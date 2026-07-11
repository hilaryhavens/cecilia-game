# Design: Larger Choice Text (item 16) + Charity-Minigame Scale-Up (item 17)

**Date:** 2026-07-11 · **Branch:** `polish-16-17` · **File:** `cecilia.html` (single-file game)
**Approved by:** Hilary (in-session, 2026-07-11)

## Item 16 — Large choice text in dialogue scenes

**Problem.** In character dialogue scenes the selectable options render at font scale 1.5,
and options longer than 54 characters drop to scale 1 — noticeably smaller than the
spoken/narration text (scale 2). Hilary wants the option text larger; the main text is fine.

**Decision (approved).** All options render at **scale 2, the same size as the spoken
text**. Options too long for one line **wrap onto a second line inside a taller button**
("Wrap to two lines" option). No option ever shrinks below scale 2.

**Behavior.**
- `drawChoices` wraps each option with `wrapText(text, ~38)` (exact char budget tuned so
  scale-2 text fits the 700px button width with the cursor gutter).
- Button height grows with its line count: ~40px for one line, ~68px for two; buttons
  stack with a small fixed gap, y advancing by actual height (no fixed 40px pitch).
- The ► selection cursor vertically centers on its button; selected/unselected colors,
  border insets, and `choiceStartY` placement logic are unchanged.

**Fit budget (dialogue box spans y 322–600).** Worst cases both fit:
- Wish menu: 1-line prompt + 4 one-line options ≈ bottom edge 582 < 596.
- Mortimer neutral pair: 3-line prompt + two 2-line options ≈ bottom edge 582 < 596.

**Verification.** Enumerate every scene × its visible choices (both branches of
conditional choice sets) through the layout math via the `window.Cecilia` seam and assert
no layout exceeds the box; screenshots of the wish menu and both Mortimer variants.

## Item 17 — Charity minigame ≥50% larger (visuals only)

**Problem.** The minigame's figures and labels are small: worthy targets scale 1.7,
spendthrifts 2, Cecilia (`SP.ceciliaWalk`) 2, and all banner/label text scale 1.

**Decision (approved).** Grow **visuals only** — "Visuals only" option: hitboxes, jump
physics, gold costs, target spawn positions, and dimming behavior stay byte-identical
(same pattern as items 12 and 15).

**Behavior (all in `drawMinigame`).**
- Sprites: worthy 1.7 → **2.6**; spendthrift 2 → **3**; Cecilia 2 → **3**, with her draw
  y shifted up so her feet stay on the same ground line the physics use (physics
  `mg.player.y` untouched).
- Labels: WORTHY / SPENDTHRIFT headers, target names, GIVE £25 / JUMP! £N lines go
  scale 1 → **1.5**; banner boxes redrawn ~1.5× (green ≈ 144×72, red ≈ 200×78) and
  raised so they clear the taller figures. The ✓ mark scales to match.
- The minigame intro instruction banner and any end-of-level text below scale 1.5 get
  the same ≥50% bump; text already at scale 2–3 is left alone.

**Verification.** Screenshots of a worthy and a spendthrift target with banners readable;
a jump over an enlarged spendthrift (visual clearance sanity); one full run confirming
gold/virtue outcomes match current behavior for the same inputs.

## Out of scope

Backlog item 14 (stats → endings), any hitbox/difficulty change, any copy change.
