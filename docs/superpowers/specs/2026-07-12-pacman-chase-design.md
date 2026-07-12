# The Streets of London — Pac-Man Chase Redesign (backlog item 18)

**Date:** 2026-07-12
**Status:** Approved by Hilary (design conversation, 2026-07-12)

## Summary

Replace BOTH phases of the delirium chase (the side-scrolling carriage dodge and
the button-mash foot chase) with a single top-down, Pac-Man-style maze game:
Cecilia, on foot and running mad through night-time London, must corner Mortimer
Delvile's moving carriage in a street maze while a shopkeeper stalks her, before
her delirium overwhelms her. The outcome feeds the existing, untouched
`resolveEnding` grid, so all four endings stay reachable and the reckoning panel
is unchanged.

Novel grounding: in *Cecilia* it is a pawnbroker/shopkeeper who confines the
delirious Cecilia — he is the "ghost." Her mad flight through London is on foot;
a one-line intro covers abandoning the carriage.

## Player experience

1. Scene 18's `onContinue` still sets `state = 'chase'` / `initChase()` — entry
   point unchanged.
2. A charity-minigame-style instruction banner explains the rules (dismiss with
   a fresh key press, consistent with the other minigames):
   "ARROW KEYS / WASD TO RUN — CATCH DELVILE'S CARRIAGE — EVADE THE SHOPKEEPER."
3. She navigates the maze with classic Pac-Man grid movement, including queued
   turns (press a direction early; she turns at the next opening).
4. Hearts, coins, and boost pellets lie along the streets.
5. The chase ends one of three ways (see Outcomes).
6. Existing post-chase flow (ending card + reckoning panel, SPACE to continue)
   unchanged.

## The maze

- Single fixed, hand-designed maze filling the canvas below the HUD: **20 × 13
  tiles of 40 px** (800 × 520), with a ~60 px HUD strip on top (delirium meter +
  stat counters) and ~20 px margin.
- Defined as an ASCII string array (one string per row). Legend:
  `#` wall, `.` open street, `h` heart, `c` coin, `b` boost pellet,
  `P` Cecilia spawn, `D` Delvile spawn, `S` shopkeeper spawn.
- Outer border is solid wall; interior blocks form Pac-Man-like corridors (no
  dead ends wider than necessary; every pellet reachable; no wrap-around
  tunnels in v1).
- Aesthetic: existing night palette (`C.n` sky is replaced by streets — the
  whole board is night ground `C.a`/cobbles); wall blocks drawn as Georgian
  terrace facades with lit windows (`C.u` body, `C.e` windows), gas lamps at
  selected corners. A red delirium vignette (reuse the `drawDeliriumField`
  vignette technique) creeps inward as the timer rises.

## Actors

All actors move tile-to-tile at fixed px/frame speeds, turning only at tile
centers. Starting values (all tunable during balance pass):

| Actor | Speed | Behavior |
|---|---|---|
| Cecilia | 2.5 px/f (3.75 boosted) | Player-controlled; queued turns. Sprite: existing `SP.ceciliaWalk`, horizontally flipped for leftward movement; side view retained for vertical movement (retro shortcut). |
| Delvile | 2.1 px/f | Moving goal. Compact carriage rig + Delvile sprite. At each intersection: 60% chance picks the direction maximizing distance from Cecilia, else random; never reverses except at dead ends. **Linger:** at each intersection, chance `min(0.30, 0.05 + 0.07 × chaseDifficulty(gs))` to pause ~45 frames — preserves the existing stat influence (love/flags make him catchable). |
| Shopkeeper | 2.3 px/f (1.8 fleeing) | New sprite (aproned Georgian shopkeeper). Pac-Man ghost AI: at each intersection picks the direction minimizing straight-line distance to Cecilia; never reverses except when boost state toggles. While Cecilia is boosted he is FRIGHTENED: picks the distance-maximizing direction instead (he retreats — he is never "eaten"; no combat). |

Catch radius for all actor-pair collisions: centers closer than 0.6 tile (24 px).

## Pellets

| Pellet | Count | Effect |
|---|---|---|
| Heart `h` | 3, placed in risky spots (near the shopkeeper's half) | +1 LOVE each via `clampHearts` — counts toward the ending thresholds. (Partially serves backlog item 19's "easier hearts.") |
| Coin `c` | 8 | +£250 GOLD each. |
| Boost `b` | 3 | Cecilia +50% speed for 300 frames (5 s) and shopkeeper flees for the duration. Timer resets if a second boost is grabbed. |

