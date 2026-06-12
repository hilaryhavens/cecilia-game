# Cecilia Game — Full Redesign Design Doc

**Date:** 2026-06-12
**File under redesign:** `cecilia.html` (single-file HTML5 canvas game, ~1140 lines; NES-style pixel art, Press Start 2P font, retro TV-frame aesthetic)
**Approach:** B — Full Redesign

A retro 8-bit canvas game based on Frances Burney's novel *Cecilia*. Goal of the redesign: make it more faithful to the novel's dramatic content and playable across screen sizes, and — critically — make the player's accumulated stats actually decide the outcome.

---

## Section 1 — Responsive Canvas

- Canvas resizes to `window.innerWidth × window.innerHeight` on load and on resize.
- All sizing constants (`SCALE`, `FONT_BASE`, `BOX_H`, `CHAR_SCALE`) derive from the live canvas dimensions rather than fixed pixels.
- HUD ≈ 8% of canvas height; dialogue box ≈ 32% of canvas height.
- Sprites scale to ≈ 5% of canvas height.
- Text sizes are computed as fractions of canvas width.

## Section 2 — Scene Data Architecture

- A scene's `text` field may be a string **or** a function of game state: `text: (gs) => gs.flags.x ? "..." : "..."`.
- `choices` entries gain an optional `condition: (gs) => bool` to show/hide them.
- `effect` receives the full game-state object instead of closing over globals.
- Game state gains a `flags` object for named story decisions.
- Any scene whose `condition` returns false is skipped automatically.

## Section 3 — New Story Content

**Act 1 (before the minigame):**
1. **Harrel scene 1** — arrival at the Harrel household; hints at debt. Sets `flags.sympathizedWithHarrel`; affects gold.
2. **Floyer scene** — clumsy pursuit. Sets `flags.encouragedFloyer`; affects `suitors.floyer`.
3. **Arnott scene** — shy admirer. Sets `flags.kindToArnott`; affects `suitors.arnott`.
4. **Albany scene** — philanthropist moral challenge; affects `wit` + `reputation`.
5. **Harrel scene 2** — crisis/pressure for money. `flags.gaveMoneyToHarrel` shapes the scandal type.

**Act 2 (after the minigame):**
6. **Mrs. Delvile confrontation** — the name-condition speech, conditional on prior warmth. Sets `flags.mrsDelvileApproval`.
7. **Mortimer's private confession** — secret marriage proposal. Sets `flags.agreedSecretMarriage`.
8. **Cecilia's breaking point** — triggers only if `reputation ≤ 2 OR hearts === 0`; drawn from the novel's madness/delirium scene.

Existing scenes (Briggs, Mrs. Delvile intro, Monckton, Delvile garden) gain conditional text variants.

## Section 4 — Stats & Endings

### State that determines the ending
- `stats.reputation`, `stats.hearts`, `stats.gold`, `stats.wit`
- `suitors.delvile`, `suitors.arnott`, `suitors.monckton`
- `flags.mrsDelvileApproval` — from the Act 2 name-condition scene (gated on prior warmth)
- `flags.agreedSecretMarriage` — from Mortimer's private proposal
- `flags.kindToArnott` — from the Act 1 Arnott scene

### Resolution mechanism: **Hybrid**
The player voices a wish, but stats/flags filter it into a happy, tragic, or "meh" variant. Resolution runs in two stages at the end of Act 2.

### Stage 1 — Breaking-point check (preempts the wish menu)
If `reputation ≤ 2 OR hearts === 0`, Cecilia collapses and the wish menu is never shown. She is unconscious, so she has no agency here; the verdict falls to Delvile, who either confronts her or flees. Both love and family sanction must hold for him to stay:

```
if (suitors.delvile >= 4 OR flags.agreedSecretMarriage) AND flags.mrsDelvileApproval:
    Delvile CONFRONTS  -> SURVIVAL ending (married, but Beverley fortune lost to the name condition)
else:
    Delvile FLEES      -> DEATH ending (fully tragic)
```

### Stage 2 — The wish menu (only if she did not break)
The player voices a wish; stats filter it:

| Wish | Happy / primary variant (condition) | Alternate variant (else) |
|---|---|---|
| **Delvile** | **True Love** — marriage with family sanction; if `mrsDelvileApproval AND (suitors.delvile ≥ 4 OR flags.agreedSecretMarriage)`. Fortune still lost to the name condition. | **Name Condition** — they cannot marry without the family; an estranged, fortuneless parting (tragic) |
| **Independence** | **Independence** — celebrated London hostess; if `gold ≥ 12 AND reputation ≥ 4` | **Faded** — independence curdles into isolation and dwindling means (tragic) |
| **Arnott (security)** | **A Fortune Married** — safe, comfortable, loveless ("meh"); if `suitors.arnott ≥ 2 OR flags.kindToArnott` | **Quiet Spinster** — he is too timid to offer; she lives unmarried, of modest means ("meh", **not** ruin) |
| **Monckton** | *(none — he is the trap)* | **Ruin** — his scheme triumphs; fortune and reputation lost |

### Full ending roster (9 distinct screens)
1. **Survival** — diminished marriage (breaking-point, Delvile stays)
2. **Death** — breaking-point, Delvile flees
3. **True Love** — Delvile wish, sanctioned
4. **Name Condition** — Delvile wish, no sanction
5. **Independence** — hostess, qualified
6. **Faded** — independence, unqualified
7. **A Fortune Married** — Arnott "meh"
8. **Quiet Spinster** — Arnott, unqualified "meh"
9. **Ruin** — Monckton wish

### Acceptance criterion — Ruin appears in < 30% of playthroughs
Ruin has a single source — wishing Monckton. The Arnott path no longer falls through to Ruin, and the breaking-point **Death** screen is a separate tragic ending, *not* counted as Ruin. To keep Ruin under ~30% of plausible playthroughs, the Act 1/Act 2 stat awards must make the qualifying thresholds (`reputation ≥ 4`, `gold ≥ 12`, `suitors.delvile ≥ 4`) comfortably reachable through ordinary play, so that Ruin is reserved for players who actively court Monckton. This must be verified against the tuned stat economy, not assumed.

## Section 5 — Dialogue-box layout specifics (deferred to implementation)

Conceptually covered by Section 1 (dialogue box ≈ 32% of canvas height; text as a fraction of canvas width). Concrete specifics — choice layout and selection, typewriter text + "▼ continue" indicator behavior across canvas sizes, and how locked/hidden wish options are presented — are to be settled during implementation.

---

## Open tuning notes
- All Section 4 threshold numbers (`≥ 4`, `≥ 12`, `≥ 2`) are provisional and to be tuned once the stat economy across Acts 1–2 is laid out, subject to the Ruin < 30% criterion.
