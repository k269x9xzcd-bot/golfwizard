/**
 * preset.js — Default group preset for GolfWizard invites.
 *
 * When someone opens an invite link from jayspieler@aol.com, this preset
 * seeds their local roster + course favorites so they're ready to play
 * without any manual setup.
 *
 * Player and course data sourced from jayspieler@aol.com's live account.
 * Update this module whenever the roster or course data changes materially.
 */

// Supabase client — used for dynamic preset fetch
import { supabase } from '../supabase'

export const PRESET_ID = 'bonnie-boyz-2026'

// Cache so we only fetch once per session
let _livePlayersCache = null

export const PRESET_PLAYERS = [
  { name: 'Alex Carroll',  short_name: 'AC', ghin_index: 3.7,  ghin_number: '1312506',  nickname: 'Al',     use_nickname: true,  is_favorite: true,  email: 'alexcarroll333@gmail.com' },
  { name: 'Andy Shpiz',    short_name: 'AS', ghin_index: 4.5,  ghin_number: '6858154',  nickname: null,      use_nickname: false, is_favorite: true,  email: null },
  { name: 'Brian Cimons',  short_name: 'BC', ghin_index: 6.3,  ghin_number: '4143469',  nickname: 'Brian',  use_nickname: false, is_favorite: true,  email: 'bcimons19@yahoo.com' },
  { name: 'Chris Raggo',   short_name: 'CR', ghin_index: 4.5,  ghin_number: '712114',   nickname: 'Chris',  use_nickname: false, is_favorite: true,  email: 'craggo@recordandreturn.com' },
  { name: 'Harry Spadaro', short_name: 'HS', ghin_index: 10.9, ghin_number: '3080777',  nickname: null,      use_nickname: false, is_favorite: true,  email: 'Harrypspadaro@gmail.com' },
  { name: 'Jason Spieler', short_name: 'JS', ghin_index: 9.8,  ghin_number: '1321498',  nickname: 'Spiels', use_nickname: true,  is_favorite: true,  email: 'jayspieler@aol.com' },
  { name: 'Jeremy Court',  short_name: 'JC', ghin_index: 4.6,  ghin_number: '3370926',  nickname: 'Jeremy', use_nickname: false, is_favorite: true,  email: 'jcourt93@gmail.com' },
  { name: 'Joe Tomei',     short_name: 'JT', ghin_index: 10.0, ghin_number: '6858150',  nickname: null,      use_nickname: false, is_favorite: true,  email: 'joertomei@gmail.com' },
  { name: 'Marty Durkin',  short_name: 'MD', ghin_index: 8.3,  ghin_number: '348255',   nickname: 'Marty',  use_nickname: false, is_favorite: true,  email: 'martydurkin17@verizon.net' },
  { name: 'Matt Derosa',   short_name: 'MR', ghin_index: 6.6,  ghin_number: '3011863',  nickname: null,      use_nickname: false, is_favorite: true,  email: null },
  { name: 'Sam Waters',    short_name: 'SW', ghin_index: 7.3,  ghin_number: '1154293',  nickname: null,      use_nickname: false, is_favorite: true,  email: 'sam.waters.80@gmail.com' },
  { name: 'Shang Chen',    short_name: 'SC', ghin_index: 5.8,  ghin_number: '1243328',  nickname: 'Wang',   use_nickname: true,  is_favorite: true,  email: 'bonga13@gmail.com' },
]

