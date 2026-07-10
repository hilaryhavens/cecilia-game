# Georgian Drawing-Room Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear run of the eight character-intro scenes in the Cecilia game with a walkable Georgian drawing room where Cecilia meets the cast in any order, then departs through a grand door that opens only when all eight are met.

**Architecture:** A new top-level `'room'` state in the single-file game's `update()`/`draw()` state machine. First conversations detour into the EXISTING scenes (indices 4–11) via an `onContinue` hook that returns control to the room (mirroring the `mgReturnIdx` minigame pattern); repeat conversations show a one-line flavor box inside the room state. No changes to stats, effects, flags, or endings.

**Tech Stack:** Vanilla JS + canvas in one file (`cecilia.html`, ~2288 lines). No dependencies, no build, no test framework — verification is by driving the game in a real browser (Playwright MCP tools) and reading its global state with `browser_evaluate` (top-level `let` bindings ARE reachable from evaluate in a classic script).

**Spec:** `docs/superpowers/specs/2026-07-09-georgian-room-design.md` (all copy in this plan is Hilary-approved verbatim — do not reword).

## Global Constraints

- Single file: ALL code goes in `C:\Users\hhavens1\cecilia\cecilia.html`. No new files, libraries, or assets.
- Repo: `C:\Users\hhavens1\cecilia` (NOT Desktop). Work on branch `georgian-room`; do NOT push to `main` (it auto-deploys via GitHub Pages).
- Player-facing copy must match the spec character-for-character (flavor lines §6, Sir Robert scene §7).
- Internal identifiers stay unchanged: `character: 'floyer'`, `suitors.floyer`, `flags.encouragedFloyer`, `SP.floyer`, `drawFloyerSword`.
- Stat effects of scenes 4–11 must remain byte-identical (game balance).
- Match existing style: `fillRect`/`drawText`/`drawSprite` pixel idiom, `C.*` palette keys, `frame`-based animation, comments explaining period detail.
- Verify in browser at `file:///C:/Users/hhavens1/cecilia/cecilia.html` (works from file://; press M to mute music while testing if needed).
- Line numbers below are for the pre-change file; they shift as tasks land — locate by the quoted code, not the number.

**Browser verification harness (used by every task):** navigate with `browser_navigate` to the file:// URL, then use `browser_evaluate` to force state, e.g. `() => { state = 'room'; initRoom(); return currentSceneIdx; }`, `browser_press_key` for Space/Arrows, `browser_take_screenshot` for visual checks. To simulate held movement keys: `() => { keys['ArrowLeft'] = true; }` then later set it false.

---

### Task 1: Sir Robert Floyer — rename, aloof/threatening intro scene, long-choice fit

**Files:**
- Modify: `cecilia.html` — SCENES index 9 (~lines 1051–1059), `drawChoices` (~line 1938)

**Interfaces:**
- Consumes: existing `clampVirtue(gs)`, `drawChoices(choices)`.
- Produces: nothing later tasks call; this is standalone copy + rendering work.

- [ ] **Step 1: Create the working branch**

```bash
cd /c/Users/hhavens1/cecilia && git checkout -b georgian-room
```

- [ ] **Step 2: Define the check (manual TDD)**

In the browser, force scene 9: `browser_evaluate`: `() => { state='scene'; currentSceneIdx=9; setupScene(); return fullText; }`. Current (failing) result: the bumbling "'…the weather, and your eyes…' He treads upon your hem." text and speaker `MR. FLOYER`.

- [ ] **Step 3: Replace the scene object**

Replace the whole SCENES entry at index 9 (the one with `character: 'floyer'`) with:

```js
  {
    bg: 'ballroom', speaker: 'SIR ROBERT FLOYER',
    text: "Sir Robert Floyer surveys you at his leisure, as a man appraises a horse at Tattersall's. 'So this is the heiress. You may account yourself fortunate, Miss Beverley - I have determined to have you.'",
    character: 'floyer',
    choices: [
      { text: "Cast your eyes downward and blush, but do not leave the room.", effect: (gs) => { gs.suitors.floyer += 1; gs.flags.encouragedFloyer = true; gs.stats.virtue -= 1; clampVirtue(gs); } },
      { text: "Excuse yourself with barely concealed revulsion.", effect: (gs) => { gs.stats.virtue += 1; clampVirtue(gs); } }
    ]
  },
```

(Effects are copied verbatim from the old choices — choice 1 = old "Laugh kindly…", choice 2 = old "Excuse yourself with civility.")

- [ ] **Step 4: Make long choice lines fit**

Choice 1 is 62 chars; at the current fixed size 1.5 (12 px/char, x-start 94) it would end at ~838 px — off the 800 px canvas. In `drawChoices`, replace the fixed-size text call:

```js
    drawText(choices[i].text, bx + 44, cy + 11, selected ? C.w : C.c, 1.5, 'left', false);
```

with a per-line size that shrinks only when needed (button text area is ~650 px):

```js
    const csz = choices[i].text.length > 54 ? 1 : 1.5;           // long lines drop to the small font so they never overflow the button
    drawText(choices[i].text, bx + 44, cy + 11 + (csz === 1 ? 3 : 0), selected ? C.w : C.c, csz, 'left', false);
```

- [ ] **Step 5: Verify in browser**

Re-run the Step 2 evaluate; expect the new text and speaker `SIR ROBERT FLOYER`. Let the typewriter finish (or `browser_evaluate`: `() => { textIdx = fullText.length; }`), screenshot, and confirm: both choices fully inside their buttons; pick choice 1 (Space) and confirm via `() => ({f: suitors.floyer, e: flags.encouragedFloyer, v: stats.virtue})` → `{f:1, e:true, v:5}`.

- [ ] **Step 6: Commit**

```bash
git add cecilia.html && git commit -m "feat: Sir Robert Floyer renamed, aloof-threatening intro scene (Hilary's copy)"
```

---

### Task 2: Room background art + chime sound

**Files:**
- Modify: `cecilia.html` — `drawBackground()` (add `case 'room':` after `case 'ballroom':`, ~line 1646), `playSound()` (~line 1259)

**Interfaces:**
- Consumes: `drawSashWindow(x,y,w,h)`, `fillRect`, `C` palette, `frame`, `W`, `H`, `tone()`.
- Produces: `drawBackground('room')` reads global `room` (may be `null` → door drawn shut) for `room.doorOpen`; `playSound('chime')`. Door geometry constants used by Task 6's departure hotspot: door spans x 345–455, wall bottom y = 300.

- [ ] **Step 1: Define the check**

`browser_evaluate`: `() => { drawBackground('room'); }` — currently throws nothing but draws nothing (falls through switch). After implementing, a screenshot must show the room.

- [ ] **Step 2: Add the `'room'` case to `drawBackground`**

Insert after the `ballroom` case's closing `}` `break;`:

```js
    case 'room': {
      // A Georgian drawing room (18th-c.): panelled plaster wall in bays with
      // rectangular fielded panels, dado rail, two curtained sash windows, a
      // pedimented grand double door in the centre, a stone chimneypiece with
      // lit fire, parquet floor as the walkable plane, gilt chandelier above.
      const WALL_B = 300;                                   // bottom of the back wall
      fillRect(0, 0, W, WALL_B, C.c);                       // plaster wall
      // panelled bays (ballroom pilaster rhythm, panels instead of mirrors)
      const bay = 160;
      for (let x = 0; x < W; x += bay) {
        fillRect(x + 12, 60, 14, WALL_B - 90, C.K);         // pilaster shaft
        fillRect(x + 14, 62, 4, WALL_B - 94, C.w);          // highlight
        fillRect(x + 8, 54, 22, 6, C.g);                    // gilt capital
        fillRect(x + 8, WALL_B - 34, 22, 6, C.g);           // base
        const px2 = x + 40, pw = bay - 56;                  // fielded panel in each bay
        if (px2 + pw < W) {
          fillRect(px2, 74, pw, 130, C.K);                  // panel moulding
          fillRect(px2 + 5, 79, pw - 10, 120, C.l);         // field
        }
      }
      fillRect(0, WALL_B - 28, W, 5, C.t);                  // dado rail
      fillRect(0, WALL_B - 4, W, 4, C.a);                   // skirting shadow
      // two curtained sash windows flanking the door (over the nearest panels)
      for (const wx of [150, 610]) {
        fillRect(wx - 14, 66, 12, 150, C.n);                // curtains
        fillRect(wx + 42, 66, 12, 150, C.n);
        fillRect(wx - 16, 62, 72, 8, C.g);                  // gilt pelmet
        drawSashWindow(wx, 74, 40, 118);
      }
      // grand double door, centred: pedimented surround, two six-panel leaves
      const DL = 345, DR = 455, DT = 140;                   // door left/right/top
      for (let s = 0; s < 16; s++) fillRect(DL - 14 + s, DT - 18 - s, (DR - DL) + 28 - s * 2, 2, C.K); // pediment
      fillRect(DL - 10, DT - 4, (DR - DL) + 20, 6, C.K);    // entablature
      fillRect(DL - 8, DT, 4, WALL_B - DT, C.K);            // jambs
      fillRect(DR + 4, DT, 4, WALL_B - DT, C.K);
      if (room && room.doorOpen) {
        fillRect(DL, DT, DR - DL, WALL_B - DT, C.k);        // dark hall beyond
        fillRect(DL, DT, 10, WALL_B - DT, C.t);             // leaves swung edge-on
        fillRect(DR - 10, DT, 10, WALL_B - DT, C.t);
      } else {
        for (const lx of [DL, DL + (DR - DL) / 2]) {        // two shut leaves
          const lw = (DR - DL) / 2;
          fillRect(lx, DT, lw, WALL_B - DT, C.t);
          fillRect(lx + 6, DT + 10, lw - 12, 40, C.a);      // three fielded panels each
          fillRect(lx + 6, DT + 58, lw - 12, 44, C.a);
          fillRect(lx + 6, DT + 110, lw - 12, 40, C.a);
        }
        fillRect(DL + (DR - DL) / 2 - 6, DT + 78, 4, 6, C.g); // brass knobs at the meeting stile
        fillRect(DL + (DR - DL) / 2 + 2, DT + 78, 4, 6, C.g);
      }
      // chimneypiece, left of the door: stone surround, mantel, flickering fire
      const fx = 40, fy = WALL_B - 118;
      fillRect(fx - 8, fy - 12, 96, 8, C.K);                // mantel shelf
      fillRect(fx - 4, fy, 8, 118 - 28, C.K);               // jambs
      fillRect(fx + 76, fy, 8, 118 - 28, C.K);
      fillRect(fx + 4, fy, 72, 118 - 28, C.k);              // firebox
      if ((frame % 24) < 16) fillRect(fx + 22, fy + 48, 36, 22, C.x); // embers
      fillRect(fx + 26, fy + 34 + ((frame % 14) < 7 ? 2 : 0), 28, 22, C.y); // flame flicker
      fillRect(fx + 34, fy + 24 + ((frame % 10) < 5 ? 3 : 0), 12, 14, C.w); // flame tip
      for (const cx of [fx + 2, fx + 66]) {                 // candlesticks on the mantel
        fillRect(cx, fy - 28, 4, 16, C.g);
        if ((frame + cx) % 30 < 22) fillRect(cx, fy - 34, 4, 6, C.y);
      }
      // parquet floor — the walkable plane (ballroom pattern, lower 1/2)
      for (let y = WALL_B; y < H; y += 24)
        for (let x = 0; x < W; x += 24)
          fillRect(x, y, 22, 22, (Math.floor(x / 24) + Math.floor(y / 24)) % 2 === 0 ? C.t : C.j);
      // gilt chandelier (ballroom's, hung below the HUD bar)
      fillRect(W / 2 - 2, 56, 4, 24, C.g);
      fillRect(W / 2 - 24, 78, 48, 6, C.g);
      fillRect(W / 2 - 38, 94, 76, 6, C.g);
      for (let i = 0; i < 9; i++) {
        const lx = W / 2 - 36 + i * 9;
        fillRect(lx, 84, 4, 18, C.g);
        if ((frame + i * 7) % 30 < 22) fillRect(lx, 100, 4, 6, C.y);
      }
      break;
    }
```

Note: `room` does not exist yet (Task 3). Add a placeholder above `drawBackground` so this case is safe standalone:

```js
// === GEORGIAN ROOM (hub) — state lives here; initialised by initRoom() ===
let room = null;
```

- [ ] **Step 3: Add the chime**

In `playSound`, after `case 'victory': ... break;`:

```js
    case 'chime': // the great door unbars: three rising bell tones
      [784, 988, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.09), i * 160));
      break;
```

- [ ] **Step 4: Verify visually**

Navigate, then `browser_evaluate`: `() => { state = 'x'; }` (freezes state machine harmlessly) is NOT needed — instead temporarily render once: `() => { drawBackground('room'); }` right after load, screenshot immediately. Check: panelled wall, two curtained windows, shut pedimented double door centre, fireplace with flame, parquet, chandelier. Then `() => { room = { doorOpen: true }; drawBackground('room'); }`, screenshot: dark opening between edge-on leaves. Reset with `() => { room = null; }`. Play the chime: `() => playSound('chime')` (no assertion — just no console error via `browser_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add cecilia.html && git commit -m "feat: Georgian drawing-room background art and door-chime sound"
```

---

### Task 3: Room state skeleton — entry, movement, Cecilia in the room

**Files:**
- Modify: `cecilia.html` — room globals (below the Task 2 `let room = null;`), SCENES index 3 (~line 998), `update()` (~line 2195), `draw()` (~line 2264), `resetGame()` (~line 1217)

**Interfaces:**
- Consumes: `drawBackground('room')` (Task 2), `SP.ceciliaWalk`, `drawSprite`, `keys`, `keyPressed`, `drawHUD`, `setupScene`.
- Produces: `initRoom()`, `updateRoom()`, `drawRoom()`, `room` object with fields `{ px, py, facing, met: {}, pendingMeet: null, doorOpen: false, doorFlash: 0, talk: null, leaving: false, fade: 0 }` (px/py = Cecilia's FEET position). Tasks 4–6 extend `updateRoom`/`drawRoom` and read/write these fields. Walkable floor: `py` ∈ [310, 585], `px` ∈ [30, 770].

- [ ] **Step 1: Define the check**

Play from title (Space) through scenes 1→3 (Space ×3 after each typewriter; or `browser_evaluate`: `() => { textIdx = fullText.length; }` between presses). Currently scene 3 advances to scene 4 (Briggs). After this task it must land in `state === 'room'` with Cecilia visible and walkable.

- [ ] **Step 2: Add room globals + init + movement + draw**

Below `let room = null;`:

```js
function initRoom() {
  room = {
    px: W / 2, py: 560, facing: 1,   // Cecilia's feet
    met: {},                          // npc key -> true once their intro scene played
    pendingMeet: null,                // npc key whose scene is currently detoured into
    doorOpen: false, doorFlash: 0,
    talk: null,                       // active flavor-line box: { name, line, idx }
    leaving: false, fade: 0
  };
}
function updateRoom() {
  const SPD = 2.5;
  let dx = 0, dy = 0;
  if (keys['ArrowRight'] || keys['KeyD']) dx = SPD;
  else if (keys['ArrowLeft'] || keys['KeyA']) dx = -SPD;
  if (keys['ArrowDown'] || keys['KeyS']) dy = SPD;
  else if (keys['ArrowUp'] || keys['KeyW']) dy = -SPD;
  if (dx) room.facing = dx > 0 ? 1 : -1;
  room.px = Math.max(30, Math.min(W - 30, room.px + dx));
  room.py = Math.max(310, Math.min(585, room.py + dy));
  room.moving = !!(dx || dy);
}
function drawRoom() {
  drawBackground('room');
  // Cecilia, feet at (px, py), walker sprite at minigame scale with walk-bob
  const bob = room.moving ? Math.sin(frame * 0.3) : 0;
  drawSprite(SP.ceciliaWalk, room.px - 24, room.py - 64 + bob, 2, C, true);
  drawHUD();
}
```

- [ ] **Step 3: Enter the room from scene 3**

SCENES index 3 (the `"And so our heroine sets out into Georgian London..."` entry) gains an `onContinue`:

```js
  {
    bg: 'london', speaker: '',
    text: "And so our heroine sets out into Georgian London, where suitors of all kinds await - some noble, some foolish, and some most dangerous indeed...",
    onContinue: () => { state = 'room'; initRoom(); }
  },
```

- [ ] **Step 4: Wire the state machine**

In `update()`, after the `'title'` branch, add:

```js
  } else if (state === 'room') {
    updateRoom();
```

In `draw()`, after the title branch, add:

```js
  } else if (state === 'room') {
    drawRoom();
```

In `resetGame()`, add `room = null;` alongside `mg = null;`.

- [ ] **Step 5: Verify**

Run the Step 1 flow. Assert `browser_evaluate`: `() => state` → `'room'`. Screenshot: room with Cecilia standing centre-front. Hold a key: `() => { keys['ArrowLeft'] = true; }`, wait ~1s, `() => { keys['ArrowLeft'] = false; return room.px; }` → decreased and ≥ 30. Same upward: `py` stops at 310 (she can't walk into the wall). Confirm HUD still drawn.

- [ ] **Step 6: Commit**

```bash
git add cecilia.html && git commit -m "feat: walkable room state entered after the London intro"
```

---

### Task 4: The eight NPCs — placement, markers, proximity, first-meeting detours

**Files:**
- Modify: `cecilia.html` — NPC table beside the room globals; `updateRoom()`/`drawRoom()` (Task 3); `onContinue` added to SCENES indices 4–11 (~lines 1002–1077)

**Interfaces:**
- Consumes: `room` fields from Task 3; `SP.briggs/mrsdelvile/monckton/delvile/harrel/floyer/arnott/albany` (24-wide × 28–32-tall portraits); `setupScene`.
- Produces: `ROOM_NPCS` array `{ key, name, sceneIdx, x, y, line }` (x,y = feet; `name` is the speech-box label; `line` is the Task 5 flavor line, included NOW so copy lands once); `nearNpc()` → the NPC within reach or `null`; `returnFromRoomDetour()` used as the scenes' `onContinue`. Task 5 consumes `room.talk`; Task 6 consumes `room.doorOpen/doorFlash` set here when the 8th is met.

- [ ] **Step 1: Define the check**

In the room, walking to a character and pressing Space currently does nothing. After: it plays their existing intro scene with choices/effects and returns to the room with them marked met.

- [ ] **Step 2: Add the NPC table (approved copy — verbatim)**

Next to `initRoom()`:

```js
// The eight acquaintances, waiting about the room. x,y = feet position;
// sceneIdx = their existing intro scene (played once, as a detour);
// line = the one repeat-conversation flavor line (approved copy — verbatim).
const ROOM_NPCS = [
  { key: 'briggs',     name: 'MR. BRIGGS',        sceneIdx: 4,  x:  90, y: 350,
    line: "If you don't know the value of sixpence, you'll never be worth fivepence three farthings." },
  { key: 'mrsdelvile', name: 'MRS. DELVILE',      sceneIdx: 5,  x: 215, y: 335,
    line: "My dear Miss Beverley, a woman's dignity is her whole estate. Guard yours, as I guard the name of Delvile." },
  { key: 'monckton',   name: 'MR. MONCKTON',      sceneIdx: 6,  x: 710, y: 350,
    line: "A word, Miss Beverley - trust none of the flatterers in this room. None, that is, save myself." },
  { key: 'delvile',    name: 'MORTIMER DELVILE',  sceneIdx: 7,  x: 585, y: 335,
    line: "Forgive me, Miss Beverley - I find I cannot quit the room while you remain in it." },
  { key: 'harrel',     name: 'MR. HARREL',        sceneIdx: 8,  x: 140, y: 495,
    line: "Do not look so grave, Miss Beverley! A masquerade, a supper - a few hundred pounds is a trivial matter between friends." },
  { key: 'floyer',     name: 'SIR ROBERT',        sceneIdx: 9,  x: 660, y: 495,
    line: "Who the d——l will fatigue himself with dancing attendance upon the women, when keeping them at a distance makes them dance attendance upon us?" },
  { key: 'arnott',     name: 'MR. ARNOTT',        sceneIdx: 10, x: 520, y: 560,
    line: "I - forgive me, I had nothing of consequence to say. Only that I am always near, should you ever want a friend." },
  { key: 'albany',     name: 'OLD ALBANY',        sceneIdx: 11, x: 280, y: 560,
    line: "Still here, among the gilded and the idle? Go forth! The poor wait upon your bounty, and time waits upon no one." }
];
function nearNpc() {
  for (const n of ROOM_NPCS)
    if (Math.abs(room.px - n.x) < 48 && Math.abs(room.py - n.y) < 40) return n;
  return null;
}
// Scenes 4-11 end here instead of advancing the linear story.
function returnFromRoomDetour() {
  if (room && room.pendingMeet) { room.met[room.pendingMeet] = true; room.pendingMeet = null; }
  state = 'room';
  if (!room.doorOpen && ROOM_NPCS.every(n => room.met[n.key])) {
    room.doorOpen = true;
    room.doorFlash = 150;
    playSound('chime');
  }
}
```

(`——` is "d——l"'s double em-dash; a Step 6 screenshot verifies the webfont renders it — if it shows tofu boxes, substitute `d--l` and note it for Hilary.)

- [ ] **Step 3: NPC interaction in `updateRoom()`**

At the end of `updateRoom()` (after the movement block), add:

```js
  // block walking through people
  const bump = nearNpc();
  if (bump && Math.abs(room.px - bump.x) < 30 && Math.abs(room.py - bump.y) < 24) {
    room.px = room.px < bump.x ? bump.x - 30 : bump.x + 30;
  }
  if (keyPressed('Space') || keyPressed('Enter')) {
    const n = nearNpc();
    if (n && !room.met[n.key]) {          // first meeting: detour into their scene
      playSound('select');
      room.pendingMeet = n.key;
      state = 'scene';
      currentSceneIdx = n.sceneIdx;
      setupScene();
    }
  }
```

- [ ] **Step 4: Draw NPCs in `drawRoom()`**

Replace the Cecilia draw in `drawRoom()` with painter's-order drawing of everyone (feet-y sorted), plus markers and the prompt:

```js
function drawRoom() {
  drawBackground('room');
  const figures = ROOM_NPCS.map(n => ({ n, y: n.y })).concat([{ cecilia: true, y: room.py }]);
  figures.sort((a, b) => a.y - b.y);
  for (const f of figures) {
    if (f.cecilia) {
      const bob = room.moving ? Math.sin(frame * 0.3) : 0;
      drawSprite(SP.ceciliaWalk, room.px - 24, room.py - 64 + bob, 2, C, true);
    } else {
      const n = f.n, spr = SP[n.key];
      drawSprite(spr, n.x - 24, n.y - spr.length * 2, 2, C, true);
      if (!room.met[n.key]) {             // bobbing "!" over the not-yet-met
        const my = n.y - spr.length * 2 - 20 + Math.sin(frame * 0.1) * 3;
        drawText('!', n.x - 4, my, C.g, 2, 'left');
      }
    }
  }
  const near = nearNpc();
  if (near && Math.floor(frame / 30) % 2 === 0) {
    drawText('PRESS SPACE TO SPEAK', W / 2, H - 24, C.g, 1.5, 'center', false);
  }
  drawHUD();
}
```

- [ ] **Step 5: Detour returns — `onContinue` on SCENES 4–11**

Add to EACH of the eight scene objects at indices 4–11 (Briggs, Mrs. Delvile, Monckton, Mortimer, Harrel, Sir Robert, Arnott, Albany) the line:

```js
    onContinue: returnFromRoomDetour,
```

(`update()`'s scene branch already prefers `onContinue` over `currentSceneIdx++` — no state-machine change needed. `returnFromRoomDetour` is hoisted, so the forward reference is fine.)

- [ ] **Step 6: Verify**

Enter the room (Task 3 flow). Screenshot: 8 figures around the room, each with a bobbing "!". Teleport to Briggs: `browser_evaluate`: `() => { room.px = 100; room.py = 355; }` → prompt appears; press Space → Briggs scene plays (`() => ({s: state, i: currentSceneIdx})` → `{s:'scene', i:4}`); finish it (Space through text, pick choice 1) → back in the room (`state === 'room'`), Briggs's "!" gone, `room.met.briggs === true`, and virtue changed per the choice. Repeat for Sir Robert (x 655, y 500): confirm scene 9 shows the Task 1 rewrite. Walk into an NPC: Cecilia stops beside them, no overlap. Space far from everyone: nothing happens.

- [ ] **Step 7: Commit**

```bash
git add cecilia.html && git commit -m "feat: room NPCs with proximity prompts and first-meeting scene detours"
```

---

### Task 5: Repeat-conversation flavor lines

**Files:**
- Modify: `cecilia.html` — `updateRoom()` and `drawRoom()` (Tasks 3–4)

**Interfaces:**
- Consumes: `ROOM_NPCS[].name/.line`, `room.talk`, `wrapText`, `playSound('type')`.
- Produces: `room.talk = { name, line, idx }` lifecycle; nothing new for Task 6.

- [ ] **Step 1: Define the check**

After meeting an NPC, pressing Space near them currently does nothing. After: a compact speech box types out their flavor line; Space dismisses it; stats never change.

- [ ] **Step 2: Talk lifecycle in `updateRoom()`**

At the TOP of `updateRoom()`, before movement, add (an open talk box freezes walking, like dialogue elsewhere):

```js
  if (room.talk) {
    if (room.talk.idx < room.talk.line.length) {
      room.talk.idx++;
      if (room.talk.idx % 3 === 0) playSound('type');
      if (keyPressed('Space') || keyPressed('Enter')) room.talk.idx = room.talk.line.length; // skip to full line
    } else if (keyPressed('Space') || keyPressed('Enter')) {
      room.talk = null;
    }
    return;
  }
```

And in the Space-press block from Task 4 Step 3, handle the met case:

```js
    if (n && !room.met[n.key]) {          // first meeting: detour into their scene
      ...existing detour code...
    } else if (n) {                        // met already: one line of character, no effects
      playSound('select');
      room.talk = { name: n.name, line: n.line, idx: 0 };
    }
```

- [ ] **Step 3: Draw the box in `drawRoom()`**

Before `drawHUD()`, add:

```js
  if (room.talk) {
    // compact speech box, styled after drawDialogue but only ~1/4 screen tall
    const bT = 468;
    fillRect(0, bT, W, H - bT, C.k);
    fillRect(0, bT, W, 4, C.w); fillRect(0, H - 4, W, 4, C.w);
    fillRect(0, bT, 4, H - bT, C.w); fillRect(W - 4, bT, 4, H - bT, C.w);
    fillRect(20, bT - 34, 360, 40, C.w);
    fillRect(25, bT - 29, 350, 30, C.k);
    drawText(room.talk.name, 34, bT - 22, C.g, 1.5, 'left', false);
    const lines = wrapText(room.talk.line.substring(0, room.talk.idx), 44);
    for (let i = 0; i < lines.length; i++) drawText(lines[i], 30, bT + 20 + i * 30, C.w, 2, 'left', false);
    if (room.talk.idx >= room.talk.line.length && Math.floor(frame / 30) % 2 === 0)
      drawText('PRESS SPACE', W - 230, H - 32, C.g, 1.5, 'left', false);
  }
```

Also suppress the "PRESS SPACE TO SPEAK" prompt while a talk box is open: change that condition to `if (near && !room.talk && ...)`.

- [ ] **Step 4: Verify**

Meet Briggs (Task 4 flow), teleport back beside him, snapshot stats (`() => JSON.stringify({stats, suitors, flags})`), press Space → box types his sixpence line under label `MR. BRIGGS`; Space mid-type completes the line; Space again dismisses. Stats JSON identical before/after. Repeat with Sir Robert: label `SIR ROBERT`, screenshot the "d——l" glyphs — if tofu, switch the string to `d--l` and flag it in the final report. Confirm arrows don't move Cecilia while the box is open, and the longest line (Sir Robert's, 4 wrapped lines) fits the box.

- [ ] **Step 5: Commit**

```bash
git add cecilia.html && git commit -m "feat: repeat-conversation flavor lines in the room"
```

---

### Task 6: The door — unlock, announcement, departure to the storm scene

**Files:**
- Modify: `cecilia.html` — `updateRoom()`/`drawRoom()`

**Interfaces:**
- Consumes: `room.doorOpen`/`room.doorFlash` (set by Task 4's `returnFromRoomDetour`), door geometry x 345–455 / wall bottom 300 (Task 2), scene index 12 (Harrel's storm plea).
- Produces: the finished feature; nothing downstream.

- [ ] **Step 1: Define the check**

With all 8 met, the door draws open (Task 2 art) and the chime has fired (Task 4), but standing at it does nothing. After: a DEPART prompt appears at the doorway; Space fades out and resumes the story at scene 12.

- [ ] **Step 2: Departure logic in `updateRoom()`**

`atDoor` = Cecilia at the doorway: `room.doorOpen && room.px > 345 && room.px < 455 && room.py < 330`. At the top of `updateRoom()` (before the talk block), handle leaving:

```js
  if (room.leaving) {
    room.fade++;
    if (room.fade >= 45) {                // ~0.75s fade, then the story resumes
      state = 'scene';
      currentSceneIdx = 12;               // Harrel's storm plea - linear flow from here
      setupScene();
    }
    return;
  }
  if (room.doorFlash > 0) room.doorFlash--;
```

And extend the Space handling (Task 4/5 block) with the door case, BEFORE the NPC cases:

```js
    const atDoor = room.doorOpen && room.px > 345 && room.px < 455 && room.py < 330;
    if (atDoor) {
      playSound('select');
      room.leaving = true;
      return;
    }
```

- [ ] **Step 3: Door text + fade in `drawRoom()`**

After the figures loop, add:

```js
  if (room.doorFlash > 0 && Math.floor(frame / 15) % 2 === 0)
    drawText('THE DOOR STANDS OPEN', W / 2, 120, C.g, 2, 'center');
  if (room.doorOpen && room.px > 345 && room.px < 455 && room.py < 330 && !room.talk && Math.floor(frame / 30) % 2 === 0)
    drawText('PRESS SPACE TO DEPART', W / 2, H - 24, C.g, 1.5, 'center', false);
```

And LAST in `drawRoom()` (after `drawHUD()`):

```js
  if (room.leaving) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, room.fade / 45)})`;
    ctx.fillRect(0, 0, W, H);
  }
```

(Adjust the Task 4 prompt so the two prompts don't overlap: show "PRESS SPACE TO SPEAK" only when `!atDoor` — compute `atDoor` once at the top of `drawRoom()`.)

- [ ] **Step 4: Verify**

Fast-path: enter the room, then meet 7 NPCs by simulation — for each of the first 7, `browser_evaluate` teleport + Space + finish scene (or set `room.met` directly for speed: `() => { for (const k of ['briggs','mrsdelvile','monckton','delvile','harrel','floyer','arnott']) room.met[k] = true; }`), then meet Albany PROPERLY (teleport + Space + play scene) so `returnFromRoomDetour` fires the unlock. Confirm: chime (console clean), `room.doorOpen === true`, flash text on screenshot, door drawn open. Walk to the doorway (`() => { room.px = 400; room.py = 320; }`) → DEPART prompt; Space → fade; then `() => ({s: state, i: currentSceneIdx})` → `{s:'scene', i:12}` and the storm scene plays. Also confirm the door is inert before the 8th meeting (fresh reload, meet nobody, teleport to doorway, Space → nothing).

- [ ] **Step 5: Commit**

```bash
git add cecilia.html && git commit -m "feat: grand door opens when all eight are met; departure resumes the story"
```

---

### Task 7: Full regression + finish

**Files:**
- Modify: none expected (fixes only if regressions surface)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full honest playthrough (no state-poking)**

From a fresh reload, using only `browser_press_key` and held-key evaluates for walking: title → scenes 1–3 → room → meet all 8 in a scrambled order (e.g. Albany, Sir Robert, Briggs, Arnott, Mrs. Delvile, Harrel, Mortimer, Monckton), making real choices → one repeat-talk spot-check → door opens → depart → play the storm scene, minigame, and onward to ANY ending. Confirm: HUD stats change with choices exactly as the scenes dictate; the minigame return, chase, and ending all behave; ending screen → Space → title → `resetGame` leaves `room === null`.

- [ ] **Step 2: Second run, different path**

Reload; meet the 8 in reverse order picking the OTHER choice in each scene; reach a different ending. Confirms order-independence and that no flag/stat effect was disturbed.

- [ ] **Step 3: Console sweep**

`browser_console_messages` after each run: no errors.

- [ ] **Step 4: Commit any fixes, then hand off**

```bash
git log --oneline main..georgian-room
```

Use superpowers:finishing-a-development-branch — present merge/PR options to Hilary (remember: pushing `main` deploys to the live site).

---

## Self-review notes (done at plan time)

- Spec coverage: §1 story placement → Tasks 3+6; §2 architecture → Tasks 3–4; §3 art → Task 2; §4 movement/NPCs → Tasks 3–4; §5 door → Tasks 2+4+6; §6 flavor lines → Tasks 4–5 (copy verbatim in the `ROOM_NPCS` table); §7 Sir Robert → Task 1 (+ room label `SIR ROBERT` in Task 4); §8 testing → per-task verifies + Task 7.
- Known risk called out: em-dash glyphs in "d——l" (Press Start 2P coverage) — verify-and-fallback step in Tasks 4–5; long choice line overflow — fixed in Task 1 Step 4.
- Type consistency: `room` fields defined once (Task 3 Step 2) and only those fields are used later; `returnFromRoomDetour`/`nearNpc`/`ROOM_NPCS` names match across Tasks 4–6.
