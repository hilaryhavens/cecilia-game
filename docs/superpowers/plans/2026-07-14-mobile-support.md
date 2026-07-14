# Mobile Touch Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cecilia game playable on phones by adding touch controls that synthesize the existing keyboard input, plus mobile viewport/layout fixes and a portrait rotate prompt.

**Architecture:** The game polls a single `keys` object (`keys['ArrowLeft']` for holds, `keys[code+'_p']` consumed by `keyPressed()` for edges). Touch UI elements set/clear exactly those flags, so no game logic changes. All work happens in `cecilia.html` (single-file game). Spec: `docs/superpowers/specs/2026-07-14-mobile-support-design.md`.

**Tech Stack:** Vanilla JS, Pointer Events, CSS media queries. Verification via Playwright MCP browser tools against `file://` URL.

## Global Constraints

- Everything stays inside `cecilia.html` — no new files, no libraries.
- Internal resolution stays 800×600 (`W`, `H`); only CSS scaling changes.
- Desktop appearance and keyboard play must be unchanged (touch UI hidden unless coarse pointer or `?touch=1`).
- Visual style of new UI: gold `#d4af37` borders, translucent black `rgba(0,0,0,0.45)` fills, matching the existing frame.
- No game-logic edits except: recording choice rectangles in `drawChoices()` (draw-side only).
- Commit after each task; push to GitHub Pages only in Task 4 after all verification passes.

**Key existing code (line numbers as of commit f43ffd4):**
- Viewport/head: lines 3–5. CSS block: lines 6–75. Body/HUD markup: 77–91.
- `resizeGame()`: lines 105–114.
- Input: `keys` object line 1249, `wakeAudio()` 1252–1256, keydown/keyup listeners 1257–1264 (music toggle on `KeyM` at 1260 uses globals `musicOn, mBar, mIdx, bIdx`), `keyPressed()` 1265–1268.
- `drawChoices(choices)`: lines 2559–2581 (`bx=50, bw=700`, per-choice `cy`/`bh`).
- Game states in `update()` (2942): `'title' | 'room' | 'scene' | 'minigame' | 'chase' | 'ending'`; room dialogue active when `room.talk` is set; minigame/chase completion flags `mg.finished` / `chase.finished`; typing state `textIdx < fullText.length`.

---

### Task 1: Viewport, touch hygiene, small-screen layout, rotate overlay

**Files:**
- Modify: `cecilia.html` (head meta ~line 4; CSS block lines 6–75; body markup after line 91)

**Interfaces:**
- Produces: `#rotate-overlay` element; body-level touch-hygiene CSS; media queries that later tasks' fixed-position buttons rely on (nothing else scrolls or zooms).

- [ ] **Step 1: Add viewport meta**

After `<meta charset="UTF-8">` (line 4) add:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

- [ ] **Step 2: Add touch hygiene + small-screen CSS**

Inside the existing `<style>` block, after the `.key` rule (line 74), add:

```css
  /* === MOBILE === */
  html, body {
    touch-action: none;              /* no scroll/pinch while playing */
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  @media (pointer: coarse) {
    #controls { display: none; }     /* keyboard hints are meaningless on touch */
  }
  /* Short screens (phone landscape): shed chrome so the scene gets the room */
  @media (max-height: 520px) {
    body { padding: 6px; gap: 6px; }
    #title-bar { display: none; }
    #controls { display: none; }
    #tv-frame { padding: 12px 10px; border-radius: 24px 24px 10px 10px; }
    #tv-frame::after { display: none; }
    #screen { border-width: 4px; border-radius: 12px; }
  }
  /* Portrait on a touch device: ask for landscape */
  #rotate-overlay {
    display: none;
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, #2c1810 0%, #0a0506 100%);
    z-index: 99;
    color: #d4af37;
    font-family: 'Press Start 2P', monospace;
    text-align: center;
    align-items: center; justify-content: center;
    line-height: 2;
  }
  #rotate-overlay .inner { padding: 24px; font-size: 12px; }
  #rotate-overlay .small { font-size: 8px; color: #f4e1c1; }
  @media (orientation: portrait) and (pointer: coarse) {
    #rotate-overlay { display: flex; }
  }
```

- [ ] **Step 3: Add the rotate overlay markup**

After the `</div>` that closes `#controls` (line 91), add:

```html
  <div id="rotate-overlay">
    <div class="inner">
      ❦<br><br>
      PRAY, TURN THY<br>DEVICE SIDEWAYS<br><br>
      <span class="small">This tale is best beheld in landscape.</span>
    </div>
  </div>
```

