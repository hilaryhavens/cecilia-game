# Cecilia — Chase-for-Everyone, Virtue Rework & Chase Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the delirium chase reachable for every player (survivors flow into the wish menu), start Cecilia at full virtue that her early answers spend/restore, and redesign the chase's two phases (cinematic night carriages + blood-red delirium) with recognizable characters.

**Architecture:** Single-file HTML5 canvas game (`cecilia.html`). Pure decision logic lives in named functions exposed on `window.Cecilia` for browser-driven tests; rendering lives in `draw*` functions. We add one new resolver (`resolveChase`), repurpose `shouldBreakDown` as a *lethality* gate, retune virtue, and rewrite `drawChase()` plus small private draw helpers. No new files, no build step.

**Tech Stack:** Vanilla JS + Canvas 2D. Tests run by serving the file and evaluating `window.Cecilia` in a headless browser via the Playwright MCP tools. No test runner/framework.

## Global Constraints

- Single file only: edit `cecilia.html` in place. No new files, no dependencies, no build tooling.
- Virtue is an integer clamped to `[0, 6]`; Cecilia starts at `6`. The HUD already renders 6 pips.
- Death (the `'death'` ending) may occur **only** for a player who is in breakdown (`shouldBreakDown(gs)` true) AND fails the chase AND is not romantically redeemable. Every other chase outcome routes to the wish menu.
- Honoring the Delvile name must **not** raise virtue.
- All new chase art must be resolution-relative (fractions of `W`/`H`), matching the responsive canvas.
- Test loop: serve with `python -m http.server 8000` (run from the repo dir), navigate the browser to `http://localhost:8000/cecilia.html?v=<n>` with a fresh `?v=` each reload to dodge caching, and assert via `window.Cecilia`.
- Commit messages end with the Co-Authored-By trailer the repo uses; commit only on the feature branch created in Setup.

---

## Setup (do once, before Task 1)

- [ ] **S1: Create the feature branch**

```bash
cd /c/Users/hhavens1/cecilia
git checkout -b chase-for-all-virtue
```

- [ ] **S2: Start the test server (leave running in background)**

```bash
cd /c/Users/hhavens1/cecilia && python -m http.server 8000
```

Then in the browser tool: `browser_navigate` to `http://localhost:8000/cecilia.html?v=0` and confirm the title screen renders with 0 console errors (favicon 404 is expected/ignored).

---

## Task 1: Expose the test seam additions

Add the hooks later tasks assert against, so logic changes are testable from `window.Cecilia`.

**Files:**
- Modify: `cecilia.html` (the `window.Cecilia = { … }` block, ~lines 1867–1874)

**Interfaces:**
- Produces: `window.Cecilia.SCENES` (the live `SCENES` array, read-only use), and placeholders that later tasks fill: `window.Cecilia.resolveChase` and `window.Cecilia.clampVirtue`. (They are added to the export object in the tasks that define the functions; this task only adds `SCENES`.)

- [ ] **Step 1: Add `SCENES` to the seam**

In the `window.Cecilia = {` object (currently ending at the `get live()` line), add `SCENES,` to the first line of exports:

```js
window.Cecilia = {
  blankGS, applyGift, shouldBreakDown, resolveWish, resolveBreakpoint, chaseDifficulty,
  resolveSceneText, visibleChoices, gameState, SCENES,
  giveTo(kind) { return applyGift(gameState(), kind); },
  chaseResultEnding,
  endingKeys: Object.keys(ENDINGS),
  get live() { return { stats, suitors, flags, state, currentSceneIdx }; }
};
```

- [ ] **Step 2: Verify in browser**

`browser_navigate` to `…/cecilia.html?v=1`, then `browser_evaluate`:

```js
() => Array.isArray(window.Cecilia.SCENES) && window.Cecilia.SCENES.length
```

Expected: a number > 15 (the scene count). 

- [ ] **Step 3: Commit**

