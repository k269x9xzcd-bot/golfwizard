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

export const PRESET_ID = 'bonnie-boyz-2026'

export const PRESET_PLAYERS = [
  { name: 'Alex Carroll',  short_name: 'AC', ghin_index: 4.0,  nickname: 'Al',     use_nickname: true,  is_favorite: true,  email: 'alexcarroll333@gmail.com' },
  { name: 'Andy Shpiz',    short_name: 'AS', ghin_index: 6.0,  nickname: null,      use_nickname: false, is_favorite: true,  email: null },
  { name: 'Brian Cimons',  short_name: 'BC', ghin_index: 6.0,  nickname: 'Brian',  use_nickname: false, is_favorite: true,  email: 'bcimons19@yahoo.com' },
  { name: 'Chris Raggo',   short_name: 'CR', ghin_index: 4.0,  nickname: 'Chris',  use_nickname: false, is_favorite: true,  email: 'craggo@recordandreturn.com' },
  { name: 'Harry Spadaro', short_name: 'HS', ghin_index: 15.0, nickname: null,      use_nickname: false, is_favorite: true,  email: 'Harrypspadaro@gmail.com' },
  { name: 'Jason Spieler', short_name: 'JS', ghin_index: 10.0, nickname: 'Spiels', use_nickname: true,  is_favorite: true,  email: 'jayspieler@aol.com' },
  { name: 'Jeremy Court',  short_name: 'JC', ghin_index: 5.0,  nickname: 'Jeremy', use_nickname: false, is_favorite: true,  email: 'jcourt93@gmail.com' },
  { name: 'Joe Tomei',     short_name: 'JT', ghin_index: 14.0, nickname: null,      use_nickname: false, is_favorite: true,  email: 'joertomei@gmail.com' },
  { name: 'Marty Durkin',  short_name: 'MD', ghin_index: 7.0,  nickname: 'Marty',  use_nickname: false, is_favorite: true,  email: 'martydurkin17@verizon.net' },
  { name: 'Sam Waters',    short_name: 'SW', ghin_index: 5.0,  nickname: null,      use_nickname: false, is_favorite: true,  email: 'sam.waters.80@gmail.com' },
  { name: 'Shang Chen',    short_name: 'SC', ghin_index: 7.0,  nickname: 'Wang',   use_nickname: true,  is_favorite: true,  email: 'bonga13@gmail.com' },
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

/**
 * Seed the preset into guest/local storage. Safe to call on every app load
 * with a preset param — only seeds once (tracked by SEEDED_KEY).
 * @param {boolean} force — re-seed even if already seeded (for re-invites)
 */
export function applyPreset(force = false) {
  if (!force && localStorage.getItem(SEEDED_KEY) === PRESET_ID) return false

  // Seed players into local roster
  const existing = JSON.parse(localStorage.getItem('gw_roster_players') || '[]')
  const existingNames = new Set(existing.map(p => p.name))
  const toAdd = PRESET_PLAYERS.filter(p => !existingNames.has(p.name)).map(p => ({
    ...p,
    id: `preset_${p.short_name}_${Date.now()}`,
    owner_id: null,
    created_at: new Date().toISOString(),
  }))
  const merged = [...existing, ...toAdd]
  localStorage.setItem('gw_roster_players', JSON.stringify(merged))

  // Seed course into local custom courses
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
  const favCourses = JSON.parse(localStorage.getItem('gw_favorite_courses') || '[]')
  if (!favCourses.includes(PRESET_COURSE.name)) {
    favCourses.unshift(PRESET_COURSE.name)
    localStorage.setItem('gw_favorite_courses', JSON.stringify(favCourses))
  }

  // Mark all preset players as favorites
  const favPlayers = JSON.parse(localStorage.getItem('gw_favorite_roster_players') || '[]')
  for (const p of PRESET_PLAYERS) {
    if (!favPlayers.includes(p.name)) favPlayers.push(p.name)
  }
  localStorage.setItem('gw_favorite_roster_players', JSON.stringify(favPlayers))

  localStorage.setItem(SEEDED_KEY, PRESET_ID)
  return true // indicates seed was applied
}

/**
 * Build a shareable invite URL that opens GolfWizard with the preset.
 */
export function buildInviteUrl() {
  if (typeof window === 'undefined') return `#/invite?preset=${PRESET_ID}`
  const origin = window.location.origin + window.location.pathname.replace(/\/+$/, '')
  return `${origin}#/invite?preset=${PRESET_ID}`
}

/**
 * Compose a mailto: link for inviting a specific player.
 * @param {object} player — { name, email }
 * @param {string} senderName — display name of the host
 */
export function buildInviteEmail(player, senderName = 'Jason') {
  const url = buildInviteUrl()
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
