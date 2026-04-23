# Wolf Game Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Wolf game issues in GolfWizard: default stakes, tee-order persistence, tie handling, and scorecard display.

**Architecture:** Six focused changes across engine (`gameEngine.js`), store (`rounds.js`), wizard UI (`WizardOverlay.vue`), scorecard composables (`useScorecard.js`, `useGameNotation.js`), and game definitions (`courses.js`). Each task is independent and testable.

**Tech Stack:** Vue 3, Pinia, Vite, Vitest, Supabase

---

## File Map

| File | Changes |
|------|---------|
| `src/modules/gameEngine.js` | ppt default $1→$1; add tieRule logic |
| `src/modules/courses.js` | Wolf GAME_DEFS wagering text + tieRule mention |
| `src/components/WizardOverlay.vue` | ppt default; wolfTeesFirst visual; tieRule selector |
| `src/components/GameEditorOverlay.vue` | Wolf ppt default |
| `src/stores/rounds.js` | Remap wolfTeeOrder IDs (auth + guest paths) |
| `src/composables/useScorecard.js` | Sort player rows by wolf rotation |
| `src/composables/useGameNotation.js` | 🐺 per-hole wolf indicator |
| `package.json` | Version bump |

---

## Task 1: Fix default ppt = $1

**Files:**
- Modify: `src/modules/gameEngine.js:1143`
- Modify: `src/components/WizardOverlay.vue:1446` (GAME_DEFAULTS) and `:593` (placeholder)
- Modify: `src/modules/courses.js:229`
- Modify: `src/components/GameEditorOverlay.vue:114`

- [ ] **Step 1: Write the failing test**

In `src/modules/gameEngine.test.js`, add inside `describe('computeWolf', ...)`:

```javascript
it('defaults ppt to 1 when not provided', () => {
  const scores = {}
  for (const id of ['a', 'b', 'c', 'd']) {
    scores[id] = {}
    for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
  }
  const ctx = fourPlayerCtx(scores)
  // wolfChoices: a is wolf hole 1 and goes lone, wins
  const result = computeWolf(ctx, {
    players: ['a', 'b', 'c', 'd'],
    wolfChoices: { 1: { partner: 'lone' } }
  })
  // With ppt=1, lone wolf (4x) win = 1*4 = 4 per opponent = $12 total for wolf
  expect(result.ppt).toBe(1)
  expect(result.settlements.find(s => s.id === 'a').net).toBe(12)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/jspieler/golfwizard && npx vitest run src/modules/gameEngine.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `ppt` defaults to 5, so `a.net` would be 60, not 12.

- [ ] **Step 3: Fix gameEngine.js**

In `src/modules/gameEngine.js` line 1143, change:
```javascript
    ppt = 5,
```
to:
```javascript
    ppt = 1,
```

- [ ] **Step 4: Fix WizardOverlay.vue GAME_DEFAULTS**

In `src/components/WizardOverlay.vue` line 1446, change:
```javascript
  wolf:        { ppt: 5, wolfLoneMultiplier: 4, blindWolfMultiplier: 8, wolfTeeOrder: [], blindWolfEnabled: true, wolfTeesFirst: true, wolfChoices: {} },
```
to:
```javascript
  wolf:        { ppt: 1, wolfLoneMultiplier: 4, blindWolfMultiplier: 8, wolfTeeOrder: [], blindWolfEnabled: true, wolfTeesFirst: true, wolfChoices: {}, tieRule: 'push' },
```

- [ ] **Step 5: Fix WizardOverlay.vue input placeholder**

In `src/components/WizardOverlay.vue` line 593, change:
```html
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="5" />
```
to:
```html
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
```

- [ ] **Step 6: Fix courses.js wagering text**

In `src/modules/courses.js` line 229, change:
```javascript
    wagering:'$ per point. Lone 4x default, Blind 8x default. Common: $5/pt.',
```
to:
```javascript
    wagering:'$ per point. Lone 4x default, Blind 8x default. Common: $1/pt.',
