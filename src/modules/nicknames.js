/**
 * Common English nickname → formal name expansions.
 * Used by GHIN search to retry with formal forms when nickname yields 0 results.
 *
 * Map values are arrays — order matters (try most-common first).
 * Bidirectional: a typed nickname expands to formal forms (and a typed formal
 * name expands to common nickname forms — useful when GHIN stores the
 * nickname instead).
 */

// Single source: nickname → array of likely formal names
const NICK_TO_FORMAL = {
  // Common male
  bob: ['Robert', 'Roberto'],
  rob: ['Robert', 'Roberto'],
  robbie: ['Robert', 'Roberto'],
  bill: ['William'],
  billy: ['William'],
  will: ['William', 'Wilson'],
  willy: ['William'],
  dick: ['Richard'],
  rick: ['Richard'],
  ricky: ['Richard'],
  rich: ['Richard'],
  jim: ['James'],
  jimmy: ['James'],
  jimbo: ['James'],
  jay: ['James', 'Jason', 'Jayson'],
  joe: ['Joseph'],
  joey: ['Joseph'],
  mike: ['Michael'],
  mick: ['Michael'],
  mickey: ['Michael'],
  mitch: ['Mitchell'],
  nick: ['Nicholas', 'Nicolas', 'Nikolai'],
  nico: ['Nicholas', 'Nicolas'],
  nate: ['Nathan', 'Nathaniel'],
  pat: ['Patrick', 'Patricia'],
  paddy: ['Patrick'],
  rich: ['Richard'],
  steve: ['Steven', 'Stephen'],
  stevie: ['Steven', 'Stephen'],
  tom: ['Thomas'],
  tommy: ['Thomas'],
  tony: ['Anthony', 'Antonio'],
  dan: ['Daniel'],
  danny: ['Daniel'],
  dave: ['David'],
  davey: ['David'],
  ed: ['Edward', 'Edwin', 'Edgar'],
  eddie: ['Edward'],
  ted: ['Theodore', 'Edward'],
  teddy: ['Theodore', 'Edward'],
  hank: ['Henry'],
  harry: ['Harold', 'Henry'],
  jack: ['John', 'Jackson'],
  johnny: ['John', 'Jonathan'],
  jon: ['Jonathan', 'John'],
  jonny: ['Jonathan', 'John'],
  ken: ['Kenneth'],
  kenny: ['Kenneth'],
  larry: ['Lawrence', 'Laurence'],
  matt: ['Matthew'],
  matty: ['Matthew'],
  alex: ['Alexander', 'Alejandro'],
  al: ['Albert', 'Alan', 'Alfred', 'Alexander'],
  andy: ['Andrew', 'Anders'],
  drew: ['Andrew'],
  art: ['Arthur'],
  artie: ['Arthur'],
  ben: ['Benjamin', 'Benedict'],
  benny: ['Benjamin'],
  charlie: ['Charles'],
  chuck: ['Charles'],
  chris: ['Christopher', 'Christian'],
  topher: ['Christopher'],
  greg: ['Gregory'],
  gus: ['Augustus', 'Gustav'],
  jerry: ['Gerald', 'Jerome', 'Jeremy'],
  les: ['Leslie', 'Lester'],
  marv: ['Marvin'],
  max: ['Maxwell', 'Maximilian'],
  pete: ['Peter'],
  ron: ['Ronald'],
  ronnie: ['Ronald'],
  sam: ['Samuel', 'Samantha'],
  sammy: ['Samuel'],
  vic: ['Victor'],
  vince: ['Vincent'],
  walt: ['Walter'],
  wes: ['Wesley'],
  zack: ['Zachary'],
  zach: ['Zachary'],
  // Common female
  abby: ['Abigail'],
  becky: ['Rebecca'],
  beth: ['Elizabeth'],
  betsy: ['Elizabeth'],
  betty: ['Elizabeth'],
  cathy: ['Catherine', 'Katherine'],
  kate: ['Katherine', 'Kathleen'],
  katie: ['Katherine', 'Kathleen'],
  kathy: ['Katherine', 'Kathleen'],
  kim: ['Kimberly'],
  liz: ['Elizabeth'],
  lizzy: ['Elizabeth'],
  maggie: ['Margaret'],
  meg: ['Margaret', 'Megan'],
  peggy: ['Margaret'],
  sue: ['Susan'],
  susie: ['Susan'],
  trish: ['Patricia'],
}

/**
 * Given a typed first name, return alternate forms to also search.
 * Returns array (may be empty). Original input is NOT included — caller
 * decides whether to combine.
 *
 * Examples:
 *   expandFirstName('nick') -> ['Nicholas', 'Nicolas', 'Nikolai']
 *   expandFirstName('Bob') -> ['Robert', 'Roberto']
 *   expandFirstName('Stephen') -> []  (no expansion needed)
 */
export function expandFirstName(typed) {
  if (!typed) return []
  const key = typed.trim().toLowerCase()
  return NICK_TO_FORMAL[key] || []
}

export default { expandFirstName }
