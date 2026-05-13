# 14 Holes — Game Design Spec

**Date:** 2026-05-13
**Status:** Design approved by Jason, ready for implementation plan
**Type:** New game type (`type='fourteen'`) — main game in the GAME_DEFS library

---

## 1. Overview

**14 Holes** is an individual net stroke-play game played over 18 holes. Each player gets up to 4 *discards* — holes they declare won't count toward their score. Final score = sum of the 14 best net scores from the holes they kept. Lowest 14-total wins.

The twist: a player who reaches hole 18 without using all 4 discards has the app **auto-discard their best kept holes** as punishment. This forces strategic, ongoing use of discards rather than hoarding.

### Rule summary

| Rule | Detail |
|---|---|
| Round length | 18 holes only |
| Players | 2–4, individual (no teams) |
| Scoring | Full net stroke play (net = gross − allocated strokes per hole). Handicap method **configurable per game: low-man (default) or full course**. |
| Discards | Up to 4 per player. Hard cap (button disabled at 0 left). Hard floor enforced at round end via auto-discard. |
| Decision timing | Per-hole KEEP/DISCARD pill. KEEP is default. Decisions are editable any time before the round is finalized (no software lockout — pace-of-play is policed socially). |
| Auto-discard at round end | If a player has unused discards when hole 18 is scored, the app auto-discards their *best* kept holes (lowest net scores) until manual + auto discards = 4. |
| Final score | Sum of 14 remaining kept net scores. |
| Tie-handling (Pot mode) | Pot splits equally among tied lowest 14-totals. |
| Stacks with other games | Yes — runs alongside Nassau, Skins, etc. as part of the same round's `game_configs`. |
| Tournament / linked match | Out of scope. Individual game only. |

---

## 2. Goals & non-goals

**Goals (v1):**
- Ship a new playable game that fits cleanly into the existing GW framework.
- KEEP/DISCARD pill UX that's fast on a phone in a foursome on a course.
- Settlement integrates with the existing live `liveSettlements` aggregator and `betSettled` gate (no $ shown mid-round).
- History + scorecard share work correctly for completed 14 Holes rounds.

**Non-goals (v1):**
- 9-hole variant. The engine config takes `totalHoles` and `discardCount` so a future 9-hole "best 7 of 9" is straightforward, but the UI ships 18-only.
- Smart re-prompt when a player edits a score and the hole becomes a new "worst kept" candidate. Dropped from scope.
- Per-hole discard heatmap visualization in History.
- Multi-game tournament integration (the 4v4 tournament structure is structural team play; 14 Holes is individual).

---

## 3. Data model

### New column

```sql
ALTER TABLE scores
  ADD COLUMN is_discarded BOOLEAN NOT NULL DEFAULT FALSE;
```

- **Why a column on `scores`, not JSON in `game_configs.config`:** KEEP/DISCARD is a per-(player, hole) decision with the same shape as `score` itself. It inherits the existing `scores` RLS policies, gets first-class realtime via the existing subscription, and gets the iOS stuck-socket fallback pattern (`supaRaw*`) automatically. Storing in `game_configs.config` would create concurrent-write contention every time any player taps a pill (whole config row gets rewritten) and force a custom realtime channel.
- **Default `FALSE`:** existing rows backfill correctly. No data migration needed.
- **NOT NULL:** prevents tri-state confusion (null vs false). KEEP is the default; a score row's existence with `is_discarded=false` means "explicitly kept" (which is the same as "default kept" — the engine doesn't care).
- **RLS:** inherits existing `scores` policies — no new policy needed.
- **Index:** none needed for v1 (`scores` is already indexed on `round_id`; per-round filter is the only access pattern).

### Engine state

All derived. Given `scores`, `is_discarded` flags, and per-player course handicap, the engine produces final standings. No new persistent state beyond the column.

### `game_configs` row shape

Standard insert into `game_configs`:

