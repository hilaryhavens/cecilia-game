# Delvile Castle Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the charity minigame, Cecilia enters a walkable castle-hall room (Georgian-room mechanics, 4 figures: the three Delviles + Lady Honoria Pemberton) whose detours are the existing post-minigame scenes plus one new Honoria scene; departing resumes at the chase gate.

**Architecture:** Generalize the existing hardwired room engine (initRoom/updateRoom/drawRoom/nearNpc) into a `ROOMS` config table (bg, npcs, resumeIdx) so one engine drives both rooms. Add three `drawBackground` cases (castlehall, castle, stormwood), one cast sprite (SP.honoria), scene edits (bg swaps + Mortimer fallback + detour returns), and a new Honoria scene inserted after Mortimer's.

**Tech Stack:** Single-file `cecilia.html` (canvas, no framework). Verification = Playwright browser checks against `python -m http.server 8000` + the `window.Cecilia` seam. No unit-test framework exists; every task ends with an in-browser verify step.

## Global Constraints

- Single file: all changes in `C:\Users\hhavens1\cecilia\cecilia.html` (repo `C:\Users\hhavens1\cecilia`, branch `delvile-room`).
- Scene indices < 14 must not change. After inserting Honoria: 14 Mrs. Delvile, 15 Mr. Delvile, 16 Mortimer, 17 Honoria (new), 18 chase gate, 19 wish menu.
- Sprites are 24×32 rows of palette letters; room draws them at scale 3 (item 15).
- The Georgian room's behavior must be byte-for-byte identical in feel: same bounds (px 30..W−30, py 310..585), door zone (px 345–455, py<330), banner text, speak/bump distances (64/48, 45/30).
- Copy: intro banner both rooms = `SPEAK WITH EVERYONE BEFORE YOU MAY DEPART` / `ARROWS WALK - SPACE SPEAK`.
- Cache-bust with `?v=N` when loading in the browser.

---

### Task 1: Config-driven room engine (pure refactor, Georgian room unchanged)

**Files:**
- Modify: `cecilia.html` — `ROOM_NPCS` block (~line 1583), `nearNpc()` (~1601), `returnFromRoomDetour()` (~1607), `initRoom()` (~1617), `updateRoom()` leaving-branch (~1637), `drawRoom()` (~1692: bg + npcs), scene 3 `onContinue` (~line 1004).

**Interfaces:**
- Produces: `initRoom(roomKey)` — `roomKey` ∈ keys of `const ROOMS`; `room.cfg` = the config entry `{ bg, npcs, resumeIdx }`. `GEORGIAN_NPCS` = the renamed `ROOM_NPCS` array. Later tasks add `ROOMS.castle` and `DELVILE_NPCS`.

- [ ] **Step 1: Rename and add the config table.** Rename `const ROOM_NPCS = [...]` to `const GEORGIAN_NPCS = [...]`. Immediately after the array, add:

```js
// Each walkable hub room: background case name, its cast, and where the linear
// story resumes when the player departs through the opened door.
const ROOMS = {
  georgian: { bg: 'room', npcs: GEORGIAN_NPCS, resumeIdx: 12 }
};
```

- [ ] **Step 2: Thread the config through the engine.**
  - `initRoom()` → `initRoom(roomKey)`; inside, set `cfg: ROOMS[roomKey]` as a property of the `room` object (keep every other field).
  - `nearNpc()`: `for (const n of room.cfg.npcs)`.
  - `returnFromRoomDetour()`: `ROOMS ... ROOM_NPCS.every` → `room.cfg.npcs.every(...)`.
  - `updateRoom()` leaving-branch: `currentSceneIdx = 12` → `currentSceneIdx = room.cfg.resumeIdx` (keep the comment).
  - `drawRoom()`: `drawBackground('room')` → `drawBackground(room.cfg.bg)`; `ROOM_NPCS.map` → `room.cfg.npcs.map`.
  - Scene 3 `onContinue` (line ~1004): `initRoom()` → `initRoom('georgian')`.

