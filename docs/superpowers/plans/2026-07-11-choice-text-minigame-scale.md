# Larger Choice Text + Minigame Scale-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dialogue choice buttons render at the same font size as the spoken text (wrapping long options to two lines), and the charity minigame's figures and labels grow ≥50% with zero gameplay change (backlog items 16 + 17).

**Architecture:** Two independent draw-function rewrites in the single-file game: `drawChoices` gets variable-height buttons with scale-2 wrapped text and an overflow guard; `drawMinigame` gets bigger sprite scales, resized/raised label banners, and a two-line intro banner. No state, physics, hitbox, or scene data changes.

**Tech Stack:** Single-file `cecilia.html` (canvas, no framework). Verification = Playwright browser checks against `python -m http.server 8000` + the `window.Cecilia` seam. No unit-test framework; every task ends with an in-browser verify step.

## Global Constraints

- All changes in `C:\Users\hhavens1\cecilia\cecilia.html` (repo `C:\Users\hhavens1\cecilia`, branch `polish-16-17`).
- Font is Press Start 2P: glyphs are square, `size*8` px wide/tall (scale 2 = 16px/char, scale 1.5 = 12px/char).
- Dialogue box spans y 322..600 (borders 4px); canvas W=800, H=600.
- Item 17 is visuals-only: `updateMinigame`, target spawn (`t.x/t.y/t.w/t.h`), costs, jump physics, `applyGift`, and the 0.35 dim-alpha must be byte-identical.
- Target spawn facts (do not change): worthy `y:380, w:44`; spendthrift `y:360, w:56`; world ground top = 410; sprites are 32 rows tall, feet-planted via `sy = 410 - sp.length*sc + bob`.
- Cache-bust with `?v=N` when loading in the browser. Serve via PowerShell (Git Bash is broken on this machine).

---

### Task 1: Item 16 — scale-2 wrapped choice buttons

**Files:**
- Modify: `cecilia.html` — `drawChoices()` (~line 2565, whole function body).

**Interfaces:**
- Consumes: `wrapText(text, maxChars)` (~897), `drawText(text,x,y,color,size,align,shadow)` (~886), globals `choiceStartY`, `choiceIdx`, `textIdx`, `fullText`, `C`, `H`.
- Produces: nothing new — same `drawChoices(choices)` signature, called from the scene draw branch (`drawChoices(visibleChoices(...))`).

- [ ] **Step 1: Replace the function body.** Swap the current fixed `pitch 40 / bh 34 / csz` implementation for variable-height buttons, all text at scale 2:

```js
function drawChoices(choices) {
  if (!choices || textIdx < fullText.length) return;
  const bx = 50, bw = 700, gap = 6;
  const CH = 38;      // scale-2 chars that fit the 700px button beside the cursor gutter
  const layouts = choices.map(c => wrapText(c.text, CH));
  let cy = choiceStartY || 430;
  // Overflow guard: keep the whole block above the box's bottom border (y 592).
  const total = layouts.reduce((s, l) => s + (l.length === 1 ? 36 : 60), 0)
              + gap * (choices.length - 1);
  cy = Math.min(cy, Math.max(330, 592 - total));
  for (let i = 0; i < choices.length; i++) {
    const lines = layouts[i];
    const bh = lines.length === 1 ? 36 : 60;
    const selected = i === choiceIdx;
    fillRect(bx, cy, bw, bh, selected ? C.n : C.k);
    fillRect(bx + 4, cy + 4, bw - 8, bh - 8, selected ? C.B : C.u);
    if (selected) drawText('►', bx + 14, cy + (bh - 12) / 2, C.y, 1.5, 'left', false);
    const ty = cy + (bh - (16 + (lines.length - 1) * 24)) / 2;
    for (let j = 0; j < lines.length; j++)
      drawText(lines[j], bx + 44, ty + j * 24, selected ? C.w : C.c, 2, 'left', false);
    cy += bh + gap;
  }
}
```

  Geometry sanity (why these numbers): text x = 94, CH 38 × 16px = 608 → right edge 702 ≤ inner border 742. Two-line button: lines at cy+10 and cy+34, text bottom cy+50 ≤ bh−insets. Wish menu (2-line prompt → `choiceStartY` 420) + 4 one-line buttons = 162px → bottom 582 < 592.