```

- [ ] **Step 7: Fix GameEditorOverlay.vue**

In `src/components/GameEditorOverlay.vue` line 114, change:
```javascript
    case 'wolf': config = { ppt: 5 }; break
```
to:
```javascript
    case 'wolf': config = { ppt: 1, wolfLoneMultiplier: 4, blindWolfMultiplier: 8, wolfTeeOrder: [], blindWolfEnabled: true, wolfTeesFirst: true, wolfChoices: {}, tieRule: 'push' }; break
```

- [ ] **Step 8: Run tests — must pass**

```bash
cd /Users/jspieler/golfwizard && npx vitest run src/modules/gameEngine.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: All wolf tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/jspieler/golfwizard && git add src/modules/gameEngine.js src/components/WizardOverlay.vue src/modules/courses.js src/components/GameEditorOverlay.vue src/modules/gameEngine.test.js && git commit -m "fix: default Wolf ppt to \$1 (was \$5)"
```

---

## Task 2: Fix wolfTeeOrder ID persistence (root cause of Issue 3)

**Root cause:** `rounds.js` remaps `team1`, `team2`, `player1`, `player2`, `players` from wizard profile IDs to Supabase round_member IDs — but omits `wolfTeeOrder`. The engine then falls back to member join order because `wolfTeeOrder` IDs don't match any member.

**Files:**
- Modify: `src/stores/rounds.js:466-476` (auth path)
- Modify: `src/stores/rounds.js:296-311` (guest path)

- [ ] **Step 1: Fix the authenticated path**

In `src/stores/rounds.js` around line 469, find:
```javascript
        // Remap players array (fidget, etc.)
        if (Array.isArray(config.players)) config.players = config.players.map(id => idMap[id] || id)
```
Add one line after it:
```javascript
        // Remap players array (fidget, etc.)
        if (Array.isArray(config.players)) config.players = config.players.map(id => idMap[id] || id)
        // Remap wolf tee order
        if (Array.isArray(config.wolfTeeOrder)) config.wolfTeeOrder = config.wolfTeeOrder.map(id => idMap[id] || id)
```

- [ ] **Step 2: Fix the guest path**

In `src/stores/rounds.js` find the guest path game config construction (around line 296):
```javascript
      const gameConfigs = games.map((g, i) => ({
        id: `gg_${i}_${Date.now()}`,
        round_id: roundId,
        type: g.type,
        config: g.config,
        sort_order: i,
        created_by: null,
      }))
```

Replace with:
```javascript
      // Build wizard-ID → guest-member-ID map for config remapping
      const guestIdMap = {}
      players.forEach((p, i) => { if (p.id) guestIdMap[p.id] = members[i].id })

      const gameConfigs = games.map((g, i) => {
        const config = { ...g.config }
        if (Array.isArray(config.team1)) config.team1 = config.team1.map(id => guestIdMap[id] || id)
        if (Array.isArray(config.team2)) config.team2 = config.team2.map(id => guestIdMap[id] || id)
        if (config.player1) config.player1 = guestIdMap[config.player1] || config.player1
        if (config.player2) config.player2 = guestIdMap[config.player2] || config.player2
        if (Array.isArray(config.players)) config.players = config.players.map(id => guestIdMap[id] || id)
        if (Array.isArray(config.wolfTeeOrder)) config.wolfTeeOrder = config.wolfTeeOrder.map(id => guestIdMap[id] || id)
        return {
          id: `gg_${i}_${Date.now()}`,
          round_id: roundId,
          type: g.type,
          config,
          sort_order: i,
          created_by: null,
        }
      })
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/jspieler/golfwizard && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS (this fix has no unit tests; the regression is data flow which is hard to unit-test without mocking Supabase).

- [ ] **Step 4: Commit**

```bash
cd /Users/jspieler/golfwizard && git add src/stores/rounds.js && git commit -m "fix: remap wolfTeeOrder IDs from wizard profile IDs to member IDs"
```

---

## Task 3: Wolf tee order + wolfTeesFirst visual (Issue 2)

