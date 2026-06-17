# Distinct Character Portraits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the single recolored 16×20 sprite template with ten distinct, period-accurate 24×32 character sprites, drawn larger when speaking, and wire the five currently-invisible characters into their scenes.

**Architecture:** All changes live in the single self-contained `cecilia.html`. Sprites are string-array bitmaps in the `SP` object, painted by `drawSprite` (already dimension-agnostic — it pads rows to `maxWidth`). We expand the `C` palette, author new sprites, enlarge `drawCharacter`, preserve a small run-sprite for the minigame/title, and correct/extend scene `character` fields.

**Tech Stack:** Vanilla HTML5 canvas + JS, single file. No build, no framework. Verification = headless-browser (Playwright) screenshots + console-error check + the existing `window.Cecilia` logic smoke test.

**Verification note:** There is no unit-test harness for pixel art. Each sprite is authored against its written brief, rendered in a gitignored preview harness, screenshotted, and visually accepted/iterated. "Test passes" = the screenshot matches the brief and the acceptance criteria in `cecilia-portraits-design.md`.

---

### Task 0: Sprite preview harness (dev tool, not shipped)

**Files:**
- Create: `sprite-preview.html` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1:** Add `sprite-preview.html` to `.gitignore`.
- [ ] **Step 2:** Create `sprite-preview.html`: a standalone page that defines the same `C` palette and a `SP` object, and renders every sprite key as a large (×12) labeled canvas on a dark background, in a flex grid. It will be edited in lockstep with `cecilia.html`'s sprite data during authoring so screenshots reflect the real arrays.
- [ ] **Step 3:** Open with Playwright (`browser_navigate` to the `file://` path), `browser_take_screenshot`, confirm it renders the current sprites. Expected: visible labeled sprites, no JS error in `browser_console_messages`.
- [ ] **Step 4:** Commit `.gitignore` change only (harness is ignored).

```bash
git add .gitignore && git commit -m "Ignore sprite-preview dev harness"
```

---

### Task 1: Expand the color palette

**Files:** Modify `cecilia.html` (the `C` object, ~line 119-129)

- [ ] **Step 1:** Add shading tones to `C` without removing any existing key (existing sprites must keep working). Add: skin shadow `S:'#E0A878'`, wig powder `W:'#F0F0F0'`, wig shadow `G:'#C8C8D0'`, claret `R2:'#7A1F2B'`→ use single chars only, so: claret `Q2`… **(single-char keys only)**. Final additions (pick unused single chars): `S` skin-shadow `#E0A878`, `W` wig-white `#F4F4FA`, `G` wig-grey `#C4C4CE`, `P` claret `#7A1F2B`, `Y` peacock `#1F6F7A`, `U2`… no. Use: `D2`… no. **Use only these unused single chars:** `S,W,G,P` plus reuse existing `v`(green), `r/F`(reds), `B/n`(blues), `t/a/j/q/L`(browns), `m`(purple/lilac), `i`(deep pink), `o/u`(greys). Add `S:'#E0A878'`, `W:'#F4F4FA'`, `G:'#C4C4CE'`, `P:'#7A1F2B'`.
- [ ] **Step 2:** Verify no key collisions: confirm `S`, `W`, `G`, `P` were not already in `C` (they are not, per current palette).
- [ ] **Step 3:** Boot `cecilia.html` via Playwright, screenshot the title, check `browser_console_messages` for errors. Expected: title renders, zero errors.
- [ ] **Step 4:** Commit.

```bash
git add cecilia.html && git commit -m "Add skin/wig/claret shading tones to palette"
```

---

### Tasks 2–6: Author the ten 24×32 sprites (five batches of two)

For EACH batch below, follow this identical loop (shown once; repeat the code for each batch):

- [ ] **Step A:** Author the 24-wide × up-to-32-tall string array(s) for the batch's characters, faithful to the brief in `cecilia-portraits-design.md` (silhouette, age, wig style, costume color, posture, prop). Place into both `sprite-preview.html` (for viewing) and the `SP` object in `cecilia.html`.
- [ ] **Step B:** Render `sprite-preview.html` with Playwright, `browser_take_screenshot`.
- [ ] **Step C:** Inspect the screenshot. Check: face legible (eyes/brows/nose/mouth present), wig matches brief (neat / ill-kempt / absent), costume is the specified color, silhouette differs from already-authored characters. If not, edit the array and repeat B–C.
- [ ] **Step D:** Once accepted, commit `cecilia.html` (and the ignored harness stays local).

