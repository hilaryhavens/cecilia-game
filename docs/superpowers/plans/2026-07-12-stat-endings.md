# Stat-Determined Endings (item 14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the wish menu; after the carriage chase the game resolves one of four flat endings from LOVE/VIRTUE/GOLD and the chase outcome, shows the stats prominently on the ending screen, and a committed Node Monte-Carlo harness proves the balance targets.

**Architecture:** Single-file HTML5 canvas game (`cecilia.html`, no build step, no dependencies). Pure decision logic lives in named functions exposed on `window.Cecilia` for browser-driven tests (Playwright MCP `browser_navigate` + `browser_evaluate` on `file:///C:/Users/hhavens1/cecilia/cecilia.html`); the script tag is non-module, so all top-level functions are also directly callable from `browser_evaluate`. The new `balance-check.mjs` loads the same script in a stubbed-DOM Node `vm` sandbox.

**Tech Stack:** Vanilla JS canvas; Playwright MCP browser tools for tests; Node ≥18 for the balance harness.

**Spec:** `docs/superpowers/specs/2026-07-12-stat-endings-design.md` (approved 2026-07-12).

## Global Constraints

- Work on branch `stat-endings` off `main`; commit after every task.
- Single file `cecilia.html` + new `balance-check.mjs`; no npm packages, no build step.
- Ending keys exactly: `single_rich`, `delvile`, `madhouse`, `loveless`.
- Resolution order (spec): love → delvile (`hearts >= 3` caught / `>= 5` uncaught); collapse → madhouse (`virtue <= 2 || gold <= 3000` caught / `virtue <= 3 || gold <= 4500` uncaught); `gold >= 7500 && virtue >= 4` → single_rich; else loveless.
- Loveless husband: Arnott if `flags.kindToArnott || suitors.arnott >= 2`, else Monckton.
- Monte-Carlo targets under uniform random play: `madhouse` ≤ 30 % AND every ending ≥ 10 %. Tune only the numeric thresholds inside `resolveEnding`, never the structure.
- Ending prose is Hilary-reviewable: keep the drafts below, flag them for her review at the end.
- Reckoning panel must not overlap the ending title band (y 64–124) or text box (y ≥ 300).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure resolver `resolveEnding` + `lovelessHusband`

**Files:**
- Modify: `cecilia.html` — pure-logic block (after `chaseDifficulty`, ~line 1014) and the `window.Cecilia` export (~line 3013).

**Interfaces:**
- Consumes: `gs` shape from `blankGS()` (`{stats:{hearts,gold,virtue}, suitors:{...arnott}, flags:{...kindToArnott}}`).
- Produces: `resolveEnding(caught, gs) -> 'delvile'|'madhouse'|'single_rich'|'loveless'` and `lovelessHusband(gs) -> 'Mr. Arnott'|'Mr. Monckton'`, both exported on `window.Cecilia`. Tasks 2–5 depend on these exact names.

- [ ] **Step 1: Create the branch**

```powershell
git -C C:\Users\hhavens1\cecilia checkout -b stat-endings
```

- [ ] **Step 2: Write the failing test.** `browser_navigate` to `file:///C:/Users/hhavens1/cecilia/cecilia.html`, then `browser_evaluate`:

```js
() => {
  const C = window.Cecilia;
  const g = (hearts, gold, virtue, extra = {}) => {
    const gs = C.blankGS();
    gs.stats = { hearts, gold, virtue };
    Object.assign(gs.flags, extra.flags || {}); Object.assign(gs.suitors, extra.suitors || {});
    return gs;
  };
  const R = C.resolveEnding;
  return { pass:
    R(true,  g(3, 8000, 5)) === 'delvile' &&        // love bar, caught
    R(false, g(4, 8000, 5)) === 'single_rich' &&    // 4 hearts not enough uncaught; standing carries her
    R(false, g(5, 1000, 1)) === 'delvile' &&        // delirium rescue: love outranks collapse
    R(true,  g(2, 3000, 5)) === 'madhouse' &&       // collapse, caught line
    R(true,  g(2, 3001, 3)) !== 'madhouse' &&       // just above caught line
    R(false, g(2, 4500, 5)) === 'madhouse' &&       // widened uncaught line (gold)
    R(false, g(2, 8000, 3)) === 'madhouse' &&       // widened uncaught line (virtue)
    R(true,  g(2, 7500, 4)) === 'single_rich' &&
    R(true,  g(2, 7499, 6)) === 'loveless' &&
    R(true,  g(2, 9000, 3)) === 'loveless' &&
    C.lovelessHusband(g(0, 5000, 4, { flags: { kindToArnott: true } })) === 'Mr. Arnott' &&
    C.lovelessHusband(g(0, 5000, 4, { suitors: { arnott: 2 } })) === 'Mr. Arnott' &&
    C.lovelessHusband(g(0, 5000, 4)) === 'Mr. Monckton' };
}
```

- [ ] **Step 3: Run it — expect failure** (`C.resolveEnding` is `undefined`, evaluate throws or returns `pass: false`).

- [ ] **Step 4: Implement.** In `cecilia.html`, immediately after `chaseDifficulty` (~line 1014), add:

```js
// Two-axis ending grid (spec: docs/superpowers/specs/2026-07-12-stat-endings-design.md).
// Love is checked FIRST so a collapsed Cecilia whose devotion clears the bar is
// married out of her delirium rather than committed. Failing the chase raises the
// love bar (5 vs 3) and widens the madhouse trapdoor.
function resolveEnding(caught, gs) {
  const s = gs.stats;
  if (s.hearts >= (caught ? 3 : 5)) return 'delvile';
  const collapsed = caught ? (s.virtue <= 2 || s.gold <= 3000)
                           : (s.virtue <= 3 || s.gold <= 4500);
  if (collapsed) return 'madhouse';
  if (s.gold >= 7500 && s.virtue >= 4) return 'single_rich';
  return 'loveless';
}
// Who takes the Beverley name in the loveless ending.
function lovelessHusband(gs) {
  return (gs.flags.kindToArnott || gs.suitors.arnott >= 2) ? 'Mr. Arnott' : 'Mr. Monckton';
}
```

Add `resolveEnding, lovelessHusband,` to the `window.Cecilia` export object (~line 3014).

- [ ] **Step 5: Reload the page and re-run the Step 2 test.** Expected: `{ pass: true }`. Also confirm `browser_console_messages` shows no errors.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\hhavens1\cecilia add cecilia.html
git -C C:\Users\hhavens1\cecilia commit -m "feat: add resolveEnding two-axis grid + lovelessHusband (item 14)"
```

---

### Task 2: ENDINGS trimmed to the four flat endings

**Files:**
- Modify: `cecilia.html` — `ENDINGS` object (~lines 1206–1252) and `chooseEnding` (~line 1258).

**Interfaces:**
- Consumes: `lovelessHusband(gs)` (Task 1), existing `resolveSceneText(scene, gs)` and `gameState()`.
- Produces: `ENDINGS` with exactly the keys `single_rich`, `delvile`, `madhouse`, `loveless` (each `{title, text, bg}`; `loveless.text` is a function of `gs`). `chooseEnding` renders function texts. Note: the old keys are still referenced by the wish menu / `resolveWish` until Task 3 removes them — the game will throw if an old ending is triggered between Tasks 2 and 3; that is expected mid-branch state.

- [ ] **Step 1: Write the failing test** (`browser_evaluate`):

```js
() => {
  const C = window.Cecilia;
  return { keysOk: JSON.stringify(C.endingKeys.slice().sort()) ===
                   JSON.stringify(['delvile', 'loveless', 'madhouse', 'single_rich']) };
}
```

(Ending-text checks come in Step 5 — `endingKeys` is the failing gate here; it currently lists 9 old keys.)

- [ ] **Step 2: Run it — expect `keysOk: false`.**

- [ ] **Step 3: Replace `ENDINGS` (~1206–1252) wholesale with:**

```js
const ENDINGS = {
  single_rich: {
    title: "SINGLE & RICH",
    text: "Fortune kept and conscience clear, you marry no one. You become a celebrated London hostess, generous and free - the most modern of all Cecilia's possible lives.\n\nTHE END",
    bg: 'ballroom'
  },
  delvile: {
    title: "MARRIED TO DELVILE",
    text: "Love carries her through fever and flight alike. Mrs. Delvile softens at last, and Mortimer marries her - the Beverley fortune passes to Mr. Eggleston under the name condition, but Cecilia wakes to a plainer, truer happiness.\n\nTHE END",
    bg: 'wedding'
  },
  madhouse: {
    title: "THE MADHOUSE",
    text: "Raving and unknown, Cecilia is carried to a private madhouse and locked among strangers. No friend with power to free her comes in time, and the world that courted her fortune lets her name dissolve into the ward's anonymous dark.\n\nA warning, Burney tells us, of what society does to an unguarded heart.\n\nTHE END",
    bg: 'storm'
  },
  loveless: {
    title: "A LOVELESS MARRIAGE",
    text: (gs) => lovelessHusband(gs) + " takes the Beverley name, and the fortune is preserved. The match is solvent, respectable, and cold: her name endures, her house is safe - but her heart was never consulted.\n\nTHE END",
    bg: 'manor'
  }
};
```

- [ ] **Step 4: Make `chooseEnding` render function texts.** In `chooseEnding` (~line 1258), change

```js
  fullText = currentScene.text;