// NOTE: Only the 3 tees actually set up in jayspieler@aol.com's custom course.
// SI for Blue is pending confirmation of Jason's edits — using current DB value.
// UPDATE THIS when Jason confirms the correct Blue SI holes 1-18.
export const PRESET_COURSE = {
  name: 'Bonnie Briar Country Club',
  is_favorite: true,
  tees: {
    'Blue': {
      slope: 138, yards: 6385, rating: 71.9,
      // TODO: Confirm Jason's edited Blue SI — currently using DB value.
      // Ask Jason to go to Courses → Bonnie Briar → Blue SI row and report h1-h18.
      siByHole: [4,12,18,10,14,2,16,6,8,13,3,9,1,11,17,7,5,15],
      yardsByHole: [468,341,168,366,185,403,309,408,491,202,453,333,458,320,133,525,518,304],
    },
    'White (M)': {
      slope: 132, yards: 5994, rating: 70.2,
      siByHole: [6,12,16,10,18,2,14,4,8,13,3,11,1,9,17,7,5,15],
      yardsByHole: [451,326,161,351,151,388,298,360,479,188,428,320,426,298,125,508,442,294],
    },
    'Blue/White': {
      slope: 133, yards: 6210, rating: 70.9,
      siByHole: [6,12,16,10,18,2,14,4,8,13,3,11,1,9,17,7,5,15],
      yardsByHole: [451,341,168,366,151,403,309,380,491,202,428,333,426,320,133,508,496,304],
    },
  },
  par: [4,4,3,4,3,4,4,4,5,3,4,4,5,4,3,5,5,4],
  si: [4,12,18,10,14,2,16,6,8,13,3,9,1,11,17,7,5,15],
  defaultTee: 'Blue',
}

const SEEDED_KEY = 'gw_preset_seeded'
// Keys used by the preset that must be cleaned up when a user signs in
const PRESET_LOCAL_KEYS = ['gw_roster_players', 'gw_favorite_roster_players', 'gw_favorite_courses']

/**
 * Seed the preset into guest/local storage.
 * CRITICAL: This must NEVER run when the user is authenticated — it would
 * overwrite their real Supabase-backed data with stub preset data, causing
 * the swipe/toggle features to break (fake preset IDs don't exist in Supabase).
 *
 * @param {boolean} force — re-seed even if already seeded (for re-invites)
 */
export async function applyPreset(force = false) {
  // HARD GUARD: never run if user is authenticated
  // Check the supabase-js session key directly to avoid circular imports
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null')
        if (parsed?.access_token || parsed?.currentSession?.access_token) {
          console.log('[preset] Skipping preset seed — user is authenticated')
          return false
        }
      }
    }
  } catch {}

  if (!force && localStorage.getItem(SEEDED_KEY) === PRESET_ID) return false

  // Fetch live roster from DB (public_preset_roster view, no auth needed)
  // Falls back to hardcoded PRESET_PLAYERS if fetch fails or is slow
  let players = PRESET_PLAYERS
  try {
    if (!_livePlayersCache) {
      const fetchPromise = supabase
        .from('public_preset_roster')
        .select('name, short_name, first_name, last_name, ghin_index, ghin_number, nickname, use_nickname, is_favorite, email, id')
      const timeout = new Promise(resolve => setTimeout(() => resolve({ data: null }), 3000))
      const { data } = await Promise.race([fetchPromise, timeout])
      if (data && data.length > 0) _livePlayersCache = data
    }
    if (_livePlayersCache) players = _livePlayersCache
  } catch (e) {
    console.warn('[preset] Live fetch failed, using static fallback:', e?.message)
  }

  // Seed players into local roster (guest-only storage key)
  const existing = JSON.parse(localStorage.getItem('gw_roster') || '[]')
  const existingNames = new Set(existing.map(p => p.name))
  const toAdd = players.filter(p => !existingNames.has(p.name)).map(p => ({
    ...p,
    id: p.id || `preset_${p.short_name}_${Date.now()}`,
    owner_id: null,
    created_at: new Date().toISOString(),
  }))
  if (toAdd.length) {
    localStorage.setItem('gw_roster', JSON.stringify([...existing, ...toAdd]))
  }

  // Seed course into local custom courses ONLY if not already there
  const existingCourses = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
  if (!existingCourses[PRESET_COURSE.name]) {
    existingCourses[PRESET_COURSE.name] = {
      tees: PRESET_COURSE.tees,
      teesData: PRESET_COURSE.tees,
      par: PRESET_COURSE.par,
      si: PRESET_COURSE.si,
      defaultTee: PRESET_COURSE.defaultTee,
    }
    localStorage.setItem('golf_custom_courses', JSON.stringify(existingCourses))
  }

  // Mark Bonnie Briar as a favorite course
  const favCourses = JSON.parse(localStorage.getItem('golf_favorites') || '[]')
  if (!favCourses.includes(PRESET_COURSE.name)) {
    favCourses.unshift(PRESET_COURSE.name)
    localStorage.setItem('golf_favorites', JSON.stringify(favCourses))
  }

  localStorage.setItem(SEEDED_KEY, PRESET_ID)
  return true
}