**Batch order (grouped so each pair is easy to differentiate side-by-side):**

- [ ] **Task 2 — Cecilia + Mrs. Delvile** (two women; differ by age, coiffure height, gown color: rose-cream vs deep-green). Commit: `"Add Cecilia and Mrs. Delvile portrait sprites"`
- [ ] **Task 3 — Mortimer Delvile + elder Mr. Delvile** (young slim blue-coat, queue wig vs ~50 stiff claret coat, full side-roll wig, cane). New key `SP.elderdelvile`. Commit: `"Add Mortimer and elder Mr. Delvile portrait sprites"`
- [ ] **Task 4 — Monckton + Arnott** (sleek severe forest-green schemer vs soft downcast sober-brown admirer). New key `SP.arnott`. Commit: `"Add Monckton and Arnott portrait sprites"`
- [ ] **Task 5 — Briggs + Albany** (ill-kempt wig, hunched, money-bag, shabby brown vs NO wig, wild grey hair, ragged cloak, staff). New key `SP.albany`. Commit: `"Add Briggs and Albany portrait sprites"`
- [ ] **Task 6 — Floyer + Harrel** (broad florid scarlet coat, crop, sneer vs late-20s fop, tall over-powdered wig, peacock/lilac frills). New keys `SP.floyer` (replace existing), `SP.harrel`. Commit: `"Add Floyer and Harrel portrait sprites"`

After Task 6, the preview screenshot must show all ten side-by-side as visibly distinct people (acceptance criterion 1–2).

---

### Task 7: Enlarge speaking figures; preserve minigame/title sprites

**Files:** Modify `cecilia.html` — `drawCharacter` (~1182), `drawTitle` (~1192-1198), minigame draws of `SP.cecilia` (~1284), chase draw (~1386).

Context: the new `cecilia` sprite is 24×32 (was 16×20). The minigame/chase draw `SP.cecilia` as a small running figure and depend on its old size for positioning; the title centers it with `W/2 - 32`. We must not distort those.

- [ ] **Step 1:** Before overwriting, the OLD 16×20 cecilia/scandal etc. running art is preserved: add `SP.ceciliaRun` = the original 16×20 cecilia array (copy it verbatim from git history / pre-change). Use `SP.ceciliaRun` in `drawMinigame` (line ~1284) and `drawChase` (line ~1386) instead of `SP.cecilia`.
- [ ] **Step 2:** In `drawCharacter`, raise the draw scale so the 24×32 sprite is a prominent speaker. Replace scale `4` with a computed scale (target ≈5) and recompute `x = (W - maxW*scale)/2`; set `y` so the figure sits just above the dialogue box (dialogue box top ≈ `H*0.68`). Keep the idle bob.

```js
function drawCharacter(charName) {
  if (!charName || !SP[charName]) return;
  const sprite = SP[charName];
  const maxW = Math.max(...sprite.map(r => r.length));
  const scale = 5;
  const x = (W - maxW * scale) / 2;
  const spriteH = sprite.length * scale;
  const boxTop = H * 0.68;
  const y = (boxTop - spriteH) / 2 + 20 + Math.sin(frame * 0.05) * 1;
  drawSprite(sprite, x, y, scale);
}
```

- [ ] **Step 3:** In `drawTitle`, recenter the title Cecilia for her new width: `drawSprite(SP.cecilia, W/2 - (24*4)/2, ceciliaY, 4);` (was `W/2 - 32`).
- [ ] **Step 4:** Playwright: boot, screenshot title; advance one scene (press Space/Enter via `browser_press_key`) to a character scene, screenshot. Confirm speaker figure is larger, centered, fully above the dialogue box, not clipped. Check console clean.
- [ ] **Step 5:** Start the charity minigame path far enough to confirm the runner still uses the small sprite and moves correctly (screenshot). 
- [ ] **Step 6:** Commit: `"Enlarge speaking figures; keep small run-sprite for minigame/title"`.

---

### Task 8: Wire the five new characters into their scenes

**Files:** Modify `cecilia.html` scene array (~503-615).

Current mismatches to fix (speaker label vs `character` sprite):

