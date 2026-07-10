# Spec: Explorable Georgian Drawing-Room Hub (2026-07-09)

Backlog item 6 for the Cecilia game (`cecilia.html`, single-file). Replaces the
linear run of the eight character-introduction scenes with a walkable Georgian
drawing room where Cecilia meets the cast in any order. Approved by Hilary
2026-07-09 (design + flavor lines, with her revisions incorporated below).

## 1. Story placement

- After the London intro (SCENES index 3), the game enters a new `'room'` state
  instead of advancing to index 4.
- The eight character-intro scenes — indices 4–11: Briggs, Mrs. Delvile,
  Monckton, Mortimer Delvile, Harrel, Sir Robert Floyer, Arnott, Albany —
  become detours triggered from the room, playable in any order.
- After all eight are met, Cecilia departs through the grand double doors and
  the story resumes linearly at Harrel's storm plea (index 12). The room is
  never revisited.
- No changes to stats, choices, suitor points, flags, or endings — the detour
  scenes run exactly as they do today.

## 2. Architecture (Approach A — approved)

- New top-level `state === 'room'` branch in `update()` and `draw()`
  (state machine at ~line 2195; draw dispatch at ~line 2264).
- **Detour:** first conversation with an NPC sets a `returnToRoom` flag and
  jumps to their existing scene (`state = 'scene'`, `currentSceneIdx = idx`).
  When that scene resolves, instead of `currentSceneIdx++`, control returns to
  `state = 'room'` — mirroring the existing `mgReturnIdx` minigame-return
  pattern (~line 2236). The NPC is then marked met (a `metCount`/per-NPC set).
- **Repeat conversations** happen inside the room state: a compact speech box
  at the bottom of the room (speaker name + one flavor line, typewriter
  effect, no choices, no stat effects), dismissed with SPACE.
- Rejected alternatives (for the record): B keyed-scene rewrite, C
  room-inside-dialogue.

## 3. Room art — new `'room'` case in `drawBackground()`

One straight-on 800×600 Georgian drawing room built from existing drawing
vocabulary:

- **Back wall:** plaster panelling in bays — the ballroom's pilaster rhythm
  (~line 1616) with rectangular panel mouldings instead of mirrors; dado rail;
  two `drawSashWindow()` windows with curtains flanking the centre.
- **Grand double door** centred on the back wall: pedimented surround (like
  the manor doorway, ~line 1553), two tall six-panel leaves, brass furniture.
  Drawn shut initially; drawn open (dark doorway visible between leaves) once
  unlocked.
- **Fireplace** on one wall section: stone surround, mantel with candlestick
  pair, animated flame using the chandelier-candle flicker trick (`frame % n`).
- **Floor:** the ballroom's two-tone parquet (~line 1631) extended over the
  lower ~2/3 of the screen as the walkable plane.
- **Gilt chandelier** overhead, reused from the ballroom.

## 4. Movement, NPCs, proximity

- Free 2D arrow-key movement with `SP.ceciliaWalk` (24×32 walker) and the
  minigame's walk-bob; speed ~2.5 px/frame; clamped to the floor region and
  around NPC/furniture bounds.
- The 8 NPCs stand at fixed spots, drawn with their existing portrait sprites
  at walker scale. Unmet NPCs show a small bobbing "!" marker; met ones don't.
- Within ~48 px of an NPC: "PRESS SPACE TO SPEAK" prompt over them. SPACE
  triggers the intro-scene detour (first time) or the flavor line (repeats).

## 5. The door

- Shut and inert until all 8 are met.
- On meeting the eighth: chime sound, leaves visibly swing open, "THE DOOR
  STANDS OPEN" flashes briefly.
- Near the open doorway: "PRESS SPACE TO DEPART"; SPACE fades out of the room
  into scene index 12.

## 6. Repeat-talk flavor lines (approved by Hilary, her wording)

One line each; no choices, no stat effects.

- **MR. BRIGGS:** "If you don't know the value of sixpence, you'll never be
  worth fivepence three farthings."
- **MRS. DELVILE:** "My dear Miss Beverley, a woman's dignity is her whole
  estate. Guard yours, as I guard the name of Delvile."
- **MR. MONCKTON:** "A word, Miss Beverley — trust none of the flatterers in
  this room. None, that is, save myself."
- **MORTIMER DELVILE:** "Forgive me, Miss Beverley — I find I cannot quit the
  room while you remain in it."
- **MR. HARREL:** "Do not look so grave, Miss Beverley! A masquerade, a
  supper — a few hundred pounds is a trivial matter between friends."
- **SIR ROBERT FLOYER:** "Who the d——l will fatigue himself with dancing
  attendance upon the women, when keeping them at a distance makes them dance
  attendance upon us?"
- **MR. ARNOTT:** "I — forgive me, I had nothing of consequence to say. Only
  that I am always near, should you ever want a friend."
- **OLD ALBANY:** "Still here, among the gilded and the idle? Go forth! The
  poor wait upon your bounty, and time waits upon no one."

## 7. Sir Robert Floyer — aloof & threatening throughout (Hilary's direction)

- **Name:** every player-facing occurrence becomes "Sir Robert" / "Sir Robert
  Floyer" — the speaker label at index 9 changes from `'MR. FLOYER'` to
  `'SIR ROBERT FLOYER'`; room prompts and the flavor-line speech box use
  "SIR ROBERT". Internal identifiers (`character: 'floyer'`, `suitors.floyer`,
  `flags.encouragedFloyer`, `SP.floyer`, `drawFloyerSword`) are code, not
  display, and stay unchanged.
- **Intro scene (index 9) rewritten** from the current bumbling version
  ("...treads upon your hem") to aloof/threatening; stat effects are kept
  IDENTICAL to preserve game balance. Text approved by Hilary 2026-07-09:

  > Sir Robert Floyer surveys you at his leisure, as a man appraises a horse
  > at Tattersall's. "So this is the heiress. You may account yourself
  > fortunate, Miss Beverley — I have determined to have you."

  Choices (Hilary's wording; same effects as today's two):
  1. "Cast your eyes downward and blush, but do not leave the room." →
     `suitors.floyer += 1`, `flags.encouragedFloyer = true`, `virtue -= 1`
     (was "Laugh kindly and encourage him.")
  2. "Excuse yourself with barely concealed revulsion." → `virtue += 1`
     (was "Excuse yourself with civility.")
- His sprite already fits: broad, florid, scarlet coat, smallsword at the hip
  ("hot-tempered, duel-ready" per the sprite comment ~line 1884).

## 8. Testing

Playwright walkthrough against a local serve of `cecilia.html`:

1. Advance past scene 3 → room state entered.
2. Visit all 8 NPCs in a scrambled order; each detour plays its scene, choices
   apply stat effects (spot-check HUD), control returns to the room, NPC
   marked met (no "!").
3. Repeat-talk each NPC → flavor line shows, no stat changes.
4. Door: inert before the 8th meeting; opens with chime after; departing lands
   on scene index 12 (Harrel storm plea).
5. Full run to an ending to confirm downstream flow, endings, and reset are
   untouched.
6. Regression: fresh start, straight-line playthrough to a different ending.

## Key code references (`cecilia.html`, 2288 lines)

- SCENES indices 4–11 (character intros): ~lines 1002–1077
- `mgReturnIdx` detour pattern: ~lines 889, 1092, 2236
- State machine `update()`: ~line 2195; draw dispatch: ~line 2264
- `drawBackground()` / `drawSashWindow()`: ~lines 1476–1700
- `SP.ceciliaWalk`: ~line 163; portrait sprites 24×32; `drawFloyerSword`: ~line 1883