- [ ] **Step 3: Verify Georgian room regression in-browser.** Serve, load `?v=t1`, then via Playwright evaluate: `state='room'; initRoom('georgian'); room.intro=false;` — walk to Briggs (set `room.px=150; room.py=360`), dispatch Space, assert detour to scene 4; Enter through a choice; assert `state==='room' && room.met.briggs`; set all `room.met` keys true via `room.cfg.npcs.forEach(n=>room.met[n.key]=true)`, speak once more near any NPC, then confirm `returnFromRoomDetour()` opened the door (`room.doorOpen`), move to `room.px=400, room.py=320`, Space → `room.leaving`; after ~1s `state==='scene' && currentSceneIdx===12`.

- [ ] **Step 4: Commit.** `git add cecilia.html && git commit -m "refactor: config-driven room engine (ROOMS table), georgian room behavior unchanged"`

---

### Task 2: SP.honoria — Lady Honoria Pemberton portrait sprite

**Files:**
- Modify: `cecilia.html` — add after `SP.mrsdelvile` (~line 428).

**Interfaces:**
- Produces: `SP.honoria` — 24×32 sprite array, drawn by the existing `drawSprite(spr, x, y, scale, C, true)`; key `'honoria'` must match the NPC `key` used in Task 5 and the `character:` name used in Task 4.

- [ ] **Step 1: Add the sprite.** Young, fashionable, mischievous; **bold orange (x/q) and blue (B/Z) gown**, **conspicuous makeup** — heavy rouge (`r`) cheeks, painted lips (`i`), a beauty patch (`k` dot on the cheek) — powdered coiffure (`W`/`G`) with a blue ribbon, and a gold fan (`g`) held out to one side:

```js
// Lady Honoria Pemberton - bold orange-and-blue gown, heavy rouge, painted
// lips, a beauty patch, powdered curls with a blue ribbon, gold fan.
SP.honoria = [
  "........GWWWWG..........",
  ".......WWWWWWWW.........",
  "......WWWBBBBWWW........",
  ".....GWWWWWWWWWWG.......",
  "......WWsssssssWW.......",
  ".....WWsssssssssWW......",
  ".....GWsksssssksWG......",
  "......WsrrsssrrsW.......",
  "......WsrrsSsrrsW.......",
  ".......ssiisskss........",
  "........ssssssss........",
  "........wwssssww........",
  "......wwxxxxxxxxww......",
  ".......xxxxxxxxxx.......",
  ".......xxBBBBBBxx.......",
  "......xxxBZZZZBxxx......",
  "......xxxZZBBZZxxxg.....",
  ".....xxxxBBZZBBxxxgg....",
  ".....xxxxZZBBZZxxsgg....",
  ".....xxxxBBBBBBxxsgg....",
  "....xxxxxxxxxxxxxxgg....",
  "....xxxxxZZZZxxxxxg.....",
  "....xxxxxxxxxxxxxx......",
  "...xxxxxxZZZZxxxxxx.....",
  "...xxxxxxxxxxxxxxxx.....",
  "...xxxxZZZZZZZZxxxx.....",
  "..xxxxxxxxxxxxxxxxxx....",
  "..xxxxZZZZZZZZZZxxxx....",
  "..xxxxxxxxxxxxxxxxxx....",
  "..xxxxxxxxxxxxxxxxxx....",
  "..wwwwwwwwwwwwwwwwww....",
  "...qqqqqqqqqqqqqqqq.....",
];
```

  (Tune rows while looking at the render — every row must be exactly 24 chars; keep: rouge `rr` blocks on both cheeks, `i` lips, one `k` patch below the left eye, orange `x` bodice/skirt with blue `B/Z` stomacher + flounces, gold fan at her right.)