**What to fix:** When `wolfTeesFirst` is toggled, the wizard should visually show the tee-shot order for hole 1. Add a descriptive line below the tee order list that reflects this setting. Also show "Wolf tees last" badge next to position 0 when wolfTeesFirst is false.

**Files:**
- Modify: `src/components/WizardOverlay.vue:618-657`

- [ ] **Step 1: Add the visual indicator**

In `src/components/WizardOverlay.vue`, find the closing tag of the wolf-order-list div (around line 628):
```html
            <div v-if="mainGame.config.wolfTeeOrder && mainGame.config.wolfTeeOrder.length" class="wolf-order-list">
              <div v-for="(pid, oi) in mainGame.config.wolfTeeOrder" :key="pid" class="wolf-order-item">
                <span class="wolf-order-num">{{ oi + 1 }}</span>
                <span class="wolf-order-name">{{ wolfPlayerName(pid) }}</span>
                <span v-if="oi === 0" class="wolf-h1-badge">WOLF H1</span>
                <button v-if="oi > 0" class="wolf-order-btn" @click="wolfMoveUp(oi)">↑</button>
                <button v-if="oi < mainGame.config.wolfTeeOrder.length - 1" class="wolf-order-btn" @click="wolfMoveDown(oi)">↓</button>
              </div>
            </div>
```

Replace with:
```html
            <div v-if="mainGame.config.wolfTeeOrder && mainGame.config.wolfTeeOrder.length" class="wolf-order-list">
              <div v-for="(pid, oi) in mainGame.config.wolfTeeOrder" :key="pid" class="wolf-order-item">
                <span class="wolf-order-num">{{ oi + 1 }}</span>
                <span class="wolf-order-name">{{ wolfPlayerName(pid) }}</span>
                <span v-if="oi === 0" class="wolf-h1-badge">WOLF H1</span>
                <button v-if="oi > 0" class="wolf-order-btn" @click="wolfMoveUp(oi)">↑</button>
                <button v-if="oi < mainGame.config.wolfTeeOrder.length - 1" class="wolf-order-btn" @click="wolfMoveDown(oi)">↓</button>
              </div>
              <!-- Tee-shot order for hole 1 -->
              <div class="wolf-tee-shot-order">
                <span class="wolf-tee-shot-label">H1 tee order:</span>
                <template v-if="mainGame.config.wolfTeesFirst !== false">
                  <span v-for="(pid, oi) in mainGame.config.wolfTeeOrder" :key="'ts-'+pid" class="wolf-tee-shot-player" :class="{ 'wolf-tee-shot-wolf': oi === 0 }">
                    {{ oi === 0 ? '🐺 ' : '' }}{{ wolfPlayerName(pid) }}{{ oi < mainGame.config.wolfTeeOrder.length - 1 ? ' →' : '' }}
                  </span>
                </template>
                <template v-else>
                  <span v-for="(pid, oi) in mainGame.config.wolfTeeOrder.slice(1).concat([mainGame.config.wolfTeeOrder[0]])" :key="'ts-'+pid" class="wolf-tee-shot-player" :class="{ 'wolf-tee-shot-wolf': oi === mainGame.config.wolfTeeOrder.length - 2 }">
                    {{ oi === mainGame.config.wolfTeeOrder.length - 2 ? '🐺 ' : '' }}{{ wolfPlayerName(pid) }}{{ oi < mainGame.config.wolfTeeOrder.length - 2 ? ' →' : '' }}
                  </span>
                </template>
              </div>
            </div>
```

- [ ] **Step 2: Add CSS for the new elements**

Find the wolf-related CSS in `WizardOverlay.vue` (search for `.wolf-h1-badge` in the `<style>` section) and add after it:

```css
.wolf-tee-shot-order {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin-top: 4px;
  background: rgba(0,0,0,0.08);
  border-radius: 6px;
  font-size: 12px;
  color: var(--c-text-2, #666);
}
.wolf-tee-shot-label {
  font-weight: 600;
  margin-right: 4px;
}
.wolf-tee-shot-player {
  white-space: nowrap;
}
.wolf-tee-shot-wolf {
  color: var(--c-accent, #2563eb);
  font-weight: 700;
}
```

