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

// --- maze integrity ---
const M = C.MAZE;
ok('maze is 13 rows', Array.isArray(M) && M.length === 13);
ok('every row is 20 chars', M.every(r => r.length === 20));
ok('border is solid wall', M[0] === '#'.repeat(20) && M[12] === '#'.repeat(20)
   && M.every(r => r[0] === '#' && r[19] === '#'));
const count = ch => M.join('').split('').filter(x => x === ch).length;
ok('3 hearts', count('h') === 3);
ok('8 coins', count('c') === 8);
ok('3 boosts', count('b') === 3);
ok('one spawn each', count('P') === 1 && count('D') === 1 && count('S') === 1);
ok('parseMaze finds 14 pellets', C.parseMaze().pellets.length === 14);
ok('parseMaze finds 3 spawns', Object.keys(C.parseMaze().spawns).sort().join('') === 'DPS');

// BFS from Cecilia's spawn: every pellet and spawn must be reachable
let start;
for (let r = 0; r < 13; r++) for (let c = 0; c < 20; c++) if (M[r][c] === 'P') start = c + ',' + r;
const seen = new Set([start]);
const q = [start];
while (q.length) {
  const [c, r] = q.shift().split(',').map(Number);
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nc = c + dc, nr = r + dr, k = nc + ',' + nr;
    if (nr < 0 || nr > 12 || nc < 0 || nc > 19 || M[nr][nc] === '#' || seen.has(k)) continue;
    seen.add(k); q.push(k);
  }
}
let unreachable = 0;
for (let r = 0; r < 13; r++) for (let c = 0; c < 20; c++)
  if ('hcbDS'.includes(M[r][c]) && !seen.has(c + ',' + r)) unreachable++;
ok('all pellets & spawns reachable from P', unreachable === 0);

console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