- [ ] **Step 2: Verify the render.** Serve + load `?v=t2`; Playwright: `state='scene'; currentSceneIdx=0;` then force `currentScene={bg:'ballroom',character:'honoria',speaker:'LADY HONORIA',text:''}; fullText=''; state='scene';` — screenshot; confirm a distinct orange-and-blue figure with visible red cheeks (compare against neighbors: not a recolor of an existing pose). All rows must be 24 chars: run `SP.honoria.every(r=>r.length===24)` → true.

- [ ] **Step 3: Commit.** `git commit -am "feat: Lady Honoria Pemberton cast sprite (orange+blue gown, heavy makeup, fan)"`

---

### Task 3: Three new backgrounds — castlehall, castle, stormwood (+ speaker ground)

**Files:**
- Modify: `cecilia.html` — `drawBackground` (~1750, add three cases; read `case 'room'` at ~1944 first and mirror its door/floor geometry for `castlehall`), `drawSpeakerGround` (~2204, add cases).

**Interfaces:**
- Produces: `drawBackground('castlehall' | 'castle' | 'stormwood')`; `castlehall` draws the same door rectangle geometry as `case 'room'` (door zone px 345–455) so the room engine's door logic works unchanged. `drawSpeakerGround` gains: `castle`/`castlehall` → stone (face `C.o`, edge `C['+']`, tex `C.k`); `stormwood` → storm-lashed grass (face `C.d`, edge `C.v`, tex `C.k`).

- [ ] **Step 1: `castlehall`.** Copy the structural skeleton of `case 'room'` (wall band, floor grid, centered double door) and restyle in stone: gray ashlar walls (`C.o` blocks with `C.u` mortar lines), two arched windows (`C.l` glass, `C.u` arch), heraldic banners (`C.F` red with `C.g` gold chevron) either side of the door, a row of ancestral portrait frames (`C.L` frames, `C.s` faces) on the wall, a fireplace with ember glow (`C.F`/`C.e`) at the left, stone-flag floor grid (`C.u` lines on `C.o`), same dark double door at x≈485–570 equivalent — **keep the exact door x-range and wall/floor split y that `case 'room'` uses** so the engine's px 345–455 / py<330 door zone lands on the drawn door.

- [ ] **Step 2: `castle`.** Full-screen exterior: dusk sky (`C.n` → `C.Z` band), the item-11 vocabulary grown to background scale — two crenellated towers with arrow slits, central gatehouse with raised portcullis, main wall, moat band across the lower third (`C.Z` with `C.l` glints), lowered drawbridge (`C.t` planks, `C.a` joins) centered, chain pixels (`C['+']`) up to the gatehouse, ground strip in front.

- [ ] **Step 3: `stormwood`.** Night storm: near-black sky (`C.n`), heavy cloud bank (`C.u`), 5–6 silhouetted wind-bent trees (`C.k` trunks arcing right, ragged canopies), diagonal rain streaks (`C.l`, alpha via sparse 1×6 rects stepping with `frame`), and **lightning**: every ~180 frames a 12-frame flash — sky washes `C.C`, a jagged `C.w` bolt (3–4 offset segments) from cloud to treeline, trees pop as outlines. Gate on `frame % 180 < 12`. (`frame` is the existing global; `drawBackground` runs every frame so animation is free.)

- [ ] **Step 4: `drawSpeakerGround` cases** as in Interfaces.

- [ ] **Step 5: Verify all three.** Serve `?v=t3`; for each bg: force `state='scene'; currentScene={bg:'<name>', speaker:'', text:''};` screenshot. For stormwood take two screenshots ~1.5s apart to catch flash-on and flash-off. Castlehall: confirm the door pixels sit inside x 345–455.

- [ ] **Step 6: Commit.** `git commit -am "feat: castlehall, castle exterior, and stormwood (lightning) backgrounds + speaker grounds"`

---

### Task 4: Scene edits — bg swaps, Mortimer fallback, detour returns, Honoria scene

