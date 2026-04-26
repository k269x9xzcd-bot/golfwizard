# GolfWizard Changelog

All notable changes. Newest first.
Convention: add a block here before every `git push`.

---

## [3.10.98] - 2026-04-25
### Changed
- SettingsView: hide sync button; auto-sync + roster_players update on credential save

## [3.10.97] - 2026-04-25
### Added
- Confirm dialog when skipping GHIN setup during onboarding

## [3.10.96] - 2026-04-25
### Changed
- YOU card: show full name, remove GHIN#/synced text, keep sync dot

## [3.10.95] - 2026-04-25
### Added
- Invite URL includes GHIN#, pre-fills GHIN step on join
- Updated preset HI values; added ghin_number to all preset players

## [3.10.94] - 2026-04-25
### Fixed
- Missing CSS for .you-card, .ghin-sheet-btn, .player-info-btn

## [3.10.93] - 2026-04-25
### Fixed
- GHIN sheet avg/low/high and aggregate stats split into separate refs (was sharing reactive state)

## [3.10.92] - 2026-04-25
### Changed
- Split PlayersView into GhinSheet, PlayerSheet, PlayerEditModal components

## [3.10.90–91] - 2026-04-25
### Changed
- GHIN sheet updates and refinements

## [3.10.89] - 2026-04-25
### Added
- GHIN sheet redesign: hero HI display, computed trend, score stats table
- Gross + net + diff columns; handicap range strip

## [3.10.88] - 2026-04-25
### Added
- Double Fidget: restart bet when all players clear early

## [3.10.81–87] - 2026-04-25
### Fixed
- YOU card cap badges display

## [3.10.79–80] - 2026-04-25
### Added
- Golf ball PWA icons (apple-touch-icon + icon-192/512)

## [3.10.63–78] - 2026-04-25
### Changed
- Default to dark theme; hide theme toggle from UI

## [3.10.62–63] - 2026-04-25
### Added
- GHIN score history sheet with trend arrows + low HI stat
- Players tab: YOU pinned card always at top; GHIN sheet inline; HCP pill
- Light/dark theme toggle (later hidden, dark made default)

## [3.10.62] - 2026-04-25
### Fixed
- Aloha call banner always visible regardless of logged-in team

## [3.10.61] - 2026-04-25
### Fixed
- Aloha loser = team down most in total match (reverted back-9 change)

## [3.10.60] - 2026-04-25
### Fixed
- Aloha: resolve on halved h18; call banner based on back-9 not overall score

## [3.10.59] - 2026-04-25
### Changed
- Settle amounts left-aligned; stroke dots off low-man; HCP shows full + low-man delta

## [3.10.58] - 2026-04-25
### Changed
- Share text formatting; settle column inline; stroke dots preserved in screenshot capture

## [3.10.57] - 2026-04-25
### Changed
- Collision-aware initials (pInit) in low-man and 5-3-1 notation rows

## [3.10.56] - 2026-04-25
### Fixed
- Aloha showing as pending when accepted — r.aloha → r.alohaResult

## [3.10.55] - 2026-04-25
### Changed
- Notation summary row spans IN+G+N columns (merged cell)

## [3.10.54] - 2026-04-25
### Fixed
- Game notation shading/colors preserved in shared scorecard screenshots

## [3.10.53] - 2026-04-25
### Added
- Sixes per-hole enabled by default; ℹ️ info button on all side games; updated game library

## [3.10.52] - 2026-04-25
### Fixed
- Sixes rows match score row height; no dice icon; no chip text wrap

## [3.10.51] - 2026-04-25
### Fixed
- Notation result column wrapping (white-space: nowrap + min-width)

## [3.10.50] - 2026-04-25
### Changed
- Sixes notation: segment-aware layout redesign

## [3.10.49] - 2026-04-25
### Added
- Sixes: rotating team colors + colored notation chips

## [3.10.48] - 2026-04-25
### Changed
- Notation rows always expanded on load; initials shown in Sixes labels

## [3.10.47] - 2026-04-25
### Added
- Inline course setup in wizard step 1; save course as favorite from wizard

## [3.10.46] - 2026-04-25
### Fixed
- Wizard sheet no longer shrinks during player search

## [3.10.45] - 2026-04-25
### Added
- GHIN name search fallback in game setup player search

## [3.10.44] - 2026-04-25
### Fixed
- Hole view scroll position resets on hole change

## [3.10.43] - 2026-04-25
### Changed
- Score tab: smarter empty state with Start a Round CTA

## [3.10.41–42] - 2026-04-25
### Changed
- Players nav renamed to Roster; nav icon cleanup

## [3.10.40] - 2026-04-25
### Fixed
- Course delete hang: added timeout + retry + loading state

## [3.10.39] - 2026-04-25
### Added
- Course tab: birdie column, dropdown selector, persist last selected course

## [3.10.38] - 2026-04-25
### Added
- Players/Courses combined view with sub-tabs

## [3.10.35–37] - 2026-04-25
### Added
- Course tab with hole-by-hole stats
- Recent Rounds shows gross + net score
- H2H: net score W/L + money won/lost per opponent
- Stats in bottom nav; Games tab in MetricsView

## [3.10.25] - 2026-04-25
### Added
- Multi-user scoring + round switcher

## [3.10.24] - 2026-04-25
### Added
- Vegas 1-row notation; edit games wizard

## [3.10.19] - 2026-04-25
### Added
- Hammer notation; Nassau last-hole press; roster sorting
### Fixed
- Vegas notation accounting format + birdie-flip ★ detection
- HCP editor hole grid reacts to strokes override in real-time

## [3.10.15–18] - 2026-04-25
### Fixed
- Delete child rows before parent (FK CASCADE workaround)
- Performance, game settlement, notation, and UX bug sweep

## [3.10.15] - 2026-04-25
### Added
- Unified player search in wizard Step 2 (favorites + BB index + GHIN fallback)
- 5-3-1 notation auto-expand on load

## [3.10.8–14] - 2026-04-25
### Added (Wolf)
- Lowman beside button; wolf badge on own card row
- Collision-aware unique player labels; full last names everywhere
- Player cards rotate by tee order; wolfTeesFirst wired to ScoringView
- Compact wolf panel; voice scoring removed
### Fixed
- Wolf simulator gameId type coercion

## [3.10.0–7] - 2026-04-25
### Added
- Wolf game: full implementation (ID resolution, team panel, live status)
- Wolf tee order rotation; wolf badge on player name card

---

## [3.9.x] - 2026-04-22
### Added
- GPS button + yardage display (greenCoords snapshot fallback)
- 5-3-1: sweep + birdie bonus engine + wizard UI; medals, tally icons, pairwise settlement
- Sixes pairwise settlement in GamesView
- Settle Up shows before Finish Round (allScored trigger)
- GHIN aggregate stats grid (birdie/par/bogey/GIR/par3/par4/par5 as %)
- Star on HI scores; public ⛳ player sheet for any roster player with GHIN number
### Fixed
- HCP sync Promise.all fix
- Finish Round overlay close + navigate to History
- Settlement "Computing..." stuck bug
- ghin-roster-sync v24 Cloudflare proxy (resolved 503s)
- Nightly GHIN sync cron simplified to single job

## [3.10.99] - 2026-04-25
### Fixed
- Roster seed: seed key now only set after confirmed Supabase insert success; users with stuck empty roster (prior failed seed) auto-repair on next load
- Round history: on login, backfill `profile_id` on `round_members` rows matching user's email or GHIN# — all users now see rounds they played in before creating an account
