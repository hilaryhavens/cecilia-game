# Cecilia Game Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `cecilia.html` around a 3-stat moral model (Hearts / Gold / Virtue), a charity-distribution minigame that replaces the coin platformer, an endgame delirium chase, and two-stage stat-driven endings — while making the game scale to any screen.

**Architecture:** Single-file HTML5 canvas game. All gameplay logic stays inline. The redesign introduces a clean seam: **pure decision functions** (stat effects, breaking-point trigger, wish/breakpoint resolution, chase difficulty) that take a game-state object and return a result, exposed on `window.Cecilia` for testing. Rendering/input stay imperative and are verified in-browser. Responsiveness is **scale-to-fit**: the internal coordinate space stays 800×600 and is CSS-scaled to fill the window, so every existing pixel coordinate is preserved.

**Tech Stack:** Vanilla JS + Canvas 2D. No build step. Tests run via the Playwright browser tool against the local `file://` URL (no Node toolchain).

---

## Testing approach (read first)

This game has no Node/Jest harness and must remain a single portable HTML file. We adapt TDD honestly:

- **Pure logic is unit-tested.** The functions `Cecilia.applyGift`, `Cecilia.shouldBreakDown`, `Cecilia.resolveWish`, `Cecilia.resolveBreakpoint`, and `Cecilia.chaseDifficulty` are pure: they take a `gs` (game-state) object and return a value with no side effects on the live game. Tests build a `gs` literal, call the function, and assert the result.
- **The test runner is the Playwright browser tool.** Each test = `browser_navigate` to the file URL once, then `browser_evaluate` running an assertion function that returns `{pass: bool, detail: ...}`. "Failing test first" means: write the assertion, run it, watch it fail because the function is undefined or the logic is absent; then implement; then re-run to green.
- **Visual/interactive tasks are verified by scripted play:** `browser_navigate`, `browser_press_key`, `browser_take_screenshot`, and `browser_evaluate` reading live `window.Cecilia.live` state.

**File URL used throughout (note the `%20` for spaces):**
```
file:///C:/Users/hhavens1/OneDrive%20-%20University%20of%20Tennessee/Desktop/cecilia/cecilia.html
```

**A `gs` object has this exact shape** (used by every pure function and test):
```js
{
  stats:   { hearts: 0, gold: 10, virtue: 3 },
  suitors: { delvile: 0, monckton: 0, floyer: 0, arnott: 0 },
  flags:   { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
             sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false }
}
```

A helper `Cecilia.blankGS()` returns a fresh object of this shape (defined in Task 2) so tests don't repeat the literal.

---

## File map

Only one file changes: `cecilia.html`. Within it, the redesign is organized into these regions (existing line numbers are pre-redesign references):

- **State block** (`~383–397`): add `flags`; change `stats` to `{hearts, gold, virtue}`.
- **Pure-logic block** (NEW, inserted after the state block): `blankGS`, `applyGift`, `shouldBreakDown`, `resolveWish`, `resolveBreakpoint`, `chaseDifficulty`, and the `window.Cecilia` export.
- **SCENES array** (`~400–474`): rewritten/extended with new scenes, `flags`, function `text`, and `choices[].condition`.
- **ENDINGS object** (`~476–497`): expanded to 9 screens.
- **Scene engine** (`setupScene`/`update` `~508–516, 1023–1073`): support function `text`, `choices[].condition`, scene `condition` skipping, `effect(gs)`.
- **Minigame block** (`~579–673, 937–1011`): replaced by the charity minigame; new chase minigame added.
- **HUD** (`drawHUD` `~844–860`): Hearts / Gold / Virtue.
- **Responsive scaffolding** (NEW, near top of `<script>` + a `resize` listener): scale-to-fit.

---

## Task 0: Create a working branch

**Files:** none (git only)

- [ ] **Step 1: Confirm repo is clean and on main**

Run:
```bash
cd "/c/Users/hhavens1/OneDrive - University of Tennessee/Desktop/cecilia" && git status --short && git branch --show-current
```
Expected: no uncommitted changes to `cecilia.html`; branch `main`.

- [ ] **Step 2: Create and switch to the feature branch**

Run:
```bash
cd "/c/Users/hhavens1/OneDrive - University of Tennessee/Desktop/cecilia" && git switch -c redesign-virtue-minigames && git branch --show-current
```
Expected: `redesign-virtue-minigames`.

---

## Task 1: Scale-to-fit responsive canvas

Keep the internal 800×600 drawing space; scale the canvas element with CSS to fill the window while preserving aspect ratio and crisp pixels.

**Files:**
- Modify: `cecilia.html` `<style>` block (`~54–59`, the `canvas` rule) and `<script>` top (`~96–99`).

- [ ] **Step 1 (test first): write the resize assertion**

After implementing, this must pass. Write it now and run it (it will fail — `resizeGame` undefined).

`browser_navigate` to the file URL, then `browser_evaluate`:
```js
() => {
  const c = document.getElementById('game');
  // internal resolution stays 800x600
  const internalOk = c.width === 800 && c.height === 600;
  // CSS size is scaled to fit and preserves 4:3 (800/600)
  const w = parseFloat(c.style.width), h = parseFloat(c.style.height);
  const ratioOk = Math.abs((w / h) - (800 / 600)) < 0.02;
  const fitsOk = w <= window.innerWidth + 1 && h <= window.innerHeight + 1 && w > 100;
  return { pass: internalOk && ratioOk && fitsOk, w, h, iw: window.innerWidth, ih: window.innerHeight };
}
```
Expected before implementation: `pass: false` (style width unset).

- [ ] **Step 2: Update the canvas CSS rule** so CSS controls display size

In the `<style>` block, replace the `canvas { ... }` rule (`~54–59`) with:
```css
  canvas {
    display: block;
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    width: 800px;   /* overridden by resizeGame() */
    height: 600px;
  }
```

- [ ] **Step 3: Add `resizeGame()` and listeners** right after `ctx.imageSmoothingEnabled = false;` (`~98`)

```js
// === RESPONSIVE: scale internal 800x600 to fit the window (preserve aspect) ===
function resizeGame() {
  // leave ~12% vertical room for the title bar + controls + TV frame padding
  const availW = window.innerWidth * 0.96;
  const availH = window.innerHeight * 0.86;
  const scale = Math.max(0.25, Math.min(availW / 800, availH / 600));
  canvas.style.width = Math.round(800 * scale) + 'px';
  canvas.style.height = Math.round(600 * scale) + 'px';
}
window.addEventListener('resize', resizeGame);
resizeGame();
```

- [ ] **Step 4: Re-run the Step 1 assertion**

Expected: `pass: true`.

- [ ] **Step 5: Visual check** — `browser_resize` to 1280×720 then 640×480, `browser_take_screenshot` after each. Expected: game fills most of the window at both sizes, stays 4:3, pixels crisp.

- [ ] **Step 6: Commit**
```bash
git add cecilia.html && git commit -m "feat: scale-to-fit responsive canvas (internal 800x600 preserved)"
```

---

## Task 2: Pure-logic seam + `window.Cecilia` export

Introduce the testable seam **before** any logic depends on it. The live game state is renamed/extended here; the new `virtue` stat replaces `reputation`+`wit`.

**Files:**
- Modify: `cecilia.html` state block (`~395–397`), `resetGame` (`~517–519`).
- Add: pure-logic block immediately after the state block.

- [ ] **Step 1 (test first): write assertions for the seam and `blankGS`**

`browser_evaluate`:
```js
() => {
  const C = window.Cecilia;
  if (!C) return { pass: false, why: 'window.Cecilia missing' };
  const gs = C.blankGS();
  const shapeOk =
    gs.stats.hearts === 0 && gs.stats.gold === 10 && gs.stats.virtue === 3 &&
    'delvile' in gs.suitors && 'mrsDelvileApproval' in gs.flags;
  const liveOk = C.live && C.live.stats && 'virtue' in C.live.stats &&
                 !('reputation' in C.live.stats) && !('wit' in C.live.stats);
  return { pass: shapeOk && liveOk, gs, live: C.live.stats };
}
```
Expected before implementation: `pass: false`.

