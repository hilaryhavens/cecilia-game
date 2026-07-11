# Delvile Castle Room — Design (2026-07-11)

Backlog item 13 (+ Hilary's additions). A second walkable hub room after the
charity minigame, set inside Delvile Castle, with the three Delviles and Lady
Honoria Pemberton. Modelled on the Georgian room: same sizing, banner, and
functionality — just fewer people (4 instead of 8).

## Story flow

The charity minigame ends at "YOU REACH DELVILE CASTLE" (item 11 art). Pressing
Space now enters the castle: instead of jumping to the Mrs. Delvile scene, the
game opens the **castle-hall room**. Cecilia walks (same bounds/speed as the
Georgian room), speaks with all four figures — each first meeting detours into
their scene — and when all four are met the door opens; departing resumes the
linear story at "Cecilia returns to London…" (the chase gate scene). Nothing at
scene index < 14 changes; the Georgian room is untouched.

## The four detour scenes

| Figure | Scene | Background | Notes |
|---|---|---|---|
| MRS. DELVILE | existing confrontation (idx 14) | **castlehall** (new interior) | bg was ballroom |
| MR. DELVILE | existing name-pride (idx 15) | **castle** (new full-screen exterior: towers, moat, drawbridge — item-11 castle grown into a background) | bg was manor |
| MORTIMER DELVILE | existing secret proposal (idx 16) | **stormwood** (new: night wood, wind-bent trees, rain, lightning flash every few seconds) | bg was garden; see fallback below |
| LADY HONORIA PEMBERTON | **new scene** (inserted after Mortimer's) | castlehall | see below |

**Mortimer fallback.** His scene-level `condition (suitors.delvile >= 1)` would
break the speak-with-everyone gate, so it is removed. Instead the scene is
conditional inside: if `delvile >= 1` he proposes the secret marriage exactly as
now (same choices/effects, `agreedSecretMarriage` still requires the proposal);
otherwise he offers a wistful line — "'Miss Beverley — I hardly know what I
would say. Only that your presence is the sole comfort this castle affords
me.'" — with two neutral, no-effect replies ("'We are friends, Mr. Delvile.
Let that content us.'" / "'Your family watches us, sir. I must go.'").

**Lady Honoria's scene.** Speaker LADY HONORIA, castlehall bg, text:
"'Delvile Castle is a frightfully dull place, even with you around!'"
Choices: "'You should honour our hosts.'" → virtue +1 (clamped);
"'I also long for London.'" → virtue −1 (clamped).

## Repeat-talk flavor lines (after first meeting)

- MR. DELVILE: "The Delviles have held this seat for centuries unbroken. Few families, Miss Beverley, may say as much."
- MRS. DELVILE: "You have a nobleness of mind, Miss Beverley, I had scarce hoped to find in this age."
- MORTIMER DELVILE: "My mother esteems you; my father suspects; and I — I am wholly yours, whatever I appear."
- LADY HONORIA: "I mean to take the phaeton out the instant it clears — say you will come, or I shall perish of dullness!"

## New art

- **SP.honoria** — 24×32 cast-style portrait sprite: young, fashionable,
  mischievous. **Bold orange-and-blue gown** and **conspicuous makeup** (heavy
  rouged cheeks, painted lips, a beauty patch), powdered coiffure, a fan.
  Mario-style outline like the rest of the cast.
- **castlehall** background — stone great-hall interior: stone walls, arched
  windows, heraldic banners, ancestral portraits, fireplace; keeps the Georgian
  room's floor/door structure so the room engine draws the same door zone.
- **castle** background — full-screen Delvile Castle exterior (sky, towers with
  crenellations, gatehouse, moat, drawbridge).
- **stormwood** background — dark storm sky, silhouetted wind-bent trees, rain
  streaks, frame-based lightning flashes (sky lightens + tree silhouettes pop
  for a few frames every few seconds).
- `drawSpeakerGround` gets cases for the three new bgs (castle/stormwood/castlehall).

## Architecture: config-driven room engine

The room engine (initRoom/updateRoom/drawRoom/nearNpc/returnFromRoomDetour) is
currently hardwired to the Georgian room (ROOM_NPCS, resume idx 12, bg 'room').
Refactor to a `ROOMS` config table:

```js
const ROOMS = {
  georgian: { bg: 'room',       npcs: GEORGIAN_NPCS, resumeIdx: 12 },
  castle:   { bg: 'castlehall', npcs: DELVILE_NPCS,  resumeIdx: 18 }  // the chase-gate scene, after Honoria's insertion
};
// Both rooms share the identical intro banner text:
// 'SPEAK WITH EVERYONE BEFORE YOU MAY DEPART' / 'ARROWS WALK - SPACE SPEAK'
initRoom(key)  // stores room.cfg; update/draw read cfg
```

Same movement bounds, door zone, banner, "!" markers, speak prompt, flavor-line
box, sprite scale 3 (item 15), and stale-key-flag clearing. One engine, two rooms.

**NPC placement (4 figures):** Mr. Delvile x215 y335, Mrs. Delvile x585 y335,
Lady Honoria x140 y495, Mortimer x660 y495 — the corners pattern of the
Georgian layout with the middle rows empty.

**Index bookkeeping.** Honoria's scene inserts after idx 16 → chase gate moves
17→18, wish menu 18→19. `chaseReturnIdx`/`mgReturnIdx` are computed dynamically;
the minigame-return handler changes from "goto scene 14" to "enter castle room";
the room config carries the resume index. Audit for any other hardcoded indices
≥ 14.

## Verification

- In-browser playthrough: minigame → castle room (banner up, dismiss on fresh
  key) → all four detours (both Mortimer variants via the `window.Cecilia`
  seam) → flavor lines on re-talk → door opens (chime) → depart → chase gate.
- Georgian room regression: enter after scene 3, one detour, door, resume at 12.
- Scene-index audit: endings, wish menu, and chase routing still line up.
- Screenshots of the three new backgrounds + Honoria for Hilary.
