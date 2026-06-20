# Cecilia — Chase-for-Everyone, Virtue Rework & Chase Redesign

**Date:** 2026-06-18
**File touched:** `cecilia.html` (single-file game)
**Status:** design approved in brainstorming; spec for review before implementation plan.

This spec covers three connected changes requested by Hilary:

1. Make the delirium **chase minigame reachable for every player** (it currently only fires on the breakdown path).
2. **Rework the virtue stat** so Cecilia starts with *full* virtue, which her early answers then spend or restore.
3. **Improve the graphics & design of the chase** (both the carriage pursuit and the on-foot delirium).

---

## 1. Chase for everyone

### Current behaviour
The stage-gate scene (the storm scene after Act 2, `SCENES` index for the second storm gate) routes:

```js
onContinue: () => {
  if (shouldBreakDown(gameState())) { state = 'chase'; initChase(); }
  else { currentSceneIdx++; setupScene(); }   // -> wish menu
}
```

So only players who hit `shouldBreakDown` (`virtue ≤ 2 || hearts === 0 || gold ≤ 3000`) ever see the chase, and for them it is **terminal**: pressing space after the chase calls `chooseEnding(chase.endingKey)` (Survival or Death). The wish menu is unreachable for those players, and the chase is unreachable for everyone else.

### New behaviour
The chase becomes the **Act-2 climax everyone plays**, framed as a fevered vision during the scandal. Survivors flow into the existing wish menu; **death is reserved for the genuinely broken who also fail**.

**Flow:**

```
stage gate  ─►  CHASE (always)  ─►  survived?  ─►  yes  ─►  WISH MENU  ─►  chosen ending
                                              └─►  no   ─►  DEATH ending
```

**Lethality is decoupled from "does the chase happen."** This is the crucial design point that keeps the change faithful and keeps Death rare:

- The chase **always plays** for every player.
- **Catching Delvile** → always survive → wish menu.
- **Failing to catch him**:
  - If the player is **not** in breakdown (`!shouldBreakDown(gs)`) → they **survive anyway** → wish menu. The chase was the emotional climax / fever-dream they wake from. (This protects the Independence and other "healthy" endings — a serene player who simply mistimed the button is not killed.)
  - If the player **is** in breakdown (`shouldBreakDown(gs)`) → resolve as today via the redemption check: romantically redeemable → survive → wish menu; otherwise → **Death**.

So `shouldBreakDown` is **repurposed**: it no longer decides *whether* the chase runs, only whether failing it is *lethal*. Death therefore happens only to a player who (a) reached breakdown stats, (b) failed the chase, and (c) has no romantic redemption — the same tragic player the old game killed. Overall Death frequency stays in the same rare band as before.

### Code changes
- **Stage-gate `onContinue`:** always `state = 'chase'; initChase();`. Capture the wish-menu index first, mirroring the existing `mgReturnIdx` pattern: `chaseReturnIdx = currentSceneIdx + 1;`.
- **New pure resolver** (replaces the direct `resolveBreakpoint` call in `updateChase`), testable via `window.Cecilia`:

  ```js
  // 'wish' = survive and proceed to the wish menu; 'death' = terminal.
  function resolveChase(caught, gs) {
    if (caught) return 'wish';
    if (!shouldBreakDown(gs)) return 'wish';
    return resolveBreakpoint(false, gs) === 'death' ? 'death' : 'wish';
  }
  ```

  (`resolveBreakpoint` is kept as-is and still unit-tested; it now feeds `resolveChase`.)
- **`updateChase` finish:** `chase.outcome = resolveChase(chase.caught, gameState());` (replaces `chase.endingKey`).
- **Catching Delvile sets a flag:** on `chase.caught`, set `flags.caughtDelvile = true`. In `resolveWish`'s `'delvile'` case, treat `caughtDelvile` like `agreedSecretMarriage` as a route to `true_love` — so winning the climax meaningfully rewards the Delvile wish.
- **Post-chase transition** (in `update()`, `state === 'chase'` branch, on space when finished):

  ```js
  if (chase.outcome === 'death') chooseEnding('death');
  else { state = 'scene'; currentSceneIdx = chaseReturnIdx; setupScene(); }   // -> wish menu
  ```