**Files:**
- Modify: `cecilia.html` — scenes at indices 14/15/16 (lines ~1105–1134), insert new scene after 16; remove `mgReturnIdx` (decl ~892, set ~1103, use ~2668 — the use is rewired in Task 5).

**Interfaces:**
- Consumes: `returnFromRoomDetour` (existing), `SP.honoria` (Task 2), bgs (Task 3).
- Produces: scene indices 14–19 as in Global Constraints; Honoria scene has `character: 'honoria'`.

- [ ] **Step 1: Mrs. Delvile (14):** `bg: 'ballroom'` → `bg: 'castlehall'`; add `onContinue: returnFromRoomDetour,`.

- [ ] **Step 2: Mr. Delvile (15):** `bg: 'manor'` → `bg: 'castle'`; add `onContinue: returnFromRoomDetour,`.

- [ ] **Step 3: Mortimer (16):** `bg: 'garden'` → `bg: 'stormwood'`; **delete** the line `condition: (gs) => gs.suitors.delvile >= 1,`; make text conditional and choices per-branch:

```js
text: (gs) => gs.suitors.delvile >= 1
  ? "'Cecilia - marry me in secret. Let no name, no fortune, no mother stand between us. Only say yes.'"
  : "'Miss Beverley - I hardly know what I would say. Only that your presence is the sole comfort this castle affords me.'",
choices: [
  { text: "'Yes. I will be yours, whatever the cost.'", condition: (gs) => gs.suitors.delvile >= 1,
    effect: (gs) => { gs.flags.agreedSecretMarriage = true; gs.stats.hearts += 1; clampHearts(gs); } },
  { text: "'Not in secret. I will not begin in shame.'", condition: (gs) => gs.suitors.delvile >= 1,
    effect: (gs) => { gs.stats.virtue += 1; clampVirtue(gs); gs.stats.hearts -= 1; clampHearts(gs); } },
  { text: "'We are friends, Mr. Delvile. Let that content us.'", condition: (gs) => gs.suitors.delvile < 1, effect: (gs) => {} },
  { text: "'Your family watches us, sir. I must go.'", condition: (gs) => gs.suitors.delvile < 1, effect: (gs) => {} }
],
onContinue: returnFromRoomDetour,
```

- [ ] **Step 4: Insert Honoria scene** between Mortimer's scene and the chase-gate scene:

```js
{ // Lady Honoria Pemberton - the Delviles' lively young cousin (castle room detour)
  bg: 'castlehall', speaker: 'LADY HONORIA',
  text: "'Delvile Castle is a frightfully dull place, even with you around!'",
  character: 'honoria',
  choices: [
    { text: "'You should honour our hosts.'", effect: (gs) => { gs.stats.virtue += 1; clampVirtue(gs); } },
    { text: "'I also long for London.'", effect: (gs) => { gs.stats.virtue -= 1; clampVirtue(gs); } }
  ],
  onContinue: returnFromRoomDetour,
},
```

- [ ] **Step 5: Remove `mgReturnIdx`:** delete `let mgReturnIdx = 0;` (~892) and shrink scene 13's onContinue to `() => { state = 'minigame'; initMinigame(); }`. (Its only read, in the minigame-finished handler, is replaced in Task 5 — Tasks 4 and 5 must land in the same working session or the file breaks; commit them together if needed, else this step's grep must show zero remaining refs after Task 5.)

- [ ] **Step 6: Verify via seam.** Serve `?v=t4`; Playwright: `Cecilia.SCENES[17].speaker === 'LADY HONORIA'`; `Cecilia.SCENES[18]` is the "returns to London" gate; `Cecilia.SCENES[19]` is the wish menu; `Cecilia.visibleChoices(Cecilia.SCENES[16], Cecilia.blankGS()).length === 2` and both are the neutral pair (blankGS has delvile 0); with `gs.suitors.delvile=1` the proposal pair shows. Honoria effects: apply choice 0 → virtue clamps at 6; choice 1 → virtue 5.