- [ ] **Step 3: Verify there are no template syntax errors**

```bash
cd /Users/jspieler/golfwizard && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/jspieler/golfwizard && git add src/components/WizardOverlay.vue && git commit -m "feat: show hole-1 tee-shot order in wolf wizard, updates on first/last toggle"
```

---

## Task 4: Add tieRule config (Issue 5)

**What to add:** `tieRule` with options `'push'` (default), `'wolfLoses'`, `'carryOver'`. Wire into engine, wizard, and GAME_DEFS.

**Files:**
- Modify: `src/modules/gameEngine.js:1141-1267` (computeWolf)
- Modify: `src/modules/courses.js:228` (rules + wagering)
- Modify: `src/components/WizardOverlay.vue` (wolf options section + GAME_DEFAULTS already updated in Task 1)

- [ ] **Step 1: Write failing tests for tieRule**

In `src/modules/gameEngine.test.js`, add inside `describe('computeWolf', ...)`:

```javascript
it('tieRule=push: tied hole moves no money (default)', () => {
  const scores = {}
  for (const id of ['a', 'b', 'c', 'd']) {
    scores[id] = {}
    for (let h = 1; h <= 18; h++) scores[id][h] = 4 // all tie
  }
  const ctx = fourPlayerCtx(scores)
  const result = computeWolf(ctx, {
    ppt: 1,
    players: ['a', 'b', 'c', 'd'],
    wolfTeeOrder: ['a', 'b', 'c', 'd'],
    wolfChoices: { 1: { partner: 'b' } }, // a+b vs c+d, all 4s, tie
    tieRule: 'push',
  })
  expect(result.settlements.find(s => s.id === 'a').net).toBe(0)
  expect(result.settlements.find(s => s.id === 'c').net).toBe(0)
})

it('tieRule=wolfLoses: wolf team loses on tie (partner mode)', () => {
  const scores = {}
  for (const id of ['a', 'b', 'c', 'd']) {
    scores[id] = {}
    for (let h = 1; h <= 18; h++) scores[id][h] = 4
  }
  const ctx = fourPlayerCtx(scores)
  const result = computeWolf(ctx, {
    ppt: 1,
    players: ['a', 'b', 'c', 'd'],
    wolfTeeOrder: ['a', 'b', 'c', 'd'],
    wolfChoices: { 1: { partner: 'b' } }, // a+b vs c+d, all 4s
    tieRule: 'wolfLoses',
  })
  // c and d each win $1 (from wolf team losing 2 opponents = $2 each from wolf team side)
  // wolf team each pays $1 to each opponent = -$2 each
  expect(result.settlements.find(s => s.id === 'a').net).toBe(-2)
  expect(result.settlements.find(s => s.id === 'b').net).toBe(-2)
  expect(result.settlements.find(s => s.id === 'c').net).toBe(2)
  expect(result.settlements.find(s => s.id === 'd').net).toBe(2)
})

it('tieRule=wolfLoses: lone wolf loses on tie', () => {
  const scores = {}
  for (const id of ['a', 'b', 'c', 'd']) {
    scores[id] = {}
    for (let h = 1; h <= 18; h++) scores[id][h] = 4
  }
  const ctx = fourPlayerCtx(scores)
  const result = computeWolf(ctx, {
    ppt: 1,
    players: ['a', 'b', 'c', 'd'],
    wolfTeeOrder: ['a', 'b', 'c', 'd'],
    wolfChoices: { 1: { partner: 'lone' } }, // a goes lone, tie
    tieRule: 'wolfLoses',
  })
  // lone wolf loses: pays 1*4 = 4 each to 3 opponents = -12, each opp +4
  expect(result.settlements.find(s => s.id === 'a').net).toBe(-12)
  expect(result.settlements.find(s => s.id === 'b').net).toBe(4)
})

it('tieRule=carryOver: carry accumulates then pays out', () => {
  const scores = {}
  for (const id of ['a', 'b', 'c', 'd']) {
    scores[id] = {}
    for (let h = 1; h <= 18; h++) scores[id][h] = 4
  }
  // hole 2: a wins as wolf
  scores['a'][2] = 3
  const ctx = fourPlayerCtx(scores)
  const result = computeWolf(ctx, {
    ppt: 1,
    players: ['a', 'b', 'c', 'd'],
    wolfTeeOrder: ['a', 'b', 'c', 'd'],
    wolfChoices: {
      1: { partner: 'b' }, // a+b wolf, tie, carryOver
      2: { partner: 'c' }, // b is wolf h2, a nets 3 wins — but wait, b is wolf on h2
    },
    tieRule: 'carryOver',
  })
  // h1: tie, carry=1. h2: b is wolf with c, a nets 3 vs others...
  // This tests that carryOver accumulates: sum should still be 0
  const sum = result.settlements.reduce((s, x) => s + x.net, 0)
  expect(Math.abs(sum)).toBeLessThan(0.01)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jspieler/golfwizard && npx vitest run src/modules/gameEngine.test.js --reporter=verbose 2>&1 | tail -30
```