```

to

```js
  fullText = resolveSceneText(currentScene, gameState());
```

- [ ] **Step 5: Reload and verify** (`browser_evaluate`):

```js
() => {
  const C = window.Cecilia;
  const gsA = C.blankGS(); gsA.flags.kindToArnott = true;
  const gsM = C.blankGS();
  const loveless = { text: null };
  // ENDINGS is a page global (non-module script): read it directly.
  const E = ENDINGS;
  return { pass:
    JSON.stringify(C.endingKeys.slice().sort()) === JSON.stringify(['delvile','loveless','madhouse','single_rich']) &&
    E.loveless.text(gsA).startsWith('Mr. Arnott') &&
    E.loveless.text(gsM).startsWith('Mr. Monckton') &&
    typeof E.single_rich.text === 'string' && typeof E.delvile.text === 'string' && typeof E.madhouse.text === 'string' };
}
```

Expected: `{ pass: true }`. NOTE: `endingKeys` was computed at load (`Object.keys(ENDINGS)`), so a plain reload picks up the new keys.

- [ ] **Step 6: Commit**

```powershell
git -C C:\Users\hhavens1\cecilia add cecilia.html
git -C C:\Users\hhavens1\cecilia commit -m "feat: four flat endings; chooseEnding renders dynamic text"
```

---

### Task 3: Remove the wish menu; chase resolves straight into the grid

**Files:**
- Modify: `cecilia.html` —
  - delete `resolveWish` (~966–983), `resolveBreakpoint` (~984–992), old `resolveChase` (~993–1002), `shouldBreakDown` (~960–964);
  - delete the wish-menu scene (last `SCENES` entry, ~1194–1203);
  - stage-gate scene `onContinue` (~1186–1193);
  - `chaseReturnIdx` declaration (~line 929);
  - `updateChase` finish block (~2768–2773);
  - `update()` chase branch (~2916–2921);
  - `window.Cecilia` export (~3013–3020).

**Interfaces:**
- Consumes: `resolveEnding(caught, gs)` (Task 1), `chooseEnding(key)` + `ENDINGS` keys (Task 2).
- Produces: `chase.outcome` now holds an ENDING KEY (one of the four), never `'wish'`; `chase.mad === (chase.outcome === 'madhouse')`. Seam exports drop `resolveWish`, `resolveBreakpoint`, `resolveChase`, `shouldBreakDown`. `chaseResultEnding()` still returns `chase.outcome`.

- [ ] **Step 1: Write the failing test** (`browser_evaluate`):

```js
() => {
  const C = window.Cecilia;
  return { pass:
    C.resolveWish === undefined && C.resolveBreakpoint === undefined &&
    C.resolveChase === undefined && C.shouldBreakDown === undefined &&
    C.SCENES[C.SCENES.length - 1].onContinue !== undefined &&   // stage gate is now the LAST scene
    C.SCENES[C.SCENES.length - 1].choices === undefined };      // the wish menu (a choices scene) is gone
}
```

- [ ] **Step 2: Run it — expect `pass: false`** (old resolvers still exported; wish menu still last).

- [ ] **Step 3: Delete the old logic.**
  - Remove the four functions `shouldBreakDown`, `resolveWish`, `resolveBreakpoint`, `resolveChase` (and the `// Breaking point:` / `// Stage 2 wish menu ->` / `// Declared-mad resolution` / `// Chase outcome routing:` comment blocks above them).
  - Remove the wish-menu scene (the final `SCENES` entry, the one whose text is `"What does Cecilia wish for, in her heart of hearts?"`).
  - Remove the module var `let chaseReturnIdx = 0;` (~line 929) and its comment.