- [ ] **Step 2: Layout enumeration via the seam.** Serve (`Set-Location C:\Users\hhavens1\cecilia; python -m http.server 8000` in PowerShell, background), load `?v=c16`, then Playwright-evaluate: for every scene with choices × two game states (blank; and `suitors.delvile=1` + `flags.sympathizedWithHarrel=true`), recompute the layout math and assert (a) no option wraps to more than 2 lines at CH 38, and (b) block bottom ≤ 592:

```js
() => {
  const Cc = window.Cecilia, bad = [];
  const states = [Cc.blankGS(), (() => { const g = Cc.blankGS(); g.suitors.delvile = 1; g.flags.sympathizedWithHarrel = true; return g; })()];
  Cc.SCENES.forEach((s, i) => {
    if (!s.choices) return;
    states.forEach((gs, v) => {
      const vis = Cc.visibleChoices(s, gs); if (!vis.length) return;
      const text = typeof s.text === 'function' ? s.text(gs) : (s.text || '');
      const startY = 322 + 22 + wrapText(text, 44).length * 30 + 16;
      let total = 6 * (vis.length - 1), tooLong = false;
      for (const c of vis) { const L = wrapText(c.text, 38).length; if (L > 2) tooLong = true; total += L === 1 ? 36 : 60; }
      const top = Math.min(startY, Math.max(330, 592 - total));
      if (tooLong || top + total > 592) bad.push({ i, v, tooLong, bottom: top + total });
    });
  });
  return bad;   // must be []
}
```

Expected: `[]`.

- [ ] **Step 3: Visual spot-checks + screenshots.** Via the seam force each of these, screenshot, and confirm large readable options, centered ► on the selected row, no overlap with the prompt or borders:
  - Wish menu: `state='scene'; currentSceneIdx=19; setupScene(); textIdx=fullText.length;` (4 one-line buttons).
  - Mortimer neutral: `currentSceneIdx=16` with blank state (two 2-line buttons).
  - Mortimer proposal: same scene after `suitors.delvile=1` (two 2-line buttons).
  - Press ArrowDown once on the wish menu and re-screenshot: cursor moved, colors swap correctly.

- [ ] **Step 4: Commit.**

```powershell
Set-Location C:\Users\hhavens1\cecilia; git add cecilia.html; git commit -m "feat: dialogue choice text at full text size, two-line wrapped buttons (backlog item 16)"
```

---

### Task 2: Item 17 — charity minigame ≥50% larger visuals

**Files:**
- Modify: `cecilia.html` — `drawMinigame()` only (~2580–2694): target-sprite scale line (~2614), worthy banner block (~2620–2629), spendthrift banner block (~2630–2638), player draw call (~2643), 'THE STREET' label (~2688), intro instruction banner (~2689–2693).

**Interfaces:**
- Consumes: `SP`/`TARGET_SPRITE`/`TARGET_NAME` (~1536), `drawSprite`, `drawText`, `fillRect`, `mg` state. Nothing outside `drawMinigame` changes.
- Produces: nothing new.

- [ ] **Step 1: Sprite scales.** Change `const sc = t.kind === 'worthy' ? 1.7 : 2;` → `const sc = t.kind === 'worthy' ? 2.6 : 3;` (the existing `sx/sy` lines already center and feet-plant any scale — leave them). Change the player draw call from scale 2 to 3, shifting so her feet and center stay put (sprite grows 48×64 → 72×96):

```js
drawSprite(SP.ceciliaWalk, px - 12, py - 28 + (mg.player.onGround && Math.abs(mg.player.vx) > 0.5 ? Math.sin(mg.levelTime * 0.3) : 0), 3, C, true);
```

  (Original was `px, py + 4 + (...), 2` — the −12/−28 offsets keep the old center-x and foot line; the bob term is unchanged.)

