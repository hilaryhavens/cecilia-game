// Seam checks for the Pac-Man maze chase (item 18).
// Spec: docs/superpowers/specs/2026-07-12-pacman-chase-design.md
// Usage: node maze-check.mjs
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
if (!C) { console.error('FAIL: no Cecilia seam'); process.exit(1); }

let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// --- resolveMazeOutcome: every branch of the outcome grid ---
const gs = (hearts, gold, virtue) => ({ stats: { hearts, gold, virtue }, suitors: {}, flags: {} });
ok('reached + hearts 3 -> delvile',        C.resolveMazeOutcome('reached',   gs(3, 8000, 5)) === 'delvile');
ok('reached + rich -> single_rich',        C.resolveMazeOutcome('reached',   gs(0, 9000, 5)) === 'single_rich');
ok('reached + poor -> madhouse',           C.resolveMazeOutcome('reached',   gs(0, 2000, 5)) === 'madhouse');
ok('reached + middling -> loveless',       C.resolveMazeOutcome('reached',   gs(0, 6000, 5)) === 'loveless');
ok('caught + hearts 5 -> delvile rescue',  C.resolveMazeOutcome('caught',    gs(5, 9000, 6)) === 'delvile');
ok('caught + hearts 4 -> madhouse',        C.resolveMazeOutcome('caught',    gs(4, 9000, 6)) === 'madhouse');
ok('collapsed + hearts 5 -> delvile',      C.resolveMazeOutcome('collapsed', gs(5, 8000, 5)) === 'delvile');
ok('collapsed + hearts 4 -> not delvile',  C.resolveMazeOutcome('collapsed', gs(4, 8000, 5)) !== 'delvile');
ok('collapsed + rich -> single_rich',      C.resolveMazeOutcome('collapsed', gs(0, 9000, 5)) === 'single_rich');
ok('collapsed + low virtue -> madhouse',   C.resolveMazeOutcome('collapsed', gs(0, 9000, 3)) === 'madhouse');

console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