```js
{
  type: 'fourteen',
  round_id: '<uuid>',
  config: {
    settlement: 'pot' | 'pairwise',  // default 'pot'
    pot: 20,                          // dollar ante per player when settlement === 'pot'
    ppt: 1,                           // $ per stroke when settlement === 'pairwise'
    hcpMode: 'lowMan' | 'full',      // default 'lowMan'
  }
}
```

The dedup helper from v3.10.273 (`gameConfigDedup.js`) prevents double-tap inserts.

### `round_settlements`

After round complete, the standard upsert writes a row keyed on `(round_id, game_id)` using the engine's `settlement.perPlayer` map. No schema change.

---

## 4. Engine — `computeFourteen(ctx, config)`

Lives in `src/modules/gameEngine.js`. Pure function, no Vue/Pinia imports.

### Signature

```js
computeFourteen(ctx, config) → result
```

**Inputs:**

```js
ctx = {
  members,           // array of round_member rows
  scores,            // array of score rows (incl. is_discarded)
  course,            // course data (par[], si[], etc.)
  courseHandicaps,   // resolved per-member handicap (same path as Stableford)
}

config = {
  settlement: 'pot' | 'pairwise',
  pot: number,                       // ante per player (pot mode)
  ppt: number,                       // $/stroke (pairwise mode)
  hcpMode: 'lowMan' | 'full',
}
```

**Constants baked in (not in config):** `totalHoles = 18`, `discardCount = 4`. Future 9-hole variant lives in this same function by reading `config.totalHoles ?? 18` and `config.discardCount ?? 4`, but v1 doesn't expose these.

### Algorithm

1. Resolve each player's effective handicap using `hcpMode` (existing `memberHandicap` helper, same one Stableford uses).
2. For each scored hole, compute net score per player using `strokesOnHole(courseHcp, holeSI)`.
3. For each player:
   - `manualDiscards = count(scores.is_discarded === true)`. Defensive: if > 4 due to race condition, take the *first* 4 by hole order; log warn.
   - `keptHoles = scores.where(is_discarded === false)`.
   - If `holesScored === 18` (round complete) AND `manualDiscards < 4`:
     - Sort `keptHoles` ascending by net score.
     - `autoDiscarded = keptHoles.slice(0, 4 - manualDiscards)` — the player's *best* holes.
     - `final14 = keptHoles.slice(4 - manualDiscards)` — the remaining 14.
   - Else (mid-round, `holesScored < 18`):
     - `autoDiscarded = []`
     - `final14Holes = null` — not meaningful until the round completes.
     - `total14 = null` — not displayed mid-round.
   - `runningKept = sum(keptHoles.map(h => h.net))` — always populated; used for the Game Status row mid-round.
   - `projection = runningKept + (avg(keptHoles.net) × (totalHoles - holesScored))` — for leaderboard ordering mid-round. Null if no kept holes yet.
4. Build standings sorted asc by `total14` (post-round) or `projection` (mid-round).
5. Compute settlement only when `isComplete === true`. Else `settlement: null`.

### Output

```js
{
  players: [{
    memberId, name,
    netByHole,           // { 1: 3, 2: 4, ... }
    manualDiscards,      // number (0-4)
    autoDiscarded,       // array of hole numbers (only after round complete)
    final14Holes,        // array of hole numbers (only after round complete)
    total14,             // number post-round, lower is better; null mid-round
    holesScored,
    runningKept,         // sum of kept net scores so far (always populated)
    projection,          // runningKept + (avg kept net × remaining holes); null if no kept holes yet
  }],
  standings,             // sorted asc by total14 (or projection mid-round)
  isComplete,            // bool: all 18 holes scored for all players
  settlement: {
    perPlayer: { memberId: $netDelta },  // signed; winners positive
    payouts: [{ from, to, amount }],     // pairwise transfers
  } | null,
}
```

### Settlement math

