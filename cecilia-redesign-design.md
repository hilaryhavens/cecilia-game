# Cecilia Game — Full Redesign Design Doc

**Date:** 2026-06-12
**File under redesign:** `cecilia.html` (single-file HTML5 canvas game, ~1140 lines; NES-style pixel art, Press Start 2P font, retro TV-frame aesthetic)
**Approach:** B — Full Redesign

A retro 8-bit canvas game based on Frances Burney's novel *Cecilia*. Goal of the redesign: make it more faithful to the novel's dramatic content and playable across screen sizes, and — critically — make the player's accumulated stats actually decide the outcome. This revision (2026-06-12) reworks the stat model around Cecilia's *inner moral life* rather than public reputation, replaces the coin-collecting platformer with a **charity-distribution** minigame, and adds an endgame **delirium chase** as the playable form of the novel's madness scene.

---

## Section 0 — Stat model (revised 2026-06-12)

The game tracks **three** stats. Public standing is *not* tracked.

| Stat | Meaning | HUD label |
|---|---|---|
| `hearts` | Delvile romance / love | hearts icon |
| `gold` | Cecilia's fortune (starts ~10) | £ counter |
| `virtue` | Charitable benevolence **and** inner contentment/happiness — they are one meter | "Virtue" |

**Removed:** `reputation` (no public-standing tracking) and `wit`. Everywhere the prior design used `reputation`, it now uses `virtue`. Scenes that previously awarded `wit` are re-pointed to `virtue` or dropped.

`suitors` still tracks `delvile`, `arnott`, `monckton` (and `floyer` for the Floyer scene). Romance flags unchanged.

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

**Act 1 (leading into the charity minigame):**
1. **Harrel scene 1** — arrival at the Harrel household; hints at debt. Sets `flags.sympathizedWithHarrel`; affects gold.
2. **Floyer scene** — clumsy pursuit. Sets `flags.encouragedFloyer`; affects `suitors.floyer`.
3. **Arnott scene** — shy admirer. Sets `flags.kindToArnott`; affects `suitors.arnott`.
4. **Albany scene** — philanthropist moral challenge; affects **`virtue`** (previously `wit + reputation`).
5. **Harrel scene 2** — crisis/pressure for money. `flags.gaveMoneyToHarrel` shapes the scandal type.

**Act 2 (after the charity minigame):**
6. **Mrs. Delvile confrontation** — the name-condition speech, conditional on prior warmth. Sets `flags.mrsDelvileApproval`.
7. **Mortimer's private confession** — secret marriage proposal. Sets `flags.agreedSecretMarriage`.
8. **Cecilia's breaking point** — triggers the **delirium chase** (Section 6) when `virtue ≤ 2 OR hearts === 0 OR gold ≤ 3`; drawn from the novel's madness/delirium scene.

Existing scenes (Briggs, Mrs. Delvile intro, Monckton, Delvile garden) gain conditional text variants.

## Section 4 — Minigame A: Charity Distribution (replaces the platformer)

The coin-collecting platformer is **replaced** by a charity-distribution game that reuses the existing side-scroller engine (movement, scrolling, collision). The verb flips from *collect* to *give*. It sits where the platformer did, at the Act 1 → Act 2 boundary.

**Setup.** Cecilia walks a London street past a line of figures, carrying her purse (`gold`, ~10 to start). Pressing the give key near a figure hands them money.

**Targets.**
- **Worthy** — a poor family, the Hills (the struggling family she rescues in the novel), Albany's beggars, a hospital. Giving: **−1 gold, +1 virtue.** Placed quietly / easier to miss.
- **Unworthy** — **Mr. Harrel** (pleads his debts), a gambling den, a foppish spendthrift. Giving: **−2 gold, −1 virtue.** Placed prominently and "asking," to tempt the player the way Cecilia is pressured. Harrel is passable: running past without giving is the virtuous play.

**End.** The level ends at the end of the street; leftover `gold` carries forward. Net result feeds the stat economy: generous-to-worthy play raises virtue and modestly lowers gold; succumbing to Harrel/vice drains gold *and* virtue, steering toward the breaking-point thresholds.

## Section 5 — Stats & Endings

### State that determines the ending
- `stats.hearts`, `stats.gold`, `stats.virtue`
- `suitors.delvile`, `suitors.arnott`, `suitors.monckton`
- `flags.mrsDelvileApproval` — from the Act 2 name-condition scene (gated on prior warmth)
- `flags.agreedSecretMarriage` — from Mortimer's private proposal
- `flags.kindToArnott` — from the Act 1 Arnott scene

### Resolution mechanism: **Hybrid**
The player voices a wish, but stats/flags filter it into a happy, tragic, or "meh" variant. Resolution runs in two stages at the end of Act 2.

### Stage 1 — Breaking-point → the delirium chase (preempts the wish menu)
If `virtue ≤ 2 OR hearts === 0 OR gold ≤ 3`, Cecilia breaks down and the wish menu is never shown. Instead the **delirium chase minigame** (Section 6) plays — the interactive form of the madness scene. Its outcome:

```
CATCH Delvile:
    if flags.mrsDelvileApproval:  SURVIVAL (full)   -- reunited & married; Beverley fortune lost to the name condition
    else:                         SURVIVAL          -- reconciliation, diminished marriage
OVERTAKEN (declared mad)  -> redemption check (madness is NOT automatically fatal):
    if (suitors.delvile >= 4 OR flags.agreedSecretMarriage) AND flags.mrsDelvileApproval:
        recovers          -> SURVIVAL (diminished marriage)
    else:
        does not recover  -> DEATH (fully tragic)
```

Catching Delvile is the best outcome of the crisis. Being overtaken and declared mad still leaves a redemption path for players who built up love **and** Mrs. Delvile's sanction; Death is reserved for those who have neither.

### Stage 2 — The wish menu (only if she did not break)
The player voices a wish; stats filter it:

| Wish | Happy / primary variant (condition) | Alternate variant (else) |
|---|---|---|
| **Delvile** | **True Love** — marriage with family sanction; if `mrsDelvileApproval AND (suitors.delvile ≥ 4 OR flags.agreedSecretMarriage)`. Fortune still lost to the name condition. | **Name Condition** — they cannot marry without the family; an estranged, fortuneless parting (tragic) |
| **Independence** | **Independence** — celebrated London hostess; if `gold ≥ 12 AND virtue ≥ 4` | **Faded** — independence curdles into isolation and dwindling means (tragic) |
| **Arnott (security)** | **A Fortune Married** — safe, comfortable, loveless ("meh"); if `suitors.arnott ≥ 2 OR flags.kindToArnott` | **Quiet Spinster** — he is too timid to offer; she lives unmarried, of modest means ("meh", **not** ruin) |
| **Monckton** | *(none — he is the trap)* | **Ruin** — his scheme triumphs; fortune lost |

### Full ending roster (9 distinct screens)
1. **Survival** — diminished/reconciled marriage (chase: caught him, or recovered from madness)
2. **Death** — chase: overtaken, declared mad, no redemption
3. **True Love** — Delvile wish, sanctioned
4. **Name Condition** — Delvile wish, no sanction
5. **Independence** — hostess, qualified
6. **Faded** — independence, unqualified
7. **A Fortune Married** — Arnott "meh"
8. **Quiet Spinster** — Arnott, unqualified "meh"
9. **Ruin** — Monckton wish

### Acceptance criterion — Ruin appears in < 30% of playthroughs
Ruin has a single source — wishing Monckton. The Arnott path no longer falls through to Ruin, and the chase's **Death** screen is a separate tragic ending, *not* counted as Ruin. To keep Ruin under ~30% of plausible playthroughs, the Act 1/Act 2 stat awards (including the charity minigame) must make the qualifying thresholds (`virtue ≥ 4`, `gold ≥ 12`, `suitors.delvile ≥ 4`) comfortably reachable through ordinary play, so that Ruin is reserved for players who actively court Monckton. This must be verified against the tuned stat economy, not assumed.

## Section 6 — Minigame B: The Delirium Chase (endgame)

The playable form of the novel's madness scene. It fires **only** when the Stage 1 breaking-point triggers, and its outcome decides Survival vs Death per the Stage 1 logic above. Two phases:

**Phase 1 — Carriage pursuit (auto-runner).** Cecilia's carriage races through London after Delvile's. The player lane-dodges obstacles (other carriages, crowds). A *distance* meter shrinks on clean steering, grows on crashes. **Stats tune it:** higher `suitors.delvile` / `flags.agreedSecretMarriage` makes Delvile's carriage linger (he half-wants to be caught), closing the gap more easily.

**Phase 2 — Foot chase (the delirium).** Delvile's carriage lost, Cecilia runs on foot; the screen distorts/tints to convey her raving. Two racing meters: an **overtaken** meter (the crowd/keepers closing to seize her) versus a **reach-Delvile** meter.
- **Reach-Delvile fills first → she CATCHES him** → reconciliation (Survival; full Survival if `mrsDelvileApproval`).
- **Overtaken fills first → declared mad** → redemption check (recovers to Survival if love + sanction, else Death).

`gold` and `virtue` feed difficulty slightly (a despairing, destitute Cecilia tires faster), so the same conditions that triggered the crisis also make the chase harder — but it is **never unwinnable**.

## Section 7 — Dialogue-box layout specifics (deferred to implementation)

Conceptually covered by Section 1 (dialogue box ≈ 32% of canvas height; text as a fraction of canvas width). Concrete specifics — choice layout and selection, typewriter text + "▼ continue" indicator behavior across canvas sizes, and how locked/hidden wish options are presented — are to be settled during implementation.

---

## Open tuning notes
- All threshold numbers (`virtue ≤ 2`, `gold ≤ 3`, `≥ 4`, `≥ 12`, `≥ 2`) are provisional and to be tuned once the full stat economy across Act 1 (incl. charity minigame), Act 2, and the chase is laid out, subject to the Ruin < 30% criterion.
- The charity minigame and the chase both read/adjust the same three stats; tune them together so worthy play comfortably clears the qualifying thresholds and only Harrel/vice/Monckton play pushes toward the breaking-point and Ruin.
