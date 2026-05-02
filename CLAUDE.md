# GolfWizard

Vue 3 + Vite + Pinia + Supabase. iOS PWA primary surface. Friends-first scoring + side-game settlement; public App Store launch later.

---

## Working with Jason

- Be concise. No fluff, apologies, or trailing summaries.
- Code answers: snippets / patches, not full files. Don't paste back code I just wrote.
- Use tables for comparisons.
- Calculations: code execution, not text.
- Blunt tone. Push back on inefficient workflows; don't proceed silently with the slower path.
- Terminal usage: one command at a time, plain English explanation, never multi-line with comments (Jason pastes literally).
- Warn proactively when the session gets long (>3 deploys, large files re-read, responses slowing) — suggest a fresh chat. Memory in `CLAUDE.md` carries context.

### Hard rules

| Rule | Why |
|---|---|
| Never use subagents to write `package.json` or any JSON config | Subagents have written `<tool_call_file_content>` XML markup into `package.json` and broken the build with EJSONPARSE. |
| Never trust subagent or `mcp__github__search_code` for "does X exist?" audits | GitHub search rate-limits and silently returns false negatives. On 2026-04-25 a subagent audit returned ~15 false NOT FOUND results — almost everything was actually built. Always clone + grep directly. |
| Always run `engineering:deploy-checklist` before any deploy | Past incidents (deploy loop creating 400+ commits, version jumping to 499, wrong repo pushed) were preventable with a pre-deploy step. Don't ask — just run it. |
| Never deploy game logic changes without Jason's per-game sign-off | Game audit spec (16 tasks) is frozen. See "Game audit" section. |
| If a screenshot contradicts your audit, trust the screenshot | Re-run audit with direct grep before claiming anything is missing. |

---

## Stack