- **`ENDINGS.survival`** is no longer auto-routed (the happy marriage is now reached through the wish menu's `delvile → true_love`). Leave the entry in `ENDINGS` and keep `resolveBreakpoint` exported so existing `window.Cecilia` tests still pass; note it as legacy in a code comment.
- **New module var** `chaseReturnIdx` and new flag `caughtDelvile` (added to `flags` initial object **and** `blankGS()`).

### A short framing line
Add one narration beat before the chase so it reads for *all* players (not only the desperate) — the scandal-fever takes her, and she dreams she is racing after Delvile through the night. Surviving = waking; the broken-and-unloved do not wake.

---

## 2. Virtue rework — start full, spend & restore

### Model
- Virtue is a **0–6 gauge** (the HUD already renders up to 6 pips at lines ~1392 and ~1625).
- **Cecilia starts at 6 (full).** Change the three initial-state sites: the live `stats` (line ~650), the `blankGS()` stats (line ~659), and `resetGame()`'s reset (line ~955), all `virtue: 3` → `virtue: 6`.
- Virtue is **clamped to [0, 6]** after every change. Add a small helper and call it after applying a choice `effect` and inside `applyGift`:

  ```js
  function clampVirtue(gs){ gs.stats.virtue = Math.max(0, Math.min(6, gs.stats.virtue)); }
  ```

  (Clamping is what makes "recover up to full" meaningful and stops `+1`s from overflowing past the 6 pips.)

### Which choices change

**Compromising choices — cost virtue** (the gauge is meaningful only if vice actually bites):

| Scene | Choice | Effect |
|---|---|---|
| Monckton (garden) | "How kind. Tell me more." | `monckton +1`, **`virtue −1`** *(already)* |
| Albany | "Charity is a private matter, sir." | **`virtue −1`** *(already)* |
| Harrel (storm) | "Give him the money…" | `gold −3000`, **`virtue −1`**, flag *(already)* |
| Mrs. Delvile (intro) | "Engage instead Mr. Monckton…" | `monckton +1`, **`virtue −1`** *(new — courting the schemer)* |
| Floyer | "Laugh kindly and encourage him." | `floyer +1`, flag, **`virtue −1`** *(new — leading on a man she won't have)* |

**Honorable / redemptive choices — restore virtue** (capped at 6; only matter once virtue has dropped). All already award `+virtue` and are **kept**: Briggs "choose with wisdom" (+1), Mrs. Delvile "keep distance" (+1), Monckton "I am not for sale!" (+1), Harrel sc.1 "economy would serve…" (+1), Floyer "Excuse yourself…" (+1), Albany "Teach me to do good" (+2), Harrel-storm "Refuse" (+1), Mortimer secret-marriage "Not in secret" (+1), and every **worthy** gift in the charity minigame (+1 each).

**Honoring the Delvile name — NO virtue gain** (per Hilary: deferring to aristocratic name-pride is a romantic/strategic move, not a moral virtue). Remove the `virtue += 1` from:

| Scene | Choice | Was | Becomes |
|---|---|---|---|
| Mrs. Delvile confrontation | "I would never ask him to dishonour his name." | `approval = true`, `virtue +1` | `approval = true` *(virtue gain removed)* |
| Elder Mr. Delvile | "I would never wish to diminish your family, sir." | `virtue +1` | *(no stat effect — flavour only)* |

### Threshold re-tuning (because the start moved 3 → 6)
- `shouldBreakDown`: keep `virtue ≤ 2`. From a full start of 6, reaching ≤2 now requires losing **4+** virtue across many compromising choices — so breakdown (and thus a *lethal* chase) is appropriately rare.
- `resolveWish` Independence: keep `virtue ≥ 4` (an independent woman who stayed largely uncompromised — lost at most 2).
- `chaseDifficulty`: unchanged formula; `Math.min(virtue, 6) * 0.05` already caps correctly at the new full value.

### Verification
Re-run an ad-hoc Monte-Carlo over random playthroughs (as in prior passes) to confirm: Death stays rare/<30%, Independence and True Love remain reachable in ordinary play, and no single choice path is dominant. Tune only if the distribution skews.

---

## 3. Chase redesign — Direction A "Cinematic night" (visuals approved in companion)

Both phases keep the game's NES pixel aesthetic but gain cinematic weight. Implemented inside the existing `drawChase()` (and small helpers) using the existing palette `C` and `drawSprite`; **no new sprite *data*** is required (Cecilia and Mortimer reuse their existing 24×32 portrait sprites). The delirium running figure switches from the old generic `SP.ceciliaRun` to **Cecilia's portrait sprite** (`SP.cecilia`) so she is recognizably herself, animated with a vertical bob + motion-trail rather than a run cycle.

### Phase 1 — carriage pursuit
- **Layered night London:** dark-blue sky gradient, a moon with glow, silhouetted Georgian terrace (chimneys + a church steeple), scattered lit windows, glowing gas-lamps, a paved road with cobble flecks, and a low drifting-fog band. (Reuses the established Georgian-London motif from the main game backgrounds.)
- **Real carriages with horse teams:** each rig = a galloping **two-horse team** (animated legs via a small sine/step cycle), a connecting pole, a swaying cab with a lit side-lamp, and **spoked wheels** (animated). 
- **Recognizable occupants:** **Cecilia** (her portrait sprite — white powdered coiffure, rose gown) leans from her cab; **Mortimer Delvile** (his portrait sprite — blue tailcoat, white wig) rides ahead and is glimpsed glancing back. Drawn small (portrait scaled down) seated in/leaning from the cabs.
- **Crash feedback:** on hitting a scandal obstacle, a brief **screen-shake** + spark flecks off the cobbles, plus the existing gap-widen + `hurt` sound.
- HUD: keep "CHASE HIS CARRIAGE ↑↓ STEER" and the CLOSING gap meter, restyled to match.

### Phase 2 — the delirium (redesigned; rendered from the real sprites)
- **Feverish swimming world:** pulsing red radial vignette, faint **concentric warp-rings** centered on the action, drifting red **motes**, and a dark vignette at the edges.
- **Cecilia** runs in the foreground drawn from her **actual portrait sprite** (`SP.cecilia`, replacing `SP.ceciliaRun` here), with a flickering **motion-trail** (2–3 fading after-images).
- **Mortimer ahead:** drawn from his real sprite, **hazed/semi-transparent with hand outstretched**; he **sharpens and drifts toward centre as the REACH meter fills**, and **dissolves** as OVERTAKEN fills.
- **Looming gossip-faces** at the screen edges (soft radial blobs) that press inward with the OVERTAKEN meter — society closing in.
- **Restyled meters:** REACH glows gold, OVERTAKEN bleeds dark-red inward. Keep the "REACH HIM! →/SPACE" prompt.
- Haze palette: **blood-red** (chosen over the sickly-green alternative). Keep the warp/shake moderate for comfort.

### Implementation notes
- All drawing stays within `drawChase()` plus a few private helpers (`drawNightStreet`, `drawCarriageRig`, `drawDeliriumField`, `drawHorse`); no change to the chase *control* logic except the outcome wiring in §1.
- Drawing the portrait sprites scaled down in the cabs: reuse `drawSprite(SP.cecilia, …, scale, C, outline)` at a small scale; clip/position so only the bust shows above the cab body.
- Keep everything resolution-relative to `W`/`H` like the rest of the game (the chase currently uses some absolute pixel constants — convert the new art to `W`/`H` fractions so it scales with the responsive canvas).

---

## Out of scope
- No change to the charity minigame, the portrait sprites themselves, the audio engine, or any ending text besides retiring the auto-`survival` route.
- No new build tooling; still a single `cecilia.html` edited in place, tested in-browser with the Playwright harness + a `?v=N` cache-buster, and re-verified with an ad-hoc Monte-Carlo for the ending distribution.

## Acceptance criteria
1. Every playthrough reaches and plays the chase before any ending.
2. A healthy player who fails the chase still survives and reaches the wish menu (no unfair Death).
3. Death occurs only for breakdown + unredeemable + failed-chase players; Monte-Carlo Death rate stays rare (<30%), and True Love + Independence remain reachable.
4. Cecilia starts at 6/6 virtue; compromising answers reduce it, honorable/charitable answers restore it (capped at 6), and honoring the Delvile name does **not** raise it.
5. The chase renders Direction A: horse-drawn carriages with recognizable Cecilia & Mortimer (phase 1) and the redesigned blood-red delirium with both real sprites (phase 2); both scale with the responsive canvas; 0 new console errors.