/**
 * Called when an authenticated user signs in. Clears any preset localStorage
 * keys so the authenticated user's real Supabase data takes over cleanly.
 * Safe to call on every authenticated init — checks for preset-style IDs first.
 */
export function clearPresetForAuthUser() {
  try {
    // Only remove preset_* entries (guest preset data injected by applyPreset).
    // Do NOT remove default_* entries — they are the last-resort fallback shown
    // while the authenticated Supabase fetch is in-flight. Once a successful
    // Supabase fetch completes, fetchPlayers() writes real data to gw_roster,
    // naturally overwriting any stale default_* entries.
    const roster = JSON.parse(localStorage.getItem('gw_roster') || '[]')
    const cleaned = roster.filter(p => p.id && !p.id.startsWith('preset_'))
    if (cleaned.length !== roster.length) {
      localStorage.setItem('gw_roster', JSON.stringify(cleaned))
    }
    // Do NOT clear golf_custom_courses — authenticated users might have
    // their own local custom courses saved there
    // DO clear the seeded flag so a future guest device can be seeded fresh
    localStorage.removeItem(SEEDED_KEY)
  } catch {}
}

/**
 * Build a shareable invite URL that opens GolfWizard with the preset.
 */
export function buildInviteUrl(email = '', ghinNumber = '', firstName = '', lastName = '', rid = '') {
  if (typeof window === 'undefined') return `#/invite?preset=${PRESET_ID}`
  const origin = window.location.origin + window.location.pathname.replace(/\/+$/, '')
  const emailParam = email ? `&email=${encodeURIComponent(email)}` : ''
  const ghinParam = ghinNumber ? `&ghin=${encodeURIComponent(ghinNumber)}` : ''
  const firstParam = firstName ? `&first=${encodeURIComponent(firstName)}` : ''
  const lastParam = lastName ? `&last=${encodeURIComponent(lastName)}` : ''
  const ridParam = rid ? `&rid=${encodeURIComponent(rid)}` : ''
  return `${origin}#/invite?preset=${PRESET_ID}${emailParam}${ghinParam}${firstParam}${lastParam}${ridParam}`
}

/**
 * Compose a mailto: link for inviting a specific player.
 * @param {object} player — { name, email }
 * @param {string} senderName — display name of the host
 */
export function buildInviteEmail(player, senderName = 'Jason') {
  const nameParts = (player.name || '').trim().split(/\s+/)
  const firstName = player.first_name || nameParts[0] || ''
  const lastName  = player.last_name  || nameParts.slice(1).join(' ') || ''
  const url = buildInviteUrl(player.email || '', player.ghin_number || '', firstName, lastName, player.id || '')
  const first = player.name.split(' ')[0]
  const subject = `${senderName} invited you to GolfWizard`
  const body = [
    `Hey ${first},`,
    '',
    `I've been using GolfWizard to track our rounds at Bonnie Briar — scores, Nassau/Skins/Fidget, match play, the works. I set it up so when you open the link below, your phone will have our whole group already loaded.`,
    '',
    `Open this on your iPhone and tap "Add to Home Screen":`,
    url,
    '',
    `Once it's installed, sign in with a magic link and you're good to go.`,
    '',
    `See you on the course,`,
    senderName,
  ].join('\n')
  return `mailto:${encodeURIComponent(player.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