- [ ] **Step 4: Rewire the stage gate** (~1186–1193) — drop the `chaseReturnIdx` line and update the comment:

```js
  { // Stage gate: the chase always plays; the ending grid resolves when it finishes.
    bg: 'storm', speaker: '',
    text: "Mr. Eggleston demands Cecilia's property, and she flees to London, in pursuit of Mortimer Delvile...",
    onContinue: () => { state = 'chase'; initChase(); }
  }
```

- [ ] **Step 5: Rewire `updateChase` finish** (~2768–2773):

```js
    if (chase.finished) {
      if (chase.caught) flags.caughtDelvile = true;
      chase.outcome = resolveEnding(chase.caught, gameState());   // an ENDINGS key
      chase.mad = (chase.outcome === 'madhouse');                 // drives the DECLARED MAD banner
      playSound(chase.caught ? 'victory' : 'hurt');
    }
```

- [ ] **Step 6: Rewire the `update()` chase branch** (~2916–2921):

```js
  } else if (state === 'chase') {
    updateChase();
    if (chase.finished && (keyPressed('Space') || keyPressed('Enter'))) {
      chooseEnding(chase.outcome);   // the grid has already resolved; no wish menu
    }
```

- [ ] **Step 7: Trim the seam** (~3013–3020) to:

```js
window.Cecilia = {
  blankGS, applyGift, resolveEnding, lovelessHusband, chaseDifficulty,
  resolveSceneText, visibleChoices, gameState, SCENES, clampVirtue, clampHearts,
  giveTo(kind) { return applyGift(gameState(), kind); },
  chaseResultEnding,
  endingKeys: Object.keys(ENDINGS),
  get live() { return { stats, suitors, flags, state, currentSceneIdx }; }
};
```

- [ ] **Step 8: Reload, re-run the Step 1 test** — expected `{ pass: true }` — and check `browser_console_messages` for errors (a leftover reference to a deleted function throws at load).

- [ ] **Step 9: Grep for stragglers** — `resolveWish|resolveBreakpoint|shouldBreakDown|chaseReturnIdx|resolveChase\(` must have zero hits in `cecilia.html` (comments included; the string `resolveChase` may remain only inside `.md` docs).

- [ ] **Step 10: Commit**

```powershell
git -C C:\Users\hhavens1\cecilia add cecilia.html
git -C C:\Users\hhavens1\cecilia commit -m "feat: remove wish menu; chase resolves ending grid directly"
```

---

### Task 4: Final-reckoning stats panel on the ending screen

**Files:**
- Modify: `cecilia.html` — new `drawFinalReckoning()` next to `drawHUD` (~line 2395), call it in the `state === 'ending'` draw branch (~2970–2977, after the title block).

**Interfaces:**
- Consumes: live `stats`, `fmtGold`, `drawText`, `drawSprite`, `fillRect`, `SP.heart`, palette `C.*` (all existing page globals; copy pitch constants from `drawHUD`, which stays untouched).
- Produces: `drawFinalReckoning()` — display only, no logic, no seam export.