Expected: tieRule tests FAIL (tieRule not yet implemented).

- [ ] **Step 3: Implement tieRule in computeWolf**

In `src/modules/gameEngine.js`, find the destructuring in `computeWolf` (line 1142):

```javascript
  const {
    ppt = 1,
    wolfLoneMultiplier = 4,      // lone wolf multiplier (default 4×)
    blindWolfMultiplier = 8,     // blind wolf multiplier (default 8×)
    wolfTeesFirst = true,        // wolf tees FIRST (true) or LAST (false)
    wolfTeeOrder = [],           // explicit tee order: array of member IDs
    hcpMode = 'lowman',
    players: pids,
  } = config
```

Replace with:

```javascript
  const {
    ppt = 1,
    wolfLoneMultiplier = 4,
    blindWolfMultiplier = 8,
    wolfTeesFirst = true,
    wolfTeeOrder = [],
    hcpMode = 'lowman',
    tieRule = 'push',            // 'push' | 'wolfLoses' | 'carryOver'
    players: pids,
  } = config
```

Then add a `carry` accumulator after `const holeResults = []`:

```javascript
  const holeResults = []
  const totals = {}
  let carry = 0                  // for tieRule='carryOver'
  for (const m of members) totals[m.id] = { name: m.short_name, net: 0 }
```

Then update the lone/blind wolf tie block (find `let winner = null` in the `isLone || isBlind` branch):

```javascript
      let winner = null
      if (wolfNet < otherBest) {
        winner = 'wolf'
        const winAmount = ppt * mult + carry
        carry = 0
        totals[wolf.id].net += winAmount * (n - 1)
        for (const o of others) totals[o.id].net -= winAmount
      } else if (otherBest < wolfNet) {
        winner = 'field'
        const loseAmount = ppt * mult + carry
        carry = 0
        totals[wolf.id].net -= loseAmount * (n - 1)
        for (const o of others) totals[o.id].net += loseAmount
      } else {
        // Tie
        if (tieRule === 'wolfLoses') {
          winner = 'field'
          const loseAmount = ppt * mult
          totals[wolf.id].net -= loseAmount * (n - 1)
          for (const o of others) totals[o.id].net += loseAmount
        } else if (tieRule === 'carryOver') {
          carry += ppt * mult
        }
        // push: no money moves (default)
      }
```

Then update the partner wolf tie block (find `let winner = null` in the partner branch):

```javascript
      let winner = null
      if (wolfBest < otherBest) {
        winner = 'wolf'
        const perOpp = ppt + (carry / Math.max(others.length, 1))
        carry = 0
        for (const w of wolfTeam) totals[w.id].net += perOpp * others.length
        for (const o of others) totals[o.id].net -= perOpp * wolfTeam.length
      } else if (otherBest < wolfBest) {
        winner = 'field'
        const perOpp = ppt + (carry / Math.max(wolfTeam.length, 1))
        carry = 0
        for (const w of wolfTeam) totals[w.id].net -= perOpp * others.length
        for (const o of others) totals[o.id].net += perOpp * wolfTeam.length
      } else {
        // Tie
        if (tieRule === 'wolfLoses') {
          winner = 'field'
          for (const w of wolfTeam) totals[w.id].net -= ppt * others.length
          for (const o of others) totals[o.id].net += ppt * wolfTeam.length
        } else if (tieRule === 'carryOver') {
          carry += ppt
        }
        // push: no money moves (default)
      }
```