- [ ] **Step 1:** Line ~546: `MR. HARREL` scene → change `character: 'monckton'` to `character: 'harrel'`.
- [ ] **Step 2:** Line ~555: `MR. FLOYER` scene → change `character: 'briggs'` to `character: 'floyer'`.
- [ ] **Step 3:** Line ~564: `MR. ARNOTT` scene → change `character: 'delvile'` to `character: 'arnott'`.
- [ ] **Step 4:** Line ~573: `OLD ALBANY` scene → change `character: 'monckton'` to `character: 'albany'`.
- [ ] **Step 5:** Line ~584: storm `MR. HARREL` scene → change `character: 'monckton'` to `character: 'harrel'`.
- [ ] **Step 6:** Distinguish the two Delviles in dialogue labels: change the young-Mortimer scenes (lines ~534, ~607) `speaker: 'MR. DELVILE'` → `speaker: 'MORTIMER DELVILE'` (their `character: 'delvile'` is correct — the young sprite).
- [ ] **Step 7:** Add an elder-Mr.-Delvile scene. Insert a new scene object immediately BEFORE the post-minigame Mrs. Delvile confrontation (~line 595), giving the proud father his name-pride moment:

```js
{
  bg: 'manor', speaker: 'MR. DELVILE',
  text: "'Miss Beverley. The name of Delvile has descended unsullied for centuries. I will not see it bartered, nor bent to suit a fortune - however large. You will understand a father's duty.'",
  character: 'elderdelvile',
  choices: [
    { text: "'I would never wish to diminish your family, sir.'", effect: (gs) => { gs.stats.virtue += 1; } },
    { text: "'A name is not worth a son's happiness.'", effect: (gs) => { gs.stats.virtue += 0; } }
  ]
},
```

Note: this inserts before `mgReturnIdx`'s target. Verify `mgReturnIdx` / `currentSceneIdx` routing still lands correctly (the minigame returns via `mgReturnIdx = currentSceneIdx + 1` set at the scandal scene; inserting a scene after that index shifts subsequent indices — confirm the scandal scene's return still points at the intended confrontation, adjusting if the inserted scene must come after the minigame rather than before). If routing is fragile, instead insert the elder-Delvile scene in Act 1 (e.g., after the garden Mortimer scene ~542) where indices are linear and safe.

- [ ] **Step 8:** Playwright: play through to each newly-wired scene (or temporarily jump via console `currentSceneIdx`), screenshot each; confirm the correct distinct sprite shows for Harrel, Floyer, Arnott, Albany, elder Delvile.
- [ ] **Step 9:** Run the logic smoke test: in `browser_console_messages` confirm no errors; evaluate `window.Cecilia` ending functions still return valid endings (`browser_evaluate` a quick `resolveWish`/`shouldBreakDown` call if exposed). 
- [ ] **Step 10:** Commit: `"Wire Harrel, Floyer, Arnott, Albany, and elder Delvile into their scenes"`.

---

### Task 9: Full verification pass

**Files:** none (verification only) → final docs update.

- [ ] **Step 1:** Playwright boot from a clean load; capture: title, one Act-1 scene, the charity minigame, one Act-2 scene, one ending screen. Confirm zero console errors throughout (favicon 404 is acceptable, as noted in project history).
- [ ] **Step 2:** Lay all ten sprites side-by-side (preview harness screenshot) and confirm acceptance criteria 1–2: each character distinct; Briggs disordered wig; Albany wig-less/wild.
- [ ] **Step 3:** Confirm criteria 3–5: speaking figures clearly larger and legible; the five new characters appear in-scene; single-file architecture intact.
- [ ] **Step 4:** Update `cecilia-portraits-design.md` status line to COMPLETE with the commit hash; commit.
- [ ] **Step 5:** Summarize to the user with screenshots; ask whether to merge to `main` (which auto-republishes to GitHub Pages) — do NOT push without explicit approval.

---

## Self-review

- **Spec coverage:** 24×32 grid (Tasks 2–6), larger figures (Task 7), expanded palette (Task 1), wigs + two exceptions (Tasks 2–6 briefs), all ten characters incl. elder Delvile (Tasks 2–6), five new characters wired (Task 8), single-file (architecture note), visual verification (every task + Task 9). All spec sections covered.
- **Placeholder scan:** Sprite arrays are authored-against-brief with screenshot acceptance rather than pre-baked — this is inherent to blind pixel-art authoring and is the honest unit of work, not a placeholder. All engine/wiring code is shown in full.
- **Consistency:** New `SP` keys used consistently: `cecilia, delvile, elderdelvile, mrsdelvile, monckton, briggs, floyer, harrel, albany, arnott`, plus `ceciliaRun` for minigame/chase. Palette keys `S,W,G,P` added once, no collisions.