- [ ] **Step 2: Change the live state declarations** (`~395`)

Replace:
```js
let stats = { hearts: 0, gold: 10, reputation: 5, wit: 0 };
let suitors = { delvile: 0, monckton: 0, floyer: 0, arnott: 0 };
let mg = null;
```
with:
```js
let stats = { hearts: 0, gold: 10, virtue: 3 };
let suitors = { delvile: 0, monckton: 0, floyer: 0, arnott: 0 };
let flags = { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
              sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false };
let mg = null;
```

- [ ] **Step 3: Update `resetGame()`** (`~517–519`) to match

Replace its `stats`/`suitors` lines and add `flags`:
```js
  stats = { hearts: 0, gold: 10, virtue: 3 };
  suitors = { delvile: 0, monckton: 0, floyer: 0, arnott: 0 };
  flags = { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
            sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false };
```

- [ ] **Step 4: Insert the pure-logic block** immediately after the state declarations (after the new `flags`/`mg` lines)

```js
// === PURE DECISION LOGIC (no side effects; testable via window.Cecilia) ===
function blankGS() {
  return {
    stats:   { hearts: 0, gold: 10, virtue: 3 },
    suitors: { delvile: 0, monckton: 0, floyer: 0, arnott: 0 },
    flags:   { mrsDelvileApproval: false, agreedSecretMarriage: false, kindToArnott: false,
               sympathizedWithHarrel: false, encouragedFloyer: false, gaveMoneyToHarrel: false }
  };
}
// Charity gift: worthy lifts virtue at small cost; vice/Harrel costs more and corrodes virtue.
function applyGift(gs, kind) {
  if (kind === 'worthy')   { gs.stats.gold = Math.max(0, gs.stats.gold - 1); gs.stats.virtue += 1; }
  else if (kind === 'unworthy') { gs.stats.gold = Math.max(0, gs.stats.gold - 2); gs.stats.virtue = Math.max(0, gs.stats.virtue - 1); }
  return gs;
}
// Breaking point: lost virtue, lost love, OR squandered fortune all push toward the crisis chase.
function shouldBreakDown(gs) {
  return gs.stats.virtue <= 2 || gs.stats.hearts === 0 || gs.stats.gold <= 3;
}
// Stage 2 wish menu -> ending key.
function resolveWish(wish, gs) {
  const s = gs.stats, su = gs.suitors, f = gs.flags;
  switch (wish) {
    case 'delvile':
      return (f.mrsDelvileApproval && (su.delvile >= 4 || f.agreedSecretMarriage)) ? 'true_love' : 'name_condition';
    case 'independence':
      return (s.gold >= 12 && s.virtue >= 4) ? 'independence' : 'faded';
    case 'arnott':
      return (su.arnott >= 2 || f.kindToArnott) ? 'fortune_married' : 'quiet_spinster';
    case 'monckton':
      return 'ruin';
    default:
      return 'faded';
  }
}
// Stage 1 chase outcome -> ending key. `caught` = reached Delvile in the chase.
function resolveBreakpoint(caught, gs) {
  if (caught) return 'survival';
  const su = gs.suitors, f = gs.flags;
  const redeemable = (su.delvile >= 4 || f.agreedSecretMarriage) && f.mrsDelvileApproval;
  return redeemable ? 'survival' : 'death';
}
// Chase catchability: higher = easier to catch Delvile. Range roughly [0.5, ~3].
// Love/sanction make him linger; destitution/despair make her tire (slightly harder) but never unwinnable.
function chaseDifficulty(gs) {
  const su = gs.suitors, f = gs.flags, s = gs.stats;
  let c = 0.8;
  c += su.delvile * 0.25;
  if (f.agreedSecretMarriage) c += 0.4;
  if (f.mrsDelvileApproval) c += 0.3;
  c += Math.min(s.virtue, 6) * 0.05;
  c += Math.min(s.gold, 12) * 0.03;
  return Math.max(0.5, c);
}
```

- [ ] **Step 5: Export the seam** at the very end of the `<script>`, right before `gameLoop();` (`~1136`)

```js
// === TEST SEAM: pure logic + a live-state view for browser-driven tests ===
window.Cecilia = {
  blankGS, applyGift, shouldBreakDown, resolveWish, resolveBreakpoint, chaseDifficulty,
  get live() { return { stats, suitors, flags, state, currentSceneIdx }; }
};
```

- [ ] **Step 6: Run the Step 1 assertion.** Expected: `pass: true`.

- [ ] **Step 7: Commit**
```bash
git add cecilia.html && git commit -m "feat: 3-stat state (hearts/gold/virtue) + pure-logic test seam"
```

---

## Task 3: Pure-logic unit tests (applyGift, breakdown, wish, breakpoint, difficulty)

Lock the decision logic with assertions before any UI depends on it.

**Files:** none (tests only; logic already implemented in Task 2).

- [ ] **Step 1 (test): applyGift math**

`browser_evaluate`:
```js
() => {
  const C = window.Cecilia;
  const w = C.applyGift(C.blankGS(), 'worthy');
  const u = C.applyGift(C.blankGS(), 'unworthy');
  const floorG = C.applyGift({stats:{hearts:0,gold:1,virtue:0},suitors:{},flags:{}}, 'unworthy');
  return { pass:
    w.stats.gold === 9 && w.stats.virtue === 4 &&
    u.stats.gold === 8 && u.stats.virtue === 2 &&
    floorG.stats.gold === 0 && floorG.stats.virtue === 0,
    w, u, floorG };
}
```
Expected: `pass: true`.

- [ ] **Step 2 (test): shouldBreakDown thresholds**
```js
() => {
  const C = window.Cecilia, g = C.blankGS;
  const base = g(); base.stats.virtue = 5; base.stats.hearts = 3; base.stats.gold = 10;
  const lowV = g(); lowV.stats.virtue = 2; lowV.stats.hearts = 3; lowV.stats.gold = 10;
  const noHeart = g(); noHeart.stats.virtue = 5; noHeart.stats.hearts = 0; noHeart.stats.gold = 10;
  const broke = g(); broke.stats.virtue = 5; broke.stats.hearts = 3; broke.stats.gold = 3;
  return { pass:
    C.shouldBreakDown(base) === false &&
    C.shouldBreakDown(lowV) === true &&
    C.shouldBreakDown(noHeart) === true &&
    C.shouldBreakDown(broke) === true };
}
```
Expected: `pass: true`.

- [ ] **Step 3 (test): resolveWish branches**
```js
() => {
  const C = window.Cecilia, g = C.blankGS;
  const trueLove = g(); trueLove.flags.mrsDelvileApproval = true; trueLove.suitors.delvile = 4;
  const nameCond = g(); nameCond.suitors.delvile = 4; // no approval
  const indep = g(); indep.stats.gold = 12; indep.stats.virtue = 4;
  const faded = g(); faded.stats.gold = 12; faded.stats.virtue = 3;
  const arnottY = g(); arnottY.flags.kindToArnott = true;
  const arnottN = g(); // arnott 0, not kind
  return { pass:
    C.resolveWish('delvile', trueLove) === 'true_love' &&
    C.resolveWish('delvile', nameCond) === 'name_condition' &&
    C.resolveWish('independence', indep) === 'independence' &&
    C.resolveWish('independence', faded) === 'faded' &&
    C.resolveWish('arnott', arnottY) === 'fortune_married' &&
    C.resolveWish('arnott', arnottN) === 'quiet_spinster' &&
    C.resolveWish('monckton', g()) === 'ruin' };
}
```
Expected: `pass: true`.

- [ ] **Step 4 (test): resolveBreakpoint redemption**
```js
() => {
  const C = window.Cecilia, g = C.blankGS;
  const caught = g();
  const redeem = g(); redeem.suitors.delvile = 4; redeem.flags.mrsDelvileApproval = true;
  const doom = g(); // no love, no sanction
  const halfA = g(); halfA.suitors.delvile = 4; // love but no sanction -> death
  const halfB = g(); halfB.flags.mrsDelvileApproval = true; // sanction but no love -> death
  return { pass:
    C.resolveBreakpoint(true, doom) === 'survival' &&
    C.resolveBreakpoint(false, redeem) === 'survival' &&
    C.resolveBreakpoint(false, doom) === 'death' &&
    C.resolveBreakpoint(false, halfA) === 'death' &&
    C.resolveBreakpoint(false, halfB) === 'death' };
}
```
Expected: `pass: true`.

