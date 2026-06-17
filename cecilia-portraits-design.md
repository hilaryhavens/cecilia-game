# Cecilia — Distinct Character Portraits (Design Spec)

**Date:** 2026-06-16
**Branch:** `portraits-distinct-cast`
**Goal:** Make every named character in `cecilia.html` look like a *distinct, believable 18th-century person* instead of the current single recolored template.

---

## Problem

All speaking characters are drawn from the **same 16×20 sprite template** — identical head, face, and body outline — with only hair color and coat color swapped (`SP.cecilia`, `SP.delvile`, `SP.monckton`, `SP.floyer`, `SP.briggs` are byte-for-byte the same shape). `SP.mrsdelvile` is a featureless black silhouette. No character has a distinct silhouette, age, posture, costume cut, or face. Players cannot tell them apart except by the speaker label.

## Approach (chosen: "Richer pixel art")

Stay inside the game's established retro / NES / retro-TV aesthetic — no external image assets, no engine rewrite, single self-contained `cecilia.html`. Raise the fidelity of the sprite data and the size at which speakers are drawn so faces and costumes can carry individual identity.

### Technical decisions

1. **Sprite grid: 16×20 → 24×32.** ~Triples face pixel area (≈6×4 → ≈12×10), the minimum for distinct eyes/brows/nose/mouth and real wig/hat shapes. All ten character sprites authored fresh at 24×32 as standing figures.
2. **Larger speaking figures.** `drawCharacter` currently draws at scale 4, ~64×80px, low above the dialogue box. Draw the new 24×32 sprites at a larger scale (target ~5–6 → ~120–190px tall) centered in the open region above the dialogue box, so the face reads. Keep the existing subtle idle bob.
3. **Expanded palette.** Add a small number of tones to `C` for shading: skin shadow + highlight, white-wig powder grey + shadow, plus any costume accents (claret, peacock/lilac, forest-green, scarlet). Still NES-flavored, flat-ish cel shading — not a style change.
4. **Period wigs.** Per historical convention (novel set 1782), **all men and women wear white/powdered wigs styled to 18th-century fashion**, with two deliberate exceptions used as characterization:
   - **Mr. Briggs** — wears a wig but it is **ill-kempt** (askew, frizzed, crooked): the vulgar miser.
   - **Mr. Albany** — **no wig**, wild unkempt natural grey hair: the deranged moral prophet.
   Because hair color is now uniform, individuality is carried by **wig style/height/neatness, costume cut & color, build, posture, age (shading/lines), and a defining prop.**

### Scope of cast (10 characters)

Five already appear on-screen as speakers (Cecilia, young Delvile, Monckton, Briggs, Mrs. Delvile). Five are added: **elder Mr. Delvile, Sir Robert Floyer, Mr. Harrel, Mr. Albany, Mr. Arnott** — these get new sprites **and** must be wired to appear in their existing story scenes (which currently render as narration with no `character`).

### Character briefs

| Key | Character | Age | Defining visual identity |
|---|---|---|---|
| `cecilia` | Cecilia Beverley | 20→21 | Neat powdered coiffure, soft face-framing curls (modest height); pale rose-and-cream gown + sash; youthful smooth face, poised upright. |
| `delvile` | Mortimer Delvile | ~25 | Trim tied-back white wig with queue; deep-blue cutaway tailcoat, cravat; slim, youthful, earnest — hand near heart. |
| `elderdelvile` | Mr. Delvile (elder) | ~50 | Formal full white wig, stacked side-rolls; aquiline nose, lifted chin; claret coat w/ gold trim; stiff posture, cane/snuffbox. |
| `mrsdelvile` | Mrs. Delvile | ~45 | Tall elegant powdered coiffure; deep-green gown with white fichu; noble bearing, faint care-lines. |
| `monckton` | Mr. Monckton | ~45 | Sleek severe white wig; narrow calculating face, thin mouth, shadowed eyes; polished forest-green coat. |
| `briggs` | Mr. Briggs | ~55 | **Ill-kempt** white wig; pinched ruddy face; shabby threadbare brown coat; hunched, clutching a money-bag. |
| `floyer` | Sir Robert Floyer | ~late 20s/30 | Fashionable white wig; broad, florid build; loud scarlet coat, riding boots; sneer, hand on hip, riding crop. |
| `harrel` | Mr. Harrel | late 20s | Over-powdered tall wig, excess curls; peacock/lilac coat with frills; charming but dissipated — wine glass/dice. |
| `albany` | Mr. Albany | ~55 | **No wig**, wild unkempt grey hair; ragged dark cloak, staff, burning eyes — visibly the outsider. |
| `arnott` | Mr. Arnott | ~26 | Modest neat white wig; soft melancholy face; sober-brown coat; downcast, hands clasped. |

## Out of scope

- No external image files; no change to music, minigames, scene engine, or ending logic.
- Title-screen Cecilia and minigame sprites: reuse the new `cecilia` sprite (scaled as needed). No new minigame art.
- No per-scene facial expressions / emotion variants (single sprite per character).

## Acceptance criteria

1. Each of the ten characters is visually distinguishable at a glance — different silhouette, costume color, and wig style — when rendered in the game.
2. Briggs reads as having a disordered wig; Albany reads as wig-less and wild.
3. Speaking figures are clearly larger than before and the face is legible.
4. The five newly-sprited characters appear in their existing scenes.
5. No console errors; game still boots, plays, and renders all paths. Single-file `cecilia.html` unchanged in architecture.
6. Sprites verified visually (headless-browser screenshot) before final commit — not authored blind.

## Mid-flight addition (2026-06-16): Super Mario styling

Per user request, the cast was pushed further toward a *Super Mario All-Stars* sprite look: `drawSprite` gained an optional bold dark-outline pass (8-neighbour silhouette outline, `#10101c`), enabled for all speaking portraits and the title Cecilia. This gives the chunky, outlined, "pops off any background" quality of Mario sprites while keeping the Georgian costumes and faces. Implemented in the same pass as the distinct-cast work.

## Status: COMPLETE (2026-06-16) — commit `cb53620` on branch `portraits-distinct-cast`

All ten characters authored at 24×32 with the Mario outline, speakers enlarged, palette expanded, five new characters wired into scenes (incl. a new elder-Delvile scene), `ceciliaRun` preserved for the minigame/chase. Verified headless: title + Briggs/Harrel/elder-Delvile/Albany scenes + charity minigame all render; scene validation reports no missing sprites; no console errors beyond the pre-existing favicon 404. NOT yet merged to `main` / pushed (awaiting user review).
