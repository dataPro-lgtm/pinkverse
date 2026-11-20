import type { GameScene } from './scenes/GameScene';
import { AMMO, AMMO_ORDER } from './data/ammo';
import type { AmmoId } from './state';
import type { Enemy } from './entities/enemy';

/*
 * Test-only autoplayer (?bot). It searches the same honest trajectory the aim preview draws,
 * stops each candidate arc at the first obstacle, and fires the arc that gets closest to a target.
 */
export class Bot {
  next = 0;
  constructor(private gs: GameScene) {}

  private pickAmmo(e: Enemy | undefined): AmmoId | null {
    const gs = this.gs;
    const has = (id: AmmoId) => (gs.ammo[id] ?? 0) > 0;
    const normal = AMMO_ORDER.filter(id => has(id) && id !== 'duck' && id !== 'doubt');
    const last: AmmoId | null = has('doubt') ? 'doubt' : has('duck') ? 'duck' : null;
    if (!e) return normal[0] ?? last;
    if (e.kind === 'chameleon') {
      if (e.lastAmmo && has(e.lastAmmo)) return e.lastAmmo;
      return normal.sort((a, b) => (gs.ammo[b] ?? 0) - (gs.ammo[a] ?? 0))[0] ?? last;
    }
    if (e.kind === 'likegod') return normal.find(id => id !== 'bubble') ?? last;
    const near = gs.enemies.filter(q => q.alive && q !== e && Math.hypot(q.x - e.x, q.y - e.y) < 220).length;
    if (near && has('bubble')) return 'bubble';
    if (e.kind === 'repeater' && e.shouting && has('question')) return 'question';
    if (has('fact')) return 'fact';
    return normal[0] ?? last;
  }

  update(time: number) {
    const gs = this.gs;
    if (gs.ended || gs.blocking || gs.paused || time < this.next || gs.projs.length > 0) return;
    if (gs.li === 5 && gs.path === 'C') return;
    this.next = time + 1300;
    let tx: number | undefined, ty: number | undefined, id: AmmoId | null = null, target: any = null;
    if (gs.li === 5 && gs.path === 'A') {
      const t = gs.trophies.find(t => t.alive && !t.data.cut);
      if (t) { const a = t.data.anchor, tp = t.topPoint(); tx = (a.x + tp.x) / 2; ty = (a.y + tp.y) / 2; id = this.pickAmmo(undefined); }
    }
    const sw = gs.props.find(p => p.alive && p.kind === 'switch' && !p.data.pressed);
    if (tx === undefined && sw) { tx = sw.x; ty = sw.y; id = this.pickAmmo(undefined); target = sw; }
    const targets = gs.enemies.filter(e => e.alive && e.spec.required);
    const e = Math.random() < 0.5 ? targets.sort((a, b) => a.hp - b.hp)[0] : targets[Math.floor(Math.random() * targets.length)];
    if (tx === undefined) { if (!e) return; tx = e.x; ty = e.y - 10; id = this.pickAmmo(e); target = e; }
    if (!id) return;
    gs.selectAmmo(id);

    // obstacles: every static or dynamic body except the target and the floor-level spawn noise
    const r = AMMO[id].r * 0.8;
    const boxes: number[][] = [];
    for (const p of gs.props) if (p.alive && p.body && p !== target && !p.body.isSensor && p.kind !== 'selfsign') { const b = p.body.bounds; boxes.push([b.min.x - r, b.min.y - r, b.max.x + r, b.max.y + r]); }
    for (const q of gs.enemies) if (q.alive && q !== target && q.body) { const b = q.body.bounds; boxes.push([b.min.x - r, b.min.y - r, b.max.x + r, b.max.y + r]); }

    const cands: { a: number; p: number; d: number }[] = [];
    for (let a = -1.5; a <= -0.08; a += 0.025) for (let p = 0.04; p <= 1; p += 0.02) {
      const pts = gs.simulate(id, a, p, 200);
      let best = 1e9;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const d = Math.hypot(q.x - tx!, q.y - ty!);
        if (d < best) best = d;
        if (i > 4 && boxes.some(b => q.x > b[0] && q.x < b[2] && q.y > b[1] && q.y < b[3])) break;
      }
      cands.push({ a, p, d: best });
    }
    cands.sort((x, y) => x.d - y.d);
    const c = cands[Math.floor(Math.random() * Math.min(5, cands.length))];
    gs.aimAt(c.a, c.p);
    gs.fire();
  }
}