**Pot mode (default):**
- Total pot = `config.pot × N` (N = player count).
- Lowest `total14` wins.
- Single winner: nets `pot × (N - 1)`. Others net `-pot`.
- M-way tie at lowest: pot splits equally among M winners. Each winner nets `(pot × (N - M)) / M`. Losers (non-tied) net `-pot`.
  - Example: 4 players × $20 ante = $80 pot. 2-way tie at lowest, 2 losers. Pot/2 = $40 per winner. Winner net = $40 - $20 ante = **+$20**. Losers net **-$20** each. Books balance.

**Pairwise mode:**
- For each pair (A, B): `delta = total14_A − total14_B`. Player with higher total pays `|delta| × ppt`.
- Same shape as Stableford settlement. Books balance pairwise (sum of all `perPlayer` deltas = 0).

### Test cases (12) — `src/modules/gameEngine.test.js`

1. 4 players, all 18 scored, each uses 4 manual discards → engine sums 14 best kept; no auto-discard fires.
2. 4 players, A uses only 2 manual discards → auto-discards A's 2 lowest-net kept holes; final14 length = 14.
3. 4 players, A uses 0 manual discards → auto-discards A's 4 lowest-net kept holes.
4. Settlement A (pairwise): 4 players with totals [55, 60, 65, 70] @ $1/stroke → all pairwise transfers; `sum(perPlayer) === 0`.
5. Settlement B (pot): 4 players × $20 ante; lowest takes pot. Winner net = +$60, others -$20.
6. Settlement B tie: two players tied at 55, two losers → each winner +$20, each loser -$20. Books balance.
7. 3-player game works (pot mode: winner net = pot × 2, others -pot).
8. 2-player game works (both pot and pairwise).
9. Mid-round (10 holes scored): `isComplete: false`, `settlement: null`, `projection` populated for all players.
10. Same scores, `hcpMode: 'full'` vs `hcpMode: 'lowMan'` → different net totals, different `final14`. Asserts the toggle wires through.
11. Hole order ≠ scored order (scores entered out of sequence) → discards still target *worst net by score*, not last-tapped.
12. Defensive: 5 `is_discarded=true` rows in input → engine takes first 4 by hole number, logs warn.

---

## 5. Wizard config & game library entry

### `GAME_DEFS.fourteen` (in `src/modules/courses.js`)

```js
fourteen: {
  icon: '🎯',
  name: '14 Holes',
  role: 'main',
  desc: 'Individual net stroke play over 18 holes. Each player drops up to 4 worst holes. Lowest 14-total wins. Unused discards become punishment auto-discards on your best holes.',
  players: '2-4 individual',
  rules: '18 holes, individual net stroke play. Each player gets up to 4 manual discards — KEEP/DISCARD pill on every hole after a score is entered. KEEP is the default. Discards used = 4 by round end (hard cap, hard floor). If a player has unused discards at hole 18, the app auto-discards their best kept holes until manual+auto = 4. Final score = sum of best 14 kept net scores. Lowest wins.',
  wagering: 'Pot mode (default): every player antes, lowest 14-total takes the pot, ties split equally. Pairwise mode: $ per stroke difference, settled pairwise.',
  hcpNote: 'Handicap configurable per game: Low-man (default) or Full course. Full course gives every player their entire stroke allotment per hole; low-man subtracts the lowest handicap in the group from everyone.',
  example: 'Pot mode, 4 players × $20 = $80 pot. Spieler 14-total: 56. Carroll: 60. Durkin: 65. Shpiz: 70. Spieler wins net +$60. Carroll/Durkin/Shpiz each owe $20.',
},
```

### Wizard tile

Available in the game-picker grid like any other main game. **Disabled states:**
- 1 or 5+ players in round → tile greyed, tooltip "Needs 2–4 players".
- 9-hole round → tile greyed, tooltip "18-hole only" (re-uses existing wizard holes-mode gate).

### Config sheet

Standard `WizardOverlay.vue` game-config step. Sketch:

```
┌─ 🎯 14 Holes ─────────────────────────┐
│                                       │
│  How does $ settle?                   │
│  ┌──────────┐ ┌──────────┐            │
│  │ Pot (✓)  │ │ Pairwise │            │
│  └──────────┘ └──────────┘            │
│                                       │
│  Pot ante                             │   ← shown when Pot selected
│  $ [  20  ]   per player              │
│                                       │
│  Stroke value                         │   ← shown when Pairwise selected
│  $ [   1  ]   per stroke diff         │
│                                       │
│  Handicap                             │
│  ◉ Low-man (default)                  │
│  ○ Full course                        │
│                                       │
│  [ Cancel ]              [ Add Game ] │
└───────────────────────────────────────┘
```

**Validation:**
- Pot ≥ $1 when Pot mode.
- ppt ≥ $0.25 when Pairwise mode.
- "Add Game" button disabled until validation passes.

**Edit-existing-game path:** same sheet, pre-filled, "Add Game" → "Save".

---

## 6. In-round UX

### KEEP/DISCARD pill — per-hole input view

Renders inside each player card on the per-hole view (`activeHole > 0`), positioned at the **bottom** of the player card (below the score entry, below the NET column).

Layout:

```
┌─────────────────────────────────────────┐
│ JS (hcp 12)    [-]  4  [+]    NET 3     │
│                                          │
│             ┌──────┐  ┌──────────┐      │
│             │ KEEP │  │ DISCARD  │      │
│             └──────┘  └──────────┘      │
│                              3 left ↑   │
└─────────────────────────────────────────┘
```

**Pill states:**
- **KEEP (default, selected):** filled green pill, white text. No action required.
- **DISCARD (selected):** thin red border, red text, slightly faded.
- **DISCARD disabled (at 0 left):** greyed out, untappable. Long-press tooltip: "All 4 discards used."
- **Pill hidden:** until a gross score is entered for that hole.

**Discards counter:** small badge to the right of the pill showing `N left`. Color: muted at 4-2, amber at 1, red at 0. Updates reactively.

**State persistence:** Tapping KEEP or DISCARD calls a new `roundsStore.setDiscardFlag(memberId, hole, isDiscarded)` action. Same iOS stuck-socket pattern as score writes: `supaCall(...)` with 5s timeout → `supaRawUpdate(...)` fallback. Optimistic local update applied immediately.

### Card view (horizontal scorecard grid)

- **Discarded scores:** thin red strikethrough on the score digit. Score stays full opacity — strikethrough alone is the visual signal.
- **Auto-discarded scores (post-round, punishment):** thin red strikethrough + small subscript `auto` in muted red. Differentiates manual from punishment at a glance.
- **Cells stay tap-to-edit.** In viewOnly mode (from History), tapping opens the existing score-edit dialog; that dialog gains a "Toggle KEEP/DISCARD" button so mistakes can be corrected on completed rounds.

### Game Status row (live games panel at top of card view)

Single line, mid-round:
```
🎯 14 Holes  ·  10/18 holes  ·  Spieler 28 (2🗑️)  Carroll 31 (3🗑️)  Durkin 35 (1🗑️)  ─ in flight
```

After round complete (Pot mode, single winner):
```
🎯 14 Holes  ·  Spieler 56 (winner)  Carroll 60  Durkin 65  Shpiz 70  ·  Pot $80 → Spieler +$60
```

Tapping the row expands a full breakdown sheet (per-hole net grid with discards visualized).

### Nudge banner (in-round reminders)

Single dismissible banner. Message updates by hole:

| Hole reached | Condition | Message |
|---|---|---|
| 9 | discards used = 0 | "Halfway done — you've used 0 discards. Use 'em or the app eats your *best* holes at the end." |
| 14 | discards used < 2 | "Only 4 holes left and {N} discards still unused." |
| 17 | discards used < 4 | "Last hole! Unused discards become auto-discards on your *best* holes." |

Each banner is dismissible (X button); won't re-fire the same threshold. Per-player tracking.

---

## 7. Settlement display

Per Jason's **"$ only when bet is mathematically settled"** rule (memory + `betSettled.js`), the dollar figure shows only after the round is fully complete (all 18 holes scored for all players). Before that: game name + `in flight` tag, no $.

### Settle-Up panel formats