```bash
git add cecilia.html
git commit -m "test: expose SCENES on window.Cecilia seam

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Virtue starts full, clamps to [0,6]

**Files:**
- Modify: `cecilia.html` — initial `stats` (~line 650), `blankGS()` stats (~line 659), `resetGame()` stats (~line 955), `applyGift()` (~lines 666–671), and the `window.Cecilia` seam.

**Interfaces:**
- Produces: `clampVirtue(gs)` — clamps `gs.stats.virtue` into `[0,6]`, returns nothing. Exposed as `window.Cecilia.clampVirtue`. `applyGift` now clamps internally. Initial/`blankGS`/`resetGame` virtue = `6`.

- [ ] **Step 1: Write the failing test**

`browser_evaluate` (against the *current* build, before edits) to capture the failing expectation:

```js
() => {
  const C = window.Cecilia;
  const gs = C.blankGS();
  const startsFull = gs.stats.virtue === 6;            // expect false now
  C.applyGift(gs, 'worthy'); C.applyGift(gs, 'worthy'); // would push 6 -> 8 without clamp
  const clamped = gs.stats.virtue <= 6;                 // expect false now (8)
  return { startsFull, clamped, virtue: gs.stats.virtue };
}
```

Expected now: `{ startsFull:false, clamped:false, virtue:5 }` (3 +1 +1) — confirming the change is needed.

- [ ] **Step 2: Add the `clampVirtue` helper**

Immediately after `applyGift` (after ~line 671), add:

```js
// Virtue is a 0..6 gauge: clamp after any change so the 6 HUD pips stay honest.
function clampVirtue(gs) { gs.stats.virtue = Math.max(0, Math.min(6, gs.stats.virtue)); }
```

- [ ] **Step 3: Clamp inside `applyGift`**

Change `applyGift` so both branches clamp. Replace the body:

```js
function applyGift(gs, kind, cost) {
  if (kind === 'worthy')        { gs.stats.gold = Math.max(0, gs.stats.gold - (cost == null ? 25 : cost)); gs.stats.virtue += 1; }
  else if (kind === 'unworthy') { gs.stats.gold = Math.max(0, gs.stats.gold - (cost == null ? 1500 : cost)); gs.stats.virtue -= 1; }
  clampVirtue(gs);
  return gs;
}
```

- [ ] **Step 4: Start at full virtue (three sites)**

- Line ~650: `let stats = { hearts: 0, gold: 10000, virtue: 6 };`
- Line ~659 (inside `blankGS`): `stats:   { hearts: 0, gold: 10000, virtue: 6 },`
- Line ~955 (inside `resetGame`): `stats = { hearts: 0, gold: 10000, virtue: 6 };`

- [ ] **Step 5: Add `clampVirtue` to the seam**

In `window.Cecilia`, add `clampVirtue` to the exports line:

```js
  blankGS, applyGift, shouldBreakDown, resolveWish, resolveBreakpoint, chaseDifficulty,
  resolveSceneText, visibleChoices, gameState, SCENES, clampVirtue,
```

- [ ] **Step 6: Run the test to verify it passes**

`browser_navigate` to `…/cecilia.html?v=2`, then the Step 1 snippet.
Expected: `{ startsFull:true, clamped:true, virtue:6 }`.

- [ ] **Step 7: Commit**

```bash
git add cecilia.html
git commit -m "feat: Cecilia starts at full virtue, clamped to 0-6

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Retune early-choice virtue effects

**Files:**
- Modify: `cecilia.html` — Mrs. Delvile intro choice (~line 755), Floyer choice (~line 793), Mrs. Delvile confrontation choice (~line 838), Elder Delvile choice (~line 847).

**Interfaces:**
- Consumes: `window.Cecilia.SCENES` (Task 1), `clampVirtue` (Task 2).
- Produces: no new symbols; changes choice `effect` closures.

- [ ] **Step 1: Write the failing test**

`browser_evaluate` against the current build:

```js
() => {
  const C = window.Cecilia;
  const find = sp => C.SCENES.find(s => s.speaker === sp);
  const run = (scene, idx) => { const gs = C.blankGS(); scene.choices[idx].effect(gs); return gs.stats.virtue; };
  // Floyer "encourage" is choices[0]; should cost 1 (6 -> 5)
  const floyer = run(find('MR. FLOYER'), 0);
  // Mrs Delvile intro "engage Monckton" is choices[1]; should cost 1 (6 -> 5)
  const engageMonckton = run(find('MRS. DELVILE'), 1);   // first MRS. DELVILE = intro
  // Elder Delvile "I would never wish to diminish your family" choices[0]; should NOT change virtue (stays 6)
  const elder = run(find('MR. DELVILE'), 0);
  return { floyer, engageMonckton, elder };
}
```

Expected now (pre-change, with Task 2 full start): `{ floyer:6, engageMonckton:6, elder:7→clamped? }` — note `elder` currently does `virtue+=1` with no clamp in the effect, so it returns `7`. This confirms all three need changing.

- [ ] **Step 2: Add −1 virtue to "engage Monckton" (Mrs. Delvile intro, ~line 755)**

```js
      { text: "Engage instead Mr. Monckton in conversation.", effect: (gs) => { gs.suitors.monckton += 1; gs.stats.virtue -= 1; clampVirtue(gs); } },
```

- [ ] **Step 3: Add −1 virtue to Floyer "encourage" (~line 793)**

```js
      { text: "Laugh kindly and encourage him.", effect: (gs) => { gs.suitors.floyer += 1; gs.flags.encouragedFloyer = true; gs.stats.virtue -= 1; clampVirtue(gs); } },
```

- [ ] **Step 4: Remove the virtue gain from "honor the name" (Mrs. Delvile confrontation, ~line 838)**

```js
      { text: "'I would never ask him to dishonour his name.'", effect: (gs) => { gs.flags.mrsDelvileApproval = true; } },
```

- [ ] **Step 5: Remove the virtue gain from Elder Delvile (~line 847)**

```js
      { text: "'I would never wish to diminish your family, sir.'", effect: (gs) => {} },
```

- [ ] **Step 6: Add `clampVirtue` to the existing virtue-gaining choices that can now exceed 6**

Because virtue starts at 6, the honorable `virtue += 1`/`+= 2` choices would overflow without a clamp. Append `clampVirtue(gs);` to each of these choice effects (search for `gs.stats.virtue += ` and `gs.stats.virtue -= `):
- Briggs "choose with wisdom" (~744), Mrs. Delvile "keep distance" (~756), Monckton "I am not for sale!" (~765), Harrel sc.1 "economy" (~785), Floyer "Excuse yourself" (~794), Albany "Teach me to do good" (~811) and "Charity is a private matter" (~812), Harrel-storm "Refuse" (~823) and "Give him the money" (~822), Monckton "How kind" (~764), Mortimer secret-marriage "Not in secret" (~858).

Example (Briggs ~744):

```js
      { text: "'Sir, I shall choose with wisdom.'", effect: (gs) => { gs.stats.virtue += 1; clampVirtue(gs); } },
```

Apply the same `clampVirtue(gs);` append to every listed choice. (The `-=` ones also clamp at the 0 floor.)

- [ ] **Step 7: Run the test to verify it passes**

`browser_navigate` `…/cecilia.html?v=3`, run Step 1 snippet.
Expected: `{ floyer:5, engageMonckton:5, elder:6 }`.

- [ ] **Step 8: Commit**