Pellet pickups update the live stats immediately (visible on the HUD), so they
are already in `gameState()` when the outcome resolves.

## Timer

A visible DELIRIUM meter fills linearly over **90 seconds** (5400 frames).
Full meter = she collapses in the street, uncaught.

## Outcomes

New thin resolver (pure, seam-exported) — `resolveEnding` itself is untouched:

```js
// result: 'reached' | 'caught' | 'collapsed'
function resolveMazeOutcome(result, gs) {
  if (result === 'reached')   return resolveEnding(true, gs);   // she catches Delvile
  if (result === 'collapsed') return resolveEnding(false, gs);  // timer expired
  /* caught by the shopkeeper */
  return gs.stats.hearts >= 5 ? 'delvile' : 'madhouse';         // love rescues her, or the madhouse
}
```

- `reached` additionally sets `flags.caughtDelvile = true` (as today).
- `chase.mad` (DECLARED MAD banner) = final outcome is `'madhouse'`, as today.
- Victory/hurt sounds keyed off outcome as today.

## Code changes

- Rewrite `initChase` / `updateChase` / `drawChase` for the maze; delete the
  dead phase-1/phase-2 internals (obstacles, `gap`, `reach`/`overtaken`,
  scandal-sheet art & banner, `drawNightStreet` if unused elsewhere,
  `drawDeliriumField` body may be trimmed to the vignette helper if reused).
- Keep `chaseDifficulty` (drives Delvile's linger) and the `chaseResultEnding`
  seam export.
- Add `resolveMazeOutcome` to the PURE DECISION LOGIC section and to
  `window.Cecilia`; expose enough maze state on the seam (`chase` internals or
  a `live`-style getter) to force each outcome in tests.
- New sprite: `SP.shopkeeper` (24 × 32, cast outline style). Compact top-down
  maze carriage for Delvile (side-view rig at small scale is acceptable).

## Balance & testing (must pass before merge)

- **`node balance-check.mjs` must PASS** with the same targets: madhouse ≤ 30%
  and every ending ≥ 10% under uniform random play. Its chase-outcome model is
  rewritten for the maze: sample an outcome (`reached`/`caught`/`collapsed`)
  and random pellet pickups (0–3 hearts, 0–8 coins applied to stats), then call
  `resolveMazeOutcome`. Outcome probabilities may scale with
  `chaseDifficulty(gs)` to mirror the linger mechanic.
- Seam tests: all `resolveMazeOutcome` permutations (reached; caught with
  hearts ≥ 5 → `delvile`; caught with hearts < 5 → `madhouse`; collapsed grid).
- In-browser playtests: win by cornering Delvile; lose to the shopkeeper (both
  rescue and madhouse variants via stat setup); collapse by timeout; boost
  pellet flee behavior; queued-turn feel; banner dismiss with fresh key press.
- Watch-item from item 14 still applies: if the harness flaps near the 10%
  floor, bump runs or seed the RNG.

## As-built deviations (2026-07-12)

- Delvile rides visibly atop his carriage (Hilary's mid-build request); the cab
  is his coat-blue (`C.B`) with a dark outline so the moving goal reads against
  the dark road.
- Delvile's per-intersection pause probability is divided by 4 in code — the
  movement engine re-rolls roughly every tile, so the divisor restores the
  spec's intended per-intersection rate.
- Caught-with-rescue gets its own finished banner: "SEIZED - YET DELVILE COMES".
- Balance harness constants as shipped: `pReach = clamp((diff-0.5)/2.5*0.7 +
  0.15, 0.15, 0.85)`, `pCaught = 0.20`; distribution ≈ 19/39/25/17
  (single_rich / delvile / madhouse / loveless) — the delvile share rose by
  design (maze hearts serve the "easier hearts" goal, backlog item 19).
- Like Pac-Man, Cecilia starts moving (rightward) as soon as the intro banner
  is dismissed; she never idles unless boxed in.

## Out of scope

- Backlog item 19 (starting virtue 3/5) — separate item; the maze hearts only
  address the "easier hearts" half.
- Multiple pursuers, wrap-around tunnels, multiple maze layouts, eating the
  shopkeeper.
