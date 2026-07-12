# Pac-Man Streets-of-London Chase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both phases of the delirium chase in `cecilia.html` with a single top-down Pac-Man-style maze: Cecilia on foot corners Delvile's moving carriage in a London street maze while a shopkeeper hunts her, under a 90-second delirium timer.

**Architecture:** Everything lives in the single `<script>` of `cecilia.html` (this game is one file by design). Pure decision logic (`resolveMazeOutcome`, the `MAZE` grid) goes in the existing "PURE DECISION LOGIC" section and is exported on the `window.Cecilia` seam so `maze-check.mjs` (new) and `balance-check.mjs` (rewritten chase model) can test it in a Node `vm` sandbox. The game-loop code rewrites `initChase`/`updateChase`/`drawChase` in place; the surrounding state machine (`state === 'chase'` branches, ending flow) is untouched.

**Tech Stack:** Vanilla JS + canvas (no libraries), Node ≥ 18 for the check scripts, Playwright MCP for in-browser verification.

**Spec:** `docs/superpowers/specs/2026-07-12-pacman-chase-design.md`

## Global Constraints

- Work on branch `pacman-chase` off `main`.
- `resolveEnding` (cecilia.html:975) must NOT be modified.
- `node balance-check.mjs` must PASS before merge: madhouse ≤ 30% AND every ending ≥ 10%.
- Delirium timer: 90 s = 5400 frames. Speeds: Cecilia 2.5 px/f (3.75 boosted for 300 frames), Delvile 2.1, shopkeeper 2.3 (1.8 frightened). Catch radius 24 px.
- Pellets: 3 hearts (+1 LOVE via `clampHearts`), 8 coins (+£250 each), 3 boosts.
- Maze: 20 × 13 tiles of 40 px at y-offset 60 (HUD strip above); canvas is `W = 800, H = 600` (cecilia.html:116).
- Existing helpers to reuse, not reinvent: `fillRect(x,y,w,h,color)`, `drawText(text,x,y,color,size,align,shadow)`, `drawSprite(sprite,x,y,scale,colorMap,outline)`, `playSound(name)` (names: `type`,`select`,`hurt`,`victory`), palette `C` (cecilia.html:119-132), `keys` / `keys['X_p']` fresh-press flags, `keyPressed(code)`.
- Sprite art uses the existing palette letters only (`.` = transparent).
- Commit after every task; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Branch + `resolveMazeOutcome` + seam test harness

**Files:**
- Modify: `cecilia.html` (~line 983, right after `resolveEnding`; and the `window.Cecilia` object at ~line 2987)
- Create: `maze-check.mjs` (repo root, beside `balance-check.mjs`)

**Interfaces:**
- Consumes: `resolveEnding(caught, gs)` (unchanged, cecilia.html:975).
- Produces: `resolveMazeOutcome(result, gs)` where `result` is `'reached' | 'caught' | 'collapsed'` and `gs` is a `gameState()`-shaped object; returns an `ENDINGS` key string. Exported on `window.Cecilia`. Also produces the `maze-check.mjs` loader that later tasks extend.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b pacman-chase
```

- [ ] **Step 2: Write the failing test file**

Create `maze-check.mjs`. The loader block is copied verbatim from `balance-check.mjs` lines 8–39 (same Proxy-sandbox technique):

```js
// Seam checks for the Pac-Man maze chase (item 18).
// Spec: docs/superpowers/specs/2026-07-12-pacman-chase-design.md
// Usage: node maze-check.mjs
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
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  AudioContext: proxy,
  webkitAudioContext: proxy,
  performance, console, Math, Date, JSON, Object, Array,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const C = sandbox.window.Cecilia;
if (!C) { console.error('FAIL: no Cecilia seam'); process.exit(1); }

let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// --- resolveMazeOutcome: every branch of the outcome grid ---
const gs = (hearts, gold, virtue) => ({ stats: { hearts, gold, virtue }, suitors: {}, flags: {} });
ok('reached + hearts 3 -> delvile',        C.resolveMazeOutcome('reached',   gs(3, 8000, 5)) === 'delvile');
ok('reached + rich -> single_rich',        C.resolveMazeOutcome('reached',   gs(0, 9000, 5)) === 'single_rich');
ok('reached + poor -> madhouse',           C.resolveMazeOutcome('reached',   gs(0, 2000, 5)) === 'madhouse');
ok('reached + middling -> loveless',       C.resolveMazeOutcome('reached',   gs(0, 6000, 5)) === 'loveless');
ok('caught + hearts 5 -> delvile rescue',  C.resolveMazeOutcome('caught',    gs(5, 9000, 6)) === 'delvile');
ok('caught + hearts 4 -> madhouse',        C.resolveMazeOutcome('caught',    gs(4, 9000, 6)) === 'madhouse');
ok('collapsed + hearts 5 -> delvile',      C.resolveMazeOutcome('collapsed', gs(5, 8000, 5)) === 'delvile');
ok('collapsed + hearts 4 -> not delvile',  C.resolveMazeOutcome('collapsed', gs(4, 8000, 5)) !== 'delvile');
ok('collapsed + rich -> single_rich',      C.resolveMazeOutcome('collapsed', gs(0, 9000, 5)) === 'single_rich');
ok('collapsed + low virtue -> madhouse',   C.resolveMazeOutcome('collapsed', gs(0, 9000, 3)) === 'madhouse');