- [ ] **Step 1: Add the panel function** (after `drawHUD`'s closing brace, ~line 2394):

```js
// Final reckoning: the three stats that decided the ending, writ large (item 14).
// Three centered rows at scale 2 (a single row at S=2 is ~910px and cannot fit W=800).
// Band y 130..290 sits between the title band (64..124) and the text box (300..).
function drawFinalReckoning() {
  const S = 2, CH = 8 * S, gap = 16;
  const top = 130, rowH = 48, panH = 16 + 3 * rowH;   // 160 -> bottom edge 290
  fillRect(0, top, W, panH, C.k);
  fillRect(0, top, W, 4, C.w);
  fillRect(0, top + panH - 4, W, 4, C.w);
  const heartPitch = 50, heartBox = 36;      // 25/18 at 1x, scaled 2x (cf. drawHUD)
  const pipPitch = 32, pipW = 24, pipH = 40; // 16/12/20 at 1x, scaled 2x
  let y = top + 8;
  // LOVE
  let w = 4 * CH + gap + 4 * heartPitch + heartBox;
  let x = Math.round((W - w) / 2);
  drawText('LOVE', x, y + Math.round((rowH - CH) / 2), C.w, S, 'left', false);
  x += 4 * CH + gap;
  for (let i = 0; i < 5; i++) {
    if (i < stats.hearts) drawSprite(SP.heart, x + i * heartPitch, y + Math.round((rowH - heartBox) / 2), S);
    else fillRect(x + i * heartPitch, y + Math.round((rowH - heartBox) / 2), heartBox, heartBox, C.u);
  }
  y += rowH;
  // GOLD
  const goldStr = fmtGold(stats.gold);
  w = 4 * CH + gap + goldStr.length * CH;
  x = Math.round((W - w) / 2);
  drawText('GOLD', x, y + Math.round((rowH - CH) / 2), C.g, S, 'left', false);
  drawText(goldStr, x + 4 * CH + gap, y + Math.round((rowH - CH) / 2), C.g, S, 'left', false);
  y += rowH;
  // VIRTUE
  w = 6 * CH + gap + 5 * pipPitch + pipW;
  x = Math.round((W - w) / 2);
  drawText('VIRTUE', x, y + Math.round((rowH - CH) / 2), C.h, S, 'left', false);
  x += 6 * CH + gap;
  for (let i = 0; i < 6; i++) {
    fillRect(x + i * pipPitch, y + Math.round((rowH - pipH) / 2), pipW, pipH, i < stats.virtue ? C.v : C.u);
  }
}
```

Check `drawHUD`'s exact glyph-vertical-centering idiom while there (`Math.round((BAR - CH) / 2)`) and keep the same idiom; also confirm the `drawText(...,'left', false)` trailing-argument signature matches `drawHUD`'s usage.

- [ ] **Step 2: Call it in the ending draw branch.** In `draw()`'s `state === 'ending'` block (~2970), after the title `if (currentScene.title) { ... }` block, add:

```js
    drawFinalReckoning();
```

- [ ] **Step 3: Visual verification — all four endings.** Reload; for each key in `['single_rich','delvile','madhouse','loveless']` run `browser_evaluate` (page functions are global):

```js
() => { stats.hearts = 4; stats.gold = 8200; stats.virtue = 5; flags.kindToArnott = true; chooseEnding('single_rich'); }
```

(then repeat swapping the key), take `browser_take_screenshot` each time, and confirm: panel centered under the title, hearts/gold/virtue readable at 2×, no overlap with title band or text box, loveless text names Mr. Arnott. Also screenshot once with `flags.kindToArnott=false` (fresh reload) → Mr. Monckton.

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\hhavens1\cecilia add cecilia.html
git -C C:\Users\hhavens1\cecilia commit -m "feat: final-reckoning stats panel on ending screens"
```

---

### Task 5: Monte-Carlo balance harness + tuning

**Files:**
- Create: `balance-check.mjs` (repo root).
- Modify (only if targets miss): `resolveEnding` numeric thresholds in `cecilia.html`.

**Interfaces:**
- Consumes: `window.Cecilia` seam (`blankGS`, `SCENES`, `visibleChoices`, `applyGift`, `chaseDifficulty`, `resolveEnding`).
- Produces: `node balance-check.mjs [runs]` printing the 4-ending distribution and PASS/FAIL against the targets; exit code 1 on FAIL.

- [x] **Step 1: Write `balance-check.mjs`:**

```js
// Monte-Carlo ending-balance check for cecilia.html (item 14).
// Spec targets (docs/superpowers/specs/2026-07-12-stat-endings-design.md):
//   madhouse <= 30% AND every ending >= 10% under uniform random play.
// Usage: node balance-check.mjs [runs]   (default 5000)
//
// Loads the game script in a stubbed-DOM vm sandbox; a universal Proxy stands in
// for canvas/ctx/AudioContext so the script's load-time side effects are inert.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./cecilia.html', import.meta.url), 'utf8');
const src = html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

const proxy = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : proxy),
  set: () => true,
  apply: () => proxy,
  construct: () => proxy,
});
const sandbox = {
  document: { getElementById: () => proxy, addEventListener: () => {} },
  requestAnimationFrame: () => 0,
  addEventListener: () => {},
  AudioContext: proxy,
  webkitAudioContext: proxy,
  performance, console, Math, Date, JSON, Object, Array,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const C = sandbox.window.Cecilia;
if (!C || typeof C.resolveEnding !== 'function') {
  console.error('FAIL: could not load the Cecilia seam from cecilia.html');
  process.exit(1);
}

// One random playthrough. Calibration notes:
//  - Story choices: every SCENES choice menu is answered uniformly at random
//    (in real play every NPC room detour is mandatory, so all menus are seen).
//  - Charity minigame: 4 worthy targets (~£25) and 3 spendthrifts (£1000-2500),
//    each given to with p=0.5 (mirrors initMinigame's target list).
//  - Chase: P(caught) maps chaseDifficulty's ~[0.5,3] range linearly onto
//    [0.05,0.95] — same shape the game's steering/mash difficulty follows.
function simulate() {
  const gs = C.blankGS();
  for (const sc of C.SCENES) {
    if (sc.condition && !sc.condition(gs)) continue;
    const vis = C.visibleChoices(sc, gs);
    if (!vis || !vis.length) continue;
    const ch = vis[Math.floor(Math.random() * vis.length)];
    if (ch.effect) ch.effect(gs);
  }
  for (let i = 0; i < 4; i++) if (Math.random() < 0.5) C.applyGift(gs, 'worthy', 25);
  for (let i = 0; i < 3; i++) if (Math.random() < 0.5) C.applyGift(gs, 'unworthy', 1000 + Math.floor(Math.random() * 4) * 500);
  const p = Math.min(0.95, Math.max(0.05, (C.chaseDifficulty(gs) - 0.5) / 2.5));
  return C.resolveEnding(Math.random() < p, gs);
}

const runs = Number(process.argv[2] || 5000);
const tally = { single_rich: 0, delvile: 0, madhouse: 0, loveless: 0 };
for (let i = 0; i < runs; i++) tally[simulate()]++;

let ok = true;
for (const [k, n] of Object.entries(tally)) {
  const pct = n / runs;
  const bad = (k === 'madhouse' && pct > 0.30) || pct < 0.10;
  if (bad) ok = false;
  console.log(`${k.padEnd(12)} ${(pct * 100).toFixed(1)}%${bad ? '  <-- OUT OF BAND' : ''}`);
}
console.log(ok ? 'PASS (madhouse <= 30%, all endings >= 10%)' : 'FAIL');
process.exit(ok ? 0 : 1);
```

- [x] **Step 2: Run it:** `node C:\Users\hhavens1\cecilia\balance-check.mjs`. First hurdle is the sandbox loading cleanly. If `vm.runInContext` throws, the error names the missing global — add it to `sandbox` as `proxy` (or a no-op) and re-run; iterate until the seam loads. Do NOT edit `cecilia.html` to accommodate the harness.

- [x] **Step 3: Judge the distribution.** Expected: PASS. If out of band, tune ONLY `resolveEnding` numbers, in this preference order, re-running after each change:
  - `madhouse` > 30 % → soften the uncaught collapse line (e.g. `4500` → `4000`, or `virtue <= 3` → `<= 2`).
  - `delvile` < 10 % → lower the caught love bar 3 → 2 (keep uncaught at 5).
  - `single_rich` < 10 % → lower its gold floor `7500` → `7000`.
  - `loveless` < 10 % → raise `single_rich`'s floor back up or tighten the delvile bar.
  Then update the same numbers in the spec's Resolution-logic section and in this plan's Global Constraints so all three stay in agreement, and note the change in the commit message.

- [x] **Step 4: Record the passing distribution** — paste the final percentages into a `## Balance results (YYYY-MM-DD)` section appended to this plan file.

- [x] **Step 5: Commit**

```powershell
git -C C:\Users\hhavens1\cecilia add balance-check.mjs cecilia.html docs/
git -C C:\Users\hhavens1\cecilia commit -m "feat: Monte-Carlo balance harness; distribution in band"
```

---

### Task 6: End-to-end verification + docs

**Files:**
- Modify: `docs/superpowers/plans/2026-07-12-stat-endings.md` (this file — check boxes, balance results).
- No game-code changes expected; fix-forward anything found, smallest change that satisfies the spec.

**Interfaces:**
- Consumes: everything above.
- Produces: a branch ready for `superpowers:finishing-a-development-branch`.

- [x] **Step 1: Full playthrough #1 (aiming at MARRIED TO DELVILE).** `browser_navigate` to the file URL and play with Playwright key presses: court Mortimer at every chance (greet warmly, secret marriage), give only to worthy causes, win the chase (mash Space in phase 2). Confirm: no wish menu ever appears; after "YOU REACH HIM" + Space the ending renders directly with the reckoning panel; title MARRIED TO DELVILE (hearts ≥ 3). — PASS: hearts=4, gold=£7,325, virtue=6/6, caught=true, title "MARRIED TO DELVILE" rendered directly, no wish menu. Screenshot: `.superpowers/sdd/item14-task6-run1.png`.
- [x] **Step 2: Full playthrough #2 (aiming at SINGLE & RICH / LOVELESS).** Keep distance from Mortimer, hoard gold, stay virtuous where free; let the chase be lost (don't mash). Confirm ending matches `resolveEnding` for the finishing stats (read `window.Cecilia.live` just before the chase ends and compute by hand), reckoning panel correct, `PRESS SPACE TO RESTART` still works and restarts cleanly. — PASS: hearts=0, gold=£8,500, virtue=6/6, caught=false; hand-computed expected `single_rich` (gold ≥ 7500 & virtue ≥ 4, not collapsed); actual `chase.outcome === 'single_rich'` — match. Restart via Space confirmed clean (stats/flags/state all reset, state='title'). Screenshot: `.superpowers/sdd/item14-task6-run2.png`.
- [x] **Step 3: Console sweep** — `browser_console_messages` across both runs: no errors (only the allowed favicon 404, x4).
- [x] **Step 4: Regression checks** (`browser_evaluate`): `Cecilia.SCENES[4].speaker === 'MR. BRIGGS'` → true; Georgian room (8 NPCs) and Castle Hall room (4 NPCs) both entered/exited cleanly with door-open-after-all-met gating intact in both playthroughs; `M` mute toggle → `musicOn` flips true/false; charity minigame applies gold/virtue deltas — playthrough 1 (worthy-only): 7 gifts given, gold 10000→7325, playthrough 2 (hoarding): 0 gifts given, one unworthy hit, gold 11000→8500, virtue 6→5.
- [x] **Step 5: Re-run `node balance-check.mjs`** one last time on the final code. Expected: PASS. — Ran twice: run A (single_rich 26.0%, delvile 12.0%, madhouse 20.9%, loveless 41.1%) PASS; run B (single_rich 26.0%, delvile 11.4%, madhouse 20.8%, loveless 41.8%) PASS. No tuning needed.
- [x] **Step 6: Update docs** — check off this plan; if any threshold was tuned in Task 5, confirm the spec was updated to match. — No thresholds tuned in Task 5 or Task 6; resolver unchanged from Task 1.
- [ ] **Step 7: Commit, then invoke `superpowers:finishing-a-development-branch`** (merge to `main` + push has been the repo's pattern; Hilary reviews ending prose before or at merge). — deferred to caller per this session's task scope (Task 6 verification only); branch is ready.

## Task 6 verification notes (2026-07-12)

Full report: `.superpowers/sdd/item14-task-6-report.md`.

**Deviation from the brief's literal instructions (disclosed):** real single `browser_press_key` calls for room-walking and charity-minigame movement proved to have a near-zero/unreliable per-press hit rate in this environment (spot-tested: 10-20 consecutive real ArrowLeft presses produced 0-5px of movement against an expected ~2.5px/frame-held rate) — walking either room fully this way would have required many thousands of tool calls. Two adaptations were used instead, both disclosed here:
1. **Room navigation** (pure UI position, not story/stat state): `room.px`/`room.py` were set directly via `browser_evaluate` to place Cecilia within each NPC's proximity threshold; the actual NPC encounter (entering the scene), all dialogue, and every choice selection were then played for real via `browser_press_key` (Space/ArrowUp/ArrowDown), exactly as a human would. No story content was skipped and no stats/flags were ever set directly.
2. **Charity minigame and chase phase 2** (real-time action segments): held/rapid input was supplied via `browser_evaluate` dispatching real `KeyboardEvent('keydown'/'keyup')` bursts against `window` (the same mechanism the brief explicitly sanctions for the chase-phase-2 mash) rather than literal single presses, since the minigame likewise needs many rapid, precisely-timed inputs over a ~19-second scrolling level.

Both playthroughs' resulting stats, choice effects, and ending resolutions were verified against the source (`SCENES[i].choices[j].effect`) and matched exactly, so the deviation did not touch any logic under test — it only worked around Playwright's key-press timing being too coarse for this canvas game's per-frame key-state reads.

---

## Self-Review

- **Spec coverage:** resolver grid + delirium rescue (Task 1); four flat endings + dynamic loveless husband (Task 2); wish-menu/old-resolver removals + declared-mad routing (Task 3); prominent final-stats panel (Task 4); Node Monte-Carlo harness, targets, tuning rule (Task 5); Playwright grid/e2e tests + both chase outcomes (Tasks 1–3, 6). Covered.
- **Type consistency:** `resolveEnding(caught, gs)` and the four ending keys are identical across Tasks 1, 2, 3, 5; `chase.outcome` holds an ending key from Task 3 onward and `chaseResultEnding` still reads it; `lovelessHusband` returns the exact strings asserted in Task 1 and rendered in Task 2.
- **Known mid-branch break:** between Tasks 2 and 3 the wish menu still calls `resolveWish` on deleted ending keys — documented in Task 2's Interfaces; Tasks 2 and 3 must land in the same session.

## Balance results (2026-07-12)

`node balance-check.mjs 5000`, run twice; no threshold tuning was needed — the first run was already in band:

| ending      | run 1 | run 2 |
|-------------|-------|-------|
| single_rich | 26.2% | 25.6% |
| delvile     | 11.2% | 12.6% |
| madhouse    | 21.4% | 21.5% |
| loveless    | 41.1% | 40.3% |

Both runs PASS (madhouse ≤ 30%, all endings ≥ 10%); per-ending percentages agree within ~2 points between runs, consistent with expected Monte-Carlo variance at 5000 runs. `resolveEnding` thresholds are unchanged from Task 1 (love: `hearts >= 3` caught / `>= 5` uncaught; collapse: `virtue <= 2 || gold <= 3000` caught / `virtue <= 3 || gold <= 4500` uncaught; single_rich: `gold >= 7500 && virtue >= 4`).