- [ ] **Step 4: Widen `resizeGame()` for short screens**

Replace line 108 (`const availH = window.innerHeight * 0.86;`) with:

```js
  // On short screens the title bar and hints are hidden, so the canvas may take more height
  const availH = window.innerHeight * (window.innerHeight < 520 ? 0.90 : 0.86);
```

- [ ] **Step 5: Verify with Playwright**

Using the Playwright MCP tools:
1. `browser_navigate` to `file:///C:/Users/hhavens1/cecilia/cecilia.html`
2. `browser_resize` to 844×390 → `browser_take_screenshot`. Expected: title screen fills most of the window, no title bar, no keyboard-hints row, slim TV frame, no scrollbars.
3. `browser_resize` to 1280×900 → screenshot. Expected: identical to pre-change desktop look (title bar, hints row, chunky frame).
4. Rotate overlay can't be triggered without pointer-coarse emulation; instead `browser_evaluate`: `() => getComputedStyle(document.getElementById('rotate-overlay')).display` → expected `"none"` on desktop. Visual check of the overlay happens on Hilary's phone in Task 4.

- [ ] **Step 6: Commit**

```bash
git -C ~/cecilia add cecilia.html
git -C ~/cecilia commit -m "Mobile task 1: viewport, touch hygiene, short-screen layout, rotate overlay"
```

---

### Task 2: Key synthesis + on-screen d-pad, action, and music buttons

**Files:**
- Modify: `cecilia.html` (CSS block; JS input section after `keyPressed()` line 1268)

**Interfaces:**
- Consumes: `keys`, `keyPressed()` convention (`keys[code]` held, `keys[code+'_p']` edge), `wakeAudio()`, music globals `musicOn, mBar, mIdx, bIdx`.
- Produces: `touchUI` (bool), `pressKey(code)`, `releaseKey(code)`, `tapKey(code)` — Task 3 uses `touchUI` and `tapKey`.

- [ ] **Step 1: Add control CSS**

In the `<style>` block, after the `#rotate-overlay` rules from Task 1, add:

```css
  /* === TOUCH CONTROLS (shown only when body.touch) === */
  #dpad, #btn-act, #btn-music { display: none; position: fixed; z-index: 20; touch-action: none; }
  body.touch #dpad, body.touch #btn-act, body.touch #btn-music { display: block; }
  #dpad {
    left: calc(14px + env(safe-area-inset-left));
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: 170px; height: 170px;
    border-radius: 50%;
    background: rgba(0,0,0,0.45);
    border: 2px solid #d4af37;
  }
  #dpad span { position: absolute; color: #d4af37; font-size: 22px; pointer-events: none; opacity: 0.9; }
  #dpad .n { top: 8px;  left: 50%; transform: translateX(-50%); }
  #dpad .s { bottom: 8px; left: 50%; transform: translateX(-50%); }
  #dpad .w { left: 10px;  top: 50%; transform: translateY(-50%); }
  #dpad .e { right: 10px; top: 50%; transform: translateY(-50%); }
  #btn-act {
    right: calc(20px + env(safe-area-inset-right));
    bottom: calc(34px + env(safe-area-inset-bottom));
    width: 84px; height: 84px;
    border-radius: 50%;
    background: rgba(0,0,0,0.45);
    border: 2px solid #d4af37;
    color: #d4af37; font-size: 30px; line-height: 80px; text-align: center;
  }
  #btn-act:active { background: rgba(212,175,55,0.35); }
  #btn-music {
    top: calc(10px + env(safe-area-inset-top));
    right: calc(12px + env(safe-area-inset-right));
    width: 44px; height: 44px;
    border-radius: 50%;
    background: rgba(0,0,0,0.45);
    border: 2px solid #d4af37;
    color: #d4af37; font-size: 20px; line-height: 40px; text-align: center;
  }
  #btn-music.off { opacity: 0.4; }
```

- [ ] **Step 2: Add key-synthesis helpers and control builder**

In the JS, immediately after `keyPressed()` (line 1268), add:

```js
// === TOUCH CONTROLS ===
// Touch UI appears on coarse-pointer devices; ?touch=1 forces it on for desktop testing.
const touchUI = matchMedia('(pointer: coarse)').matches
             || new URLSearchParams(location.search).has('touch');

// Synthesize the same flags the keyboard listeners set, so all game code works unchanged.
function pressKey(code) {
  if (!keys[code]) keys[code + '_p'] = true;
  keys[code] = true;
}
function releaseKey(code) { keys[code] = false; }
function tapKey(code) { keys[code + '_p'] = true; }  // one-shot pulse, nothing left held

function buildTouchControls() {
  const pad = document.createElement('div');
  pad.id = 'dpad';
  pad.innerHTML = '<span class="n">▲</span><span class="s">▼</span><span class="w">◀</span><span class="e">▶</span>';
  const act = document.createElement('div');
  act.id = 'btn-act';
  act.textContent = '✦';
  const mus = document.createElement('div');
  mus.id = 'btn-music';
  mus.textContent = '♪';
  document.body.append(pad, act, mus);

  // --- d-pad: one pointer steers; sliding across it re-aims without lifting ---
  const held = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
  function setDirs(next) {
    for (const code in held) {
      if (next[code] && !held[code]) pressKey(code);
      if (!next[code] && held[code]) releaseKey(code);
      held[code] = next[code];
    }
  }
  function dirsFromEvent(e) {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dead = r.width * 0.12;   // center dead zone; diagonals allowed
    return { ArrowLeft: dx < -dead, ArrowRight: dx > dead,
             ArrowUp: dy < -dead,  ArrowDown: dy > dead };
  }
  let padPointer = null;
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    setDirs(dirsFromEvent(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) setDirs(dirsFromEvent(e));
  });
  function padEnd(e) {
    if (e.pointerId === padPointer) {
      padPointer = null;
      setDirs({ ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false });
    }
  }
  pad.addEventListener('pointerup', padEnd);
  pad.addEventListener('pointercancel', padEnd);

  // --- action button = Space (every confirm in the game accepts Space) ---
  act.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    act.setPointerCapture(e.pointerId);
    pressKey('Space');
  });
  act.addEventListener('pointerup', () => releaseKey('Space'));
  act.addEventListener('pointercancel', () => releaseKey('Space'));

  // --- music toggle: same behavior as the M key (first tap only wakes audio) ---
  mus.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const woke = wakeAudio();
    if (!woke) { musicOn = !musicOn; if (musicOn) { mBar = 0; mIdx = 0; bIdx = 0; } }
    mus.classList.toggle('off', !musicOn);
  });
}

if (touchUI) {
  document.body.classList.add('touch');
  buildTouchControls();
}
```

Note: `musicOn` etc. are declared later in the file with `let`, but `buildTouchControls` only touches them inside event handlers, which fire after the whole script has run — no TDZ issue. Same pattern as the existing keydown listener.

- [ ] **Step 3: Verify with Playwright**