console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node maze-check.mjs`
Expected: FAIL lines (or a TypeError) — `resolveMazeOutcome` is not a function yet.

- [ ] **Step 4: Implement `resolveMazeOutcome`**

In `cecilia.html`, directly after the `resolveEnding` function (after line 983), add:

```js
// Maze-chase outcome -> ENDINGS key (spec: docs/superpowers/specs/2026-07-12-pacman-chase-design.md).
// result: 'reached' (she corners Delvile) | 'caught' (the shopkeeper seizes her) | 'collapsed' (delirium timer).
// Seized by the shopkeeper, only a full heart saves her from committal.
function resolveMazeOutcome(result, gs) {
  if (result === 'reached')   return resolveEnding(true, gs);
  if (result === 'collapsed') return resolveEnding(false, gs);
  return gs.stats.hearts >= 5 ? 'delvile' : 'madhouse';
}
```

In the `window.Cecilia` object (~line 2987), add `resolveMazeOutcome` to the first export line:

```js
window.Cecilia = {
  blankGS, applyGift, resolveEnding, resolveMazeOutcome, lovelessHusband, chaseDifficulty,
  ...
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node maze-check.mjs` → Expected: all `ok`, final `PASS`, exit 0.
Run: `node balance-check.mjs` → Expected: still PASS (nothing it uses changed).

- [ ] **Step 6: Commit**

```bash
git add cecilia.html maze-check.mjs
git commit -m "feat: resolveMazeOutcome grid + maze-check seam harness (item 18)"
```

---

### Task 2: Maze data + geometry helpers

**Files:**
- Modify: `cecilia.html` (the `// === DELIRIUM CHASE ===` section, ~line 2680; seam at ~line 2987)
- Modify: `maze-check.mjs` (append integrity tests)

**Interfaces:**
- Produces (used by Tasks 3–4): constants `TILE = 40`, `MAZE_Y = 60`, `MAZE` (array of 13 twenty-char strings); `parseMaze()` → `{ pellets: [{c, r, kind: 'h'|'c'|'b', taken: false}], spawns: {P: {c,r}, D: {c,r}, S: {c,r}} }`; `mazeWall(c, r)` → boolean (out-of-bounds counts as wall); `tileCX(c)` / `tileCY(r)` → pixel center of a tile. `MAZE` and `parseMaze` exported on the seam.

- [ ] **Step 1: Append failing integrity tests to `maze-check.mjs`** (before the final `console.log`/`process.exit` lines)

```js
// --- maze integrity ---
const M = C.MAZE;
ok('maze is 13 rows', Array.isArray(M) && M.length === 13);
ok('every row is 20 chars', M.every(r => r.length === 20));
ok('border is solid wall', M[0] === '#'.repeat(20) && M[12] === '#'.repeat(20)
   && M.every(r => r[0] === '#' && r[19] === '#'));
const count = ch => M.join('').split('').filter(x => x === ch).length;
ok('3 hearts', count('h') === 3);
ok('8 coins', count('c') === 8);
ok('3 boosts', count('b') === 3);
ok('one spawn each', count('P') === 1 && count('D') === 1 && count('S') === 1);
ok('parseMaze finds 14 pellets', C.parseMaze().pellets.length === 14);
ok('parseMaze finds 3 spawns', Object.keys(C.parseMaze().spawns).sort().join('') === 'DPS');

// BFS from Cecilia's spawn: every pellet and spawn must be reachable
let start;
for (let r = 0; r < 13; r++) for (let c = 0; c < 20; c++) if (M[r][c] === 'P') start = c + ',' + r;
const seen = new Set([start]);
const q = [start];
while (q.length) {
  const [c, r] = q.shift().split(',').map(Number);
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nc = c + dc, nr = r + dr, k = nc + ',' + nr;
    if (nr < 0 || nr > 12 || nc < 0 || nc > 19 || M[nr][nc] === '#' || seen.has(k)) continue;
    seen.add(k); q.push(k);
  }
}
let unreachable = 0;
for (let r = 0; r < 13; r++) for (let c = 0; c < 20; c++)
  if ('hcbDS'.includes(M[r][c]) && !seen.has(c + ',' + r)) unreachable++;
ok('all pellets & spawns reachable from P', unreachable === 0);
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node maze-check.mjs` → Expected: the Task-1 tests pass, the new ones FAIL (`C.MAZE` undefined).

- [ ] **Step 3: Add the maze data and helpers**

In `cecilia.html`, at the top of the `// === DELIRIUM CHASE ===` section (just after `let chase = null;`, line 2681), add:

```js
// The streets of London: 20x13 tile maze, 40px tiles, under a 60px HUD strip.
// '#' wall, '.' street, 'h' heart, 'c' coin, 'b' boost, P/D/S = Cecilia/Delvile/shopkeeper spawns.
const TILE = 40, MAZE_Y = 60;
const MAZE = [
  "####################",
  "#P......c..c......D#",
  "#.##.###....###.##.#",
  "#.#....#.##.#..c.#.#",
  "#.#.##...##...##.#.#",
  "#c..#..#.h..#..#...#",
  "#.#.#..#..S.#h.#.#.#",
  "#...#..#..h.#..#..c#",
  "#.#.##...##...##.#.#",
  "#.#.c..#.##.#..b.#.#",
  "#.##.###....###.##.#",
  "#b......c..c......b#",
  "####################",
];
function parseMaze() {
  const pellets = [], spawns = {};
  MAZE.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === 'h' || ch === 'c' || ch === 'b') pellets.push({ c, r, kind: ch, taken: false });
      if (ch === 'P' || ch === 'D' || ch === 'S') spawns[ch] = { c, r };
    }
  });
  return { pellets, spawns };
}
function mazeWall(c, r) {
  return r < 0 || r >= MAZE.length || c < 0 || c >= MAZE[0].length || MAZE[r][c] === '#';
}
function tileCX(c) { return c * TILE + TILE / 2; }
function tileCY(r) { return MAZE_Y + r * TILE + TILE / 2; }
```

Add `MAZE, parseMaze,` to the `window.Cecilia` exports.

NOTE: `TILE` must not collide with an existing identifier — run a quick `grep -n "TILE" cecilia.html` first; if taken, rename to `MTILE` everywhere in this plan's code.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node maze-check.mjs` → Expected: all `ok` incl. reachability, `PASS`.
If `all pellets & spawns reachable` FAILS: print the maze, find the walled-off pocket, and open one wall tile to reconnect it (keep counts intact), then rerun.

- [ ] **Step 5: Commit**

```bash
git add cecilia.html maze-check.mjs
git commit -m "feat: London street maze grid + parser for the Pac-Man chase"
```

---

### Task 3: Chase engine — movement, AI, pellets, outcomes

**Files:**
- Modify: `cecilia.html` — replace the bodies of `initChase` (2682–2700) and `updateChase` (2701–2749); add helpers next to them; extend the seam.

**Interfaces:**
- Consumes: Task 2's `MAZE`/`parseMaze`/`mazeWall`/`tileCX`/`tileCY`; Task 1's `resolveMazeOutcome`; existing `chaseDifficulty(gs)`, `gameState()`, `stats`, `flags`, `clampHearts`, `keys`, `playSound`.
- Produces: `chase` object with fields the draw code (Task 4) and state machine read: `intro`, `t`, `boost`, `pellets`, `cecilia`/`delvile`/`shopkeeper` actors (`{x, y, c, r, tc, tr, dir, pause?}`), `finished`, `caught`, `mad`, `result`, `outcome`, `diff`. Seam gains `startChase()` and `get chase()` for browser tests.
- The state-machine contract is unchanged: `updateChase()` per frame; when `chase.finished`, SPACE/ENTER → `chooseEnding(chase.outcome)` (cecilia.html:2890-2894 stays as-is).

- [ ] **Step 1: Replace `initChase` and `updateChase`**

Delete lines 2682–2749 (old `initChase` + `updateChase`, keep `chaseResultEnding` at 2750) and insert:

```js
const DIRS = { up: {dx:0,dy:-1}, down: {dx:0,dy:1}, left: {dx:-1,dy:0}, right: {dx:1,dy:0} };
const OPP  = { up: 'down', down: 'up', left: 'right', right: 'left' };
function makeActor(sp, dir) {
  return { x: tileCX(sp.c), y: tileCY(sp.r), c: sp.c, r: sp.r, tc: sp.c, tr: sp.r, dir };
}
function initChase() {
  const { pellets, spawns } = parseMaze();
  chase = {
    t: 0, intro: true, boost: 0, pellets,
    diff: chaseDifficulty(gameState()),
    cecilia:    makeActor(spawns.P, 'right'),
    delvile:    Object.assign(makeActor(spawns.D, 'left'), { pause: 0 }),
    shopkeeper: makeActor(spawns.S, 'left'),
    want: null,
    finished: false, caught: false, mad: false, result: null, outcome: null
  };
  for (const k in keys) if (k.endsWith('_p')) keys[k] = false;  // a stray press must not pre-dismiss the intro banner
}
function openDirs(c, r) { return Object.keys(DIRS).filter(d => !mazeWall(c + DIRS[d].dx, r + DIRS[d].dy)); }
// Target-tile movement: walk toward the target tile centre; on arrival snap,
// ask chooseDir for the next direction (null = stand still). Handles any speed
// without drifting off the grid.
function stepActor(a, speed, chooseDir) {
  let remaining = speed;
  while (remaining > 0) {
    const tx = tileCX(a.tc), ty = tileCY(a.tr);
    const dist = Math.abs(tx - a.x) + Math.abs(ty - a.y);
    if (dist > remaining) {
      a.x += Math.sign(tx - a.x) * remaining;
      a.y += Math.sign(ty - a.y) * remaining;
      return;
    }
    a.x = tx; a.y = ty; a.c = a.tc; a.r = a.tr;
    remaining -= dist;
    const d = chooseDir(a);
    if (!d || mazeWall(a.c + DIRS[d].dx, a.r + DIRS[d].dy)) return;
    a.dir = d; a.tc = a.c + DIRS[d].dx; a.tr = a.r + DIRS[d].dy;
    if (dist === 0 && remaining === speed) remaining -= 0.001;  // guard: no infinite loop if chooseDir keeps returning at a centre
  }
}
// Pick the non-reversing open direction that minimizes (or maximizes) distance to (tx,ty).
function huntDir(a, tx, ty, minimize) {
  let opts = openDirs(a.c, a.r).filter(d => d !== OPP[a.dir]);
  if (!opts.length) opts = [OPP[a.dir]];
  let best = opts[0], bestScore = null;
  for (const d of opts) {
    const ddx = tileCX(a.c + DIRS[d].dx) - tx, ddy = tileCY(a.r + DIRS[d].dy) - ty;
    const s = ddx * ddx + ddy * ddy;
    if (bestScore === null || (minimize ? s < bestScore : s > bestScore)) { best = d; bestScore = s; }
  }
  return best;
}
function aboutFace(a) { [a.c, a.tc] = [a.tc, a.c]; [a.r, a.tr] = [a.tr, a.r]; a.dir = OPP[a.dir]; }
function updateCecilia() {
  const cc = chase.cecilia;
  if (keys['ArrowUp'] || keys['KeyW']) chase.want = 'up';
  else if (keys['ArrowDown'] || keys['KeyS']) chase.want = 'down';
  else if (keys['ArrowLeft'] || keys['KeyA']) chase.want = 'left';
  else if (keys['ArrowRight'] || keys['KeyD']) chase.want = 'right';
  // instant about-face mid-corridor, like Pac-Man
  if (chase.want === OPP[cc.dir] && (cc.tc !== cc.c || cc.tr !== cc.r)) aboutFace(cc);
  stepActor(cc, chase.boost > 0 ? 3.75 : 2.5, a => {
    if (chase.want && !mazeWall(a.c + DIRS[chase.want].dx, a.r + DIRS[chase.want].dy)) return chase.want;
    if (!mazeWall(a.c + DIRS[a.dir].dx, a.r + DIRS[a.dir].dy)) return a.dir;
    return null;
  });
}
function updateDelvile() {
  const dv = chase.delvile, cc = chase.cecilia;
  if (dv.pause > 0) { dv.pause--; return; }
  stepActor(dv, 2.1, a => {
    // love and promises make him linger at corners (chaseDifficulty preserved from the old chase)
    if (Math.random() < Math.min(0.30, 0.05 + 0.07 * chase.diff) / 4) { dv.pause = 45; return null; }
    if (Math.random() < 0.6) return huntDir(a, cc.x, cc.y, false);   // slip away from her
    const opts = openDirs(a.c, a.r).filter(d => d !== OPP[a.dir]);
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : OPP[a.dir];
  });
}
function updateShopkeeper() {
  const sk = chase.shopkeeper, cc = chase.cecilia;
  stepActor(sk, chase.boost > 0 ? 1.8 : 2.3, a => huntDir(a, cc.x, cc.y, chase.boost <= 0));
}
function finishChase(result) {
  chase.result = result;
  chase.finished = true;
  chase.caught = (result === 'reached');
  if (chase.caught) flags.caughtDelvile = true;
  chase.outcome = resolveMazeOutcome(result, gameState());   // an ENDINGS key
  chase.mad = (chase.outcome === 'madhouse');                // drives the DECLARED MAD banner
  playSound(!chase.mad && chase.caught ? 'victory' : 'hurt');
}
function updateChase() {
  if (chase.intro) {                                          // instruction banner: dismissed by a FRESH key press
    for (const k in keys) if (k.endsWith('_p') && keys[k]) { chase.intro = false; break; }
    if (!chase.intro) {
      keys['ArrowUp_p'] = keys['ArrowDown_p'] = keys['ArrowLeft_p'] = keys['ArrowRight_p'] = false;
      keys['KeyW_p'] = keys['KeyA_p'] = keys['KeyS_p'] = keys['KeyD_p'] = false;
      keys['Space_p'] = keys['Enter_p'] = false;
    }
    return;
  }
  if (chase.finished) return;
  chase.t++;
  if (chase.boost > 0) chase.boost--;
  updateCecilia(); updateDelvile(); updateShopkeeper();
  const cc = chase.cecilia;
  for (const p of chase.pellets) {                            // pellet pickups feed the live stats
    if (p.taken || Math.abs(tileCX(p.c) - cc.x) >= 20 || Math.abs(tileCY(p.r) - cc.y) >= 20) continue;
    p.taken = true; playSound('select');
    if (p.kind === 'h') { stats.hearts += 1; clampHearts(gameState()); }
    else if (p.kind === 'c') { stats.gold += 250; }
    else { chase.boost = 300; aboutFace(chase.shopkeeper); }  // power pellet: speed + the shopkeeper flees
  }
  const near = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 24 * 24;
  if (near(cc, chase.delvile)) finishChase('reached');
  else if (chase.boost <= 0 && near(cc, chase.shopkeeper)) finishChase('caught');
  else if (chase.t >= 5400) finishChase('collapsed');         // 90s delirium timer
}
```

Design notes baked into that code:
- While boosted (`chase.boost > 0`) the shopkeeper is harmless — contact is only checked unboosted, so grabbing a pellet next to him can't kill you the same frame.
- The Delvile pause probability is divided by 4 because `stepActor` re-asks `chooseDir` roughly every tile, not once per intersection — without the divisor he'd pause far more than the spec's per-intersection rate. Tune by feel in Task 6.

- [ ] **Step 2: Extend the seam for tests**

In `window.Cecilia` add (after `chaseResultEnding,`):

```js
  startChase() { state = 'chase'; initChase(); },
  get chaseState() { return chase; },
```

- [ ] **Step 3: Sanity-check the file still loads headless**

Run: `node maze-check.mjs && node -e "console.log('load ok')"`
Then: `node balance-check.mjs` — Expected: **FAIL or PASS is acceptable here** (its chase model still calls the old probability path against `resolveEnding`; it is rewritten in Task 5). What must not happen: a crash loading the script (SyntaxError/ReferenceError), which would mean the edit broke the file.

- [ ] **Step 4: Quick browser smoke**

Serve and drive with Playwright MCP:
```bash
# from the repo root (background)
python -m http.server 8123
```
Navigate to `http://localhost:8123/cecilia.html`, then evaluate `window.Cecilia.startChase()` and press an arrow key. Expected: no console errors; `window.Cecilia.chaseState.cecilia.x` changes over time. (The screen will look wrong — drawChase is still the old code drawing missing fields; that's Task 4. Ignore visuals, watch the console: if the old `drawChase` throws on missing `chase.phase`, note it and proceed straight to Task 4 before judging the smoke test.)

- [ ] **Step 5: Commit**

```bash
git add cecilia.html
git commit -m "feat: Pac-Man maze chase engine - movement, AI, pellets, outcomes"
```

---

### Task 4: Rendering — maze, sprites, HUD, banners; delete dead art

**Files:**
- Modify: `cecilia.html` — replace `drawChase` (was 2799–2841) and the finished-banner line (~2938); add `SP.shopkeeper` next to the other cast sprites (after `SP.mgFop` or similar, ~line 660s region); add `drawMazeCarriage` beside the chase code; delete now-dead art helpers.

**Interfaces:**
- Consumes: Task 3's `chase` fields (`intro`, `t`, `boost`, `pellets`, actors, `result`, `mad`, `caught`), Task 2's `MAZE`/`TILE`/`MAZE_Y`/`tileCX`/`tileCY`; existing `SP.ceciliaWalk` (24×32), `fillRect`, `drawText`, `drawSprite`, palette `C`, `stats`.
- Produces: visual layer only — no new interfaces.

- [ ] **Step 1: Add the shopkeeper sprite**

Next to the other minigame cast sprites (e.g. after `SP.mgHospital`), add a 24-wide aproned Georgian shopkeeper (the pawnbroker). Palette: `k` dark, `s` skin, `j` brown coat, `w` white apron, `u` gray breeches:

```js
// SHOPKEEPER - the pawnbroker who confines Cecilia; brown coat, white shop apron
SP.shopkeeper = [
  "........kkkkkkkk........",
  ".......kkkkkkkkkk.......",
  ".......kssssssssk.......",
  ".......kskssssksk.......",
  ".......ksssssssk........",
  "........ssssssss........",
  ".......jjssssssjj.......",
  "......jjjjjjjjjjjj......",
  "......jjjwwwwwwjjj......",
  ".....sjjwwwwwwwwjjs.....",
  ".....sjjwwwwwwwwjjs.....",
  "......jjwwwwwwwwjj......",
  "......jjwwwwwwwwjj......",
  "......jjwwwwwwwwjj......",
  "......jjjwwwwwwjjj......",
  ".......jwwwwwwwwj.......",
  ".......wwwwwwwwww.......",
  ".......wwwwwwwwww.......",
  ".......wwwwwwwwww.......",
  "........uuu..uuu........",
  "........uuu..uuu........",
  "........sss..sss........",
  "........sss..sss........",
  ".......kkkk..kkkk.......",
  "......kkkkk..kkkkk......",
];
```

- [ ] **Step 2: Replace `drawChase` and add `drawMazeCarriage`**

Delete the old `drawChase` (2799–2841) AND the old chase art helpers `drawHorse`, `drawCarriageRig`, `drawNightStreet`, `drawDeliriumField` (2752–2798) — but FIRST run `grep -n "drawHorse\|drawCarriageRig\|drawNightStreet\|drawDeliriumField" cecilia.html` and keep any helper referenced outside the chase (as of `main`@a3cea8b they are chase-only). Insert:

```js
// Compact top-down-ish carriage for the maze (Delvile inside, lamp lit)
function drawMazeCarriage(x, y, t, facing) {
  const step = Math.sin(t * 0.4) > 0 ? 1 : 0;
  fillRect(x + facing * 10, y - 2 + step, 12, 6, C.a);        // horse body
  fillRect(x + facing * (facing > 0 ? 20 : 14), y - 5 + step, 5, 5, C.a); // horse head
  fillRect(x - 12, y - 9, 22, 14, C.L);                       // cab
  fillRect(x - 8, y - 5, 6, 6, C.e);                          // lit window
  fillRect(x - 10, y + 5, 6, 6, C.k); fillRect(x + 2, y + 5, 6, 6, C.k); // wheels
}
function drawChase() {
  fillRect(0, 0, W, H, C.k);
  fillRect(0, MAZE_Y, W, MAZE.length * TILE, C.a);            // cobbled streets
  for (let r = 0; r < MAZE.length; r++) for (let c = 0; c < MAZE[0].length; c++) {
    const x = c * TILE, y = MAZE_Y + r * TILE;
    if (MAZE[r][c] === '#') {                                 // Georgian terrace blocks as walls
      fillRect(x + 1, y + 1, TILE - 2, TILE - 2, C.u);
      fillRect(x + 8, y + 10, 8, 10, C.e);                    // lit sash windows
      fillRect(x + 24, y + 10, 8, 10, C.e);
      fillRect(x + 4, y + 30, TILE - 8, 4, C.N);              // plinth
    } else if ((c + r) % 2 === 0) {
      fillRect(x + 18, y + 18, 4, 4, C.k);                    // cobble dots
    }
  }
  for (const p of chase.pellets) {                            // pellets
    if (p.taken) continue;
    const x = tileCX(p.c), y = tileCY(p.r);
    if (p.kind === 'h') {                                     // heart
      fillRect(x - 6, y - 6, 5, 5, C.i); fillRect(x + 1, y - 6, 5, 5, C.i);
      fillRect(x - 6, y - 2, 12, 4, C.i); fillRect(x - 3, y + 2, 6, 4, C.i);
    } else if (p.kind === 'c') {                              // guinea
      fillRect(x - 4, y - 4, 8, 8, C.g); fillRect(x - 2, y - 2, 4, 4, C.e);
    } else {                                                  // boost: pulsing power pellet
      const pu = 8 + (Math.sin(chase.t * 0.15) > 0 ? 3 : 0);
      fillRect(x - pu / 2, y - pu / 2, pu, pu, C.w);
    }
  }
  drawMazeCarriage(chase.delvile.x, chase.delvile.y, chase.t, chase.delvile.dir === 'left' ? -1 : 1);
  const sk = chase.shopkeeper;
  if (chase.boost > 0) {                                      // frightened: he flickers as he flees
    ctx.save(); ctx.globalAlpha = (chase.boost % 20 < 10) ? 0.45 : 0.85;
    drawSprite(SP.shopkeeper, sk.x - 12, sk.y - 13, 1, C, true);
    ctx.restore();
  } else drawSprite(SP.shopkeeper, sk.x - 12, sk.y - 13, 1, C, true);
  drawSprite(SP.ceciliaWalk, chase.cecilia.x - 12, chase.cecilia.y - 16, 1, C, true);
  // delirium vignette closes in as the timer rises
  const dvf = Math.min(1, chase.t / 5400);
  if (dvf > 0.2) {
    const vg = ctx.createRadialGradient(W/2, H/2, H * (0.85 - 0.45 * dvf), W/2, H/2, H * 0.95);
    vg.addColorStop(0, 'rgba(112,32,48,0)'); vg.addColorStop(1, `rgba(112,32,48,${0.55 * dvf})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  // HUD strip
  fillRect(0, 0, W, MAZE_Y, C.k); fillRect(0, MAZE_Y - 3, W, 3, C.w);
  drawText("CATCH DELVILE'S CARRIAGE - EVADE THE SHOPKEEPER", W / 2, 8, C.w, 1, 'center');
  fillRect(16, 28, 240, 18, C.u);                             // delirium meter
  fillRect(18, 30, 236 * dvf, 14, C.F);
  drawText('DELIRIUM', 22, 33, C.w, 1, 'left', false);
  drawText('LOVE ' + stats.hearts + '/5', W - 260, 32, C.i, 1, 'left');
  drawText('£' + stats.gold, W - 130, 32, C.g, 1, 'left');
  if (chase.intro) {                                          // instruction banner, charity-minigame style
    fillRect(W/2 - 330, H/2 - 64, 660, 128, C.k);
    fillRect(W/2 - 330, H/2 - 64, 660, 3, C.w);
    drawText('MAD WITH FEVER, CECILIA RUNS INTO THE LONDON NIGHT', W/2, H/2 - 44, C.r, 1, 'center');
    drawText("ARROWS / WASD - CATCH DELVILE'S CARRIAGE", W/2, H/2 - 18, C.w, 1, 'center');
    drawText('EVADE THE SHOPKEEPER - WHITE PELLETS GRANT SPEED', W/2, H/2 + 4, C.w, 1, 'center');
    drawText('PRESS ANY KEY TO RUN', W/2, H/2 + 34, C.y, 1, 'center');
  }
}
```

- [ ] **Step 3: Update the finished-screen banner** (~old line 2938, in the `state === 'chase'` draw branch)

Replace:
```js
const banner = chase.mad ? 'DECLARED MAD' : (chase.caught ? 'YOU REACH HIM' : 'HE IS LOST TO YOU');
```
with:
```js
const banner = chase.mad ? 'DECLARED MAD'
             : chase.result === 'reached' ? 'YOU REACH HIM'
             : chase.result === 'caught'  ? 'SEIZED - YET DELVILE COMES'
             : 'HE IS LOST TO YOU';
```
(`result === 'caught'` and not mad can only mean the hearts-5 rescue, hence the banner text.)

- [ ] **Step 4: Verify headless + in browser**

Run: `node maze-check.mjs` → PASS; the script must still load (no ReferenceErrors from the deleted helpers — grep again for stragglers).
Browser (Playwright, server from Task 3): `window.Cecilia.startChase()`, screenshot. Expected: HUD strip, maze of terrace blocks, pellets, three actors, intro banner. Press a key → banner gone, arrows move Cecilia; watch 10 s → shopkeeper visibly hunts her, Delvile's carriage roams. Take screenshots for the record.

- [ ] **Step 5: Commit**

```bash
git add cecilia.html
git commit -m "feat: maze chase rendering - terrace maze, shopkeeper sprite, HUD, banners"
```

---

### Task 5: Balance harness rewrite + tune

**Files:**
- Modify: `balance-check.mjs` (the chase lines at the end of `simulate()`)

**Interfaces:**
- Consumes: seam `C.resolveMazeOutcome`, `C.chaseDifficulty`, `C.clampHearts`.
- Produces: a PASSING `node balance-check.mjs` (madhouse ≤ 30%, all endings ≥ 10%).

- [ ] **Step 1: Replace the chase model**

In `simulate()`, replace the last two lines (`const p = ...; return C.resolveEnding(...)`) with:

```js
  // Maze chase: random pellet pickups, then an outcome whose odds follow
  // chaseDifficulty (love & promises make Delvile linger -> easier to corner).
  gs.stats.hearts += Math.floor(Math.random() * 4);            // 0-3 maze hearts
  C.clampHearts(gs);
  gs.stats.gold += 250 * Math.floor(Math.random() * 9);        // 0-8 maze coins
  const diff = C.chaseDifficulty(gs);
  const pReach = Math.min(0.85, Math.max(0.15, (diff - 0.5) / 2.5 * 0.7 + 0.15));
  const pCaught = 0.25;                                        // shopkeeper seizes her
  const roll = Math.random();
  const result = roll < pReach ? 'reached' : roll < pReach + pCaught ? 'caught' : 'collapsed';
  return C.resolveMazeOutcome(result, gs);
```

Also update the header comment block ("Chase: P(caught) maps chaseDifficulty..." lines) to describe the maze model.

- [ ] **Step 2: Run and tune**

Run: `node balance-check.mjs 20000` (high runs to dodge the known 10%-floor flap).
Expected: PASS. If out of band, tune ONLY the model constants in this file (`pReach` coefficients, `pCaught`, pellet pickup distributions) to reflect plausible play — do NOT touch `resolveEnding` or `resolveMazeOutcome` thresholds without flagging it to the user first (that's a game-balance change, not a model change). Record the final constants in the commit message. Then run plain `node balance-check.mjs` (5000) twice — both must PASS.

- [ ] **Step 3: Commit**

```bash
git add balance-check.mjs
git commit -m "test: balance harness models the maze chase; PASS at tuned constants"
```

---

### Task 6: End-to-end verification + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-pacman-chase-design.md` only if reality diverged (record deviations); no code changes expected.

**Interfaces:** none — this task is evidence-gathering.

- [ ] **Step 1: Forced-outcome checks in the browser (Playwright + seam)**

With the server running, for each case: `window.Cecilia.startChase()`, dismiss the banner with a key press, then manipulate `const ch = window.Cecilia.chaseState`:

1. **Reached:** set `ch.delvile.x = ch.cecilia.x; ch.delvile.y = ch.cecilia.y;` wait one frame → `ch.finished === true`, `ch.result === 'reached'`, banner "YOU REACH HIM" (or DECLARED MAD if stats collapsed), SPACE advances to an ending screen with the reckoning panel.
2. **Caught, no rescue:** fresh chase, set `ch.shopkeeper.x/y` onto Cecilia with hearts < 5 → `ch.result === 'caught'`, `ch.outcome === 'madhouse'`, "DECLARED MAD".
3. **Caught, rescue:** fresh chase; first set hearts to 5 (collect hearts by seam: `window.Cecilia.live.stats.hearts = 5`), then collide shopkeeper → `ch.outcome === 'delvile'`, banner "SEIZED - YET DELVILE COMES".
4. **Collapsed:** fresh chase, set `ch.t = 5399`, wait → `ch.result === 'collapsed'`, ending matches `resolveEnding(false, gs)` for the current stats.

- [ ] **Step 2: Real-play checks**

Play honestly for one full minute: queued turns feel right (press a turn early, she takes it at the corner), about-face works mid-corridor, pellet pickups tick LOVE/GOLD on the HUD, boost pellet speeds her up and the shopkeeper flickers and flees, delirium meter and vignette rise. Then play the game from the title through the story to the chase once — confirm the scene-18 transition, the intro banner needs a FRESH key press (hold a key through the scene transition: banner must not self-dismiss), and one natural ending renders with the reckoning panel.

- [ ] **Step 3: Full regression battery**

```bash
node maze-check.mjs && node balance-check.mjs
```
Expected: both PASS.

- [ ] **Step 4: Update docs & commit**

If any spec numbers changed during tuning (speeds, pause rates, harness constants), append a short "As-built deviations" section to the spec. Commit:

```bash
git add -A
git commit -m "docs: as-built notes for the Pac-Man chase; e2e verified"
```

---

## Self-review notes (done at planning time)

- Spec coverage: maze/actors/pellets/timer/outcomes/AI/banner/HUD/dead-code/balance/seam-tests all map to Tasks 1–6. The spec's "resolveEnding untouched" is a global constraint.
- Type consistency: `chase.chaseState` seam name used in Tasks 3, 4 (via browser), 6; actor shape `{x,y,c,r,tc,tr,dir}` consistent; `resolveMazeOutcome(result, gs)` consistent across Tasks 1, 3, 5.
- Known judgment calls surfaced to the executor: `TILE` name collision check (Task 2), Delvile pause-rate divisor (Task 3), old-drawChase crash window between Tasks 3 and 4 (noted in Task 3 Step 4).