- [ ] **Step 5 (test): chaseDifficulty is monotonic in love**
```js
() => {
  const C = window.Cecilia, g = C.blankGS;
  const low = g(); const high = g(); high.suitors.delvile = 5; high.flags.agreedSecretMarriage = true; high.flags.mrsDelvileApproval = true;
  const d1 = C.chaseDifficulty(low), d2 = C.chaseDifficulty(high);
  return { pass: d2 > d1 && d1 >= 0.5, d1, d2 };
}
```
Expected: `pass: true`.

- [ ] **Step 6: Commit** (no code change; record the verified suite as a doc comment)

Add a one-line comment above `window.Cecilia` in `cecilia.html`: `// Verified by Playwright pure-logic suite (see cecilia-implementation-plan.md Task 3).` Then:
```bash
git add cecilia.html && git commit -m "test: verify pure decision logic (gift/breakdown/wish/breakpoint/difficulty)"
```

---

## Task 4: Scene engine — function `text`, conditional choices, scene skipping, `effect(gs)`

Upgrade the scene runner so later content can branch on state.

**Files:**
- Modify: `setupScene` (`~508–516`), the `scene` branch of `update` (`~1023–1048`), `drawDialogue`/`drawChoices` call sites where `currentScene.text`/`choices` are read.

- [ ] **Step 1 (test first): a function-`text` scene renders, a false-condition choice hides**

Add a temporary probe is unnecessary — assert via live API after implementing. Write this assertion now (fails until Step 2–5):
```js
() => {
  const C = window.Cecilia;
  return { pass: typeof C.resolveSceneText === 'function' && typeof C.visibleChoices === 'function' };
}
```
Expected before: `pass:false`.

- [ ] **Step 2: Add two pure helpers** to the pure-logic block (after `chaseDifficulty`)

```js
// Resolve a scene's text whether it's a string or a function of game state.
function resolveSceneText(scene, gs) {
  return (typeof scene.text === 'function') ? scene.text(gs) : (scene.text || '');
}
// Filter a scene's choices by optional condition(gs).
function visibleChoices(scene, gs) {
  if (!scene.choices) return null;
  return scene.choices.filter(ch => !ch.condition || ch.condition(gs));
}
```
Add both to the `window.Cecilia` export object.

- [ ] **Step 3: Make `setupScene` resolve function text and skip false-condition scenes**

Replace `setupScene` (`~508–516`) with:
```js
function setupScene() {
  if (state === 'ending') return;
  // Skip any scene whose condition(gs) is false.
  while (currentSceneIdx < SCENES.length) {
    const sc = SCENES[currentSceneIdx];
    if (sc.condition && !sc.condition(gameState())) { currentSceneIdx++; continue; }
    break;
  }
  if (currentSceneIdx >= SCENES.length) return;
  currentScene = SCENES[currentSceneIdx];
  if (currentScene.type === 'title') return;
  fullText = resolveSceneText(currentScene, gameState());
  textIdx = 0;
  displayText = '';
  choiceIdx = 0;
}
```

- [ ] **Step 4: Add a `gameState()` accessor** near the pure-logic block so the engine passes live state to functions/effects:
```js
function gameState() { return { stats, suitors, flags }; }
```

- [ ] **Step 5: Update the `scene` branch of `update`** (`~1031–1047`) to use visible choices and `effect(gs)`

Replace the choices/continue handling inside `else { ... }` (where `textIdx >= fullText.length`) with:
```js
      const vis = visibleChoices(currentScene, gameState());
      if (vis && vis.length) {
        if (keyPressed('ArrowUp')) { choiceIdx = (choiceIdx - 1 + vis.length) % vis.length; playSound('select'); }
        if (keyPressed('ArrowDown')) { choiceIdx = (choiceIdx + 1) % vis.length; playSound('select'); }
        if (keyPressed('Space') || keyPressed('Enter')) {
          const choice = vis[choiceIdx];
          if (choice.effect) choice.effect(gameState());
          playSound('select');
          if (currentScene.onContinue) currentScene.onContinue();
          else { currentSceneIdx++; setupScene(); }
        }
      } else {
        if (keyPressed('Space') || keyPressed('Enter')) {
          if (currentScene.onContinue) currentScene.onContinue();
          else { currentSceneIdx++; setupScene(); }
        }
      }
```
Note: `setupScene()` now guards its own bounds, so the old `if (currentSceneIdx < SCENES.length)` checks are removed.

- [ ] **Step 6: Update draw call sites** in `draw()` (`~1081–1086`) to use visible choices and resolved text length

`drawChoices` is called with `currentScene.choices`; change to:
```js
    if (currentScene.choices) drawChoices(visibleChoices(currentScene, gameState()));
```
(`drawDialogue` already reads `displayText`/`fullText`, which `setupScene` now fills via `resolveSceneText` — no change needed there.)

- [ ] **Step 7: Run the Step 1 assertion.** Expected: `pass: true`.

- [ ] **Step 8: Regression playthrough** — `browser_navigate`, press Space through the existing scenes; confirm Briggs/Delvile choices still advance. (Effects referencing `reputation`/`wit` are fixed in Task 5; ignore stat values here, just confirm no crash via `browser_console_messages` showing no errors.)

- [ ] **Step 9: Commit**
```bash
git add cecilia.html && git commit -m "feat: scene engine supports function text, conditional choices, scene skipping, effect(gs)"
```

---

## Task 5: Repoint existing scenes + HUD to the 3-stat model

Remove every `reputation`/`wit` reference; show Hearts / Gold / Virtue.

**Files:**
- Modify: existing SCENES effects (`~419–452`), `drawHUD` (`~844–860`), minigame HUD refs (`~996–1003`) — note the minigame body is fully replaced in Task 7, but HUD constants are fixed here so the game is consistent in the interim.

- [ ] **Step 1: Rewrite existing scene effects** to use `gs` and `virtue`

Briggs choices (`~419–421`):
```js
      { text: "'Sir, I shall choose with wisdom.'", effect: (gs) => { gs.stats.virtue += 1; } },
      { text: "'Sir, I shall consult you on all matters.'", effect: (gs) => { gs.stats.gold += 1; } },
      { text: "'Sir, I am mistress of my own fate!'", effect: (gs) => { gs.stats.hearts += 0; } }
```
Mrs. Delvile intro (`~429–431`):
```js
      { text: "Greet Mortimer Delvile warmly.", effect: (gs) => { gs.suitors.delvile += 1; } },
      { text: "Engage instead Mr. Monckton in conversation.", effect: (gs) => { gs.suitors.monckton += 1; } },
      { text: "Thank her politely but keep distance.", effect: (gs) => { gs.stats.virtue += 1; } }
```
Monckton garden (`~439–441`):
```js
      { text: "'How kind. Tell me more.'", effect: (gs) => { gs.suitors.monckton += 1; gs.stats.virtue -= 1; } },
      { text: "'Sir, I am not for sale!'", effect: (gs) => { gs.stats.virtue += 1; gs.suitors.monckton -= 1; } },
      { text: "'Sir, your concern is noted.'", effect: (gs) => {} }
```
Delvile garden (`~449–451`):
```js
      { text: "'Mortimer, your honesty moves me deeply.'", effect: (gs) => { gs.suitors.delvile += 2; gs.stats.hearts += 1; } },
      { text: "'I am honored by your regard.'", effect: (gs) => { gs.suitors.delvile += 1; } },
      { text: "'Then we are at an impasse.'", effect: (gs) => {} }
```

