# Polish batch: backlog items 7–10 — design (2026-07-10)

Four small user-requested changes to `cecilia.html` (single-file HTML5-canvas game). All
approved by Hilary in brainstorming; decisions: Briggs bg = **interior**, HUD = **~1.5×**.

## 1. Briggs's miser's-mansion background (backlog item 7)

- New `case 'miser':` in `drawBackground`, in the existing fillRect/palette pixel idiom.
- Content: dim bare-panelled walls; two sash-window positions — one **bricked up**
  (window-tax joke) and one **shuttered**; a single **guttering candle** whose halo
  flickers with the same `frame`-modulo idiom other backgrounds use; **cobwebs** in the
  top corners; a **padlocked strongbox** against the wall.
- Briggs's intro scene (`character: 'briggs'`, currently `bg: 'manor'`) changes to
  `bg: 'miser'`. No other scene uses it.
- Palette: existing `C.*` colors only; overall darker/dingier than 'manor'.

## 2. HUD stat counters: ~1.5× and centered (backlog item 8)

- Rework `drawHUD()` (currently fixed left-skewed pixel positions, text scale 1,
  bar `0..50` + 4px rule):
  - Scale labels (LOVE / GOLD / VIRTUE), gold value, hearts, and virtue pips to ~1.5×
    current size (use the nearest scale that renders crisply in the pixel font).
  - Lay the whole group out from a **computed total width** and center it on the canvas.
  - Bar height grows only as needed (~60px + rule). Anything that assumes the old 54px
    HUD bottom edge (e.g. scene art starting below it) must be checked and adjusted.
- The charity minigame's separate VIRTUE/GOLD readout (`drawMinigame`) is untouched.

## 3. Delete Monckton's "Sir, I am not for sale!" choice (backlog item 9)

- Monckton's room-detour scene (speaker `MR. MONCKTON`, bg `garden`): remove the choice
  `"'Sir, I am not for sale!'"` (effect: virtue +1, monckton −1). Two choices remain.
- Choice menu code is count-agnostic; verify nothing depends on a 3-choice menu there
  (wrap-around indexing with 2 choices, and the room stale-flag clear still fine).

## 4. Dismissible room intro instructions (backlog item 10)

- On entering the Georgian room, draw a banner in **exactly the charity minigame's
  instruction-banner format** (black bar, white top rule, centered Press-Start-2P text)
  near the top of the room view, just below the HUD:
  - Line 1: `SPEAK WITH EVERYONE BEFORE YOU MAY DEPART`
  - Line 2 (smaller/control line): `ARROWS WALK - SPACE SPEAK`
- Dismissal: disappears on the **first key press** of any key (the same press may also
  move Cecilia — acceptable), and never reappears for the rest of that game
  (`room.introSeen`-style flag lives on the `room` object; `resetGame` nulling `room`
  resets it naturally).
- Returning from an NPC detour must NOT re-show the banner.

## Verification (in-browser, Playwright)

- 'miser' bg behind Briggs's dialogue (reach via room detour), flicker animating.
- HUD: centered group, ~1.5× size, correct at title→scene transition, in the room,
  in dialogue scenes; hearts/pips fill correctly as stats change.
- Monckton scene shows exactly 2 choices; both work; cursor wrap works with 2.
- Room entry shows banner; any key dismisses; detour + return does not re-show;
  new game after reset shows it again. Console clean throughout.