- [ ] **Step 7: Commit** (with Task 5 if mgReturnIdx removal spans both): `git commit -am "feat: castle-room detour scenes - bg swaps, Mortimer fallback, Lady Honoria scene"`

---

### Task 5: DELVILE_NPCS + room entry wiring

**Files:**
- Modify: `cecilia.html` — after `GEORGIAN_NPCS`/`ROOMS` (Task 1 site), the minigame-finished handler (~2665–2671).

**Interfaces:**
- Consumes: `ROOMS`/`initRoom(key)` (Task 1), scene indices (Task 4), `SP.honoria` (Task 2).
- Produces: `ROOMS.castle = { bg: 'castlehall', npcs: DELVILE_NPCS, resumeIdx: 18 }`.

- [ ] **Step 1: The cast.** Before the `ROOMS` table:

```js
const DELVILE_NPCS = [
  { key: 'elderdelvile', name: 'MR. DELVILE',       sceneIdx: 15, x: 215, y: 335,
    line: "The Delviles have held this seat for centuries unbroken. Few families, Miss Beverley, may say as much." },
  { key: 'mrsdelvile',   name: 'MRS. DELVILE',      sceneIdx: 14, x: 585, y: 335,
    line: "You have a nobleness of mind, Miss Beverley, I had scarce hoped to find in this age." },
  { key: 'honoria',      name: 'LADY HONORIA',      sceneIdx: 17, x: 140, y: 495,
    line: "I mean to take the phaeton out the instant it clears - say you will come, or I shall perish of dullness!" },
  { key: 'delvile',      name: 'MORTIMER DELVILE',  sceneIdx: 16, x: 660, y: 495,
    line: "My mother esteems you; my father suspects; and I - I am wholly yours, whatever I appear." }
];
```

  and extend the table: `castle: { bg: 'castlehall', npcs: DELVILE_NPCS, resumeIdx: 18 }`.

- [ ] **Step 2: Enter the castle after the minigame.** In the minigame-finished handler replace the scene jump:

```js
} else if (state === 'minigame') {
  updateMinigame();
  if (mg.finished) {
    if (keyPressed('Space') || keyPressed('Enter')) {
      state = 'room';               // into Delvile Castle - the walkable hall
      initRoom('castle');
    }
  }
}
```

- [ ] **Step 3: Grep `mgReturnIdx`** → zero hits.

- [ ] **Step 4: Verify the full flow.** Serve `?v=t5`; Playwright: `state='minigame'; initMinigame(); mg.player.x = mg.endX;` wait for finish, dispatch Space → `state==='room'`, `room.cfg.resumeIdx===18`, 4 figures with `!` markers, intro banner up. Meet all four via the seam-drive pattern (position + Space + Enter through choices), door opens (chime), depart → `currentSceneIdx===18`, text "Cecilia returns to London…". Screenshot the populated room.

- [ ] **Step 5: Commit.** `git commit -am "feat: Delvile Castle walkable room after the charity minigame (backlog item 13)"`

---

### Task 6: End-to-end verification + regression

**Files:** none (verification only; fix-forward anything found, then commit fixes).

- [ ] **Step 1: Full honest playthrough** from title through: room 1 (spot-check one detour), minigame, castle room (all four detours — capture both Mortimer variants by running the room twice via seam with `suitors.delvile` 0 and 1), chase, an ending. No console errors except favicon.
- [ ] **Step 2: Regression checks.** Georgian room resume idx 12 intact; wish menu still resolves all four wishes via `Cecilia.resolveWish`; ENDINGS render; `M` mute; scene indices < 14 untouched (`Cecilia.SCENES[4].speaker === 'MR. BRIGGS'` etc.).
- [ ] **Step 3: Screenshots for Hilary:** castle room with all four figures; each new background; Honoria close-up.
- [ ] **Step 4: Commit any fixes** with descriptive messages.