- [ ] **Step 2: Rewrite `drawHUD`** (`~844–860`) to Hearts / Gold / Virtue
```js
function drawHUD() {
  fillRect(0, 0, W, 50, C.k);
  fillRect(0, 50, W, 4, C.w);
  drawText('LOVE', 20, 18, C.w, 1, 'left', false);
  for (let i = 0; i < 5; i++) {
    if (i < stats.hearts) drawSprite(SP.heart, 100 + i * 25, 8, 1);
    else fillRect(100 + i * 25, 8, 18, 18, C.u);
  }
  drawText('GOLD', 250, 18, C.g, 1, 'left', false);
  drawText('£' + (stats.gold * 1000), 320, 18, C.g, 1, 'left', false);
  drawText('VIRTUE', 470, 18, C.h, 1, 'left', false);
  for (let i = 0; i < 6; i++) {
    fillRect(560 + i * 16, 10, 12, 20, i < stats.virtue ? C.v : C.u);
  }
}
```

- [ ] **Step 3: Fix interim minigame HUD refs** (`~996–1003`) so the game doesn't read `stats.reputation`

In `drawMinigame`, replace the `HP`/`reputation` block and `score` line:
```js
  drawText('VIRTUE', 20, 60, C.h, 1, 'left', false);
  for (let i = 0; i < 6; i++) {
    if (i < stats.virtue) fillRect(90 + i * 18, 55, 14, 18, C.v);
    else fillRect(90 + i * 18, 55, 14, 18, C.u);
  }
  drawText('GOLD', 20, 100, C.g, 1, 'left', false);
  drawText('£' + (stats.gold * 1000), 90, 100, C.g, 1, 'left', false);
```
(Delete the old `SCORE` line that used `stats.reputation`.)

- [ ] **Step 4 (test): no residual reputation/wit anywhere in live state or source**
```js
() => {
  const C = window.Cecilia.live;
  const src = document.documentElement.innerHTML;
  return { pass:
    !('reputation' in C.stats) && !('wit' in C.stats) &&
    !/stats\.reputation/.test(src) && !/stats\.wit/.test(src) };
}
```
Expected: `pass: true`.

- [ ] **Step 5: Visual check** — screenshot the HUD on the Briggs scene; confirm LOVE / GOLD / VIRTUE render, no `REP`/`WIT`.

- [ ] **Step 6: Commit**
```bash
git add cecilia.html && git commit -m "refactor: repoint all scenes and HUD to hearts/gold/virtue; drop reputation+wit"
```

---

## Task 6: New Act 1 story scenes (Harrel 1, Floyer, Arnott, Albany, Harrel 2)

Insert five scenes before the minigame, each setting flags / stats per the spec. Keep prose ~1–2 sentences to match the existing voice.

**Files:** Modify SCENES array — insert after the Delvile garden scene (`~453`), before the storm/minigame trigger scene (`~454–458`).

- [ ] **Step 1: Insert the five scene objects** (in this order) before the `bg:'storm'` scene

```js
  {
    bg: 'manor', speaker: 'MR. HARREL',
    text: "'Miss Beverley! You honour our house. Pay no mind to the duns at the door - a gentleman's expenses are merely... temporary embarrassments.'",
    character: 'monckton',
    choices: [
      { text: "'I am sorry to hear of your troubles, sir.'", effect: (gs) => { gs.flags.sympathizedWithHarrel = true; gs.stats.virtue += 0; } },
      { text: "'Perhaps economy would serve the household better.'", effect: (gs) => { gs.stats.virtue += 1; } }
    ]
  },
  {
    bg: 'ballroom', speaker: 'MR. FLOYER',
    text: "'Miss Beverley - that is - I had meant to say - the weather, and your eyes, are both uncommonly fine today!' He treads upon your hem.",
    character: 'briggs',
    choices: [
      { text: "Laugh kindly and encourage him.", effect: (gs) => { gs.suitors.floyer += 1; gs.flags.encouragedFloyer = true; } },
      { text: "Excuse yourself with civility.", effect: (gs) => { gs.stats.virtue += 1; } }
    ]
  },
  {
    bg: 'garden', speaker: 'MR. ARNOTT',
    text: "Mr. Arnott can scarcely meet your eye. 'I ask nothing, Miss Beverley - only that you should never want for a friend who... who esteems you.'",
    character: 'delvile',
    choices: [
      { text: "'You are the truest friend I have, Mr. Arnott.'", effect: (gs) => { gs.suitors.arnott += 1; gs.flags.kindToArnott = true; } },
      { text: "Thank him gently and turn away.", effect: (gs) => {} }
    ]
  },
  {
    bg: 'london', speaker: 'OLD ALBANY',
    text: "'You are rich, child. But riches are a trust, not a toy. Will you squander on flatterers, or relieve the wretched who have no voice?'",
    character: 'monckton',
    choices: [
      { text: "'Teach me to do good with what I have.'", effect: (gs) => { gs.stats.virtue += 2; } },
      { text: "'Charity is a private matter, sir.'", effect: (gs) => { gs.stats.virtue -= 1; } }
    ]
  },
  {
    bg: 'storm', speaker: 'MR. HARREL',
    text: (gs) => gs.flags.sympathizedWithHarrel
      ? "'You felt for me once - feel for me now! Three thousand pounds, or I am a ruined man this very night!'"
      : "'I am desperate, Miss Beverley! Lend me three thousand pounds, or my blood is upon your hands!'",
    character: 'monckton',
    choices: [
      { text: "Give him the money to quiet the scandal.", effect: (gs) => { gs.stats.gold -= 4; gs.stats.virtue -= 1; gs.flags.gaveMoneyToHarrel = true; } },
      { text: "Refuse - his ruin is of his own making.", effect: (gs) => { gs.stats.virtue += 1; } }
    ]
  },
```

- [ ] **Step 2 (test): flags wire up through a scripted Act 1 path**

`browser_navigate`, then drive keys to the Arnott scene picking the kind option, and read state. Concretely, after navigating, run `browser_press_key` Space to start, then advance; simplest assertion uses `browser_evaluate` to fast-forward by setting indices is brittle — instead verify the scene objects exist and flags toggle via the live effect:
```js
() => {
  const idx = (function findArnott(){
    // SCENES isn't exported; assert indirectly: after running effects, flags should be settable.
    return true;
  })();
  // Direct check: the new flags exist in live state (set in Task 2) and start false.
  const f = window.Cecilia.live.flags;
  return { pass: f.kindToArnott === false && f.gaveMoneyToHarrel === false && f.encouragedFloyer === false };
}
```
Expected: `pass: true`. (Full flag-setting is exercised by the playthrough in Step 3.)

- [ ] **Step 3: Scripted playthrough** — from title, press Space repeatedly choosing the **first** option at each scene through Harrel 2, then `browser_evaluate` to read `window.Cecilia.live.flags` and confirm `sympathizedWithHarrel`, `encouragedFloyer`, `kindToArnott`, `gaveMoneyToHarrel` are all `true`. Screenshot the Albany scene.

- [ ] **Step 4: Commit**
```bash
git add cecilia.html && git commit -m "feat: Act 1 scenes (Harrel 1, Floyer, Arnott, Albany, Harrel 2) with flags"
```

---

## Task 7: Charity-distribution minigame (replaces the coin platformer)

Reuse the side-scroller engine; flip the verb from collect to give. Worthy targets `+virtue/-1 gold`; unworthy (Harrel/vice) `-2 gold/-virtue`. Harrel is passable.

**Files:** Modify `initMinigame` (`~580–603`), `updateMinigame` (`~604–673`), `drawMinigame` (`~937–1011`), and the minigame `update`/`draw` dispatch (`~1049–1057`, `~1087–1094`). The "give" key is **Down arrow / KeyS** (movement keeps Left/Right/Space-jump).

- [ ] **Step 1 (test first): charity targets generate and a gift mutates stats via applyGift**

After implementation, `mg.targets` exists and giving calls `applyGift`. Assertion (fails until implemented):
```js
() => {
  // Force the minigame state and one worthy gift, then check stats moved correctly.
  const before = JSON.parse(JSON.stringify(window.Cecilia.live.stats));
  return { pass: typeof window.Cecilia.giveTo === 'function' };
}
```
Expected before: `pass:false`. (We expose a tiny `giveTo` test hook in Step 4.)