**Pot mode, single winner:**
```
🎯 14 Holes · Pot $80
  Spieler  +$60 (56) ← winner
  Carroll  -$20 (60)
  Durkin   -$20 (65)
  Shpiz    -$20 (70)
```

**Pot mode, 2-way tie at lowest:**
```
🎯 14 Holes · Pot $80 — split (tied at 56)
  Spieler  +$20 (56) ← split
  Carroll  +$20 (56) ← split
  Durkin   -$20 (65)
  Shpiz    -$20 (70)
```

**Pairwise mode ($1/stroke):**
```
🎯 14 Holes ($1/stroke)
  Carroll owes Spieler  $4
  Durkin  owes Spieler  $9
  Shpiz   owes Spieler  $14
  Durkin  owes Carroll  $5
  ...
```

### `betSettled.js` addition

```js
export function fourteenSettled(isComplete) {
  return !!isComplete
}
```

One-liner — 14 Holes settles all-or-nothing on round completion (no per-segment lock like Nassau, no per-hole lock like Skins).

---

## 8. History view & recap share

### History chip

```
🎯 14 Holes · Spieler +$60 (56)   [view scorecard >]
```

Shows the winner's net delta and 14-total. "$60" matches the chip format used by Skins/Stableford (net winnings, not gross pot).

Tapping "view scorecard" routes to `ScoringView` in viewOnly mode (TDZ blank-screen path verified working as of v3.10.275). The scorecard grid shows all 18 holes per player with manual + auto discards visually distinguished, and the 14-total in a bold gold rightmost column.

### Scorecard share PNG (`scorecardShare.js`)

The existing capture-target DOM picks up the strikethrough styling automatically (it screenshots live DOM). One addition: a **footer row** beneath the grid showing the 14-totals + winner banner so a shared screenshot reads at a glance:

```
14 Holes (best 14 of 18): Spieler 56 ✓ · Carroll 60 · Durkin 65 · Shpiz 70
```

---

## 9. File map

**New files:**

| Path | Purpose |
|---|---|
| `src/modules/gameEngine.js` | Add `computeFourteen` function (~100 lines). |
| `src/modules/gameEngine.test.js` | Append 12 test cases. |
| `supabase/migrations/2026-05-13_scores_is_discarded.sql` | `ALTER TABLE` migration. |

**Modified files:**

| Path | Change |
|---|---|
| `src/modules/courses.js` | New `fourteen` entry in `GAME_DEFS` (~25 lines). |
| `src/components/WizardOverlay.vue` | New config step UI + validation (~80 lines). |
| `src/views/ScoringView.vue` | KEEP/DISCARD pill in `phc-score-entry`, nudge banner, card-view cell strikethrough, viewOnly dialog toggle (~120 lines). |
| `src/stores/rounds.js` | `setDiscardFlag(memberId, hole, value)` action with `supaCall` + `supaRaw` fallback. Subscribe to `is_discarded` updates in realtime listener (~50 lines). |
| `src/composables/useLiveSettlements.js` | `case 'fourteen'` branch in settlement formatter (~60 lines). |
| `src/composables/useGameNotation.js` | Optional 14-total running notation row (~30 lines). |
| `src/modules/betSettled.js` | `fourteenSettled` one-liner. |
| `src/views/HistoryView.vue` | History chip variant for `type='fourteen'` (~20 lines). |
| `src/modules/scorecardShare.js` | 14-totals footer when `fourteen` game present (~15 lines). |
| `src/styles/ScoringView.css` | Pill, strikethrough, nudge banner styles (~40 lines). |