```bash
git add cecilia.html
git commit -m "feat: retune virtue - vice costs, name-pride is not virtue, clamp choices

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Chase routing — everyone plays, survivors reach the wish menu

**Files:**
- Modify: `cecilia.html` — `flags` init (~lines 652–653) and `blankGS()` flags (~661–662); module var near `mgReturnIdx` (~647); stage-gate `onContinue` (~864–867); `resolveWish` `'delvile'` case (~682); `updateChase` finish block (~1689–1692); `chaseResultEnding` (~1695); `update()` chase branch (~1777–1779); the `window.Cecilia` seam.

**Interfaces:**
- Consumes: `shouldBreakDown`, `resolveBreakpoint` (existing).
- Produces: `resolveChase(caught, gs)` → `'wish' | 'death'`; new flag `flags.caughtDelvile`; module var `chaseReturnIdx`; `chase.outcome` (replaces `chase.endingKey`). Exposed: `window.Cecilia.resolveChase`.

- [ ] **Step 1: Write the failing test**

`browser_evaluate` against current build:

```js
() => {
  const C = window.Cecilia;
  const hasResolveChase = typeof C.resolveChase === 'function';   // expect false now
  return { hasResolveChase };
}
```

Expected now: `{ hasResolveChase:false }`.

- [ ] **Step 2: Add `caughtDelvile` to both flag objects**

Initial `flags` (~652–653):

```js
let flags = { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
              sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false,
              caughtDelvile: false };
```

`blankGS()` flags (~661–662):

```js
    flags:   { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
               sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false,
               caughtDelvile: false }
```

- [ ] **Step 3: Add the `chaseReturnIdx` module var**

Next to `let mgReturnIdx = 0;` (~647):

```js
let chaseReturnIdx = 0;   // scene index to resume at (the wish menu) after surviving the chase
```

- [ ] **Step 4: Add `resolveChase` (pure resolver)**

Immediately after `resolveBreakpoint` (after ~line 701):

```js
// Chase outcome routing: the chase ALWAYS plays. Catching Delvile, or merely
// not being in breakdown, means she survives and proceeds to the wish menu.
// Only a broken-and-unredeemable player who fails the chase dies.
function resolveChase(caught, gs) {
  if (caught) return 'wish';
  if (!shouldBreakDown(gs)) return 'wish';
  return resolveBreakpoint(false, gs) === 'death' ? 'death' : 'wish';
}
```

- [ ] **Step 5: Reward catching Delvile in `resolveWish`**

In the `'delvile'` case (~line 682), treat `caughtDelvile` like `agreedSecretMarriage`:

```js
    case 'delvile':
      return (f.mrsDelvileApproval && (su.delvile >= 4 || f.agreedSecretMarriage || f.caughtDelvile)) ? 'true_love' : 'name_condition';
```

- [ ] **Step 6: Stage gate always runs the chase**

Replace the stage-gate `onContinue` (~864–867):

```js
    onContinue: () => {
      chaseReturnIdx = currentSceneIdx + 1;   // the wish menu
      state = 'chase'; initChase();
    }
```

- [ ] **Step 7: `updateChase` sets `chase.outcome` and the catch flag**

Replace the finish block (~1689–1692):

```js
    if (chase.finished) {
      if (chase.caught) flags.caughtDelvile = true;
      chase.outcome = resolveChase(chase.caught, gameState());
      playSound(chase.caught ? 'victory' : 'hurt');
    }
```

Also update `chaseResultEnding` (~1695):

```js
function chaseResultEnding() { return chase ? chase.outcome : null; }
```

And initialize `outcome` in `initChase` (in the `chase = { … }` object, replace `endingKey: null` ~line 1655):

```js
    outcome: null
```

- [ ] **Step 8: Route after the chase in `update()`**

Replace the `state === 'chase'` branch (~1775–1779):

```js
  } else if (state === 'chase') {
    updateChase();
    if (chase.finished && (keyPressed('Space') || keyPressed('Enter'))) {
      if (chase.outcome === 'death') chooseEnding('death');
      else { state = 'scene'; currentSceneIdx = chaseReturnIdx; setupScene(); }
    }
  }
```

- [ ] **Step 9: Expose `resolveChase` on the seam**

```js
  blankGS, applyGift, shouldBreakDown, resolveWish, resolveBreakpoint, resolveChase, chaseDifficulty,
  resolveSceneText, visibleChoices, gameState, SCENES, clampVirtue,
