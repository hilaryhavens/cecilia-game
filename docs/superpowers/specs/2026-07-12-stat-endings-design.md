# Stat-Determined Endings (backlog item 14) — Design

**Date:** 2026-07-12 · **Approved by:** Hilary (interactive design session)

## Goal

Make LOVE / VIRTUE / GOLD decide the ending. The wish menu is removed entirely;
after the carriage chase the game computes one of **four flat endings** from the
stats, story flags, and the chase outcome.

## The four endings

| # | Key (new)       | Title              | Outcome                                              | Background |
|---|-----------------|--------------------|------------------------------------------------------|------------|
| 1 | `single_rich`   | SINGLE & RICH      | Fortune and character intact; she marries no one     | `ballroom` |
| 2 | `delvile`       | MARRIED TO DELVILE | Marries Mortimer; name and fortune forfeit           | `wedding`  |
| 3 | `madhouse`      | THE MADHOUSE       | Standing collapsed; committed among strangers        | `storm`    |
| 4 | `loveless`      | A LOVELESS MARRIAGE| A suitor takes the Beverley name; heart not consulted| `manor`    |

Text sources: `single_rich` reuses the INDEPENDENCE prose; `delvile` adapts
TRUE LOVE TRIUMPHS; `madhouse` keeps the asylum prose as-is; `loveless` is one
flat text adapted from A FORTUNE MARRIED, with the husband's **name filled in
dynamically** (the scene engine already supports `text` as a function of game
state): **Arnott** if `flags.kindToArnott || suitors.arnott >= 2`, otherwise
**Monckton**. Hilary has final say on all prose and may rewrite during
implementation review.

## Resolution logic — two-axis grid, tilted by the chase

The chase always plays. Let `caught` = she caught Delvile. Resolution order:

1. **Love → `delvile`.**
   - `caught`: `hearts >= 3`.
   - `!caught`: `hearts >= 5` (only maximal devotion reaches him after he flees).
2. **Standing collapse → `madhouse`.**
   - `caught`: `virtue <= 2 || gold <= 3000` (today's breakdown line).
   - `!caught`: heartbreak widens the trapdoor — `virtue <= 3 || gold <= 4500`.
3. **`single_rich`** — `gold >= 7500 && virtue >= 4`.
4. **`loveless`** — everything else (name intact, solvent middle).

Checking love first encodes the **delirium rescue**: a Cecilia whose standing
has collapsed but whose love clears the tilted Delvile bar is married out of
her delirium (`delvile`) rather than committed — the same outcome the old
`survival` ending covered. For everyone below the love bar, collapse means the
madhouse, full stop. This ordering replaces `resolveBreakpoint`'s flag-based
rescue; `survival` as a distinct ending is gone (absorbed by `delvile`).

Failing the chase therefore both raises the Delvile bar (5 hearts vs. 3) and
widens the madhouse trapdoor — the requested lever. Stats also still steer the
chase itself via `chaseDifficulty` (unchanged), so they matter twice. The
mid-chase breakdown ("DECLARED MAD") path simply feeds this same grid.

## Removals

- The wish-menu scene (last entry of `SCENES`) and `resolveWish`.
- `resolveBreakpoint` (logic absorbed into the grid resolver).
- Ending texts `survival`, `true_love` (superseded by `delvile`),
  `name_condition`, `independence` (superseded by `single_rich`), `faded`,
  `fortune_married` (superseded by `loveless`), `quiet_spinster`, `ruin`.
  `ENDINGS` goes from 9 keys to 4.
- Their `window.Cecilia` seam exports and Playwright tests.

## New resolver

One pure function, exported on the seam:

```js
resolveEnding(caught, gs) -> 'madhouse' | 'delvile' | 'single_rich' | 'loveless'
```

`resolveChase` calls it directly for both chase outcomes (the wish state is
gone). The chase-end banner keeps its current caught/lost/mad messaging.

## Monte-Carlo balance check

A Node harness (committed to the repo, e.g. `balance-check.mjs`) simulates a few
thousand random-choice playthroughs against the pure-logic seam: apply each
scene's choice effects uniformly at random, model chase success as a probability
derived from `chaseDifficulty(gs)` (calibration documented in the script), then
call `resolveEnding`. It prints the 4-ending distribution.

**Targets under uniform random play:**

- `madhouse` **≤ 30 %** (successor to the old "Ruin < 30 %" ceiling), and
- **every ending ≥ 10 %** (nothing dominant, nothing effectively unreachable).

If a target fails, tune the numeric thresholds in `resolveEnding` (not the
structure) and re-run. The script stays in the repo so future rebalances are
one command.

## Testing

- Playwright pure-logic suite: replace wish/breakpoint tests with a
  `resolveEnding` grid test (all four cells × caught/uncaught).
- In-browser end-to-end: one playthrough per chase outcome, confirming the menu
  is gone and an ending renders directly after the chase.
- Run the Monte-Carlo harness and record the passing distribution in the plan.

## Out of scope

- Backlog item 18 (Pac-Man-style carriage chase redesign) — noted separately.
- Any change to choice effects, gift economy, or `chaseDifficulty`
  (unless Monte-Carlo tuning requires a threshold nudge, which stays in
  `resolveEnding` only).
