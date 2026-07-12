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
//  - Chase: P(caught) maps chaseDifficulty's ~[0.5,3] range linearly onto
//    [0.05,0.95] — same shape the game's steering/mash difficulty follows.
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
  const p = Math.min(0.95, Math.max(0.05, (C.chaseDifficulty(gs) - 0.5) / 2.5));
  return C.resolveEnding(Math.random() < p, gs);
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