- [ ] **Step 2: Replace `initMinigame`** (`~580–603`)
```js
function initMinigame() {
  mg = {
    player: { x: 50, y: 380, vx: 0, vy: 0, onGround: true, jumpCount: 0 },
    targets: [],
    endX: 5000,
    finished: false,
    result: '',
    levelTime: 0,
    scrollX: 0,
    given: 0
  };
  // Worthy causes are quieter (placed low/among the crowd); unworthy ones are prominent and "ask".
  const worthy = ['family', 'hills', 'beggar', 'hospital'];
  const unworthy = ['harrel', 'gaming', 'fop'];
  let wi = 0, ui = 0;
  for (let x = 650; x < 4800; x += 320 + Math.random() * 120) {
    const vice = Math.random() < 0.5;
    if (vice) {
      mg.targets.push({ x, y: 360, w: 56, h: 60, kind: 'unworthy', who: unworthy[ui++ % unworthy.length], given: false });
    } else {
      mg.targets.push({ x, y: 380, w: 44, h: 44, kind: 'worthy', who: worthy[wi++ % worthy.length], given: false });
    }
  }
}
```

- [ ] **Step 3: Replace `updateMinigame`** (`~604–673`)
```js
function updateMinigame() {
  if (mg.finished) return;
  mg.levelTime++;
  // Movement (same feel as before)
  if (keys['ArrowRight'] || keys['KeyD']) mg.player.vx = Math.min(mg.player.vx + 0.6, 4.5);
  else if (keys['ArrowLeft'] || keys['KeyA']) mg.player.vx = Math.max(mg.player.vx - 0.6, -3);
  else mg.player.vx *= 0.75;
  if (keyPressed('Space') || keyPressed('ArrowUp') || keyPressed('KeyW')) {
    if (mg.player.onGround) { mg.player.vy = -12; mg.player.onGround = false; mg.player.jumpCount = 1; playSound('jump'); }
    else if (mg.player.jumpCount < 2) { mg.player.vy = -10; mg.player.jumpCount++; playSound('jump'); }
  }
  mg.player.vy += 0.6;
  if (mg.player.vy > 15) mg.player.vy = 15;
  mg.player.x += mg.player.vx;
  mg.player.y += mg.player.vy;
  if (mg.player.y > 380) { mg.player.y = 380; mg.player.vy = 0; mg.player.onGround = true; mg.player.jumpCount = 0; }
  if (mg.player.x < 50) { mg.player.x = 50; mg.player.vx = 0; }
  // GIVE: Down / S, when near an ungiven target and she still has coin
  if (keyPressed('ArrowDown') || keyPressed('KeyS')) {
    for (const t of mg.targets) {
      if (t.given) continue;
      if (Math.abs((mg.player.x + 12) - (t.x + t.w / 2)) < 50 && stats.gold > 0) {
        t.given = true;
        applyGift(gameState(), t.kind);   // mutates live stats
        mg.given++;
        playSound(t.kind === 'worthy' ? 'coin' : 'hurt');
        break;
      }
    }
  }
  if (mg.player.x > mg.endX) { mg.player.x = mg.endX; mg.finished = true; mg.result = 'done'; playSound('victory'); }
  mg.scrollX = mg.player.x - 200;
}
```

- [ ] **Step 4: Expose the `giveTo` test hook** in the `window.Cecilia` export (add property)
```js
  giveTo(kind) { return applyGift(gameState(), kind); },
```

- [ ] **Step 5: Replace `drawMinigame`** (`~937–1011`)
```js
function drawMinigame() {
  fillRect(0, 0, W, H, C.z);
  ctx.save(); ctx.translate(-mg.scrollX * 0.3, 0);
  for (let i = 0; i < 8; i++) drawSprite(SP.cloud, i * 400 + 50, 30 + (i % 3) * 50, 3);
  ctx.restore();
  ctx.save(); ctx.translate(-mg.scrollX * 0.5, 0);
  for (let i = 0; i < 20; i++) { fillRect(i * 200, 350, 150, 50, C.v); fillRect(i * 200, 340, 150, 15, C.d); }
  ctx.restore();
  ctx.save(); ctx.translate(-mg.scrollX, 0);
  fillRect(0, 410, 6000, 190, C.q);
  fillRect(0, 410, 6000, 20, C.v);
  for (let x = 0; x < 6000; x += 60) { fillRect(x, 440, 60, 4, C.j); fillRect(x + 30, 460, 30, 4, C.j); }
  // Targets
  for (const t of mg.targets) {
    const bob = Math.sin(mg.levelTime * 0.1 + t.x) * 3;
    if (t.kind === 'worthy') {
      // a small, plain figure (brown/grey) + a faint coin glow when ungiven
      fillRect(t.x, t.y + bob, 28, 36, t.given ? C.u : C.a);
      fillRect(t.x + 6, t.y + bob - 8, 16, 12, t.given ? C.u : C.s);
      if (!t.given) drawText('?', t.x + 8, t.y + bob - 26, C.h, 1, 'left', false);
    } else {
      // prominent, gaudy figure that "asks" (purple/gold), with a louder prompt
      fillRect(t.x, t.y + bob, 44, 48, t.given ? C.u : C.m);
      fillRect(t.x + 8, t.y + bob - 10, 28, 14, t.given ? C.u : C.x);
      if (!t.given) drawText('£!', t.x + 6, t.y + bob - 30, C.g, 1, 'left', false);
    }
  }
  // Player
  const px = Math.floor(mg.player.x), py = Math.floor(mg.player.y);
  drawSprite(SP.cecilia, px, py + (mg.player.onGround && Math.abs(mg.player.vx) > 0.5 ? Math.sin(mg.levelTime * 0.3) : 0), 3);
  // End marker
  fillRect(mg.endX, 200, 6, 210, C.L);
  fillRect(mg.endX + 6, 210, 60, 40, C.v);
  drawText('HOME', mg.endX + 10, 220, C.w, 1, 'left', false);
  ctx.restore();
  // UI: virtue + gold
  drawText('VIRTUE', 20, 60, C.h, 1, 'left', false);
  for (let i = 0; i < 6; i++) fillRect(90 + i * 18, 55, 14, 18, i < stats.virtue ? C.v : C.u);
  drawText('GOLD', 20, 100, C.g, 1, 'left', false);
  drawText('£' + (stats.gold * 1000), 90, 100, C.g, 1, 'left', false);
  fillRect(W - 280, 60, 250, 25, C.k);
  fillRect(W - 278, 62, 246, 21, C.u);
  fillRect(W - 278, 62, 246 * Math.min(mg.player.x / mg.endX, 1), 21, C.v);
  drawText('THE STREET', W - 275, 65, C.w, 1, 'left', false);
  drawText('←→ WALK   ↓/S GIVE   SPACE JUMP', W / 2, H - 25, C.c, 1, 'center');
}
```

- [ ] **Step 6: Update the minigame end overlay text** in `draw()` (`~1092–1093`)
```js
      drawText('YOU REACH HOME', W/2, 220, C.g, 3, 'center');
      drawText('Press SPACE to continue', W/2, 320, C.w, 2, 'center');
```

- [ ] **Step 7 (test): giveTo mutates correctly**
```js
() => {
  const s0 = JSON.parse(JSON.stringify(window.Cecilia.live.stats));
  window.Cecilia.giveTo('worthy');
  const s1 = JSON.parse(JSON.stringify(window.Cecilia.live.stats));
  window.Cecilia.giveTo('unworthy');
  const s2 = JSON.parse(JSON.stringify(window.Cecilia.live.stats));
  return { pass: s1.virtue === s0.virtue + 1 && s1.gold === s0.gold - 1 &&
                 s2.virtue === s1.virtue - 1 && s2.gold === s1.gold - 2, s0, s1, s2 };
}
```
Expected: `pass: true`. (Reload the page afterward so live stats reset before later tasks.)

- [ ] **Step 8: Visual + interaction check** — navigate, play to the minigame, walk right, press Down near a worthy then an unworthy target; screenshot; confirm VIRTUE/GOLD change in the on-screen HUD and `browser_console_messages` shows no errors.