```

- [ ] **Step 10: Run logic tests**

`browser_navigate` `…/cecilia.html?v=4`, then:

```js
() => {
  const C = window.Cecilia;
  const broken = () => { const g = C.blankGS(); g.stats.virtue = 1; return g; };       // shouldBreakDown true
  const healthy = () => { const g = C.blankGS(); g.suitors.delvile = 2; return g; };   // not breakdown
  const redeemable = () => { const g = broken(); g.suitors.delvile = 4; g.flags.mrsDelvileApproval = true; return g; };
  return {
    caughtAlwaysWish: C.resolveChase(true, broken()) === 'wish',
    healthyMissSurvives: C.resolveChase(false, healthy()) === 'wish',
    brokenUnredeemedDies: C.resolveChase(false, broken()) === 'death',
    brokenRedeemedSurvives: C.resolveChase(false, redeemable()) === 'wish',
  };
}
```

Expected: all four `true`.

- [ ] **Step 11: Verify end-to-end in the browser (scripted)**

Drive a healthy playthrough to the gate, then force the chase and a miss, and confirm it lands on the wish menu rather than an ending. `browser_evaluate`:

```js
() => {
  // jump straight to the stage gate scene and trigger its continue
  const C = window.Cecilia;
  const gateIdx = C.SCENES.findIndex(s => s.onContinue && /heart and fortune alike in peril/.test(s.text || ''));
  return gateIdx; // sanity: a valid index
}
```

Expected: a non-negative integer. (Full button-driven verification happens in Task 7.)

- [ ] **Step 12: Commit**

```bash
git add cecilia.html
git commit -m "feat: chase plays for everyone; survivors reach the wish menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Redesign chase Phase 1 — cinematic night carriages with horses

**Files:**
- Modify: `cecilia.html` — `drawChase()` phase-1 branch (~1697–1713); add private helpers near `drawChase`.

**Interfaces:**
- Consumes: globals `W`, `H`, palette `C`, `drawSprite`, `SP.cecilia`, `SP.delvile`, `chase` state.
- Produces: helpers `drawNightStreet(t)`, `drawCarriageRig(x, baseY, t, who, facing)`, `drawHorse(x, y, t)` (private; no test seam). No logic changes.

- [ ] **Step 1: Add the draw helpers**

Above `function drawChase()` (~line 1696), add (all coordinates derived from `W`/`H`):

```js
// --- chase art helpers (resolution-relative) ---
function drawHorse(x, y, t, s) {
  // s = pixel unit (≈ H/120). Galloping two-stride cycle.
  const step = Math.sin(t * 0.4) > 0 ? 1 : -1;
  fillRect(x, y, 18*s, 8*s, C.a);                 // body
  fillRect(x + 17*s, y - 4*s, 6*s, 8*s, C.a);     // neck
  fillRect(x + 22*s, y - 2*s, 7*s, 5*s, C.a);     // head
  fillRect(x + 16*s, y - 5*s, 3*s, 6*s, C.k);     // mane
  fillRect(x - 3*s, y + 1*s, 4*s, 7*s, C.k);      // tail
  fillRect(x + 4*s, y + 8*s, 3*s, 8*s + step*2*s, C.L);   // foreleg
  fillRect(x + 14*s, y + 8*s, 3*s, 8*s - step*2*s, C.L);  // hindleg
}
function drawCarriageRig(x, baseY, t, who, facing) {
  const s = Math.max(2, Math.round(H / 120));
  drawHorse(x + facing*30*s, baseY + 4*s, t, s);
  fillRect(x + (facing>0 ? 26*s : -2*s), baseY + 6*s, 2*s, 26*s, C.k); // pole
  const cabX = x, cabY = baseY;
  fillRect(cabX, cabY, 30*s, 20*s, who === 'cecilia' ? C.P : C.L);     // cab
  fillRect(cabX + 2*s, cabY + 4*s, 6*s, 6*s, C.e);                     // side lamp glow
  // wheels
  for (const wx of [cabX + 4*s, cabX + 24*s]) { fillRect(wx, cabY + 20*s, 8*s, 8*s, C.k); fillRect(wx + 2*s, cabY + 22*s, 4*s, 4*s, C.o); }
  // recognizable occupant (portrait, small, bust only via clip height)
  const sp = who === 'cecilia' ? SP.cecilia : SP.delvile;
  drawSprite(sp, cabX + 6*s, cabY - 14*s, Math.max(1, s - 1), C, true);
}
function drawNightStreet(t) {
  // sky
  fillRect(0, 0, W, H, C.n);
  fillRect(0, 0, W, H*0.5, C.n);
  // moon
  fillRect(W - 80, 30, 30, 30, C.c);
  // terrace silhouette + steeple
  for (let i = 0; i < 6; i++) fillRect(i * (W/6), H*0.45, W/6 - 8, H*0.22, C.u);
  fillRect(W*0.55, H*0.30, 16, 40, C.u);
  // lit windows
  for (let i = 0; i < 8; i++) fillRect(20 + i*(W/8), H*0.5 + (i%2)*12, 6, 8, C.e);
  // gas lamps
  for (const lx of [W*0.22, W*0.7]) { fillRect(lx, H*0.62, 4, 26, C.u); fillRect(lx - 6, H*0.58, 14, 12, C.e); }
  // road + cobbles + fog
  fillRect(0, H*0.66, W, H*0.34, C.a);
  for (let x = -(t*6) % 120; x < W; x += 120) fillRect(x, H*0.82, 16, 6, C.k);
}
```

