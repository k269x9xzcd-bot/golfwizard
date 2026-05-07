import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock supabase client — irrelevant to this test, but roster.js imports it.
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    }),
  },
}))

// Mocks for the iOS-resilience modules — these are dynamic-imported inside roster.js.
const supaCallMock = vi.fn()
const supaRawRequestMock = vi.fn()
const supaRawInsertMock = vi.fn()

vi.mock('../modules/supabaseOps', () => ({
  supaCall: (...args) => supaCallMock(...args),
  supaCallWithRetry: vi.fn(),
  debugLog: vi.fn(),
}))

vi.mock('../modules/supaRaw', () => ({
  supaRawRequest: (...args) => supaRawRequestMock(...args),
  supaRawInsert: (...args) => supaRawInsertMock(...args),
  supaRawSelect: vi.fn(async () => []),
  supaRawUpdate: vi.fn(),
  supaRawDelete: vi.fn(),
}))

import { useRosterStore } from './roster'
import { useAuthStore } from './auth'

const realPlayer = { id: '11111111-2222-3333-4444-555555555555', name: 'Test', is_favorite: false, ghin_number: '1234567' }

function setupAuthed() {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { id: 'user-1', email: 'test@example.com' }
  auth.profile = { display_name: 'Test User' }
  const roster = useRosterStore()
  roster.players.push({ ...realPlayer })
  return { auth, roster }
}

describe('updatePlayer iOS PWA resilience', () => {
  beforeEach(() => {
    supaCallMock.mockReset()
    supaRawRequestMock.mockReset()
    supaRawInsertMock.mockReset()
  })

  it('falls through to supaRawRequest when SJS update times out (multi-field edit)', async () => {
    supaCallMock.mockRejectedValue(new Error('roster.update timed out after 8000ms'))
    supaRawRequestMock.mockResolvedValue([{ ...realPlayer, name: 'Test Updated' }])

    const { roster } = setupAuthed()
    await roster.updatePlayer(realPlayer.id, { name: 'Test Updated', email: 'foo@bar.com' })

    expect(supaCallMock).toHaveBeenCalledTimes(1)
    expect(supaRawRequestMock).toHaveBeenCalledTimes(1)
    const [method, path] = supaRawRequestMock.mock.calls[0]
    expect(method).toBe('PATCH')
    expect(path).toContain(`roster_players?id=eq.${realPlayer.id}`)

    expect(roster.players[0].name).toBe('Test Updated')
  })

  it('uses supaRawRequest directly for trivial favorite toggle (skips SJS)', async () => {
    supaRawRequestMock.mockResolvedValue([{ ...realPlayer, is_favorite: true }])

    const { roster } = setupAuthed()
    await roster.updatePlayer(realPlayer.id, { is_favorite: true })

    expect(supaCallMock).not.toHaveBeenCalled()
    expect(supaRawRequestMock).toHaveBeenCalledTimes(1)
    expect(roster.players[0].is_favorite).toBe(true)
  })

  it('reverts and throws when PATCH returns 0 rows (RLS deny / silent failure)', async () => {
    // Trivial path: raw returns empty array
    supaRawRequestMock.mockResolvedValue([])

    const { roster } = setupAuthed()
    await expect(roster.updatePlayer(realPlayer.id, { is_favorite: true })).rejects.toThrow(/no rows affected/)

    // Optimistic state was reverted
    expect(roster.players[0].is_favorite).toBe(false)
  })

  it('reverts and throws when SJS+raw both return 0 rows on multi-field update', async () => {
    supaCallMock.mockRejectedValue(new Error('roster.update timed out after 8000ms'))
    supaRawRequestMock.mockResolvedValue([])

    const { roster } = setupAuthed()
    await expect(
      roster.updatePlayer(realPlayer.id, { name: 'Test Updated', email: 'foo@bar.com' })
    ).rejects.toThrow(/no rows affected/)

    expect(roster.players[0].name).toBe('Test')
    expect(roster.players[0].email).toBeUndefined()
  })

  it('keeps optimistic state when both SJS and raw fail with network error (timeout != failure on iOS)', async () => {
    supaCallMock.mockRejectedValue(new Error('roster.update timed out after 8000ms'))
    supaRawRequestMock.mockRejectedValue(new Error('PATCH timed out after 12000ms'))

    const { roster } = setupAuthed()
    // Should NOT throw — optimistic state kept for iOS PWA stuck-socket scenario
    await roster.updatePlayer(realPlayer.id, { name: 'Test Updated', email: 'foo@bar.com' })

    expect(roster.players[0].name).toBe('Test Updated')
  })
})