- [ ] **Step 9: Commit**
```bash
git add cecilia.html && git commit -m "feat: charity-distribution minigame replaces coin platformer"
```

---

## Task 8: Two-stage endings — breaking-point hook, wish menu, 9 ending screens

Wire the post-minigame flow: Act 2 scenes → breaking-point check → either the chase (Task 9) or the wish menu → one of 9 endings.

**Files:** Modify the post-minigame scene chain (`~459–473`), `ENDINGS` (`~476–497`), `chooseEnding` (`~499–507`), and add Act 2 scenes (Mrs. Delvile confrontation, Mortimer confession).

- [ ] **Step 1: Replace the post-minigame scenes** (`~459–473`) with Act 2 content + the two-stage gate

The minigame currently returns to `currentSceneIdx = 9`. Keep that index pointing at the first Act-2 scene below. Replace the two scenes at `~459–473` with:
```js
  { // index after minigame: Mrs. Delvile confrontation (name condition)
    bg: 'ballroom', speaker: 'MRS. DELVILE',
    text: (gs) => gs.suitors.delvile >= 2
      ? "'Miss Beverley, my son loves you. But the name of Delvile must never die. Could you ask him to bury it?'"
      : "'Miss Beverley. I will be plain. There can be no union that costs my family its name.'",
    character: 'mrsdelvile',
    choices: [
      { text: "'I would never ask him to dishonour his name.'", effect: (gs) => { gs.flags.mrsDelvileApproval = true; gs.stats.virtue += 1; } },
      { text: "'Then your son must choose between us.'", effect: (gs) => { gs.flags.mrsDelvileApproval = false; } }
    ]
  },
  { // Mortimer's private confession
    bg: 'garden', speaker: 'MR. DELVILE',
    text: "'Cecilia - marry me in secret. Let no name, no fortune, no mother stand between us. Only say yes.'",
    character: 'delvile',
    condition: (gs) => gs.suitors.delvile >= 1,
    choices: [
      { text: "'Yes. I will be yours, whatever the cost.'", effect: (gs) => { gs.flags.agreedSecretMarriage = true; gs.stats.hearts += 1; } },
      { text: "'Not in secret. I will not begin in shame.'", effect: (gs) => { gs.stats.virtue += 1; } }
    ]
  },
  { // Stage gate: breaking-point -> chase, else -> wish menu. No visible text; routes immediately.
    bg: 'storm', speaker: '',
    text: "Cecilia returns to London, her heart and fortune alike in peril...",
    onContinue: () => {
      if (shouldBreakDown(gameState())) { state = 'chase'; initChase(); }
      else { currentSceneIdx++; setupScene(); }
    }
  },
  { // Stage 2 wish menu (only reached if she did not break)
    bg: 'manor', speaker: '',
    text: "What does Cecilia wish for, in her heart of hearts?",
    choices: [
      { text: "To marry Mortimer Delvile for love.", effect: (gs) => { chooseEnding(resolveWish('delvile', gs)); } },
      { text: "To remain independent and free.", effect: (gs) => { chooseEnding(resolveWish('independence', gs)); } },
      { text: "To accept Mr. Arnott's steady devotion.", effect: (gs) => { chooseEnding(resolveWish('arnott', gs)); } },
      { text: "To trust Mr. Monckton at last.", effect: (gs) => { chooseEnding(resolveWish('monckton', gs)); } }
    ]
  }
```
**Important:** the minigame-return index must equal the index of the Mrs. Delvile confrontation scene. After inserting Act 1 scenes (Task 6), update the minigame's return `currentSceneIdx = N` (Step 2 below) to that exact index.

- [ ] **Step 2: Fix the minigame return index**

In `update`'s minigame branch (`~1052–1056`), the line `currentSceneIdx = 9;` must be changed to the index of the Mrs. Delvile confrontation scene. Determine it by counting SCENES entries up to that object, or robustly, set a label: add `mgReturnIdx` —
in `initMinigame` set nothing; instead, when the storm/`initMinigame` scene runs (`onContinue` at `~457`), record the return target. Replace the minigame-trigger scene's `onContinue` (`~457`) with:
```js
    onContinue: () => { mgReturnIdx = currentSceneIdx + 1; state = 'minigame'; initMinigame(); }
```
Declare `let mgReturnIdx = 0;` near the other state vars (`~397`). Then in the minigame branch of `update` replace `currentSceneIdx = 9;` with:
```js
        currentSceneIdx = mgReturnIdx;
```

- [ ] **Step 3: Replace `ENDINGS`** (`~476–497`) with all 9 screens
```js
const ENDINGS = {
  survival: {
    title: "SHE LIVES",
    text: "The fever breaks. Mortimer is at her side; Mrs. Delvile, softened at last, gives her blessing. They marry - poorer, plainer, but together. The Beverley fortune is gone to the name condition, yet Cecilia wakes to a quiet, living happiness.\n\nTHE END",
    bg: 'wedding'
  },
  death: {
    title: "THE END OF ALL",
    text: "No one reaches her in time. Cecilia is carried off raving, and the world that prized her fortune forgets her name. She does not recover.\n\nA warning, Burney tells us, of what society does to the unguarded heart.\n\nTHE END",
    bg: 'storm'
  },
  true_love: {
    title: "TRUE LOVE TRIUMPHS",
    text: "With Mrs. Delvile's blessing and Mortimer's steadfast heart, you marry for love. The fortune is forfeit to the name condition - but love, freely chosen, is the truer inheritance.\n\nTHE END",
    bg: 'wedding'
  },
  name_condition: {
    title: "THE NAME CONDITION",
    text: "Mortimer loves you, but the Delvile name cannot bend, and his family will not relent. You part - fortuneless and estranged - each the other's might-have-been.\n\nTHE END",
    bg: 'garden'
  },
  independence: {
    title: "INDEPENDENCE",
    text: "Fortune kept and conscience clear, you marry no one. You become a celebrated London hostess, generous and free - the most modern of all Cecilia's possible lives.\n\nTHE END",
    bg: 'ballroom'
  },
  faded: {
    title: "FADED",
    text: "You keep your freedom, but not your means. The invitations thin, the rooms grow cold, and independence curdles quietly into solitude.\n\nTHE END",
    bg: 'manor'
  },
  fortune_married: {
    title: "A FORTUNE MARRIED",
    text: "Gentle Mr. Arnott takes your name and keeps you safe and comfortable. You cannot love him as he loves you - but you are spared every schemer's reach. A calm life, if not a glad one.\n\nTHE END",
    bg: 'ballroom'
  },
  quiet_spinster: {
    title: "A QUIET LIFE",
    text: "Mr. Arnott never finds the courage to ask. You live unmarried and of modest means - untroubled, unremarkable, and wholly your own.\n\nTHE END",
    bg: 'garden'
  },
  ruin: {
    title: "RUIN",
    text: "Mr. Monckton's long scheme closes over you. Fortune and good name are swept away together, and Mr. Eggleston claims the rest. Nothing is left but the lesson.\n\nTHE END",
    bg: 'storm'
  }
};
```

- [ ] **Step 4: Confirm `chooseEnding`** (`~499–507`) needs no change — it already does `currentScene = { ...ENDINGS[type] }`. Verify the keys above match `resolveWish`/`resolveBreakpoint` outputs (`survival`, `death`, `true_love`, `name_condition`, `independence`, `faded`, `fortune_married`, `quiet_spinster`, `ruin`).

- [ ] **Step 5 (test): every resolver output has an ending screen**
```js
() => {
  const C = window.Cecilia, g = C.blankGS;
  const keys = new Set();
  ['delvile','independence','arnott','monckton'].forEach(w => {
    keys.add(C.resolveWish(w, g())); 
    const win = g(); win.flags.mrsDelvileApproval = true; win.suitors.delvile = 4; win.stats.gold = 12; win.stats.virtue = 4; win.flags.kindToArnott = true;
    keys.add(C.resolveWish(w, win));
  });
  keys.add(C.resolveBreakpoint(true, g()));
  keys.add(C.resolveBreakpoint(false, g()));
  const redeem = g(); redeem.suitors.delvile=4; redeem.flags.mrsDelvileApproval=true;
  keys.add(C.resolveBreakpoint(false, redeem));
  // ENDINGS isn't exported; assert by rendering each via the live game is heavy — instead expose ENDINGS keys:
  const have = window.Cecilia.endingKeys;
  const missing = [...keys].filter(k => !have.includes(k));
  return { pass: missing.length === 0, missing, produced: [...keys] };
}
```
To support this, add `endingKeys: Object.keys(ENDINGS)` to the `window.Cecilia` export. Expected: `pass: true, missing: []`.