- [ ] **Step 2: Rewrite the phase-1 draw branch**

Replace the body of the `if (chase.phase === 1) { … }` branch in `drawChase` (~1697–1713) with:

```js
    drawNightStreet(chase.t);
    const shake = (chase.t < (chase.shakeUntil||0)) ? (Math.random()*4 - 2) : 0;
    const baseY = H*0.66;
    // Delvile ahead (position from gap), facing left toward her
    const dx = Math.min(W - 120, W - 120 - Math.max(0, chase.gap));
    drawCarriageRig(dx + shake, chase.laneY - baseY + baseY*0 + (baseY - 40), chase.t, 'delvile', -1);
    // Cecilia (player), steered vertically
    drawCarriageRig(40 + shake, chase.laneY, chase.t, 'cecilia', 1);
    for (const o of chase.obstacles) drawSprite(SP.scandal, o.x, o.y, 3);
    drawText('CHASE HIS CARRIAGE  ↑↓ STEER', W/2, 30, C.w, 1, 'center');
    fillRect(W - 260, 60, 230, 18, C.k);
    fillRect(W - 258, 62, 226 * (1 - Math.min(1, Math.max(0, chase.gap) / 320)), 14, C.v);
    drawText('CLOSING', W - 255, 62, C.w, 1, 'left', false);
```

