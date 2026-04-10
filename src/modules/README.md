# GolfWizard Module Files

Clean ES modules extracted from the GolfWizard main application (`index.html`). All game logic, scoring calculations, and course data have been separated into focused, reusable modules.

## Files

### 1. **courses.js** (141 lines)
Golf course database and course-related helpers.

**Exports:**
- `COURSES` - Object containing ~100 built-in golf courses with all tee data
- `FORMATS` - Available game format definitions
- `GAME_DEFS` - Descriptions and rules for Nassau, Match Play, Vegas
- `WOLF_HOLE_MODES`, `HOLES_MODE_OPTS`, `VEGAS_VARIANT_OPTS`, etc. - Game configuration options
- `getCourse(courseName)` - Look up a course by name
- `getCourseNames()` - Get list of all available courses
- `getTeesForCourse(courseName)` - Get available tees for a course

**Data Structure:**
Each course includes:
- `par` - Array of hole pars (18 values)
- `si` - Array of stroke index (handicap difficulty ranking)
- `tees` - Default tee name
- `teesData` - Object keyed by tee name (Black, Green, Gold, etc.) with rating/slope/yards

### 2. **scoring.js** (7,097 lines)
Pure scoring calculation helpers - no Vue reactivity, all functions are deterministic.

**Core Exports:**
- `strokesOnHole(hcp, si)` - Calculate stroke penalty for a hole based on handicap and SI
- `getScore(rid, pid, h)` - Get gross score for a player on a hole
- `setScore(rid, pid, h, v)` - Set gross score
- `editRoundHcp(pid, rid, val)` - Update player's handicap for a round
- `netScore(rid, pid, h)` - Calculate net score (gross - strokes)
- `gameNetScore(rid, pid, h)` - Calculate net score using game-specific handicap
- `scoreClass(score, par)` - Return CSS class for score styling (eagle, birdie, par, bogey, etc.)
- `grossTotal(rid, pid)` - Sum of all gross scores for a player in a round
- `netTotal(rid, pid)` - Sum of all net scores for a player in a round
- `holeNetWinners(rid, h)` - Determine which players won a hole (lowest net score)
- `roundPlayers(rid)` - Get list of player IDs in a round
- `roundGroups(rid)` - Get group assignments for a round

**Usage Note:** These functions accept round ID (`rid`), player ID (`pid`), and hole number (`h`). They currently reference a global tournament object `T` - to make them fully pure, replace references to `T` with parameter injection.

### 3. **gameLogic.js** (365 lines)
All game computation logic for settlement calculations.

**Game Functions (22 compute functions):**

**Main Team Games:**
- `computeSkins(rid, pids, gameObj)` - Calculate skins payout (each player competes individually)
- `computeMatch(rid, p1, p2, gameConfig)` - 1v1 match play
- `computeMatchTeam(rid, team1, team2, gameConfig)` - 2v2 match play (best ball)
- `compute1v1Holes(rid, p1, p2)` - Process individual hole results for 1v1
- `computeHiLow(rid, gameObj)` - Hi-low aggregate (2v2)
- `computeTeamDay(rid, team1, team2, bestNets, bestGross)` - Team day (best 2 net + best gross)
- `computeBestBall(rid, game)` - Best ball scoring

**Special Games:**
- `computeSixes(rid, tData)` - Sixes (0-1-2-3 points for double/birdie/par/other)
- `computeScotch6s(rid, tData)` - Scottish Sixes variant
- `computeFiveThreeOne(rid)` - 5-3-1 points system
- `computeStableford(rid, team1, team2, variant, gameConfig, tData)` - Stableford points
- `computeStablefordIndividual(rid, pids, variant, gameConfig)` - Individual Stableford

**High-Action Games:**
- `computeWolfResult(rid, tData)` - Wolf (rotating partner/lone wolf)
- `computeVegasHoles(rid, team1, team2, gameObj)` - Vegas (2-digit team numbers)
- `computeVegasHoleVariant(rid, h, team1, team2, variant, gameConfig, tData)` - Vegas variants
- `computeVegasVariantFull(rid, team1, team2, variant, gameObj, tData)` - Full Vegas settlement
- `computeHammerResult(rid)` - Hammer (team doubles down after bad hole)
- `computeHammerResultV2(rid)` - Hammer variant

**Trivial Games:**
- `computeSnakeResult(rid)` - Snake (low net score each hole wins, carries forward)
- `computeDotsResult(rid)` - Dots/Dots & Dashes (bingo-bango-bongo)
- `computeBbbResult(rid, tData)` - 3-way bingo/bango/bongo points
- `computeFidgetResult(rid, tData)` - Fidget/Junk/Garbage games

### 4. **settlement.js** (757 lines)
Game settlement and financial reconciliation logic.

**Core Exports:**
- `computeFullSettlement(rid)` - Main settlement calculation for a round, returns debts/credits
- `computeRoundGameResult(t, rid)` - Process all games in a round and compute payouts

**Key Algorithm:**
- Calculates individual game results for each game in a round
- Computes net win/loss per player across all games
- Implements debt-clearing algorithm to minimize transfers
- Returns settlement ledger showing who owes whom how much

## Important Notes

### Global State Removal
These modules still reference the global tournament object `T` from the original Vue app. To make them fully pure and testable:

1. Replace `T.rounds`, `T.scores`, `T.gameRounds` references with function parameters
2. Extract helper functions that depend on `T` (like `getScore`, `pRoundHcp`, `holeSI`)
3. Consider creating a data accessor layer

### Function Signatures
Most functions use the form:
```javascript
function computeGame(rid, pids, gameObj) {
  // rid = round ID
  // pids = array of player IDs
  // gameObj = game configuration object
  return { ... result }
}
```

Parameters vary by game type. Refer to each function's implementation for exact requirements.

### Game Math Preserved
All calculation logic is preserved exactly as-is from the original application. No changes were made to scoring algorithms or settlement logic - only code organization.

## Extraction Source

All code extracted from `/sessions/friendly-bold-hypatia/mnt/uploads/index.html` (GolfWizard full-stack Vue application).

**Date:** April 10, 2026
**Status:** All syntax verified - balanced braces, proper ES module format