| | |
|---|---|
| Frontend | Vue 3 + Vite + Pinia + vue-router |
| Backend | Supabase project `mhzhdmsiliyfnijzddhu` (https://mhzhdmsiliyfnijzddhu.supabase.co) |
| Auth | Supabase Auth (email OTP / magic link) |
| Edge fns | Deno on Supabase Functions |
| State | Pinia stores: `roster.js`, `rounds.js`, `auth.js`, `linkedMatches.js`, `tournament.js`, `challenges.js`, `courses.js` |
| Hosting | GitHub Pages via Actions on push to `main` |
| Repo | `k269x9xzcd-bot/golfwizard` |
| Live URL | https://k269x9xzcd-bot.github.io/golfwizard |
| Custom domain | golfwizard.net (purchased for Resend email; DNS pending) |
| Email | Resend on golfwizard.net (sender `noreply@golfwizard.net`) |
| Sentry | Wired in `main.js` + `.env.example` |

### Key tables

`roster_players`, `rounds`, `round_members`, `scores`, `game_configs`, `round_settlements`, `linked_matches`, `bb_member_index`, `ghin_index_cache`, `profiles`.

### Repo layout

```
src/
  views/            HomeView, ScoringView, HistoryView, MetricsView,
                    PlayersView, CoursesView, SettingsView,
                    LinkedMatchSetup/Accept/Detail, TournamentView,
                    InviteWelcome, PlayerCoursesView
  components/       WizardOverlay (~101KB), GhinSheet, PlayerSheet,
                    PlayerEditModal, ScorecardGrid
  components/ui/    Sheet, Card, ListItem, Avatar, Pill, Toggle, Badge,
                    AppHeader (built but unused)
  stores/           roster, rounds, auth, linkedMatches, tournament,
                    challenges, courses
  modules/          gameEngine, settlements, courses (GAME_DEFS),
                    nicknames, scorecardShare, supaRaw, supabaseOps,
                    preset
  composables/      useScorecard, useGameNotation, useLiveSettlements,
                    usePlayerSearch, useScorecardHelpers
  styles/           ScoringView.css (62KB)
  style.css         design system v2 tokens (--gw-*)
scripts/deploy.js   pull + bump + build + push
supabase/functions/ ghin-player-search, ghin-sync, ghin-roster-sync,
                    invite-player, ghin-scores, ghin-lookup
```

### Large files (push via terminal git, not GitHub MCP)

- `src/components/WizardOverlay.vue` — ~101KB
- `src/views/ScoringView.vue` — ~64KB after ADR-003 split (was 170KB)
- `src/views/PlayersView.vue` — ~86KB
- `src/styles/ScoringView.css` — ~62KB

GitHub MCP `push_files` truncates over ~40-50KB. CI threshold currently blocks `.vue > 110KB`.

---

## Deploy

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeAI/GolfWizard/GolfWizard/gw
npm run deploy
```

`scripts/deploy.js` does: remove stale `.git/*.lock` → `git pull --rebase --autostash` → bump patch in `package.json` → `vite build` → commit → push. GitHub Actions handles the Pages publish.

**Always run `engineering:deploy-checklist` first.**

If `.git/index.lock` survives a Ctrl-C, Jason removes it manually before retrying.

---

## iOS PWA stuck-socket pattern — **READ BEFORE TOUCHING ANY DATA WRITE**

iOS 18.7 WKWebView holds dead HTTP/2 sockets in its connection pool after backgrounding/wake. supabase-js's internal `fetch` reuses pooled connections. AbortController on the SJS layer doesn't kill the underlying socket cleanly. Result: the first request after wake queues behind a zombie and never returns. Spinner never resets. User sees "Adding…" / "Saving…" forever.

**Symptoms in the wild:**
- Stephen Virgilio favorite toggle reverting (Apr 30)
- GHIN search hang on Brendan Lavelle (Apr 30 → fixed v3.10.216)
- Anthony Caggiano "Adding…" hang (May 2 → fixed v3.10.222)
- Edit Player save sometimes drops GHIN # (Todd Boccabella null — open)

### Helpers — already in repo

```js
// src/modules/supabaseOps.js
supaCall(label, promise, ms = 8000)              // race vs timeout, throws on timeout
supaCallWithRetry(label, buildPromise, ms = 8000) // one auto-retry on timeout

// src/modules/supaRaw.js — bypass SJS entirely with raw fetch
//   keepalive:false + AbortController + cache-bust → forces fresh socket
supaRawInsert(table, row, ms = 10000)
supaRawUpdate(table, filter, patch, ms = 10000)
supaRawDelete(table, filter, ms = 8000)
supaRawSelect(table, query, ms = 8000)
supaRawRequest(method, pathAndQuery, body, ms, extraHeaders)
supaPreflightOk(ms = 3500)                       // tiny probe — confirms pool is alive
```

### The pattern to apply for any write

```js
import { supaCall } from '@/modules/supabaseOps'
import { supaRawInsert } from '@/modules/supaRaw'

let data, error
try {
  ;({ data, error } = await supaCall('roster.add',
    supabase.from('roster_players').insert(row).select().single(),
    5000
  ))
} catch (timeoutErr) {
  console.warn('[roster.add] SJS timeout, raw fallback')
  const rows = await supaRawInsert('roster_players', row, 8000)
  data = Array.isArray(rows) ? rows[0] : rows
}
```

For edge-fn invokes, wrap with `Promise.race` + 5–8s timeout (pattern in `PlayersView.vue` ~line 1109).

### What NOT to do

- Don't roll back optimistic state on timeout. Timeout ≠ failure on iOS PWA. Keep the optimistic value.
- Don't lower SJS timeout below 4s — legit slow networks will trigger false positives.
- Don't auto-retry hung writes that aren't idempotent — duplicates side effects.
- Don't try to "patch" supabase-js — patches blow away on upgrade.

### Prevention layer (planned v3.10.223)

Wake-probe on `visibilitychange` → `supaPreflightOk(3500)` → if it fails, recreate the SJS client. See "Open work" below.

---

## v3.10.222 — IN FLIGHT — iOS stuck-socket sweep + addPlayer hang fix

The Caggiano "Adding…" hang on May 2 was the trigger. Audit identified 13 unprotected writes + 8 unprotected edge-fn invokes across the codebase. Fix the high-impact ones in one bundle.

### Apply the SJS-timeout + supaRaw fallback pattern at:

| File:line | Operation |
|---|---|
| `src/stores/roster.js:198` | `addPlayer` insert + 23505 conflict-recovery update path |
| `src/stores/roster.js:334` | `deletePlayer` |
| `src/stores/roster.js:363` | bulk `addPlayers` insert (cross-match import) |
| `src/stores/rounds.js:795` | `game_configs` delete |
| `src/stores/rounds.js:811` | `rounds.date` update (edit round date) |
| `src/stores/rounds.js:839` | `round_members` insert (mid-round add player) |
| `src/stores/rounds.js:1007` | `round_settlements` upsert |
| `src/stores/linkedMatches.js:248` | `round_settlements` upsert |
| `src/views/ScoringView.vue:2061` | `round_members.ghin_index` update (HCP editor) |
| `src/views/ScoringView.vue:2074` | `round_members.stroke_override` update |

### Wrap edge-fn invokes with `Promise.race` + 5–8s timeout:

```
src/composables/usePlayerSearch.js:161, 229
src/components/WizardOverlay.vue:1775
src/views/SettingsView.vue:266, 322
src/views/PlayersView.vue:809, 1602
src/views/InviteWelcome.vue:254
```

### Bonus diagnostic for addPlayer

```js
// roster.js addPlayer — before insert
console.log('[addPlayer payload]', {
  name: row.name,
  ghin_number: row.ghin_number,
  ghin_index: row.ghin_index,
  club_name: row.club_name,
})
```

Confirms BB-list selection populates `ghin_number` + `club_name` in the payload. Caggiano case showed all GHIN data IS being passed — hang was purely the network call.

### Tier 3 — defer (low frequency, startup paths only)

- `auth.js:338` (first sign-in roster bulk insert)
- `courses.js:461` (save course — rare)
- `rounds.js:155, 583, 719` (already in `Promise.all` — verify timeout exists)
- `LinkedMatchAccept.vue:386` (cross-match accept)
- `InviteWelcome.vue:248` (onboarding)

### Verification

- Bump version (deploy script does this)
- Smoke test: background PWA 60s → wake → add player → should not hang
- Watch console for `[addPlayer payload]` and `[*] SJS timeout, raw fallback` lines

---

## GHIN API contract — read before debugging GHIN

GHIN's API is undocumented and unofficial. They've changed param requirements twice (Apr 29 and Apr 30). Always re-verify with the test edge fn before assuming yesterday's contract holds.

### Endpoints

Base: `https://api2.ghin.com/api/v1`

| Endpoint | Purpose |
|---|---|
| `POST /golfer_login.json` | Firebase token + creds → `golfer_user_token` bearer |
| `GET /golfers.json?global_search=true&search={last}&first_name={first}&page=1&per_page=25` | Name search (returns MASKED `ghin`, UNMASKED `club_id` + `club_affiliation_id`) |
| `GET /clubs/{club_id}/golfers.json?last_name=X&per_page=200&page=1` | Per-club list — `id` field = UNMASKED real GHIN # |
| `GET /golfers.json?golfer_id={ghin}&from_ghin=true&per_page=25&page=1&status=Active` | Single-golfer lookup (full unmasked record) |

### Auth — 3 hops

1. Firebase Installation → `authToken.token`. Constants: project `ghin-mobile-app`, API key `AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I`, app ID `1:884417644529:web:47fb315bc6c70242f72650`. Body `{ fid, appId, authVersion: 'FIS_v2', sdkVersion: 'w:0.5.7' }`.
2. `POST /golfer_login.json` headers `Content-Type: application/json`, `source: GHINcom`. Body `{ token: <firebase>, user: { email_or_ghin, password } }`. Response `golfer_user.golfer_user_token`.
3. All subsequent calls: `Authorization: Bearer <token>`, `source: GHINcom`.

**Use the caller's GHIN credentials**, not a shared service account. The shared `GHIN_PUBLIC_USER` got rate-limited / demoted Apr 29.

### Search — required params

- `global_search=true` (only mode that works cross-club)
- `search=<last>` (required — 400 "search param is not present" if missing)
- `first_name=<prefix>` (server-side prefix-matched — "Bren" finds Brendan)
- `page=1` (required — 400 "errors.page can't be blank" if missing)
- `per_page=25`

### Two-step unmask

Name search returns masked `ghin: "1*****1"`. To save a real GHIN # to roster, group results by `club_id`, fire `clubResolve()` per club, build a Map keyed by `club_affiliation_id` → unmasked record. Edge fn `ghin-player-search` v21 already does this server-side.

### Nickname expansion

`src/modules/nicknames.js` + edge fn v21 mirror a ~50-pair English nickname → formal map (Nick→Nicholas/Nicolas, Bob→Robert, Bill→William, Mike→Michael, etc). When typed first name yields 0 results, edge fn retries in parallel with formal forms. Dedupes by `club_affiliation_id`.

### Frontend body shape

```json
{
  "first_name": "Brendan",
  "last_name": "Lavelle",
  "ghin_number": "<callers ghin>",
  "password": "<callers password>"
}
```

Frontend min-input: both first AND last ≥ 2 chars. Debounce 350ms. Hard 8s overall ceiling.

### Edge fn versions

| Fn | Version | Status |
|---|---|---|
| `ghin-player-search` | v21 | Live, healthy. Caller creds + nickname expansion + club-resolve. |
| `ghin-name-search-test` | v27 | Test/diagnostic only — can be deleted |
| `ghin-sync` | v16 | Nightly handicap refresh (`/golfers.json?golfer_id=`) |
| `ghin-roster-sync` | (current) | Bulk roster GHIN refresh |
| `invite-player` | (current) | Supabase `inviteUserByEmail` wrapper |
| `ghin-lookup`, `ghin-scores` | (current) | Per-golfer detail / score history |

### Known masked test cases

| Name | Club | Real GHIN # |
|---|---|---|
| Stephen Virgilio (Active) | Plandome CC | 1829951 |
| Stephen Virgilio (Inactive) | Plandome CC | 1763265 |
| Brendan Lavelle | Winged Foot | (3 results) |

### Don't do

- Don't use `last_name=X` without `search` — 400.
- Don't use SQL `%` wildcards — 400.
- Don't store masked GHINs (`1*****1`) in DB. Either resolve or save name+club only with `ghin_number=null`.
- Don't search on every keystroke — debounce ≥350ms.

---

## Game definitions — manual sync required

`src/modules/courses.js` (GAME_DEFS info button text) is **not auto-generated** from `src/modules/gameEngine.js`. Any time engine behavior changes, update GAME_DEFS in the same commit.

After ANY engine change, ask: "Do you want me to update the GAME_DEFS info button text to reflect this change?" Don't skip.

### Game types implemented (engine + settlements)

Nassau, Skins, Match, BestBall, BestBallNet, Snake, Vegas, HiLow, Stableford, Wolf, Hammer, Sixes, FiveThreeOne (a.k.a. 9s), Dots, Fidget, BBB, Scotch6s, TeamDay.

### Game audit spec — 16 tasks, FROZEN, **DO NOT DEPLOY without per-game sign-off**

Phase 1 (quick wins): Tasks 1, 2, 4, 5, 11, 16
Phase 2 (engine + wizard): Tasks 3, 6, 7, 9, 10, 14, 15
Phase 3 (new UI): Tasks 8, 12, 13

Highlights:
- Task 7 Wolf: wolf-order toggle (first/last), lone 4x / blind 8x adjustable, **remove lastPlaceWolf entirely**, carryover-on-tie option carries POINT VALUE not team.
- Task 8 Hammer: full rebuild — live button in hole banner, state machine `hammerLog[hole]`, realtime accept/decline modal, both team members can write.
- Task 10: rename 5-3-1 → "9s" everywhere. 3-player only. BirdieDouble variant. Pairwise settlement.
- Task 11 + 16: hide BestBall (Team), Scotch6s, TeamDay from wizard. Keep engines, mark `hidden: true` in GAME_DEFS.
- Task 12 Dots/Junk: Junk Sheet bottom sheet after hole save. Big Three on by default.
- Task 13 BBB: BBB strip on hole detail, sweep button, double-bongo variant.

Full spec: see git history for `project_game_audit_spec.md` content, or ask Jason.

---

## Open work — current state (post v3.10.222)

| Priority | Item | Notes |
|---|---|---|
| **High** | Verify v3.10.222 fixes Caggiano + sweep — smoke test add/edit/delete after backgrounding PWA 60s | Just shipped |
| **High** | Verify Edit Player save persists GHIN # — try Todd Boccabella (id `472b69ca-b48a-46b0-8027-b44d9ece2953`, ghin_number still null) | Diagnostic logs from v3.10.212 should fire |
| High | v3.10.223 — wake-probe on `visibilitychange` + `resetSupabaseClient()`. After 30s+ background, fire `supaPreflightOk(3500)`; if it fails, recreate the SJS client before user touches anything. | Architectural prevention, not patch |
| High | Shared-roster banner on Home — when sharing a roster, in addition to email, show in-app accept banner. Migration: `roster_shares` table + RLS. Sender writes share row + email. Recipient HomeView banner queries `WHERE recipient_id = me AND status='pending'`. Accept dedupes by `ghin_number` then `(name+email)`. | Not started; see design notes below |
| High | Nightly GHIN handicap refresh — new `ghin-roster-refresh` edge fn + Supabase pg_cron | Not built |
| Medium | Solo recap broken in prod (issue #4) | Open since Apr 28 |
| Medium | Cross-match polish: B3 (settlement doesn't recompute on score edits after both rounds complete), B5 (cancel doesn't notify Team B), UX5 (per-player breakdown), UX7 (live mid-round preview) | |
| Medium | Security audit FIX-3 (auth check on `ghin-roster-sync` inline player path), FIX-9 (remove real emails from `DEFAULT_PLAYERS` + `PRESET_PLAYERS`) | Apr 29 audit, rollback at v3.10.188 |
| Medium | WizardOverlay.vue split (101KB → <100KB so CI threshold can drop) | Follow-up to ADR-003 |
| Low | Game audit spec (16 tasks) | Frozen — needs per-game sign-off |
| Low | Replace `.view-header` markup with `<AppHeader>` component | Zero user-visible change |
| Low | DNS records for Resend → golfwizard.net → update Supabase SMTP sender to `noreply@golfwizard.net` | |

### Shared-roster banner — design

| Piece | Detail |
|---|---|
| Schema | `roster_shares (id, sender_id, recipient_email, recipient_id nullable, players_json snapshot, status enum pending/accepted/declined/expired, created_at, accepted_at)` |
| RLS | Sender writes; recipient reads/updates own (matched on `recipient_id` after auth, fallback `recipient_email = auth.email`) |
| Resolve | On sign-in, `claim-roster-shares` edge fn matches `recipient_email = auth.email` → sets `recipient_id` |
| Banner | HomeView computed `pendingRosterShares`. Copy: "📋 Jason shared 12 players — Add to my roster" |
| Accept | `acceptRosterShare(shareId)` → for each player in snapshot: dedup by `ghin_number` (primary) → `(lower(name) + email)` (secondary) → upsert with `is_favorite=true`. Mark share `accepted` |
| Avoid | Don't write into recipient's roster from sender's session — RLS nightmare + no consent. Always recipient-initiated. |

---

## Sandbox SQL fixes already applied (don't re-do)

```sql
-- Nick Boccabella roster row patched May 1
UPDATE roster_players
SET ghin_number='6438823', ghin_index=6.9,
    club_name='Dunes West Golf Club', ghin_synced_at=NOW()
WHERE id='4b67a8a4-bc28-4d22-bf49-f26f7b3b4318';

-- Brian Cimons + Jeremy Court linked to user_id, GHIN # set, favorited (Apr 29)

-- RLS policy added Apr 29:
CREATE POLICY roster_update_self_link ON roster_players
  FOR UPDATE
  USING (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email') AND user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
```

---

## Tech debt status

✅ Done: scoring.js (7,097 lines), gameLogic.js (342 lines), 14 legacy HTML files, two-git-repo problem, BBB/Scotch6s/TeamDay engine port, Sentry, gameEngine tests (50/50 passing), ScoringView split (170KB→64KB).

🔲 Open: WizardOverlay split, supaRaw.js + supabaseOps.js consolidation (low priority).

---

## Players (Jason's group — for context only, never used as data)

Jason's regular group: Spieler (Jason), Carroll, Waters, Derosa, Shpiz, Durkin, Boccabella (Nick + Todd), Cimons (Brian), Court (Jeremy), Caggiano (Anthony), Chen (Shang), Lavelle (Brendan), Virgilio (Stephen).

Plays at Bonnie Briar Country Club primarily. `bb_member_index` table holds the BB roster for fast local search before falling back to GHIN API.

---

## ADR-003 — workspace migration (DONE 2026-04-21)

- Single canonical repo at `~/Library/Mobile Documents/com~apple~CloudDocs/ClaudeAI/GolfWizard/GolfWizard/gw` — has `.git`
- Old Desktop copy purged; project lives in iCloud Drive under ClaudeAI/ folder
- ScoringView.vue split: 166KB → 64KB (extracted `useScorecardHelpers`, `useGameNotation`, `useLiveSettlements`, `GameEditorOverlay`, `RetroScoreOverlay`, `ScoringView.css`)
- CI gate: `.vue > 110KB` blocks deploy (110 to accommodate WizardOverlay at 101KB)
- Rollback anchor: tag `v3.9.569-pre-adr003`

---

## Engineering plugin skills installed

- `engineering:deploy-checklist` — **automatic before every deploy**
- `engineering:code-review` — before major deploys (3+ files, new modules, store changes)
- `engineering:debug` — when something is broken
- `engineering:tech-debt` — periodic, not automatic
- `frontend-design` skill from anthropic-skills — apply for any UI / view / styling work on GolfWizard

---

## Quick reference

| | |
|---|---|
| Live | https://k269x9xzcd-bot.github.io/golfwizard |
| Repo | github.com/k269x9xzcd-bot/golfwizard |
| Supabase project | mhzhdmsiliyfnijzddhu |
| Current version | v3.10.221 (origin) → v3.10.222 in flight |
| Deploy | `cd ~/Desktop/GolfWizard/GolfWizard/src && npm run deploy` |
| CI | https://github.com/k269x9xzcd-bot/golfwizard/actions |
| Domain | golfwizard.net (DNS → Resend pending) |
| Tests | `npm test` (vitest, 50 game-engine tests) |
| Dev | `npm run dev` → iPhone on local Wi-Fi for live PWA testing |