(Keep Cecilia's carriage steering tied to `chase.laneY` as today; Delvile draws at a fixed mid-road `baseY`.)

- [ ] **Step 3: Add screen-shake on crash**

In `updateChase` phase-1 collision (the block at ~1672 where `o.hit` becomes true and `chase.gap += 40`), add a shake window and a spark flag:

```js
        o.hit = true; chase.gap += 40; chase.shakeUntil = chase.t + 18; playSound('hurt');
```

(`chase.shakeUntil` is read in Step 2; undefined-safe via `||0`.)

- [ ] **Step 4: Visual verification (screenshot)**

`browser_navigate` `…/cecilia.html?v=5`, then `browser_evaluate` to force the chase render:

```js
() => { state = 'chase'; initChase(); chase.phase = 1; chase.t = 30; chase.gap = 160; chase.laneY = 0.5*innerHeight; draw(); return 'ok'; }
```

Then `browser_take_screenshot`. Confirm: night street, two horse-drawn carriages, recognizable Cecilia (rose) and Delvile (blue) busts, CLOSING meter. 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add cecilia.html
git commit -m "feat: redesign chase phase 1 - night carriages with horses and faces

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Redesign chase Phase 2 — blood-red delirium from real sprites

**Files:**
- Modify: `cecilia.html` — `drawChase()` phase-2 branch (~1714–1726); add helper `drawDeliriumField`.

**Interfaces:**
- Consumes: `W`, `H`, `C`, `drawSprite`, `SP.cecilia`, `SP.delvile`, `chase` (`reach`, `overtaken`, `t`).
- Produces: helper `drawDeliriumField(t, reachFrac, overFrac)` (private).

- [ ] **Step 1: Add the delirium field helper**

Above `drawChase` (near the other helpers), add:

```js
function drawDeliriumField(t, reachFrac, overFrac) {
  // pulsing blood-red base
  fillRect(0, 0, W, H, C.I);
  fillRect(0, 0, W, H, C.I);
  // concentric warp rings (drawn as thin stroked boxes approximating arcs)
  const cx = W/2, cy = H*0.42;
  ctx.strokeStyle = 'rgba(255,90,90,0.10)'; ctx.lineWidth = 2;
  for (let i = 1; i <= 6; i++) { ctx.beginPath(); ctx.arc(cx, cy, i*34, 0, Math.PI*2); ctx.stroke(); }
  // drifting motes
  for (let i = 0; i < 40; i++) fillRect((i*53 + t*3) % W, (i*71) % H, 3, 3, C.r);
  // looming gossip-faces at edges; press inward as overFrac rises
  const press = overFrac * 30;
  ctx.fillStyle = 'rgba(225,210,220,0.28)';
  ctx.beginPath(); ctx.ellipse(40 + press, H*0.6, 34, 42, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W - 40 - press, H*0.62, 38, 46, 0, 0, Math.PI*2); ctx.fill();
  // vignette
  const vg = ctx.createRadialGradient(cx, H/2, H*0.3, cx, H/2, H*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
```

- [ ] **Step 2: Rewrite the phase-2 draw branch**

Replace the `else { … }` (delirium) branch in `drawChase` (~1714–1726):

```js
  } else {
    const reachFrac = Math.min(1, chase.reach / 100);
    const overFrac  = Math.min(1, chase.overtaken / 100);
    drawDeliriumField(chase.t, reachFrac, overFrac);
    const shake = Math.sin(chase.t * 0.5) * 4;
    // Mortimer ahead: sharpens (alpha) and drifts toward centre as reach rises; dissolves with overtaken
    const dAlpha = Math.max(0, reachFrac - overFrac*0.6);
    const dx = W*0.7 - reachFrac * W*0.18;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.6*dAlpha;
    drawSprite(SP.delvile, dx, H*0.42, 3, C, true);
    ctx.restore();
    // Cecilia running (her portrait), vertical bob + motion trail
    const cyB = H*0.42 + Math.sin(chase.t * 0.3) * 6;
    ctx.save(); ctx.globalAlpha = 0.25; drawSprite(SP.cecilia, W*0.34 - 20 + shake, cyB, 4, C, false); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5;  drawSprite(SP.cecilia, W*0.34 - 8 + shake,  cyB, 4, C, false); ctx.restore();
    drawSprite(SP.cecilia, W*0.34 + shake, cyB, 4, C, true);
    drawText('REACH HIM!  →/SPACE', W/2, 30, C.w, 2, 'center');
    // meters: REACH gold, OVERTAKEN dark-red
    fillRect(80, 120, 300, 22, C.k); fillRect(82, 122, 296 * reachFrac, 18, C.g);
    drawText('REACH DELVILE', 90, 124, C.w, 1, 'left', false);
    fillRect(80, 150, 300, 22, C.k); fillRect(82, 152, 296 * overFrac, 18, C.F);
    drawText('OVERTAKEN', 90, 154, C.w, 1, 'left', false);
  }
```

- [ ] **Step 3: Visual verification (screenshot)**

`browser_navigate` `…/cecilia.html?v=6`, then `browser_evaluate`:

```js
() => { state = 'chase'; initChase(); chase.phase = 2; chase.t = 40; chase.reach = 60; chase.overtaken = 30; draw(); return 'ok'; }
```

`browser_take_screenshot`. Confirm: blood-red field, recognizable Cecilia with trail, hazed Delvile ahead, gold REACH + red OVERTAKEN meters, gossip-faces. 0 console errors.

- [ ] **Step 4: Commit**

```bash
git add cecilia.html
git commit -m "feat: redesign chase phase 2 - blood-red delirium from real sprites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: End-to-end verification + Monte-Carlo retune

**Files:**
- Modify (only if the distribution misses targets): `cecilia.html` thresholds in `resolveWish`/`shouldBreakDown`.

**Interfaces:** none new.

- [ ] **Step 1: Scripted full playthrough (button-driven)**

With the server running and `…/cecilia.html?v=7` open, use the browser tools to: press Space/Enter through the intro, make a healthy set of choices (greet Mortimer, refuse Monckton, charity), reach the gate, play the chase (steer with ↑/↓, mash → in phase 2), and confirm landing on the **wish menu** (not an ending). Then pick "marry Mortimer" and confirm a non-Death ending screen. Capture a screenshot of the chase and the wish menu.

Expected: chase always appears; surviving leads to the wish menu; no console errors.

- [ ] **Step 2: Monte-Carlo the ending distribution**

`browser_evaluate` a self-contained simulation using only the exposed pure functions (random virtue/gold/suitor/flag states → outcome):

```js
() => {
  const C = window.Cecilia;
  const N = 4000, tally = {};
  const rnd = (a,b) => a + Math.random()*(b-a);
  for (let i=0;i<N;i++){
    const gs = C.blankGS();
    gs.stats.virtue = Math.round(rnd(0,6));
    gs.stats.gold   = Math.round(rnd(0,10000));
    gs.stats.hearts = Math.round(rnd(0,3));
    gs.suitors.delvile = Math.round(rnd(0,5));
    gs.flags.mrsDelvileApproval = Math.random()<0.5;
    gs.flags.agreedSecretMarriage = Math.random()<0.3;
    // chase: caught chance scales with difficulty (proxy)
    const diff = C.chaseDifficulty(gs);
    const caught = Math.random() < Math.min(0.95, diff/3);
    const outcome = C.resolveChase(caught, gs);
    let key;
    if (outcome === 'death') key = 'death';
    else { const wishes=['delvile','independence','arnott','monckton']; key = C.resolveWish(wishes[Math.floor(Math.random()*4)], gs); }
    tally[key] = (tally[key]||0)+1;
  }
  Object.keys(tally).forEach(k=> tally[k]=+(100*tally[k]/N).toFixed(1));
  return tally;
}
```

Expected acceptance: `death` < 30%; `true_love` and `independence` both > ~5% (reachable). If `death` ≥ 30% or `independence`/`true_love` are near-zero, adjust: ease `shouldBreakDown` (e.g. `virtue <= 1`) and/or `resolveWish` independence gold floor, re-run until in band. Record the final numbers.

- [ ] **Step 3: Commit any tuning**

```bash
git add cecilia.html
git commit -m "chore: tune chase/ending economy after Monte-Carlo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Final smoke check**

Reload `…/cecilia.html?v=final`, play from the title once more, confirm 0 console errors (favicon excepted) and that virtue starts at 6 pips on the HUD.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §1 chase-for-everyone → Tasks 4 (+routing) & 7 (verify); §2 virtue → Tasks 2 (full/clamp) & 3 (retune, name-pride removed); §3 visuals phase 1 → Task 5, phase 2 → Task 6; acceptance criteria → Task 7. Test-seam need → Task 1. All covered.
- **Placeholder scan:** every code step shows concrete code; no TBD/TODO.
- **Type consistency:** `resolveChase(caught, gs) → 'wish'|'death'` defined in Task 4, consumed in Task 7; `chase.outcome` replaces `chase.endingKey` consistently (init in Task 4 Step 7, read in `update()` Step 8 and `chaseResultEnding`); `clampVirtue(gs)` defined in Task 2, used in Tasks 2–3; `chaseReturnIdx`/`flags.caughtDelvile` defined and used in Task 4. Consistent.
- **Note for implementer:** the phase-1 Delvile rig Y in Task 5 Step 2 is written to sit at mid-road; if it reads visually off against the responsive canvas, pin it to a constant `baseY - 40` and adjust during the Step 4 screenshot check rather than changing control logic.