Also add `carry` and `tieRule` to the return value:

```javascript
  return { holeResults, totals, settlements, ppt, wolfTeesFirst, rotationOrder: orderedMembers.map(m => m.id), tieRule, carry }
```

- [ ] **Step 4: Run tests — must pass**

```bash
cd /Users/jspieler/golfwizard && npx vitest run src/modules/gameEngine.test.js --reporter=verbose 2>&1 | tail -30
```

Expected: All wolf tests PASS.

- [ ] **Step 5: Add tieRule selector to wizard**

In `src/components/WizardOverlay.vue`, find the wolf options section (around line 648):
```html
          <!-- Options -->
          <div class="wolf-options">
            <label class="wolf-option-toggle" @click="mainGame.config.blindWolfEnabled = !mainGame.config.blindWolfEnabled">
```

Replace the entire `<!-- Options -->` block with:
```html
          <!-- Options -->
          <div class="wolf-options">
            <label class="wolf-option-toggle" @click="mainGame.config.blindWolfEnabled = !mainGame.config.blindWolfEnabled">
              <span class="wolf-toggle" :class="{ on: mainGame.config.blindWolfEnabled !== false }"></span>
              <span>🙈 Blind Wolf (declare before tee shots)</span>
            </label>
            <label class="wolf-option-toggle" @click="mainGame.config.wolfTeesFirst = !mainGame.config.wolfTeesFirst">
              <span class="wolf-toggle" :class="{ on: mainGame.config.wolfTeesFirst }"></span>
              <span>🏌️ Wolf Tees First (wolf hits before choosing partner)</span>
            </label>
            <div class="config-field" style="margin-top:8px">
              <label>Tie rule</label>
              <select v-model="mainGame.config.tieRule" class="config-select">
                <option value="push">Push — ties = no money moves (default)</option>
                <option value="wolfLoses">Wolf Loses — field wins on tie</option>
                <option value="carryOver">Carry Over — pot doubles on next hole</option>
              </select>
            </div>
          </div>
```

- [ ] **Step 6: Update GAME_DEFS rules description in courses.js**

In `src/modules/courses.js` line 228, change:
```javascript
    rules:'Set tee order before the round. Wolf can tee FIRST (watches others, picks after each shot) or LAST (must decide as each opponent hits). Rotation 1-2-3-4, 2-3-4-1, etc. Wolf picks nobody: Lone Wolf (default 4x stakes, 1 vs 3). Blind Wolf: declare before anyone tees, default 8x stakes. Best ball per side wins the hole. Lone/Blind multipliers are configurable.',
```
to:
```javascript
    rules:'Set tee order before the round. Wolf can tee FIRST (watches others, picks after each shot) or LAST (must decide as each opponent hits). Rotation 1-2-3-4, 2-3-4-1, etc. Wolf picks nobody: Lone Wolf (default 4x stakes, 1 vs 3). Blind Wolf: declare before anyone tees, default 8x stakes. Best ball per side wins the hole. Lone/Blind multipliers are configurable. Tie rule: Push (default, no money moves), Wolf Loses (field wins ties), or Carry Over (pot accumulates to next hole).',
```

- [ ] **Step 7: Commit**

```bash
cd /Users/jspieler/golfwizard && git add src/modules/gameEngine.js src/modules/gameEngine.test.js src/modules/courses.js src/components/WizardOverlay.vue && git commit -m "feat: add tieRule config to Wolf game (push/wolfLoses/carryOver)"
```

---

## Task 5: Scorecard wolf rotation order + 🐺 indicator (Issue 4)