**File-size watch:** `WizardOverlay.vue` is currently ~101KB. Adding ~80 lines (~3KB) pushes it to ~104KB — still under the CI 110KB threshold. `ScoringView.vue` is ~64KB; ~120 new lines (~4KB) keeps it well clear. No file pushes past the CI gate. Per CLAUDE.md, large edits to these files should be made via the `Edit` tool (not subagents writing `package.json`/JSON config; that hard rule doesn't apply here).

---

## 10. Implementation sequencing

Each step is independently deployable. Order chosen so a failed step doesn't leave users with broken UI for a partial feature.

1. **Tag rollback anchor** — `git tag v3.X.Y-pre-fourteen` on origin/main.
2. **Schema migration** — apply via Supabase MCP `apply_migration`. Verify with a manual UPDATE in the SQL editor that RLS allows the row owner to write `is_discarded`.
3. **Engine + tests (TDD)** — write 12 tests first (red), implement `computeFourteen`, get to green. Commit and push. UI not yet live; engine runs but is invisible. Tests now 222/222.
4. **Game library entry + wizard config** — `GAME_DEFS.fourteen` + WizardOverlay UI step. Deployable: users can now *select* the game in the wizard and a `game_configs` row gets written, but in-round UI for KEEP/DISCARD doesn't exist yet (no pills). Engine is invisible to user.
5. **Store action + realtime subscription** — `setDiscardFlag` + subscribe to `is_discarded` column changes. Console-only validation.
6. **ScoringView hole-view pill + counter** — KEEP/DISCARD pill renders on per-hole view; tapping persists. First visible UI change for the new game.
7. **Card-view strikethrough notation** — visual indicator on the horizontal grid.
8. **Game Status row + live settlement** — plug into existing `liveSettlements` aggregator with the `betSettled.fourteenSettled` gate.
9. **Nudge banner** — hole 9 / 14 / 17 triggers.
10. **History chip + viewOnly dialog toggle** — completes the round-replay path.
11. **Recap share footer** — small polish at the end.
12. **Real-device smoke test** — Jason plays a full 18 with 14 Holes selected. Verify pill, discards counter, auto-discard on unused, settlement math, history view, share image.

Per CLAUDE.md hard rule, **never deploy game logic changes without Jason's per-game sign-off**. Steps 3–5 are scaffold; steps 6+ are user-facing and require sign-off before each deploy.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| iOS stuck-socket on `setDiscardFlag` writes (hung "DISCARD…" state). | Use the `supaCall` + `supaRaw` fallback pattern that's already standard for score writes. Optimistic local update means tap feels instant regardless of network. |
| Concurrent `is_discarded` writes from two devices (player + scorekeeper both tap). | Last-write-wins semantics on a single boolean column — acceptable. The pill always reflects the latest realtime state. |
| Player taps DISCARD 5 times rapidly while discards-left = 0 visibly. | UI button is disabled at 0 left, but defensive engine guard ignores `is_discarded` rows beyond the 4th by hole order (test 12). |
| User edits a kept hole's gross score and forgets to re-evaluate discard. | Out of scope per Jason's "no re-prompt" decision. Trusting players to manage their own discards. The nudge banner at hole 17 covers the worst case. |
| Migration fails or RLS blocks `is_discarded` updates. | Step 2 includes a manual SQL editor smoke test before any code ships. Migration is reversible: `ALTER TABLE scores DROP COLUMN is_discarded;`. |
| `WizardOverlay.vue` growing past 110KB CI gate. | Current ~101KB + ~3KB = ~104KB. Well clear. If estimates miss and we hit the gate, extract the config step to a child component (`FourteenConfigStep.vue`). |
| New game logic breaks existing settlement display (regression on Stableford/Skins). | Engine is purely additive (`case 'fourteen'` in settlement formatter). Existing 210 tests stay green throughout. CI runs all tests on each push. |

**Rollback plan:** if a step ships and causes user-visible regressions, `git revert <sha>` undoes the commit; redeploy. For the schema, `ALTER TABLE scores DROP COLUMN is_discarded;` reverses cleanly (rows lose the flag but score data is intact). The tag from step 1 is the full-feature rollback point.

---

## 12. Open questions (none blocking)

All design questions have been resolved during brainstorming. The smart re-prompt and 9-hole variant are explicitly deferred (Section 2 non-goals).

If something turns up during implementation that the spec doesn't cover, surface it in the implementation plan rather than mutating this spec without sign-off.
