/**
 * memberNameResolver — pick the best "source name string" for initials.
 *
 * Why: round_member rows from a roster pick land with short_name="Spieler"
 * (last name only) and guest_name=null, so the existing 1-word fallback
 * produces "SP" (first 2 of last name). Same player added as a guest with
 * full name "Jason Spieler" produces "JS". This function reconciles those
 * paths by reaching into roster_players / auth.profile to recover the full
 * "First Last" string when the round_member row only has a short_name.
 *
 * Pure helper — no Vue/Pinia imports. Caller passes in the data.
 */

function trimOrNull(s) {
  return typeof s === 'string' && s.trim() ? s.trim() : null
}

function joinFirstLast(first, last) {
  const f = trimOrNull(first)
  const l = trimOrNull(last)
  if (f && l) return `${f} ${l}`
  return null
}

/**
 * @param {object}   member       round_member row { profile_id, email, guest_name, name, short_name, ... }
 * @param {object} [opts]
 * @param {Array}  [opts.rosterPlayers]  in-memory roster_players rows
 * @param {object} [opts.authUser]       { id } — current authenticated user
 * @param {object} [opts.authProfile]    { first_name, last_name, display_name }
 * @returns {string} best source name (full "First Last" preferred over short_name)
 */
export function resolveMemberSourceName(member, opts = {}) {
  if (!member) return ''
  const { rosterPlayers = [], authUser = null, authProfile = null } = opts

  // 1. profile-linked: if it's the current user, prefer their auth profile.
  if (member.profile_id && authUser?.id && member.profile_id === authUser.id && authProfile) {
    const fl = joinFirstLast(authProfile.first_name, authProfile.last_name)
    if (fl) return fl
    const dn = trimOrNull(authProfile.display_name)
    if (dn) return dn
  }

  // 2. roster match — by user_id (profile_id) or email (case-insensitive).
  const memberEmail = trimOrNull(member.email)?.toLowerCase()
  const roster = rosterPlayers.find(p => {
    if (member.profile_id && p.user_id && p.user_id === member.profile_id) return true
    if (memberEmail && p.email && trimOrNull(p.email)?.toLowerCase() === memberEmail) return true
    return false
  })
  if (roster) {
    const fl = joinFirstLast(roster.first_name, roster.last_name)
    if (fl) return fl
    const fullName = trimOrNull(roster.name)
    // Use roster.name only if it contains a space (i.e., First Last). short_name
    // alone wouldn't help — we already get that from member.short_name.
    if (fullName && /\s/.test(fullName)) return fullName
  }

  // 3. fallback to existing chain.
  return trimOrNull(member.guest_name) || trimOrNull(member.name) || trimOrNull(member.short_name) || ''
}