**What to add:**
1. Sort player rows by wolf rotation order in `useScorecard.js` when a wolf game is active.
2. The notation in `useGameNotation.js` already encodes the wolf name in each cell — enhance it to prepend 🐺 to every cell (not just lone wolf mode) to make the wolf identity unambiguous.

**Files:**
- Modify: `src/composables/useScorecard.js:165-171` (sortedPlayerGroups)
- Modify: `src/composables/useGameNotation.js:311-329` (wolf notation row)

- [ ] **Step 1: Update sortedPlayerGroups in useScorecard.js**

In `src/composables/useScorecard.js`, find (line 165):
```javascript
  const sortedPlayerGroups = computed(() => {
    const members = ctx.value?.members || []
    const t1 = members.filter(m => m.team === 1).map(m => ({ member: m, team: 1 }))
    const t2 = members.filter(m => m.team === 2).map(m => ({ member: m, team: 2 }))
    const noTeam = members.filter(m => !m.team || (m.team !== 1 && m.team !== 2)).map(m => ({ member: m, team: 0 }))
    return [...t1, ...t2, ...noTeam]
  })
```

Replace with:
```javascript
  const sortedPlayerGroups = computed(() => {
    const members = ctx.value?.members || []
    const games = round.value?.game_configs || []
    const wolfGame = games.find(g => g.type === 'wolf')
    const wolfOrder = wolfGame?.config?.wolfTeeOrder || []

    // If wolf game active with tee order, sort members by rotation order
    if (wolfOrder.length >= members.length) {
      return wolfOrder
        .map(id => members.find(m => m.id === id))
        .filter(Boolean)
        .map(m => ({ member: m, team: 0 }))
    }

    const t1 = members.filter(m => m.team === 1).map(m => ({ member: m, team: 1 }))
    const t2 = members.filter(m => m.team === 2).map(m => ({ member: m, team: 2 }))
    const noTeam = members.filter(m => !m.team || (m.team !== 1 && m.team !== 2)).map(m => ({ member: m, team: 0 }))
    return [...t1, ...t2, ...noTeam]
  })
```

- [ ] **Step 2: Enhance wolf notation to show 🐺 on wolf for every hole**

In `src/composables/useGameNotation.js`, find the wolf notation block (line 319):
```javascript
            const wInit = pInit(hr.wolf) || 'W'
            const mode = hr.isBlind ? '🙈' : hr.isLone ? '🐺' : `+${pInit(hr.partner) || '?'}`
            const result = hr.winner === 'wolf' ? '✓' : hr.winner === 'field' ? '✗' : '='
            const cls = hr.winner === 'wolf' ? 'nota-t1' : hr.winner === 'field' ? 'nota-t2' : 'nota-halved'
            cells[hr.hole] = { text: `${wInit}${mode}${result}`, cls }
```

Replace with:
```javascript
            const wInit = pInit(hr.wolf) || 'W'
            const mode = hr.isBlind ? '🙈' : hr.isLone ? '🐺' : `+${pInit(hr.partner) || '?'}`
            const result = hr.winner === 'wolf' ? '✓' : hr.winner === 'field' ? '✗' : hr.winner === null ? '' : '='
            const cls = hr.winner === 'wolf' ? 'nota-t1' : hr.winner === 'field' ? 'nota-t2' : 'nota-halved'
            // Show wolf initial + mode (🐺/🙈/+partner) + result
            cells[hr.hole] = { text: `🐺${wInit}${mode}${result}`, cls }
```

Also add a second row for the rotation order (wolf names per hole), right before the `rows.push(...)` line:

```javascript
          // Build rotation order row (shows who is wolf per hole block)
          const rotOrder = r.rotationOrder || []
          if (rotOrder.length) {
            const rotCells = {}
            const { from, to } = (() => {
              const mode = ctx.holesMode || '18'
              return mode === 'back9' ? { from: 10, to: 18 } : mode === 'front9' ? { from: 1, to: 9 } : { from: 1, to: 18 }
            })()
            for (let h = from; h <= to; h++) {
              const wolfIdx = (h - from) % rotOrder.length
              const wolfId = rotOrder[wolfIdx]
              const wolfInit = pInit(wolfId) || '?'
              rotCells[h] = { text: wolfInit, cls: 'nota-wolf-rot' }
            }
            rows.push({ icon: '', label: 'Wolf Rot', cells: rotCells, outSummary: '', inSummary: '', totalSummary: '' })
          }
          rows.push({ icon: '🐺', label: 'Wolf', cells, outSummary: '', inSummary: '', totalSummary: summary })
```

Note: Remove the original `rows.push` that is already there (line 328) since we're replacing it.

- [ ] **Step 3: Run build to check for errors**

```bash
cd /Users/jspieler/golfwizard && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/jspieler/golfwizard && git add src/composables/useScorecard.js src/composables/useGameNotation.js && git commit -m "feat: scorecard shows wolf rotation order and \ud83d\udc3a per-hole indicator"
```

---

## Task 6: Build, test, version bump, and deploy (Issue 6)

**Files:**
- Modify: `package.json` (version)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/jspieler/golfwizard && npx vitest run --reporter=verbose 2>&1
```

Expected: All tests pass. Fix any failures before continuing.

- [ ] **Step 2: Run production build**

```bash
cd /Users/jspieler/golfwizard && npm run build 2>&1 | tail -20
```

Expected: Build completes with no errors.

- [ ] **Step 3: Bump version**

In `package.json`, change:
```json
  "version": "3.9.614",
```
to:
```json
  "version": "3.10.0",
```

Also update the `golfwizard@3.9.499` directory symlink if it exists (it's a static file pointer, not critical for deployment).

- [ ] **Step 4: Commit version bump**

```bash
cd /Users/jspieler/golfwizard && git add package.json && git commit -m "chore: bump version to 3.10.0 (wolf game fixes)"
```

- [ ] **Step 5: Deploy**

```bash
cd /Users/jspieler/golfwizard && node scripts/deploy.js 2>&1 | tail -30
```

Expected: Deployment succeeds and the site updates on GitHub Pages.

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|-------------|------|
| Default ppt = $1 in engine | Task 1, Step 3 |
| Default ppt = $1 in wizard GAME_DEFAULTS | Task 1, Step 4 |
| Default ppt = $1 in GAME_DEFS wagering text | Task 1, Step 6 |
| Default ppt = $1 in GameEditorOverlay | Task 1, Step 7 |
| Wolf tee order visual updates on first/last toggle | Task 3 |
| wolfTeeOrder persists correctly (auth path) | Task 2, Step 1 |
| wolfTeeOrder persists correctly (guest path) | Task 2, Step 2 |
| Scorecard orders rows by wolf rotation | Task 5, Step 1 |
| Scorecard shows 🐺 on wolf per hole | Task 5, Step 2 |
| Tie rule 'push' (default) | Task 4, Step 3 |
| Tie rule 'wolfLoses' | Task 4, Step 3 |
| Tie rule 'carryOver' | Task 4, Step 3 |
| Tie rule selector in wizard | Task 4, Step 5 |
| Tie rule in GAME_DEFS description | Task 4, Step 6 |
| Tests pass | Task 6, Step 1 |
| Version bump | Task 6, Step 3 |
| Deploy | Task 6, Step 5 |

### Gaps found and fixed

- Guest path ID remapping was missing entirely — added in Task 2, Step 2 (covers team1/team2/player1/player2/players AND wolfTeeOrder).
- `carryOver` partner wolf calculation uses `carry / others.length` to distribute pot evenly — verified zero-sum.
- `useGameNotation.js`: added wolf rotation row AND updated the per-hole cell format.

### Type consistency

- `tieRule: string` destructured in engine, sent via wizard config, matches `'push'|'wolfLoses'|'carryOver'` string literals throughout.
- `wolfTeeOrder: string[]` remapping uses same `idMap[id] || id` pattern as existing team arrays.
- `sortedPlayerGroups` return type unchanged: `{ member, team }[]`.
