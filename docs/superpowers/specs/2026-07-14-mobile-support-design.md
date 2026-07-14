# Mobile Support for the Cecilia Game — Design

**Date:** 2026-07-14
**Status:** Approved by Hilary (in conversation)

## Goal

Make the game playable on phones. The game is a single 800×600 canvas
(`cecilia.html`) that already scales to fit the window; the gap is input —
everything runs on the keyboard (Arrows/WASD to move and steer, Space/Enter
to advance dialogue and confirm choices).

## Approach

Touch controls **synthesize the existing keyboard state**. The whole game
reads one `keys` object (e.g. `keys['ArrowLeft']`, plus the `_p` "pressed"
flags via `keyPressed()`). An on-screen button sets the same flags while a
finger is down and clears them on lift. No game-logic changes; every scene
(walking, dialogue, choices, chase) works unchanged.

Rejected alternative: refactoring to an input-abstraction layer — touches
dozens of call sites for no visible benefit.

## Components (all inside `cecilia.html`)

1. **Viewport & touch hygiene**
   - Mobile viewport meta tag (`width=device-width, initial-scale=1,
     viewport-fit=cover`).
   - CSS/JS to prevent page scroll, pinch/double-tap zoom, text-selection
     callout, and pull-to-refresh while playing (`touch-action: none`,
     `user-select: none`, `overscroll-behavior: none`).

2. **On-screen controls — shown only on touch devices**
   - Directional pad, lower-left; round action button (= Space/Enter),
     lower-right. Styled to match the game's period look.
   - Overlaid on the letterboxed margins beside the 4:3 canvas where
     possible so they don't cover the art.
   - Detection: shown when the device reports touch
     (`matchMedia('(pointer: coarse)')`); hidden on desktop.
   - Buttons use Pointer Events with `setPointerCapture`; sliding a finger
     across the d-pad updates direction without lifting (important for the
     chase). Multi-touch: d-pad and action button work simultaneously.
   - Press = set `keys[code] = true` and fire the same edge the keyboard
     path fires (so `keyPressed()` sees it once); release = clear.

3. **Tap conveniences**
   - Tapping the dialogue box advances/reveals text (same as action button).
   - Tapping a visible choice line selects it directly (maps tap Y within
     the canvas to the choice index, sets selection, confirms).

4. **Rotate prompt**
   - In portrait on small screens, a period-styled overlay asks the player
     to turn the device sideways (wording to match the game's tone) and
     pauses input until rotated. Landscape is the supported play
     orientation.

5. **Canvas scaling**
   - Existing scale-to-fit code stays; extend it to respect safe-area
     insets (notches) and to leave room for the touch controls when the
     screen is short.

## Testing

- Playwright with a phone-sized touch viewport (e.g. 844×390 landscape):
  movement in rooms, dialogue advance, choice tap-selection, chase
  steering, rotate-prompt appearance in portrait.
- Desktop regression: no visible change, keyboard play unchanged.
- Real-device check by Hilary at the GitHub Pages URL after push.

## Out of scope

- Portrait play layout (rotate prompt instead — chosen by Hilary).
- Swipe/gesture controls (on-screen buttons chosen instead).
- Any rebalancing of game difficulty for touch.
