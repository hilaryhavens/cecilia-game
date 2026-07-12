// Monte-Carlo ending-balance check for cecilia.html (item 14).
// Spec targets (docs/superpowers/specs/2026-07-12-stat-endings-design.md):
//   madhouse <= 30% AND every ending >= 10% under uniform random play.
// Usage: node balance-check.mjs [runs]   (default 5000)
//
// Loads the game script in a stubbed-DOM vm sandbox; a universal Proxy stands in
// for canvas/ctx/AudioContext so the script's load-time side effects are inert.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./cecilia.html', import.meta.url), 'utf8');
const src = html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

const proxy = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : proxy),
  set: () => true,
  apply: () => proxy,
  construct: () => proxy,
});
const sandbox = {
  document: { getElementById: () => proxy, addEventListener: () => {} },
  requestAnimationFrame: () => 0,
  addEventListener: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  AudioContext: proxy,
  webkitAudioContext: proxy,
  performance, console, Math, Date, JSON, Object, Array,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const C = sandbox.window.Cecilia;
if (!C || typeof C.resolveEnding !== 'function') {
  console.error('FAIL: could not load the Cecilia seam from cecilia.html');
  process.exit(1);
}

// One random playthrough. Calibration notes:
//  - Story choices: every SCENES choice menu is answered uniformly at random
//    (in real play every NPC room detour is mandatory, so all menus are seen).
//  - Charity minigame: 4 worthy targets (~£25) and 3 spendthrifts (£1000-2500),
//    each given to with p=0.5 (mirrors initMinigame's target list).
//  - Maze chase (item 18): random pellet pickups (0-3 hearts, 0-8 coins), then
//    an outcome roll — P(reached) follows chaseDifficulty (love & promises make
//    Delvile linger, so he's easier to corner); the shopkeeper seizes her at a
//    flat rate; the remainder collapse to the delirium timer.
function simulate() {
  const gs = C.blankGS();
  for (const sc of C.SCENES) {
    if (sc.condition && !sc.condition(gs)) continue;
    const vis = C.visibleChoices(sc, gs);
    if (!vis || !vis.length) continue;
    const ch = vis[Math.floor(Math.random() * vis.length)];
    if (ch.effect) ch.effect(gs);
  }
  for (let i = 0; i < 4; i++) if (Math.random() < 0.5) C.applyGift(gs, 'worthy', 25);
  for (let i = 0; i < 3; i++) if (Math.random() < 0.5) C.applyGift(gs, 'unworthy', 1000 + Math.floor(Math.random() * 4) * 500);
  gs.stats.hearts += Math.floor(Math.random() * 4);            // 0-3 maze hearts
  C.clampHearts(gs);
  gs.stats.gold += 250 * Math.floor(Math.random() * 9);        // 0-8 maze coins
  const diff = C.chaseDifficulty(gs);
  const pReach = Math.min(0.85, Math.max(0.15, (diff - 0.5) / 2.5 * 0.7 + 0.15));
  const pCaught = 0.20;                                        // the shopkeeper seizes her
  const roll = Math.random();
  const result = roll < pReach ? 'reached' : roll < pReach + pCaught ? 'caught' : 'collapsed';
  return C.resolveMazeOutcome(result, gs);
}

const runs = Number(process.argv[2] || 5000);
const tally = { single_rich: 0, delvile: 0, madhouse: 0, loveless: 0 };
for (let i = 0; i < runs; i++) tally[simulate()]++;

let ok = true;
for (const [k, n] of Object.entries(tally)) {
  const pct = n / runs;
  const bad = (k === 'madhouse' && pct > 0.30) || pct < 0.10;
  if (bad) ok = false;
  console.log(`${k.padEnd(12)} ${(pct * 100).toFixed(1)}%${bad ? '  <-- OUT OF BAND' : ''}`);
}
console.log(ok ? 'PASS (madhouse <= 30%, all endings >= 10%)' : 'FAIL');
process.exit(ok ? 0 : 1);