- [ ] **Step 2: Worthy banner at scale 1.5.** Replace the `if (!t.given) { ... } else { ... }` block with (raised and ~1.5× box; sprite top is now 410−83=327, box bottom 380−42=338 keeps today's slight head overlap):

```js
if (!t.given) {
  fillRect(t.x - 16, t.y + bob - 116, 150, 74, C.d);          // green banner
  fillRect(t.x - 16, t.y + bob - 116, 150, 4, C.h);
  drawText('WORTHY', t.x - 10, t.y + bob - 108, C.h, 1.5, 'left', false);
  drawText(name, t.x - 10, t.y + bob - 86, C.w, 1.5, 'left', false);
  drawText('GIVE £25', t.x - 10, t.y + bob - 64, C.g, 1.5, 'left', false);
} else {
  drawText('✓', t.x + 8, t.y + bob - 30, C.h, 1.5, 'left', false);
}
```

- [ ] **Step 3: Spendthrift banner at scale 1.5.** Replace the `if (!t.hit) { ... }` block (sprite top now 410−96=314; box bottom 360−46=314 — flush, no overlap, like today):

```js
if (!t.hit) {
  fillRect(t.x - 18, t.y + bob - 128, 208, 82, C.I);          // red banner
  fillRect(t.x - 18, t.y + bob - 128, 208, 4, C.r);
  drawText('SPENDTHRIFT', t.x - 12, t.y + bob - 120, C.r, 1.5, 'left', false);
  drawText(name, t.x - 12, t.y + bob - 98, C.w, 1.5, 'left', false);
  drawText('JUMP! £' + t.cost.toLocaleString('en-GB'), t.x - 12, t.y + bob - 76, C.x, 1.5, 'left', false);
}
```

  (Widths: longest line 'JUMP! £2,500' = 12 chars × 12px = 144 ≤ 208−12.)

- [ ] **Step 4: HUD-strip text at scale 1.5.** Three text changes at the bottom of `drawMinigame`:
  - `'THE STREET'` label: `drawText('THE STREET', W - 275, 66, C.w, 1.5, 'left', false);` (12px text still fits the 21px bar).
  - Intro banner: the single 68-char line is too wide at scale 1.5 (816px > 800). Replace the 3-line banner block with a two-line version:

```js
fillRect(W / 2 - 300, 14, 600, 52, C.k);
fillRect(W / 2 - 300, 14, 600, 3, C.w);
drawText('GIVE TO THE WORTHY (GREEN, DOWN)', W / 2, 22, C.w, 1.5, 'center');
drawText('JUMP OVER SPENDTHRIFTS (RED)', W / 2, 42, C.r, 1.5, 'center');
```

  - Bottom key hint: `drawText('←→ WALK   ↓/S GIVE   SPACE JUMP', W / 2, H - 28, C.c, 1.5, 'center');` (31 chars × 12 = 372 ≤ 800).
  - Leave untouched: the `mg.finished` overlay (already scale 3/2) and the progress-bar geometry.

- [ ] **Step 5: Verify in-browser, visuals + unchanged gameplay.** Load `?v=c17`; via seam `state='minigame'; initMinigame();` then:
  - Walk right (hold ArrowRight via Playwright `keyboard.down`) until a worthy and a spendthrift are on screen; screenshot each — figures visibly ~50% bigger, banners readable, banner boxes clear of sprite heads.
  - Jump over a spendthrift (Space ×2 for the double jump if needed) — screenshot mid-jump; then confirm via seam `mg.targets` shows that target `hit === false` and `stats.gold === 10000` (visual growth didn't change collision).
  - Give to a worthy target (position over it, press ArrowDown): `stats.gold === 9975`, `stats.virtue` +1, figure dims.
  - Walk into a spendthrift deliberately: gold drops by that target's `cost`, virtue −1, knockback occurs — matching current live behavior.
  - Cecilia's feet sit on the same ground line as the target figures in every screenshot.

- [ ] **Step 6: Commit.**

```powershell
Set-Location C:\Users\hhavens1\cecilia; git add cecilia.html; git commit -m "feat: charity minigame sprites and labels >=50% larger, visuals only (backlog item 17)"
```

---

### Task 3: Regression + screenshots for Hilary

**Files:** none (verification only; fix-forward anything found, commit fixes).

- [ ] **Step 1: Full minigame run** start-to-castle with honest play (`?v=c18`): no console errors except favicon; finish overlay unchanged; entering the Delvile Castle room still works (`state==='room'`, `room.cfg.resumeIdx===18`).
- [ ] **Step 2: Dialogue regression.** Play title → scene 1 → Georgian room entry: narration scenes still center text; a 2-choice scene and the 4-choice wish menu (via seam) render inside the box; ArrowUp/Down + Enter still select correctly; `M` mute unaffected.
- [ ] **Step 3: Screenshots for Hilary:** wish menu, a 2-line-choice scene (Mortimer), a worthy + spendthrift with banners, Cecilia mid-jump. Note their paths in the final report.
- [ ] **Step 4: Commit any fixes** with descriptive messages.