1. `browser_navigate` to `file:///C:/Users/hhavens1/cecilia/cecilia.html?touch=1`, `browser_resize` 844×390, screenshot. Expected: d-pad lower-left, ✦ button lower-right, ♪ top-right, all gold-on-dark.
2. `browser_click` on the ✦ button. Screenshot. Expected: title screen replaced by the first scene (Space started the game).
3. `browser_click` ✦ a few more times, screenshot: dialogue text advances.
4. `browser_evaluate` to check no stuck keys after a d-pad tap:
   ```js
   () => {
     const pad = document.getElementById('dpad');
     const r = pad.getBoundingClientRect();
     const opts = { bubbles: true, pointerId: 7, clientX: r.left + r.width - 15, clientY: r.top + r.height / 2 };
     pad.dispatchEvent(new PointerEvent('pointerdown', opts));
     const during = keys['ArrowRight'];
     pad.dispatchEvent(new PointerEvent('pointerup', opts));
     return { during, after: keys['ArrowRight'] };
   }
   ```
   Expected: `{ during: true, after: false }`. (`keys` is a top-level `const` in a classic script — reachable from an injected function only if evaluation runs in page context; if the MCP tool sandbox can't see it, dispatch the events, then verify visually: hold-press right on the d-pad during a room scene and watch Cecilia walk in a screenshot.)
5. Navigate without `?touch=1`, resize 1280×900, screenshot: no touch buttons visible.

- [ ] **Step 4: Commit**

```bash
git -C ~/cecilia add cecilia.html
git -C ~/cecilia commit -m "Mobile task 2: on-screen d-pad, action and music buttons synthesizing key state"
```

---

### Task 3: Canvas taps — advance dialogue, pick choices

**Files:**
- Modify: `cecilia.html` (`drawChoices()` lines 2559–2581; new tap handler after `buildTouchControls` block from Task 2)

**Interfaces:**
- Consumes: `touchUI`, `tapKey()` from Task 2; game globals `state, textIdx, fullText, currentScene, choiceIdx, mg, chase, room`; `visibleChoices()`, `gameState()`, `playSound()`.
- Produces: `choiceRects` array (recorded each frame by `drawChoices`).

- [ ] **Step 1: Record choice rectangles in `drawChoices()`**

In `drawChoices()` (line 2559), after the overflow-guard line `cy = Math.min(cy, Math.max(330, 592 - total));` add:

```js
  choiceRects.length = 0;
```

and inside the `for` loop, right after `const selected = i === choiceIdx;` add:

```js
    choiceRects.push({ i, x: bx, y: cy, w: bw, h: bh });
```

- [ ] **Step 2: Add the `choiceRects` global and tap handler**

After the `if (touchUI) { ... }` block from Task 2, add:

```js
// Rectangles of the currently drawn choices, in 800x600 game coordinates,
// refreshed every frame by drawChoices(). Used for tap hit-testing.
const choiceRects = [];

// Tapping the scene advances dialogue; tapping a choice highlights it,
// tapping the highlighted choice confirms it (two-step guards against mis-taps).
canvas.addEventListener('pointerdown', (e) => {
  if (!touchUI) return;
  const r = canvas.getBoundingClientRect();
  const gx = (e.clientX - r.left) * (W / r.width);
  const gy = (e.clientY - r.top) * (H / r.height);

  if (state === 'scene' && textIdx >= fullText.length && currentScene.choices) {
    const vis = visibleChoices(currentScene, gameState());
    if (vis && vis.length) {
      for (const c of choiceRects) {
        if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) {
          if (c.i === choiceIdx) tapKey('Enter');           // second tap: confirm
          else { choiceIdx = c.i; playSound('select'); }    // first tap: highlight
          return;
        }
      }
      return;   // while choosing, a stray tap elsewhere does nothing
    }
  }

  // Elsewhere a tap acts as Space — but never during live action, where a
  // stray tap would jump or steer; the buttons handle those.
  const inert = (state === 'minigame' && !mg.finished)
             || (state === 'chase' && !chase.finished)
             || (state === 'room' && !(room && room.talk));
  if (!inert) tapKey('Space');
});
```

- [ ] **Step 3: Verify with Playwright**

1. Navigate to `file:///C:/Users/hhavens1/cecilia/cecilia.html?touch=1`, resize 844×390.
2. `browser_click` on the middle of the canvas → screenshot. Expected: game starts (tap = Space on title).
3. Keep clicking the canvas until a choice menu appears (first choices arrive within the opening scenes) → screenshot showing choice buttons.
4. Click directly on the *second* choice rectangle → screenshot. Expected: highlight moved to it (blue selected style), scene NOT yet advanced.
5. Click the same choice again → screenshot. Expected: scene advanced.
6. Desktop regression: navigate without `?touch=1`, click the canvas → expected: nothing happens (handler exits on `!touchUI`); Space/keyboard still works.

- [ ] **Step 4: Commit**

```bash
git -C ~/cecilia add cecilia.html
git -C ~/cecilia commit -m "Mobile task 3: tap to advance dialogue, tap-highlight then tap-confirm choices"
```

---

### Task 4: Full smoke test, desktop regression, push live

**Files:**
- Modify: none expected (fixes only if smoke test finds issues)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Phone-landscape smoke test (Playwright, 844×390, `?touch=1`)**

Walk the opening of the game end-to-end with only touch-shaped input, screenshotting each stage:
1. Title → tap canvas → first scene.
2. Advance dialogue via ✦ and via canvas taps; make a choice via tap-highlight + tap-confirm.
3. Reach the first walkable room; hold the d-pad right (dispatch `pointerdown` without `pointerup`, screenshot twice a second apart) → Cecilia visibly moved between screenshots; release; talk to an NPC via ✦.
4. Confirm the ♪ button toggles its dimmed state when clicked twice.
5. Check `browser_console_messages` → expected: no errors.

- [ ] **Step 2: Desktop regression (1280×900, no `?touch=1`)**

1. Screenshot title: identical chrome to pre-change (title bar, hints, frame).
2. Play the opening with keyboard via `browser_press_key` (Space, arrows): starts, advances, choice selection works.
3. No touch buttons visible; no console errors.

- [ ] **Step 3: Data-check regression**

Run: `node ~/cecilia/balance-check.mjs && node ~/cecilia/maze-check.mjs`
Expected: both pass unchanged (input work shouldn't touch game data; this catches accidental edits).

- [ ] **Step 4: Push live**

```bash
git -C ~/cecilia push
```

Then tell Hilary it's live at `https://hilaryhavens.github.io/cecilia-game/` and ask her to check on her phone (held sideways): rotate prompt in portrait, d-pad walking, chase steering, choice taps, and the ♪ button. Her by-ear/by-hand approval is the final gate, as with the music work.
