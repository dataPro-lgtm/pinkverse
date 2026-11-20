/*
 * End-to-end test without extra dependencies: drives headless Chrome over the DevTools protocol.
 *   node tests/e2e.mjs [baseUrl] [outDir]
 * Uses the in-game test autoplayer (?bot) to clear levels 1-5, then forces each of the three
 * final-level paths by seeding run stats into localStorage and checks the matching ending.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
const OUT = process.argv[3] || join(tmpdir(), 'pinkverse-e2e');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'pv-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* chrome still starting */ }
    await sleep(200);
  }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
  });
}
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
const go = async (url) => { await send('Page.navigate', { url }); await sleep(1500); };

const STATE = `(() => { const g = window.__pv?.game; if (!g) return null; const s = g.scene.getScene('Game');
  const act = g.scene.getScenes(true).map(x => x.scene.key);
  const h = document.querySelector('.modal h2, .ending .et');
  return { act, li: s.li, ended: s.ended, path: s.path, alive: (s.enemies||[]).filter(e => e.alive && e.spec.required).map(e => e.kind + ':' + Math.round(e.hp)),
    ammo: s.ammo, modal: h ? h.textContent : null, score: Math.round(s.score || 0), run: window.__pv.Store.d.run }; })()`;

async function playLevel(n, maxMs = 300000) {
  const t0 = Date.now(); let tries = 0, last = null;
  while (Date.now() - t0 < maxMs) {
    await sleep(1000);
    const st = await ev(STATE); last = st;
    if (!st) continue;
    if (st.modal === '胜利！') return { ok: true, tries, ms: Date.now() - t0, st };
    if (st.modal === '弹药耗尽') { tries++; await ev(`document.querySelector('.modal .btn.pri').click()`); await sleep(1200); }
  }
  return { ok: false, tries, ms: Date.now() - t0, st: last };
}

const results = [];
try {
  await connect();
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // 0. first open: level 1 is immediately playable, no menus
  if (want('first')) {
  await go(BASE + '?reset');
  await sleep(1500);
  const first = await ev(STATE);
  await shot('00-first-open');
  results.push({ name: 'first open shows playable level 1', ok: !!first && first.act.includes('Game') && first.li === 0 && !first.modal && Object.keys(first.ammo).length > 0, detail: first });
  }

  // 1-5 cleared by the autoplayer
  for (let n = 1; n <= 5; n++) {
    if (!want(String(n))) continue;
    await go(`${BASE}?bot&level=${n}`);
    const r = await playLevel(n);
    await shot(`0${n}-level${n}-${r.ok ? 'win' : 'stuck'}`);
    results.push({ name: `level ${n} clearable`, ok: r.ok, detail: { tries: r.tries, seconds: Math.round(r.ms / 1000), score: r.st?.score, alive: r.st?.alive, ammo: r.st?.ammo } });
  }

  // 6: force each path by seeding the run stats, then check the ending
  const seeds = {
    A: { thinking: 10, traffic: 20, certainty: 120, doubtUsed: 0, factChecks: 2, selfHits: 0 },
    B: { thinking: 10, traffic: 140, certainty: 40, doubtUsed: 0, factChecks: 2, selfHits: 0 },
    C: { thinking: 150, traffic: 40, certainty: 20, doubtUsed: 1, factChecks: 9, selfHits: 1 },
  };
  for (const [path, run] of Object.entries(seeds)) {
    if (!want(path)) continue;
    await go(BASE);
    await ev(`(() => { const d = window.__pv.Store.d; d.unlocked = 5; d.checkpoints = [null,null,null,null,null,null]; Object.assign(d.run, ${JSON.stringify(run)}); d.checkpoints[5] = { ...d.run }; window.__pv.Store.save(); return true; })()`);
    await go(`${BASE}?bot&level=6`);
    const t0 = Date.now(); let st = null, saw = null;
    while (Date.now() - t0 < 200000) {
      await sleep(1000);
      st = await ev(STATE);
      if (st?.path && !saw) saw = st.path;
      if (st?.act?.includes('Ending')) break;
      if (st?.modal === '弹药耗尽') await ev(`document.querySelector('.modal .btn.pri').click()`);
    }
    await sleep(6000);
    const endings = await ev(`window.__pv.Store.d.endings`);
    await shot(`06-ending-${path}`);
    results.push({ name: `final path ${path} reaches ending ${path}`, ok: saw === path && st?.act?.includes('Ending') && endings.includes(path), detail: { saw, endings, seconds: Math.round((Date.now() - t0) / 1000) } });
  }

  // audio toggle and save persistence
  if (want('misc')) {
  await go(BASE + '?level=1');
  await ev(`document.querySelector('.hud .ibtn[aria-label="静音"]')?.click()`);
  const muted = await ev(`window.__pv.Store.d.muted`);
  await go(BASE + '?level=1');
  const mutedAfter = await ev(`JSON.parse(localStorage.getItem('pinkverse-save-v1')).muted`);
  results.push({ name: 'mute toggle works and persists', ok: muted === true && mutedAfter === true });
  const saved = await ev(`(() => { const d = JSON.parse(localStorage.getItem('pinkverse-save-v1')); return { unlocked: d.unlocked, endings: d.endings, best: d.best }; })()`);
  results.push({ name: 'progress saved to localStorage', ok: saved.unlocked >= 5 && saved.endings.length === 3, detail: saved });
  await ev(`document.querySelector('.hud .ibtn')?.click()`);
  await sleep(600);
  const pause = await ev(`document.querySelector('.modal h2')?.textContent`);
  await shot('07-pause');
  results.push({ name: 'pause menu opens', ok: pause === '暂停' });
  }
} finally {
  results.push({ name: 'no uncaught errors', ok: errors.length === 0, detail: errors.slice(0, 10) });
  try { ws?.close(); } catch { }
  chrome.kill();
  const pass = results.filter(r => r.ok).length;
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n${pass}/${results.length} checks passed. Screenshots: ${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
}