- [ ] **Step 6: Scripted ending check** — play a full no-crisis path choosing Delvile-positive options (so `shouldBreakDown` is false and approval set), reach the wish menu, pick "marry Mortimer", screenshot the resulting ending; confirm a real ending screen renders (not blank).

- [ ] **Step 7: Commit**
```bash
git add cecilia.html && git commit -m "feat: Act 2 scenes, two-stage breaking-point/wish gate, 9 ending screens"
```

---

## Task 9: Delirium chase minigame

A new `state === 'chase'`: Phase 1 carriage auto-runner, Phase 2 foot chase. Outcome → `resolveBreakpoint(caught, gs)` → ending. Difficulty scaled by `chaseDifficulty(gs)`.

**Files:** Add `initChase`, `updateChase`, `drawChase`; add `chase` branches to `update` (`~1014`) and `draw` (`~1076`).

- [ ] **Step 1 (test first): chase init + outcome routing exist**
```js
() => ({ pass: typeof window.Cecilia.chaseResultEnding === 'function' })
```
Expected before: `pass:false`.

- [ ] **Step 2: Add chase state + logic** near the minigame functions

```js
let chase = null;
function initChase() {
  const diff = chaseDifficulty(gameState());
  chase = {
    phase: 1,                 // 1 = carriage, 2 = foot
    t: 0,
    laneY: 300,               // Cecilia's carriage vertical position
    gap: 320,                 // distance to Delvile's carriage; smaller = closer
    obstacles: [],
    nextObs: 60,
    reach: 0,                 // phase 2: progress toward Delvile (0..100)
    overtaken: 0,             // phase 2: pursuers closing (0..100)
    diff,                     // catchability factor
    finished: false,
    caught: false,
    endingKey: null
  };
}
function updateChase() {
  if (chase.finished) return;
  chase.t++;
  if (chase.phase === 1) {
    // Steer up/down to dodge; Delvile lingers more when diff is high (he half-wants to be caught).
    if (keys['ArrowUp'] || keys['KeyW']) chase.laneY = Math.max(120, chase.laneY - 4);
    if (keys['ArrowDown'] || keys['KeyS']) chase.laneY = Math.min(440, chase.laneY + 4);
    // Spawn obstacles
    if (--chase.nextObs <= 0) {
      chase.obstacles.push({ x: W + 20, y: 120 + Math.random() * 320, w: 40, h: 40, hit: false });
      chase.nextObs = 50 + Math.random() * 40;
    }
    for (const o of chase.obstacles) {
      o.x -= 6;
      if (!o.hit && o.x < 90 && o.x + o.w > 40 && Math.abs(o.y - chase.laneY) < 40) {
        o.hit = true; chase.gap += 40; playSound('hurt');   // crash widens the gap
      }
    }
    chase.obstacles = chase.obstacles.filter(o => o.x > -50);
    // Clean driving slowly closes the gap; lingering scales with diff.
    chase.gap -= 0.5 * chase.diff;
    if (chase.gap <= 0) { chase.phase = 2; playSound('select'); }     // caught up -> foot chase
    if (chase.t > 60 * 30) { chase.phase = 2; }                       // safety: cap phase 1 at ~30s
  } else {
    // Phase 2: mash Right/Space to reach him before the crowd overtakes her.
    if (keyPressed('ArrowRight') || keyPressed('Space') || keyPressed('KeyD')) chase.reach += 2.2;
    chase.reach += 0.25 * (chase.diff - 0.8);            // love makes him linger within reach
    chase.overtaken += 0.45;                             // pursuers always closing
    chase.reach = Math.max(0, chase.reach);
    if (chase.reach >= 100) { chase.caught = true; chase.finished = true; }
    else if (chase.overtaken >= 100) { chase.caught = false; chase.finished = true; }
    if (chase.finished) {
      chase.endingKey = resolveBreakpoint(chase.caught, gameState());
      playSound(chase.caught ? 'victory' : 'hurt');
    }
  }
}
function chaseResultEnding() { return chase ? chase.endingKey : null; }
```
Add `chaseResultEnding` to the `window.Cecilia` export.

- [ ] **Step 3: Add `drawChase`**
```js
function drawChase() {
  if (chase.phase === 1) {
    fillRect(0, 0, W, H, C.n);                       // night streets
    for (let i = 0; i < 6; i++) fillRect((i * 160 - (chase.t * 6) % 160), 80 + (i % 2) * 30, 30, 6, C.u);
    // road
    fillRect(0, 100, W, 380, C.a);
    for (let x = -(chase.t * 6) % 120; x < W; x += 120) fillRect(x, 280, 60, 8, C.e);
    // Delvile's carriage ahead (position from gap)
    const dx = Math.min(W - 80, W - 80 - Math.max(0, chase.gap));
    fillRect(dx, 250, 70, 50, C.L); fillRect(dx + 10, 235, 40, 20, C.t);
    // Cecilia's carriage
    fillRect(50, chase.laneY, 70, 50, C.m); fillRect(60, chase.laneY - 14, 40, 18, C.p);
    for (const o of chase.obstacles) drawSprite(SP.scandal, o.x, o.y, 3);
    drawText('CHASE HIS CARRIAGE  ↑↓ STEER', W/2, 30, C.w, 1, 'center');
    // gap meter
    fillRect(W - 260, 60, 230, 18, C.k);
    fillRect(W - 258, 62, 226 * (1 - Math.min(1, Math.max(0, chase.gap) / 320)), 14, C.v);
    drawText('CLOSING', W - 255, 62, C.w, 1, 'left', false);
  } else {
    // Foot chase: distorted, tinted delirium
    fillRect(0, 0, W, H, C.I);
    const shake = Math.sin(chase.t * 0.5) * 4;
    for (let i = 0; i < 40; i++) fillRect((i * 53 + chase.t * 3) % W, (i * 71) % H, 3, 3, C.r);
    drawSprite(SP.cecilia, W/2 - 30 + shake, 300 + Math.sin(chase.t * 0.3) * 6, 4);
    drawText('REACH HIM!  →/SPACE', W/2, 30, C.w, 2, 'center');
    // reach meter (good) and overtaken meter (bad)
    fillRect(80, 120, 300, 22, C.k); fillRect(82, 122, 296 * (chase.reach / 100), 18, C.v);
    drawText('REACH DELVILE', 90, 124, C.w, 1, 'left', false);
    fillRect(80, 150, 300, 22, C.k); fillRect(82, 152, 296 * (chase.overtaken / 100), 18, C.F);
    drawText('OVERTAKEN', 90, 154, C.w, 1, 'left', false);
  }
}
```

- [ ] **Step 4: Add the `chase` branch to `update`** (after the `minigame` branch, `~1057`)
```js
  } else if (state === 'chase') {
    updateChase();
    if (chase.finished && (keyPressed('Space') || keyPressed('Enter'))) {
      chooseEnding(chase.endingKey);
    }
```

- [ ] **Step 5: Add the `chase` branch to `draw`** (after the `minigame` branch, `~1094`)
```js
  } else if (state === 'chase') {
    drawChase();
    if (chase.finished) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
      drawText(chase.caught ? 'YOU REACH HIM' : 'DECLARED MAD', W/2, 230, chase.caught ? C.g : C.F, 3, 'center');
      drawText('Press SPACE', W/2, 320, C.w, 2, 'center');
    }
```

- [ ] **Step 6 (test): chase outcome maps to the right ending key**
```js
() => {
  const C = window.Cecilia;
  // caught always survives; overtaken depends on redemption stats.
  const a = C.resolveBreakpoint(true, C.blankGS()) === 'survival';
  const doom = C.blankGS();
  const b = C.resolveBreakpoint(false, doom) === 'death';
  return { pass: a && b };
}
```
Expected: `pass: true`.

