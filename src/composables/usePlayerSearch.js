import { ref, computed } from 'vue'
import { supabase } from '../supabase'

/**
 * usePlayerSearch — cascading search across roster, BB member index, and GHIN API.
 *
 * results: { roster[], bb[], ghin[] } — each entry:
 *   { id, name, shortName, ghinIndex, ghinNumber, ghinSyncedAt, isFavorite, source }
 */
export function usePlayerSearch(rosterPlayers) {
  const query = ref('')
  const bbResults = ref([])
  const ghinResult = ref(null)
  const ghinResults = ref([])  // multiple GHIN matches
  const searching = ref(false)
  const ghinUnavailable = ref(false)  // true when user has no GHIN creds in profile

  let _debounceTimer = null
  let _lastQuery = ''

  function _byLastName(a, b) {
    const lastName = n => { const parts = (n.name || '').trim().split(/\s+/); return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase() }
    const firstPart = n => (n.name || '').trim().split(/\s+/)[0].toLowerCase()
    const lastDiff = lastName(a).localeCompare(lastName(b))
    return lastDiff !== 0 ? lastDiff : firstPart(a).localeCompare(firstPart(b))
  }

  // ── Roster matches (instant, client-side) ──────────────────
  const rosterMatches = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) {
      const favs = rosterPlayers.value.filter(p => p.is_favorite).slice().sort(_byLastName)
      const others = rosterPlayers.value.filter(p => !p.is_favorite).slice().sort(_byLastName)
      const items = []
      items.push(...favs.map(p => _toResult(p, 'roster')))
      if (favs.length && others.length) items.push({ isDivider: true, id: '__divider__', label: 'All Players' })
      items.push(...others.map(p => _toResult(p, 'roster')))
      return items
    }
    return rosterPlayers.value
      .filter(p => {
        const name = p.name?.toLowerCase() || ''
        const short = p.short_name?.toLowerCase() || ''
        const nick = p.nickname?.toLowerCase() || ''
        return name.includes(q) || short.includes(q) || nick.includes(q)
      })
      .slice().sort(_byLastName)
      .map(p => _toResult(p, 'roster'))
  })

  // BB results de-duped against roster
  const bbFiltered = computed(() => {
    return bbResults.value.filter(bb => {
      if (bb.ghinNumber && rosterPlayers.value.some(p => p.ghin_number === bb.ghinNumber)) return false
      const bbNameLower = bb.name.toLowerCase()
      if (rosterPlayers.value.some(p => p.name.toLowerCase() === bbNameLower)) return false
      return true
    })
  })

  const results = computed(() => ({
    roster: rosterMatches.value,
    bb: bbFiltered.value,
    ghin: ghinResults.value.length ? ghinResults.value : (ghinResult.value ? [ghinResult.value] : []),
  }))

  const hasResults = computed(() => {
    const { roster, bb, ghin } = results.value
    return roster.length > 0 || bb.length > 0 || ghin.length > 0
  })

  // ── Query change handler (call from @input) ────────────────
  function onQueryChange(val) {
    query.value = val
    bbResults.value = []
    ghinResult.value = null
    ghinResults.value = []
    ghinUnavailable.value = false

    const q = val.trim()
    if (!q || q.length < 2) return

    clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => _runSearch(q), 300)
  }

  async function _runSearch(q) {
    if (q !== query.value.trim()) return
    _lastQuery = q
    searching.value = true
    try {
      if (/^\d{5,8}$/.test(q)) {
        await _ghinNumberLookup(q)
      } else {
        await _bbNameSearch(q)
      }
    } catch {
      // silent fail — manual entry always available
    } finally {
      if (_lastQuery === q) searching.value = false
    }
  }

  async function _bbNameSearch(q) {
    const parts = q.split(/\s+/)
    const last = parts.length > 1 ? parts[parts.length - 1] : q
    const first = parts.length > 1 ? parts[0] : ''

    const { data } = await supabase
      .from('bb_member_index')
      .select('ghin_number, first_name, last_name, handicap_index')
      .ilike('last_name', `%${last}%`)
      .order('last_name')
      .limit(20)

    if (!data || _lastQuery !== query.value.trim()) return

    let filtered = data
    if (first) {
      const fl = first.toLowerCase()
      const exact = filtered.filter(p => p.first_name?.toLowerCase().startsWith(fl))
      if (exact.length > 0) filtered = exact
    }

    bbResults.value = filtered.map(bb => ({
      id: `bb_${bb.ghin_number || bb.last_name + bb.first_name}`,
      name: `${bb.first_name} ${bb.last_name}`,
      shortName: bb.last_name,
      ghinIndex: bb.handicap_index,
      ghinNumber: bb.ghin_number,
      ghinSyncedAt: null,
      isFavorite: false,
      source: 'bb',
    }))

    // If no BB results, try GHIN name search as fallback
    if (bbResults.value.length === 0 && _lastQuery === query.value.trim()) {
      await _ghinNameSearch(q)
    }
  }

  async function _ghinNameSearch(q) {
    if (_lastQuery !== query.value.trim()) return

    try {
      const { data, error } = await supabase.functions.invoke('ghin-player-search', {
        body: { query: q },
      })
      if (error) return
      if (!data?.results?.length) {
        // Edge fn returned 400 = no GHIN creds on this profile
        if (data?.error?.includes('No GHIN credentials')) ghinUnavailable.value = true
        return
      }
      if (_lastQuery !== query.value.trim()) return

      // Map to ghinResult array — filter out anyone already in the roster
      const rosterNames = new Set(rosterPlayers.value.map(p => p.name?.toLowerCase()))
      const rosterGhins = new Set(rosterPlayers.value.map(p => p.ghin_number).filter(Boolean))

      const mapped = data.results
        .filter(g => !rosterGhins.has(g.ghin_number) && !rosterNames.has(g.full_name?.toLowerCase()))
        .map(g => ({
          id: `ghin_${g.ghin_number}`,
          name: g.full_name,
          shortName: g.last_name,
          ghinIndex: g.handicap_index,
          ghinNumber: g.ghin_number,
          ghinSyncedAt: null,
          isFavorite: false,
          club: g.club_name,
          source: 'ghin',
        }))

      if (mapped.length === 1) {
        ghinResult.value = mapped[0]
      } else if (mapped.length > 1) {
        ghinResult.value = mapped[0]
        ghinResults.value = mapped
      }
    } catch { /* silent — GHIN search is best-effort */ }
  }

  async function _ghinNumberLookup(ghinNumber) {
    // Check BB index first
    const { data: bbRow } = await supabase
      .from('bb_member_index')
      .select('ghin_number, first_name, last_name, handicap_index')
      .eq('ghin_number', ghinNumber)
      .maybeSingle()

    if (_lastQuery !== query.value.trim()) return

    if (bbRow) {
      ghinResult.value = {
        id: `ghin_${ghinNumber}`,
        name: `${bbRow.first_name} ${bbRow.last_name}`,
        shortName: bbRow.last_name,
        ghinIndex: bbRow.handicap_index,
        ghinNumber: bbRow.ghin_number,
        ghinSyncedAt: null,
        isFavorite: false,
        source: 'bb',
      }
      return
    }

    // Best-effort GHIN edge function (silent fail if unavailable)
    try {
      const { data: fn } = await supabase.functions.invoke('ghin-lookup', {
        body: { ghin_number: ghinNumber },
      })
      if (_lastQuery !== query.value.trim()) return
      if (fn?.name) {
        ghinResult.value = {
          id: `ghin_${ghinNumber}`,
          name: fn.name,
          shortName: fn.last_name || fn.name.split(' ').pop(),
          ghinIndex: fn.handicap_index ?? null,
          ghinNumber,
          ghinSyncedAt: null,
          isFavorite: false,
          source: 'ghin',
        }
      }
    } catch { /* silent */ }
  }

  function clearSearch() {
    query.value = ''
    bbResults.value = []
    ghinResult.value = null
    ghinResults.value = []
    searching.value = false
    ghinUnavailable.value = false
    clearTimeout(_debounceTimer)
  }

  function _toResult(p, source) {
    return {
      id: p.id,
      name: p.name,
      shortName: p.short_name,
      ghinIndex: p.ghin_index,
      ghinNumber: p.ghin_number ?? null,
      ghinSyncedAt: p.ghin_synced_at ?? null,
      isFavorite: p.is_favorite ?? false,
      nickname: p.nickname ?? null,
      useNickname: p.use_nickname ?? false,
      profileId: p.user_id ?? null,
      email: p.email ?? null,
      source,
      _raw: p,
    }
  }

  return { query, results, hasResults, searching, ghinUnavailable, onQueryChange, clearSearch }
}