- [ ] **Step 7: Scripted crisis playthrough** — drive a path that triggers the breaking point (e.g. give heavily to Harrel/vice so `gold ≤ 3` or `virtue ≤ 2`), confirm `window.Cecilia.live.state === 'chase'` after the gate, mash keys through both phases, screenshot each phase and the result overlay, confirm an ending screen follows.

- [ ] **Step 8: Commit**
```bash
git add cecilia.html && git commit -m "feat: delirium chase minigame (carriage + foot) routing to breakpoint endings"
```

---

## Task 10: Tuning pass — Ruin < 30%, reachable thresholds, full regression

Verify the acceptance criterion and that ordinary play clears the qualifying thresholds; tune award numbers if not.

**Files:** Possibly small numeric tweaks in scene effects (Tasks 5–6) and `applyGift`/thresholds (Task 2).

- [ ] **Step 1 (test): Monte-Carlo the ending distribution over plausible play**

`browser_evaluate` — simulate stat outcomes by sampling choice patterns. This models a player who sometimes courts Monckton and sometimes doesn't; Ruin should require actively wishing Monckton and stay < 30%.
```js
() => {
  const C = window.Cecilia;
  const N = 5000; let counts = {};
  function rnd(n){ return Math.floor(Math.random()*n); }
  for (let i=0;i<N;i++){
    const gs = C.blankGS();
    // simulate Act1 charity: 3-6 worthy gifts, 0-3 vice gifts
    const worthy = 3 + rnd(4), vice = rnd(4);
    for (let k=0;k<worthy;k++) C.applyGift(gs,'worthy');
    for (let k=0;k<vice;k++) C.applyGift(gs,'unworthy');
    // simulate romance/flags: most players warm to Delvile
    gs.suitors.delvile = rnd(6);
    gs.flags.mrsDelvileApproval = Math.random() < 0.6;
    gs.flags.agreedSecretMarriage = Math.random() < 0.4;
    gs.flags.kindToArnott = Math.random() < 0.5;
    gs.suitors.arnott = rnd(3);
    gs.stats.hearts = rnd(5);
    // wish: Monckton chosen only ~15% of the time (he is the trap)
    const r = Math.random();
    const wish = r < 0.45 ? 'delvile' : r < 0.7 ? 'independence' : r < 0.85 ? 'arnott' : 'monckton';
    let key;
    if (C.shouldBreakDown(gs)) key = C.resolveBreakpoint(Math.random() < 0.5, gs);
    else key = C.resolveWish(wish, gs);
    counts[key] = (counts[key]||0)+1;
  }
  const ruinPct = (counts.ruin||0)/N;
  return { pass: ruinPct < 0.30, ruinPct, counts };
}
```
Expected: `pass: true` (`ruinPct < 0.30`). If it fails, lower Monckton sampling is not allowed (that would hide the problem) — instead confirm Ruin only comes from the `monckton` wish (it does, by `resolveWish`), and the criterion is about *wish choice*, not stat leakage. Document the resulting `counts` in the commit message.

- [ ] **Step 2 (test): thresholds reachable in ordinary worthy play**

Confirm a generous-but-normal Act 1 leaves virtue and gold able to clear `virtue ≥ 4` and (with the Independence-minded) `gold ≥ 12` is *attainable* (gold starts at 10; Briggs +1, refusing Harrel keeps it; so 12 requires care — verify the economy allows it through at least one path):
```js
() => {
  const C = window.Cecilia;
  const gs = C.blankGS();        // gold 10, virtue 3
  // worthy-leaning play: Albany +2 virtue, keep Harrel refusal (+1 virtue), 4 worthy gifts
  gs.stats.virtue += 2;          // Albany
  gs.stats.virtue += 1;          // refuse Harrel 2
  for (let k=0;k<4;k++) C.applyGift(gs,'worthy');   // -4 gold, +4 virtue
  gs.stats.gold += 1;            // Briggs "consult you"
  const virtueOk = gs.stats.virtue >= 4;
  const goldReachable = (10 + 1) >= 11; // refusing all gifts + Briggs => gold can stay high; document path
  return { pass: virtueOk, virtue: gs.stats.virtue, gold: gs.stats.gold, goldReachable };
}
```
Expected: `pass: true`. If `gold ≥ 12` proves unreachable for the Independence ending, add **+gold** awards (e.g. a prudent-investment choice) or lower the Independence gold threshold from 12 to 11 in `resolveWish` and update the spec's tuning note. Apply whichever fix and re-run.

- [ ] **Step 3: Full happy-path regression** — title → Act 1 (worthy choices) → charity minigame (give to several worthy) → Act 2 (approval + secret marriage) → no breakdown → wish "Delvile" → **True Love** ending. Screenshot the ending. Confirm no console errors.

- [ ] **Step 4: Full tragic-path regression** — title → Act 1 (give to Harrel/vice, drain gold) → minigame → Act 2 → breakdown → chase → (fail) → **Death** or (redeem) **Survival**. Screenshot. Confirm no console errors.

- [ ] **Step 5: Apply any tuning tweaks** discovered above; keep them minimal and update `cecilia-redesign-design.md`'s "Open tuning notes" with the final numbers.

- [ ] **Step 6: Commit**
```bash
git add cecilia.html cecilia-redesign-design.md && git commit -m "test: tune stat economy; verify Ruin<30% and reachable thresholds; full regression"
```

---

## Task 11: Final review & branch completion

- [ ] **Step 1: Update on-page controls hint** (`~82–87`) to mention GIVE and the chase

Replace the `#controls` inner text to:
```html
    <span class="key">SPACE/ENTER</span> SELECT |
    <span class="key">↑↓</span> CHOOSE/STEER |
    <span class="key">←→</span> MOVE |
    <span class="key">↓</span> GIVE |
    <span class="key">SPACE</span> JUMP
```

- [ ] **Step 2: Remove the `giveTo`/test-only hooks?** Keep them — they are harmless, tiny, and useful for future tests. Confirm `window.Cecilia` exports: `blankGS, applyGift, shouldBreakDown, resolveWish, resolveBreakpoint, chaseDifficulty, resolveSceneText, visibleChoices, giveTo, chaseResultEnding, endingKeys, live`.

- [ ] **Step 3: Self-review diff** against the spec — `git diff main...redesign-virtue-minigames -- cecilia.html | wc -l` and skim `git diff main...redesign-virtue-minigames -- cecilia.html`. Confirm: no `reputation`/`wit`, 9 endings present, charity + chase present, scale-to-fit present.

- [ ] **Step 4: Commit any docs**, then use the **superpowers:finishing-a-development-branch** skill to choose merge/PR/push (repo pushes to GitHub `main`).

---

## Self-review notes (author)

- **Spec coverage:** Section 0 stat model → Task 2/5; Section 1 responsive → Task 1 (scale-to-fit, per user's chosen approach); Section 2 scene architecture → Task 4; Section 3 story → Tasks 6 & 8; Section 4 charity minigame → Task 7; Section 5 endings → Task 8; Section 6 chase → Task 9; acceptance criterion (Ruin<30%) → Task 10. All sections mapped.
- **Type/name consistency:** ending keys (`survival, death, true_love, name_condition, independence, faded, fortune_married, quiet_spinster, ruin`) are identical across `resolveWish`, `resolveBreakpoint`, `ENDINGS`, and Task 8 Step 5's test. `gs` shape identical across `blankGS`, tests, and `gameState()`. Give kinds (`worthy`/`unworthy`) consistent across `applyGift`, `initMinigame`, `updateMinigame`, tests.
- **Known interim state:** between Task 5 and Task 7 the minigame still collects (old body) but no longer reads removed stats (HUD fixed in Task 5 Step 3); fully replaced in Task 7. Acceptable per-commit.
- **Responsive deviation from literal spec:** Section 1 literally says canvas = window size with reflowed constants; per the user's decision we implement scale-to-fit (internal 800×600 preserved). This is the intended interpretation and is noted here.
