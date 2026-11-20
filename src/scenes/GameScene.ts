import Phaser from 'phaser';
import { W, H, FLOOR_Y, CANNON, C, FONT, INK, G_STEP, SPEED_MIN, SPEED_MAX } from '../config';
import { LEVELS, LevelDef } from '../data/levels';
import { AMMO, AMMO_ORDER } from '../data/ammo';
import { ADS, SYS, COMIC, FACT_SOURCES, FACT_NOTES, WIN_LINES, FAIL_LINES, STORY, CANNON_LINES, EGGS, LINES } from '../data/lines';
import { Store, AmmoId, RunStats } from '../state';
import { Synth } from '../audio';
import { ui } from '../ui';
import { Fx } from '../fx';
import { Enemy, EnemyKind } from '../entities/enemy';
import { Prop } from '../entities/props';
import { Projectile } from '../entities/projectile';
import { Cannon } from '../entities/cannon';
import { drawBackground, BgRefs } from '../bg';
import * as Art from '../entities/enemyArt';
import { openPause, openLevelSelect, openShop, openStory } from './menus';
import { Bot } from '../bot';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sgn = (v: number) => (v >= 0 ? '+' : '') + Math.round(v);
type StatKey = 'thinking' | 'traffic' | 'certainty' | 'doubtUsed' | 'factChecks' | 'fights' | 'humiliations' | 'extreme' | 'selfHits' | 'adsBought' | 'ironies';

export class GameScene extends Phaser.Scene {
  li = 0;
  def!: LevelDef;
  enemies: Enemy[] = [];
  props: Prop[] = [];
  projs: Projectile[] = [];
  fx!: Fx;
  cannon!: Cannon;
  selfSign!: Prop;
  previewG!: Phaser.GameObjects.Graphics;
  bg: BgRefs = {};
  ammo: Partial<Record<AmmoId, number>> = {};
  sel: AmmoId = 'fact';
  score = 0; combo = 0; comboUntil = 0;
  aiming = false; aimAngle = -0.75; aimPower = 0;
  cooldownUntil = 0; lastShotAt = 0; lastActivity = 0;
  ended = false; paused = false; blocking = false;
  gained = { thinking: 0, traffic: 0, certainty: 0 };
  coinsGained = 0;
  flags: Record<string, any> = {};
  adsShown = new Set<string>();
  danmakuSlots: { x: number; y: number; alive: boolean }[] = [];
  gates = new Map<string, Prop>();
  path: 'A' | 'B' | 'C' | null = null;
  boss: Enemy | null = null;
  mirror: Prop | null = null;
  trophies: Prop[] = [];
  pajamaView: Phaser.GameObjects.Container | null = null;
  cannonTaps: number[] = [];
  timerLeft = 0;
  demo: Phaser.GameObjects.Container | null = null;
  ringG: Phaser.GameObjects.Graphics | null = null;
  reflectionG: Phaser.GameObjects.Container | null = null;
  bot: Bot | null = null;
  startOpts: { select?: boolean } = {};
  private onResize = () => ui.layout(this.game.canvas);

  constructor() { super('Game'); }

  init(data: { level?: number; select?: boolean }) {
    this.li = Phaser.Math.Clamp(data?.level ?? 0, 0, LEVELS.length - 1);
    this.startOpts = { select: !!data?.select };
    this.enemies = []; this.props = []; this.projs = [];
    this.ammo = {}; this.score = 0; this.combo = 0; this.comboUntil = 0;
    this.aiming = false; this.cooldownUntil = 0; this.lastShotAt = 0; this.lastActivity = 0;
    this.ended = false; this.paused = false; this.blocking = false;
    this.gained = { thinking: 0, traffic: 0, certainty: 0 }; this.coinsGained = 0;
    this.flags = {}; this.adsShown = new Set(); this.danmakuSlots = []; this.gates = new Map();
    this.path = null; this.boss = null; this.mirror = null; this.trophies = []; this.pajamaView = null;
    this.cannonTaps = []; this.demo = null; this.ringG = null; this.reflectionG = null; this.bot = null;
  }

  create() {
    this.def = LEVELS[this.li];
    Store.enterLevel(this.li);
    const eng: any = this.matter.world.engine;
    eng.timing.timeScale = 1; this.tweens.timeScale = 1; this.time.timeScale = 1;
    this.cameras.main.setZoom(1);
    this.bg = drawBackground(this, this.def.theme);
    this.fx = new Fx(this);
    this.matter.add.rectangle(W / 2, FLOOR_Y + 60, W + 800, 120, { isStatic: true, friction: 0.9, label: 'floor' });
    this.cannon = new Cannon(this);
    this.selfSign = this.addProp({ t: 'selfsign', x: 40, y: 944 });
    this.previewG = this.add.graphics().setDepth(24);

    for (const p of this.def.props) {
      if (p.t === 'danmaku') {
        for (let c = 0; c < p.cols; c++) for (let r = 0; r < p.rows; r++) {
          const slot = { x: p.x + c * 44, y: p.y + r * 32, alive: true };
          this.danmakuSlots.push(slot);
          this.addProp({ t: 'dblock', x: slot.x, y: slot.y });
        }
        continue;
      }
      const prop = this.addProp(p);
      if (p.t === 'gate') this.gates.set(p.id, prop);
      if (p.t === 'mirror') this.mirror = prop;
    }
    for (const e of this.def.enemies) this.addEnemy(e.k, e.x, e.y, e.move ? { move: e.move } : {});

    const sup = Store.d.up.supply;
    for (const id of AMMO_ORDER) {
      const base = this.def.ammo[id];
      if (base === undefined) continue;
      let n = base + (id === 'doubt' ? 0 : sup);
      if (id === 'doubt' && Store.d.run.thinking >= 60) n += 1;
      this.ammo[id] = n;
    }
    this.sel = AMMO_ORDER.find(id => (this.ammo[id] ?? 0) > 0) ?? 'fact';

    ui.on.pause = () => this.pauseGame();
    ui.on.mute = () => this.toggleMute();
    ui.on.ammo = (id) => this.selectAmmo(id);
    ui.setLevel(this.def.sub, this.def.title);
    ui.setScore(0); ui.setCombo(0); ui.timer(null);
    ui.setAmmo(this.ammo, this.sel);
    ui.setMuted(Store.d.muted);
    ui.showHud(true);
    this.refreshMeters();
    ui.closeModal();
    this.cannon.setCrown(Store.d.run.certainty >= 60);

    this.input.on('pointerdown', this.pDown, this);
    this.input.on('pointermove', this.pMove, this);
    this.input.on('pointerup', this.pUp, this);
    this.input.on('pointerupoutside', this.pUp, this);
    this.matter.world.on('collisionstart', this.onCollide, this);
    this.matter.world.on('beforeupdate', this.preStep, this);
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize);
      this.input?.removeAllListeners();
      // Phaser may already have torn the Matter world down at this point
      const w: any = this.matter?.world;
      if (w) { w.off('collisionstart', this.onCollide, this); w.off('beforeupdate', this.preStep, this); }
    });
    this.onResize();

    Synth.setMusic(this.def.music);
    this.lastActivity = this.time.now;
    if (this.def.timer) this.timerLeft = this.def.timer;

    const params = new URLSearchParams(location.search);
    if (params.has('bot')) this.bot = new Bot(this);

    if (this.startOpts.select) { this.blocking = true; openLevelSelect(this, true); return; }
    const story = STORY[this.li];
    if (story.length && !Store.d.skipStory && !this.bot) { this.blocking = true; openStory(this, story, () => this.beginLevel()); }
    else this.beginLevel();
  }

  beginLevel() {
    this.blocking = false;
    ui.closeModal();
    this.lastActivity = this.time.now;
    if (this.li === 0 && Store.d.best[0] === 0 && !this.bot) { ui.intro(true); this.showDemo(); }
    else { ui.intro(false); this.fx.comic(W / 2, 470, this.def.title, { size: 52, color: '#ffd400', dur: 900, rot: -0.05 }); }
    if (this.li === 5) { this.startMirror(); return; }
    if (this.li === 1) this.time.delayedCall(4000, () => this.showAd('trend'));
    if (this.li === 2) this.time.delayedCall(2500, () => this.showAd('blindbox'));
    if (this.li === 3) this.time.delayedCall(3000, () => this.showAd('army'));
    if (this.li === 4) { this.time.delayedCall(2500, () => this.showAd('expert')); }
  }

  /* ---------------- building ---------------- */
  addProp(def: any) { const p = new Prop(this, def); this.props.push(p); if (def.t === 'trophy') this.trophies.push(p); return p; }
  addEnemy(k: EnemyKind, x: number, y: number, opt: any = {}) { const e = new Enemy(this, k, x, y, opt); this.enemies.push(e); return e; }

  /* ---------------- input & aiming ---------------- */
  pDown(p: Phaser.Input.Pointer) {
    Synth.init();
    if (this.ended || this.paused || this.blocking) return;
    this.lastActivity = this.time.now;
    ui.intro(false); this.killDemo();
    if (this.pajamaView && this.pajamaView.active && Phaser.Math.Distance.Between(p.worldX, p.worldY, this.pajamaView.x, this.pajamaView.y) < 70) {
      this.foundEgg('pajama');
      const sp = this.fx.speech('嘘……别告诉我老板。', 1800); sp.place(this.pajamaView.x, this.pajamaView.y - 80);
      return;
    }
    if (Phaser.Math.Distance.Between(p.worldX, p.worldY, CANNON.x, CANNON.y) < 70) { this.cannonTap(); }
    this.aiming = true;
    this.updateAim(p.worldX, p.worldY);
  }
  pMove(p: Phaser.Input.Pointer) { if (this.aiming && !this.paused) this.updateAim(p.worldX, p.worldY); }
  pUp() {
    if (!this.aiming) return;
    this.aiming = false;
    this.previewG.clear();
    const power = this.aimPower;
    this.cannon.setAim(this.aimAngle, 0);
    if (power >= 0.06 && !this.ended && !this.paused && !this.blocking) this.fire();
  }

  updateAim(px: number, py: number) {
    const pv = this.cannon.pivot;
    const dx = px - pv.x, dy = py - pv.y;
    let a = Math.atan2(dy, dx);
    if (dy > 0) a = dx >= 0 ? -0.06 : -3.08;
    a = Phaser.Math.Clamp(a, -3.08, -0.06);
    const dist = Math.hypot(dx, dy);
    this.aimAngle = a;
    this.aimPower = Phaser.Math.Clamp((dist - 70) / 440, 0, 1);
    this.cannon.setAim(a, this.aimPower);
    this.drawPreview();
  }

  aimAt(a: number, power: number) { this.aimAngle = a; this.aimPower = power; this.cannon.setAim(a, power); }
  speedOf(power: number) { return SPEED_MIN + power * (SPEED_MAX - SPEED_MIN); }

  /** Simulates exactly what Matter will do, so the dotted arc is honest. */
  simulate(ammo: AmmoId, a: number, power: number, steps: number) {
    const spec = AMMO[ammo];
    const tip = this.cannon.tipFor(a, power);
    const v = this.speedOf(power);
    let x = tip.x, y = tip.y, vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const g = G_STEP * spec.grav, fa = 1 - spec.frictionAir;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < steps; i++) {
      vx *= fa; vy = vy * fa + g; x += vx; y += vy;
      pts.push({ x, y });
      if (y > FLOOR_Y || x > W + 40 || x < -40) break;
    }
    return pts;
  }

  drawPreview() {
    const g = this.previewG; g.clear();
    const steps = 40 + Store.d.up.scope * 18 + (Store.d.run.certainty >= 60 ? 10 : 0);
    const lim = this.sel === 'boomerang' ? Math.min(steps, 48) : this.sel === 'question' ? 26 : steps;
    const pts = this.simulate(this.sel, this.aimAngle, this.aimPower, lim);
    const col = AMMO[this.sel].color;
    pts.forEach((p, i) => {
      if (i % 3) return;
      const k = 1 - i / steps;
      g.fillStyle(col === 0xffffff ? 0xffffff : col, 0.35 + 0.6 * k); g.fillCircle(p.x, p.y, 3 + 4 * k);
      g.lineStyle(2, C.ink, 0.6 * k); g.strokeCircle(p.x, p.y, 3 + 4 * k);
    });
    const end = pts[pts.length - 1];
    if (end && this.sel === 'question') {
      g.lineStyle(3, C.pink, 0.8);
      for (let i = -2; i <= 2; i++) { const a = Math.atan2(end.y - pts[Math.max(0, pts.length - 3)].y, end.x - pts[Math.max(0, pts.length - 3)].x) + i * 0.16; g.lineBetween(end.x, end.y, end.x + Math.cos(a) * 46, end.y + Math.sin(a) * 46); }
    }
    if (end && this.sel === 'boomerang') { g.lineStyle(3, C.yellow, 0.7); g.beginPath(); g.arc(end.x, end.y, 18, -Math.PI * 0.2, Math.PI * 1.3, false); g.strokePath(); }
  }

  selectAmmo(id: AmmoId) {
    if (this.ammo[id] === undefined) return;
    this.sel = id; Synth.click();
    ui.setAmmo(this.ammo, this.sel);
    if (this.aiming) this.drawPreview();
  }

  fire() {
    const now = this.time.now;
    if (now < this.cooldownUntil) return;
    const id = this.sel;
    if (!((this.ammo[id] ?? 0) > 0)) { ui.toast(`${AMMO[id].name} 用完了`); return; }
    this.ammo[id] = this.ammo[id]! - 1;
    const tip = this.cannon.tipFor(this.aimAngle, this.aimPower);
    const v = this.speedOf(this.aimPower);
    const proj = this.spawnProjectile(id, tip.x, tip.y, Math.cos(this.aimAngle) * v, Math.sin(this.aimAngle) * v);
    this.cannon.recoil();
    Synth.fire(id);
    this.fx.flash(tip.x, tip.y, 34, AMMO[id].color);
    this.fx.burst('smoke', tip.x, tip.y, 6);
    this.fx.shake(90, 0.004);
    this.lastShotAt = now; this.cooldownUntil = now + 320; this.lastActivity = now;
    if (id === 'doubt') { this.statRaw('doubtUsed', 1); }
    if (id === 'duck' && this.aimAngle < -1.4 && this.aimAngle > -1.74) this.flags.duckUp = proj;
    if ((this.ammo[id] ?? 0) <= 0) { const next = AMMO_ORDER.find(k => (this.ammo[k] ?? 0) > 0); if (next) this.sel = next; }
    ui.setAmmo(this.ammo, this.sel);
    if (!this.flags.firstShot) { this.flags.firstShot = true; if (this.li === 0) this.time.delayedCall(600, () => this.sysMsg(SYS.welcome)); }
  }

  spawnProjectile(id: AmmoId, x: number, y: number, vx: number, vy: number, small = false) {
    const p = new Projectile(this, id, x, y, vx, vy, small);
    this.projs.push(p);
    return p;
  }
  projectileGone(p: Projectile) {
    const i = this.projs.indexOf(p); if (i >= 0) this.projs.splice(i, 1);
    if (this.flags.duckUp === p) {
      if (Math.abs(p.x - CANNON.x) < 170) {
        this.foundEgg('duckup');
        const sp = this.fx.speech('嘎。（鸭子回家了）', 2000); sp.place(CANNON.x + 60, CANNON.y - 120);
      }
      this.flags.duckUp = null;
    }
  }
  nearestProjectile(x: number, y: number) {
    let best: Projectile | null = null, bd = 380;
    for (const p of this.projs) { const d = Math.abs(p.x - x) + Math.abs(p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  homePoint() { return { x: this.selfSign.x, y: this.selfSign.y }; }

  /* ---------------- physics hooks ---------------- */
  preStep() {
    for (const p of this.projs) p.preStep();
    for (const conv of this.props) {
      if (conv.kind !== 'conveyor' || !conv.alive) continue;
      const d = conv.data;
      for (const p of this.props) {
        if (p.isStatic || !p.alive || !p.body) continue;
        const b = p.body; const bottom = b.bounds.max.y;
        if (bottom > d.top - 4 && bottom < d.top + 8 && b.position.x > d.x0 && b.position.x < d.x1) {
          this.matter.body.setVelocity(b, { x: b.velocity.x + (d.speed - b.velocity.x) * 0.35, y: b.velocity.y });
        }
      }
    }
  }

  onCollide(ev: any) {
    for (const pair of ev.pairs) {
      const A = pair.bodyA.parent || pair.bodyA, B = pair.bodyB.parent || pair.bodyB;
      const ea = A.ent, eb = B.ent;
      const rel = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
      if (ea?.type === 'proj') ea.onHit(eb ?? null, B, rel);
      if (eb?.type === 'proj') eb.onHit(ea ?? null, A, rel);
      if (ea?.type === 'proj' || eb?.type === 'proj') continue;
      if (ea?.type === 'enemy') this.enemyImpact(ea, B, eb, rel);
      if (eb?.type === 'enemy') this.enemyImpact(eb, A, ea, rel);
      if (ea?.type === 'prop') ea.impact(rel, B.isStatic);
      if (eb?.type === 'prop') eb.impact(rel, A.isStatic);
    }
  }

  enemyImpact(e: Enemy, otherBody: any, other: any, rel: number) {
    if (!e.alive) return;
    if (otherBody.isStatic) { if (rel > 7) e.takeHit((rel - 6.5) * 9, { type: 'fall' }); return; }
    if (other?.kind === 'sheet') return;
    if (other?.type === 'enemy') { if (rel > 4) e.takeHit(rel * 2.5, { type: 'prop' }); return; }
    if (other?.kind === 'trophy') { if (rel > 4) { this.fx.comic(e.x, e.y - 120, '真理杯砸中！', { size: 40, color: '#ffd400' }); this.fx.shake(300, 0.02); this.fx.slowmo(500, 0.2); this.stat('thinking', 6); e.takeHit(210, { type: 'env', heavy: true }); } return; }
    if (rel > 2.8) e.takeHit(Math.min(75, rel * otherBody.mass * 0.32), { type: 'prop' });
  }

  /* ---------------- scoring & meta stats ---------------- */
  comboMult() { return 1 + Math.min(4, Math.max(0, this.combo - 1) * 0.5); }
  addScore(n: number, x?: number, y?: number, big = false) {
    const v = Math.round(n * this.comboMult());
    this.score += v; ui.setScore(this.score);
    if (x !== undefined && y !== undefined && (big || v >= 60)) this.fx.comic(x, y - 30, '+' + v, { size: big ? 34 : 24, color: '#ffd400', dur: 250 });
  }
  bumpCombo() {
    const now = this.time.now;
    this.combo = now < this.comboUntil ? this.combo + 1 : 1;
    this.comboUntil = now + 1600;
    ui.setCombo(this.combo);
    if (this.combo >= 2) Synth.combo(this.combo);
    if (this.combo === 3 && !this.flags.capital) { this.flags.capital = true; this.sysMsg(SYS.capital); this.stat('traffic', 4); this.time.delayedCall(800, () => this.showAd('live')); }
    if (this.combo === 5) this.fx.comic(W / 2, 520, '超级连击！', { size: 56, color: '#ff2e88' });
  }

  statRaw(k: StatKey, n: number) { (Store.d.run as any)[k] = Math.max(0, (Store.d.run as any)[k] + n); }
  stat(k: 'thinking' | 'traffic' | 'certainty', n: number) {
    const r = Store.d.run;
    const before = r[k];
    r[k] = Math.max(0, r[k] + n);
    this.gained[k] += r[k] - before;
    this.refreshMeters();
    if (k === 'thinking' && n > 0 && !this.flags.adCourse && r.thinking >= 12) { this.flags.adCourse = true; this.showAd('course'); }
    if (k === 'traffic' && r.traffic >= 50 && !this.flags.adChair) { this.flags.adChair = true; this.showAd('chair'); }
    if (k === 'certainty' && r.certainty >= 50 && !this.flags.adEcho) { this.flags.adEcho = true; this.showAd('echo'); }
    if (k === 'certainty' && r.certainty >= 60 && !this.flags.certainHpSaid) { this.flags.certainHpSaid = true; this.sysMsg(SYS.certainHp); }
    this.cannon.setCrown(r.certainty >= 60);
    if (this.li === 1 && this.gained.traffic >= 18 && !this.flags.platformReward) {
      this.flags.platformReward = true; this.coinsGained += 150;
      this.time.delayedCall(700, () => { this.sysMsg(SYS.platformReward, '平台'); this.fx.burst('coin', 96, 330, 18); Synth.coin(); });
    }
  }
  refreshMeters() { const r = Store.d.run; ui.setMeters(r.thinking, r.traffic, r.certainty); }
  enemyHpMult() { return 1 + Math.min(0.4, Store.d.run.certainty / 250); }
  powerMult() { return 1 + Store.d.up.power * 0.15; }
  questionCount() {
    if (Store.d.run.thinking >= 40) { if (!this.flags.thinkSplit) { this.flags.thinkSplit = true; this.sysMsg(SYS.thinkSplit); } return 7; }
    return 5;
  }
  sysMsg(t: string, tag = '系统') { ui.sys(t, tag); }
  sysText(k: keyof typeof SYS) { return SYS[k] as string; }

  /* ---------------- events from entities ---------------- */
  onDamage(e: Enemy, d: number, src: any) {
    this.addScore(d * 3, e.x, e.y - 40);
    this.bumpCombo();
    if (src.type !== 'ammo' && d > 25) this.fx.comic(e.x, e.y - 90, pick(COMIC.hit), { size: 38 });
    this.fx.burst('star', e.x, e.y - 30, 6);
  }
  onDefeat(e: Enemy, reason: string) {
    this.addScore(300, e.x, e.y - 60, true);
    this.bumpCombo();
    this.fx.comic(e.x, e.y - 130, pick(COMIC.exit), { size: 46, color: '#ff2e88' });
    this.fx.burst('confetti', e.x, e.y, 18);
    this.fx.punch(1.04);
    Synth.explode();
    const required = this.enemies.filter(q => q.spec.required);
    const last = required.every(q => !q.alive);
    if (e.spec.required && (this.combo >= 2 || last)) this.fx.slowmo(last ? 700 : 420, 0.22);
    if (e.spec.required) {
      this.flags.streak = (this.flags.streak ?? 0) + 1;
      this.stat('certainty', 2 + Math.min(4, this.flags.streak));
    }
    if (e.kind === 'seller') this.time.delayedCall(900, () => this.showAd('live'));
    if (e === this.boss) this.time.delayedCall(400, () => this.sysMsg(SYS.truthUpdate));
  }
  onExitDone(e: Enemy) {
    const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1);
    if (this.pajamaView && !this.pajamaView.active) this.pajamaView = null;
  }
  onShout(e: Enemy) {
    this.statRaw('fights', 1);
    this.stat('traffic', 0.25);
    for (const q of this.enemies) if (q.kind === 'speculator') q.addHeat();
    this.updateRanks(e);
    if (e.kind === 'repeater') { this.flags.shouts = (this.flags.shouts ?? 0) + 1; if (this.flags.shouts === 6) this.showAd('powerbank'); }
  }
  humiliate(e: Enemy, overkill: boolean) {
    const now = this.time.now;
    if (now - (this.flags.lastHumil ?? 0) < 400) return;
    this.flags.lastHumil = now;
    this.statRaw('humiliations', 1);
    this.stat('certainty', 5);
    this.addScore(150, e.x, e.y);
    this.fx.comic(e.x, e.y - 110, overkill ? '鞭尸 +150' : '羞辱 +150', { size: 34, color: '#ff2e88' });
    if (!this.flags.humilSaid) { this.flags.humilSaid = true; this.sysMsg(SYS.humiliate); }
  }
  echo(e: Enemy) {
    Synth.scratch();
    this.stat('traffic', 2);
    if (!this.flags.echoSaid) { this.flags.echoSaid = true; this.sysMsg(SYS.echo); }
    this.foundEgg('echo');
  }
  irony(e: Enemy) {
    this.statRaw('ironies', 1);
    this.stat('thinking', 6); this.stat('certainty', -3);
    e.say(pick(LINES.chameleon.irony), 2000);
    this.fx.comic(e.x, e.y - 120, '自相矛盾！', { size: 42, color: '#27e1e6' });
    this.fx.slowmo(380, 0.3);
    this.sysMsg(this.flags.ironySaid ? SYS.irony : SYS.firstIrony); this.flags.ironySaid = true;
    this.showAd('stance');
  }
  questionHit(e: Enemy) { e.think(3400); this.stat('thinking', 2); this.flags.streak = 0; this.fx.burst('qm', e.x, e.y - 60, 3); }
  rightImmune(e: Enemy) {
    this.stat('certainty', 2);
    this.flags.immune = (this.flags.immune ?? 0) + 1;
    if (this.flags.immune === 1) this.sysMsg(SYS.rightImmune);
    if (this.flags.immune === 2 && this.trophies.length) { this.sysMsg(SYS.rightHint); this.trophies.forEach(t => this.fx.ring(t.data.anchor.x, t.data.anchor.y + 40, C.yellow, 20, 900)); }
    if (this.flags.immune === 4) this.sysMsg(SYS.truthUpdate);
  }
  doubtHit(e: Enemy, p: Projectile) {
    Synth.doubt();
    this.stat('certainty', -25); this.stat('thinking', 18);
    this.flags.streak = 0;
    this.cameras.main.flash(260, 155, 92, 255);
    this.fx.comic(e.x, e.y - 130, pick(COMIC.doubt), { size: 44, color: '#9b5cff' });
    this.sysMsg(SYS.doubt);
    if (this.li === 5 && e === this.boss && (this.path === 'A' || this.path === 'B')) {
      this.time.delayedCall(900, () => { if (this.computePath() === 'C' && this.boss?.alive) this.switchToC(); });
    }
  }
  silence(p: Projectile) {
    Synth.squeak();
    for (const e of this.enemies) e.freeze(3200);
    this.stat('thinking', 2);
    this.fx.ring(p.x, p.y, 0xffe14d, 40, 900);
    this.sysMsg(pick(SYS.duck), '橡皮鸭');
    Synth.duck(0.12, 3000);
    this.showAd('calm');
  }
  factCheck(board: Prop) {
    this.statRaw('factChecks', 1);
    this.stat('thinking', 4);
    this.flags.streak = 0;
    ui.fact(board.data.text, pick(FACT_SOURCES), pick(FACT_NOTES));
    this.fx.comic(board.x, board.y - 40, '查无此据！', { size: 34, color: '#ff4d4d' });
    if (!this.flags.factSaid && Store.d.run.factChecks <= 1) { this.flags.factSaid = true; this.time.delayedCall(1200, () => this.sysMsg(SYS.firstFact)); }
    this.time.delayedCall(2800, () => this.showAd('helmet'));
  }
  extremeHit(p: Prop) {
    const now = this.time.now;
    if (now < (p.data.cd ?? 0)) return;
    p.data.cd = now + 1500;
    this.statRaw('extreme', 1);
    this.stat('certainty', 8); this.stat('traffic', 10);
    this.addScore(1000, p.x, p.y, true);
    this.fx.burst('like', p.x, p.y, 24); this.fx.burst('heart', p.x, p.y, 16);
    this.fx.comic(p.x, p.y + 70, '极端发言 +1000', { size: 36, color: '#ff2e88' });
    Synth.jingle();
    this.sysMsg(SYS.algorithm, '算法');
    for (const e of this.enemies) if (e.alive && e.spec.required) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2); e.drawHp(); e.expr('happy', 1200); }
    this.updateVotes(true);
  }
  platformEgg(p: Prop) {
    if (this.flags.pbossHit) return; this.flags.pbossHit = true;
    const sp = this.fx.speech('我们只是一个中立的平台。', 2600, { tint: 0xd8d0e8 }); sp.place(p.x + 60, p.y - 50);
    this.foundEgg('pboss');
  }
  selfHit(sign: Prop, p: Projectile) {
    this.statRaw('selfHits', 1);
    this.stat('certainty', -10); this.stat('thinking', 5);
    this.flags.streak = 0;
    if (!this.flags.boomSaid) { this.flags.boomSaid = true; this.sysMsg(SYS.boomSelf); }
    this.fx.comic(sign.x + 60, sign.y - 50, '打到自己了！', { size: 34, color: '#ffd400' });
    sign.view.setAngle(-14); this.tweens.add({ targets: sign.view, angle: 0, duration: 700, ease: 'Elastic.Out' });
    Synth.impact(1);
    p.kill(true);
  }
  toggleGate(id: string) { this.gates.get(id)?.open(); this.stat('thinking', 2); this.addScore(100); }
  dropCoins(x: number, y: number, n: number) { this.fx.burst('coin', x, y, n * 2); Synth.coin(); this.coinsGained += n * 5; }
  dropLoot(e: Enemy) {
    this.fx.burst('coupon', e.x, e.y - 20, 6); this.dropCoins(e.x, e.y, 2);
    if (Math.random() < 0.5) this.fx.comic(e.x + 40, e.y - 20, pick(['满100减99', '信念满减', '产地：别问']), { size: 22, color: '#ff2e88' });
  }

  bubbleBlast(e: Enemy) {
    const r = Store.d.run.traffic >= 50 ? 250 : 210;
    this.explode(e.x, e.y, r, 0.06, 55);
    this.fx.burst('like', e.x, e.y, 22); this.fx.burst('heart', e.x, e.y, 14); this.fx.burst('coupon', e.x, e.y, 5);
    this.fx.comic(e.x, e.y - 90, pick(COMIC.bubble), { size: 46, color: '#27e1e6' });
    this.fx.shake(260, 0.014);
    this.stat('traffic', 6);
    this.flags.streak = (this.flags.streak ?? 0);
  }
  smallBlast(x: number, y: number) { this.explode(x, y, 130, 0.035, 25); this.fx.burst('like', x, y, 10); }
  explode(x: number, y: number, r: number, power: number, dmg: number) {
    Synth.explode(); Synth.pop();
    this.fx.flash(x, y, r * 0.35, C.cyan); this.fx.ring(x, y, C.pink, 30, 400);
    const bodies: any[] = (this.matter.world as any).getAllBodies();
    for (const b of bodies) {
      if (b.isStatic) continue;
      const dx = b.position.x - x, dy = b.position.y - y, d = Math.hypot(dx, dy);
      if (d > r || d < 1) continue;
      const k = 1 - d / r;
      this.matter.body.applyForce(b, b.position, { x: (dx / d) * power * k * b.mass, y: ((dy / d) - 0.5) * power * k * b.mass });
      const ent = b.ent;
      if (ent?.type === 'enemy') ent.takeHit(dmg * (0.4 + 0.6 * k), { type: 'blast' });
      if (ent?.type === 'prop' && k > 0.5) ent.shatter();
    }
  }

  spawnClone(gen: Enemy): boolean {
    const clones = this.enemies.filter(e => e.kind === 'clone' && e.alive).length;
    if (clones >= 3) return false;
    const spots = [{ x: 470, y: 650 }, { x: 640, y: 580 }, { x: 300, y: 910 }, { x: 420, y: 1100 }, { x: 620, y: 1100 }];
    const s = pick(spots);
    const c = this.addEnemy('clone', s.x + Phaser.Math.Between(-20, 20), s.y);
    this.fx.burst('smoke', c.x, c.y, 6);
    if (!this.flags.copied) { this.flags.copied = true; this.sysMsg(SYS.copied); }
    return true;
  }
  regenDanmaku(): boolean {
    const slot = this.danmakuSlots.find(s => !s.alive);
    if (!slot) return false;
    slot.alive = true;
    const p = this.addProp({ t: 'dblock', x: slot.x, y: slot.y });
    p.view.setScale(0); this.tweens.add({ targets: p.view, scale: 1, duration: 300, ease: 'Back.Out' });
    return true;
  }
  danmakuGone(p: Prop) { const s = this.danmakuSlots.find(q => Math.abs(q.x - p.x) < 2 && Math.abs(q.y - p.y) < 2); if (s) s.alive = false; }
  spawnProduct(x: number, y: number) {
    if (this.props.filter(p => p.kind === 'product' && p.alive).length >= 8) return;
    const p = this.addProp({ t: 'product', x, y });
    this.matter.body.setVelocity(p.body, { x: -1, y: 1 });
  }
  spawnOnConveyor(conv: Prop) {
    if (this.props.filter(p => p.kind === 'product' && p.alive).length >= 7) return;
    this.addProp({ t: 'product', x: conv.data.x1 - 30, y: conv.data.top - 34 });
  }
  spawnSheet(x: number, y: number) {
    const sheets = this.props.filter(p => p.kind === 'sheet' && p.alive);
    if (sheets.length >= 6) sheets[0].shatter(true);
    const p = this.addProp({ t: 'sheet', x, y });
    this.matter.body.setVelocity(p.body, { x: -3 - Math.random() * 2, y: -2 });
  }
  checkRopes(p: Projectile) {
    for (const t of this.trophies) {
      if (!t.alive || t.data.cut) continue;
      const a = t.data.anchor, b = t.topPoint();
      const d = Phaser.Math.Distance.BetweenPoints(p.body.position, Phaser.Geom.Line.GetNearestPoint(new Phaser.Geom.Line(a.x, a.y, b.x, b.y), p.body.position as any) as any);
      if (d < p.spec.r + 10) { t.cutRope(); this.stat('thinking', 3); }
    }
  }
  registerPajama(v: Phaser.GameObjects.Container) { this.pajamaView = v; }

  updateRanks(e: Enemy) {
    if (!this.bg.ranks) return;
    const names: Record<string, string> = { repeater: '#复读机又喊了#', chameleon: '#变色龙换立场#', speculator: '#投机商冲浪#', seller: '#带货王开播#', general: '#大将军发话#' };
    const top = names[e.kind] ?? '#有人在吵架#';
    this.flags.rank = [top, ...(this.flags.rank ?? ['#今天也在吵#', '#你怎么看#']).filter((t: string) => t !== top)].slice(0, 3);
    this.bg.ranks.forEach((t, i) => t.setText(`${i + 1}. ${this.flags.rank[i] ?? ''}`));
  }
  updateVotes(boost = false) {
    const g = this.bg.votes; if (!g) return;
    this.flags.votes = this.flags.votes ?? {};
    for (const e of this.enemies) if (e.spec.required) this.flags.votes[e.kind] = (this.flags.votes[e.kind] ?? 10) + (boost ? 30 : 1);
    g.clear();
    const list = this.enemies.filter(e => e.spec.required && e.alive);
    g.fillStyle(0x0d0820, 0.8); g.fillRoundedRect(120, 262, 230, 30 + list.length * 22, 10);
    const max = Math.max(1, ...list.map(e => this.flags.votes[e.kind] ?? 10));
    list.forEach((e, i) => { g.fillStyle([C.pink, C.yellow, C.cyan, C.violet][i % 4]); g.fillRect(134, 282 + i * 22, 200 * (this.flags.votes[e.kind] ?? 10) / max, 14); });
  }

  /* ---------------- eggs, ads, mute, pause ---------------- */
  foundEgg(id: string) {
    if (!Store.egg(id)) return;
    const def = EGGS.find(e => e.id === id);
    ui.toast(`彩蛋 ${Store.d.eggs.length}/${EGGS.length}：${def?.title ?? id}`);
    Synth.jingle();
    Store.d.coins += 50; Store.save();
  }
  showAd(id: string) {
    if (this.adsShown.has(id) || this.ended || this.bot) return;
    const def = ADS.find(a => a.id === id); if (!def) return;
    this.adsShown.add(id);
    Synth.jingle();
    const escape = !Store.d.eggs.includes('adx') && (id === 'helmet' || id === 'course');
    if (id === 'trend') {
      this.sysMsg(SYS.trending);
      ui.ad(def, { action: () => this.buyTrending(), life: 7500 });
    } else ui.ad(def, { escape, onEscapeDone: () => { this.foundEgg('adx'); ui.toast('您已成功关闭广告。作为奖励，请观看广告。'); } });
  }
  buyTrending() {
    const cost = 120;
    if (Store.d.coins < cost) { ui.toast('金币不足。热搜也要讲出身。'); return; }
    Store.d.coins -= cost; Store.save();
    this.statRaw('adsBought', 1);
    this.stat('traffic', 15); this.stat('certainty', 8);
    this.score += 500; ui.setScore(this.score);
    this.sysMsg('已置顶。你的观点现在看起来很正确。', '平台');
  }
  toggleMute() {
    Store.d.muted = !Store.d.muted; Store.save();
    Synth.init(); Synth.setMuted(Store.d.muted); ui.setMuted(Store.d.muted);
    const shouting = this.enemies.find(e => e.kind === 'repeater' && e.shouting && e.alive);
    if (Store.d.muted && shouting) { shouting.say('你不能让我闭嘴！……哦，你可以。', 2200); this.foundEgg('mute'); }
  }
  pauseGame() {
    if (this.paused || this.blocking) return;
    this.paused = true; this.aiming = false; this.previewG.clear();
    this.scene.pause();
    openPause(this);
  }
  resumeGame() {
    ui.closeModal();
    this.paused = false;
    this.scene.resume();
  }
  cannonTap() {
    const now = this.time.now;
    this.cannonTaps = this.cannonTaps.filter(t => now - t < 3000); this.cannonTaps.push(now);
    this.cannon.wiggle();
    if (this.cannonTaps.length >= 3) {
      const sp = this.fx.speech(CANNON_LINES[Math.min(CANNON_LINES.length - 1, this.cannonTaps.length - 3)], 1600); sp.place(CANNON.x + 40, CANNON.y - 110);
    }
    if (this.cannonTaps.length >= 5) this.foundEgg('cannon');
  }

  showDemo() {
    const ct = this.add.container(0, 0).setDepth(90);
    const g = this.add.graphics(); ct.add(g);
    const hand = this.add.container(0, 0); ct.add(hand);
    const hg = this.add.graphics(); hand.add(hg);
    hg.fillStyle(0xffffff); hg.fillCircle(0, 0, 22); hg.lineStyle(5, C.ink); hg.strokeCircle(0, 0, 22);
    hg.fillStyle(C.pink); hg.fillCircle(0, 0, 9);
    const target = { x: 470, y: 560 };
    const tw = this.tweens.addCounter({
      from: 0, to: 1, duration: 1500, repeat: -1, repeatDelay: 500, ease: 'Sine.InOut',
      onUpdate: (t) => {
        const k = t.getValue() ?? 0;
        const x = CANNON.x + 60 + (target.x - CANNON.x - 60) * k, y = CANNON.y - 70 + (target.y - CANNON.y + 70) * k;
        hand.setPosition(x, y); hand.setScale(k < 0.08 ? 1.3 - k * 4 : k > 0.92 ? 1 + (k - 0.92) * 4 : 1);
        g.clear();
        if (k > 0.15) {
          const pv = this.cannon.pivot;
          const a = Phaser.Math.Clamp(Math.atan2(y - pv.y, x - pv.x), -3.08, -0.06), pw = Phaser.Math.Clamp((Math.hypot(x - pv.x, y - pv.y) - 70) / 440, 0, 1);
          this.cannon.setAim(a, pw);
          const pts = this.simulate('fact', a, pw, 40);
          pts.forEach((p, i) => { if (i % 3) return; g.fillStyle(0xffffff, 0.8 * (1 - i / 40)); g.fillCircle(p.x, p.y, 5); });
        }
      },
    });
    this.demo = ct;
    ct.setData('tw', tw);
  }
  killDemo() {
    if (!this.demo) return;
    (this.demo.getData('tw') as Phaser.Tweens.Tween).stop();
    this.demo.destroy(); this.demo = null;
    this.cannon.setAim(this.aimAngle, 0);
  }

  /* ---------------- the mirror ---------------- */
  computePath(): 'A' | 'B' | 'C' {
    const r = Store.d.run;
    const humble = r.doubtUsed > 0 || r.selfHits > 0 || r.factChecks >= 8;
    if (r.thinking >= r.certainty && r.thinking >= r.traffic * 0.9 && humble) return 'C';
    return r.certainty >= r.traffic ? 'A' : 'B';
  }

  startMirror() {
    this.blocking = true;
    Synth.setMusic('mirror');
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(85);
    this.tweens.add({ targets: dim, fillAlpha: 0.7, duration: 900 });
    const t1 = this.add.text(W / 2, 520, SYS.mirror1, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 600, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(86).setAlpha(0);
    const t2 = this.add.text(W / 2, 640, SYS.mirror2, { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffd400', stroke: INK, strokeThickness: 8 }).setOrigin(0.5).setDepth(86).setAlpha(0);
    const skip = this.bot ? 0.1 : 1;
    this.tweens.add({ targets: t1, alpha: 1, delay: 800 * skip, duration: 700 });
    this.time.delayedCall(1500 * skip, () => Synth.applause(1.4));
    this.tweens.add({ targets: t2, alpha: 1, scale: { from: 1.6, to: 1 }, delay: 3400 * skip, duration: 500, ease: 'Back.Out', onStart: () => Synth.hum() });
    this.time.delayedCall(5600 * skip, () => {
      this.tweens.add({ targets: [t1, t2, dim], alpha: 0, duration: 600, onComplete: () => { t1.destroy(); t2.destroy(); dim.destroy(); } });
      this.path = this.computePath();
      this.revealBoss();
      this.blocking = false;
    });
  }

  revealBoss() {
    const m = this.mirror!;
    const refl = m.data.refl as Phaser.GameObjects.Container;
    refl.removeAll(true);
    Synth.glass();
    this.fx.flash(m.x, m.y, 200, 0xffffff);
    if (this.path === 'A') {
      Synth.setMusic('boss');
      this.boss = this.addEnemy('mirrorright', 520, 999);
      const ghost = this.add.container(0, 120); refl.add(ghost); Art.right(this, ghost, true); ghost.setAlpha(0.3).setScale(-0.9, 0.9);
      this.addProp({ t: 'trophy', x: 478, y: 300, anchorY: 160 });
      this.addProp({ t: 'trophy', x: 562, y: 300, anchorY: 160 });
      this.time.delayedCall(600, () => this.boss?.say('我就是你，只是更确定。', 2600));
    } else if (this.path === 'B') {
      Synth.setMusic('boss');
      this.boss = this.addEnemy('likegod', 520, 660);
      const ghost = this.add.container(0, 20); refl.add(ghost); Art.likegod(this, ghost); ghost.setAlpha(0.25).setScale(-0.8, 0.8);
      this.time.delayedCall(600, () => this.boss?.say('欢迎，未来的首席流量官。', 2600));
    } else this.enterC();
  }

  switchToC() {
    const b = this.boss; if (!b) return;
    this.sysMsg(SYS.hesitate);
    b.say('……', 1500);
    this.time.delayedCall(1200, () => {
      if (b.alive) { b.alive = false; this.matter.world.remove(b.body); b.hpBar.destroy(); b.qMark.destroy(); this.tweens.add({ targets: b.view, alpha: 0, duration: 900, onComplete: () => { b.view.destroy(); this.onExitDone(b); } }); }
      this.boss = null;
      for (const t of this.trophies) if (t.alive) t.remove();
      this.path = 'C';
      (this.mirror!.data.refl as Phaser.GameObjects.Container).removeAll(true);
      this.enterC();
    });
  }

  enterC() {
    Synth.setMusic('mirrorPad');
    const refl = this.mirror!.data.refl as Phaser.GameObjects.Container;
    const g = this.add.graphics(); refl.add(g);
    g.fillStyle(C.pink, 0.35); g.fillRoundedRect(-60, 40, 120, 70, 20); g.fillRect(-20, -10, 110, 36);
    const q = this.add.text(0, -80, '?', { fontFamily: FONT, fontSize: '120px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.5); refl.add(q);
    this.tweens.add({ targets: q, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1 });
    this.flags.cStart = this.time.now;
    this.ringG = this.add.graphics().setDepth(9);
    this.time.delayedCall(5000, () => { if (this.path === 'C' && !this.ended && !this.flags.hintSaid) { this.flags.hintSaid = true; this.sysMsg(SYS.mirrorHint, '镜子'); } });
  }

  mirrorHit(p: Projectile, m: Prop) {
    if (p.ammo === 'duck') {
      this.foundEgg('mirrorduck');
      const sp = this.fx.speech('镜子里的鸭子也在沉默。', 2200); sp.place(m.x, m.y - 300);
    }
    if (this.path !== 'C') { Synth.glass(); return; }
    if (p.ammo === 'doubt' || p.ammo === 'duck') { this.flags.cDone = true; return; }
    p.reflected++;
    const home = { x: CANNON.x + 40, y: CANNON.y - 60 };
    const dx = home.x - p.x, dy = home.y - p.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(10, p.body.speed);
    this.matter.body.setVelocity(p.body, { x: dx / d * sp, y: dy / d * sp - 4 });
    Synth.glass();
    this.fx.flash(p.x, p.y, 40, 0xffffff);
    const cr = m.data.cracks as Phaser.GameObjects.Graphics;
    cr.lineStyle(3, 0xffffff, 0.8); const ox = p.x - m.x, oy = p.y - m.y;
    for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2; cr.lineBetween(ox, oy, ox + Math.cos(a) * 40, oy + Math.sin(a) * 40); }
    this.flags.reflections = (this.flags.reflections ?? 0) + 1;
    this.sysMsg(pick(SYS.reflect), '镜子');
    this.stat('certainty', -3);
    if (this.flags.reflections === 2 && !this.flags.hintSaid) { this.flags.hintSaid = true; this.time.delayedCall(1500, () => this.sysMsg(SYS.mirrorHint, '镜子')); }
  }

  checkMirror(time: number) {
    if (this.path !== 'C' || this.ended || this.blocking) return;
    const quiet = time - Math.max(this.lastShotAt, this.flags.cStart ?? time);
    const busy = this.projs.length > 0;
    const k = busy ? 0 : Phaser.Math.Clamp((quiet - 1500) / 6500, 0, 1);
    const g = this.ringG!; g.clear();
    if (k > 0) { g.lineStyle(10, C.yellow, 0.25 + k * 0.6); g.beginPath(); g.arc(520, 640, 300, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false); g.strokePath(); }
    const out = AMMO_ORDER.every(id => (this.ammo[id] ?? 0) <= 0) && !busy;
    if (out && !this.flags.outSaid) { this.flags.outSaid = true; this.sysMsg('你已经没有弹药了。现在，你只能思考。', '镜子'); }
    if (k >= 1 || this.flags.cDone || (out && quiet > 3500)) this.finish('C');
  }

  /* ---------------- end of level ---------------- */
  update(time: number, delta: number) {
    if (this.paused) return;
    for (const p of [...this.projs]) p.update(time);
    for (const e of [...this.enemies]) e.update(time, delta * this.time.timeScale);
    for (const p of this.props) p.update(time, delta);
    if (this.props.length > 60) this.props = this.props.filter(p => p.alive);
    if (this.aiming) this.drawPreview();
    if (this.combo > 0 && time > this.comboUntil) { this.combo = 0; ui.setCombo(0); }
    if (this.def.timer && !this.blocking && !this.ended) {
      this.timerLeft -= delta / 1000;
      ui.timer(this.timerLeft);
      if (this.timerLeft <= 0 && !this.flags.timeout) {
        this.flags.timeout = true;
        this.sysMsg(SYS.showTimeout, '节目组');
        for (const e of this.enemies) if (e.alive && e.spec.required) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3); e.drawHp(); }
        this.showAd('expert');
        ui.timer(null);
      }
    }
    if (this.li === 4 && time % 1000 < 20) this.updateVotes();
    if (!this.ended && !this.blocking && !this.flags.idleDone && time - this.lastActivity > 20000 && this.enemies.filter(e => e.alive && e.spec.required).length >= 1) this.idleEgg();
    if (this.li === 5) this.checkMirror(time);
    this.bot?.update(time);
    this.checkEnd(time);
  }

  idleEgg() {
    this.flags.idleDone = true;
    const alive = this.enemies.filter(e => e.alive && e.kind !== 'clone');
    this.sysMsg(SYS.idle);
    if (alive[0]) alive[0].say(alive.length > 1 ? '你刚才那句话，我不同意！' : '没人理我……那我反对我自己！', 2400);
    if (alive[1]) this.time.delayedCall(1300, () => alive[1].say('你连我在说什么都没听懂！', 2400));
    this.foundEgg('idle');
  }

  ammoLeft() { return AMMO_ORDER.reduce((s, id) => s + Math.max(0, this.ammo[id] ?? 0), 0); }

  checkEnd(time: number) {
    if (this.ended || this.blocking) return;
    if (this.li === 5) {
      if (this.path === 'A' || this.path === 'B') {
        if (this.boss && !this.boss.alive && !this.boss.exiting) this.finish(this.path);
        else if (this.ammoLeft() === 0 && this.projs.length === 0 && time - this.lastShotAt > 3000 && this.boss?.alive && !this.trophies.some(t => t.alive && t.data.cut && t.body && t.body.speed > 0.5)) this.fail();
      }
      return;
    }
    const req = this.enemies.filter(e => e.spec.required);
    if (req.every(e => !e.alive) && !req.some(e => e.exiting)) { this.win(); return; }
    if (this.ammoLeft() === 0 && this.projs.length === 0 && time - this.lastShotAt > 2800 && !this.enemies.some(e => (e.alive && e.inflating) || e.exiting)) this.fail();
  }

  win() {
    this.ended = true; this.aiming = false; this.previewG.clear(); ui.timer(null);
    const left = this.ammoLeft();
    const bonus = left * 250;
    this.score += bonus; ui.setScore(this.score);
    const stars = left >= 3 ? 3 : left >= 1 ? 2 : 1;
    const coins = Math.floor(this.score / 25) + this.coinsGained;
    const d = Store.d;
    d.coins += coins;
    d.best[this.li] = Math.max(d.best[this.li], Math.round(this.score));
    d.unlocked = Math.max(d.unlocked, Math.min(LEVELS.length - 1, this.li + 1));
    d.run.score += Math.round(this.score);
    if (this.li + 1 < LEVELS.length) d.checkpoints[this.li + 1] = { ...d.run };
    Store.save();
    Synth.fanfare();
    this.fx.comic(W / 2, 560, '通关！', { size: 90, color: '#ffd400', dur: 1100, rot: -0.06 });
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 220, () => this.fx.burst('confetti', Phaser.Math.Between(100, 620), 300, 40));
    this.time.delayedCall(1700, () => {
      const g = this.gained;
      const html = `<h2>胜利！</h2><div class="sub">${this.def.sub}</div>
        <div class="stars">${[0, 1, 2].map(i => i < stars ? '★' : '<span class="dim">★</span>').join('')}</div>
        <p class="quip">${pick(WIN_LINES)}</p>
        <div class="stats"><span>得分</span><b>${Math.round(this.score).toLocaleString('en-US')}</b><span>剩余弹药奖励</span><b>+${bonus}</b><span>金币</span><b>+${coins}</b>
        <span>思考 / 流量 / 确信</span><b>${sgn(g.thinking)} / ${sgn(g.traffic)} / ${sgn(g.certainty)}</b></div>`;
      const btns = [];
      if (this.li + 1 < LEVELS.length) btns.push({ label: '下一关', sub: LEVELS[this.li + 1].title, cls: 'pri', onClick: () => this.goLevel(this.li + 1) });
      btns.push({ label: '升级大炮', sub: `金币 ${Store.d.coins}`, onClick: () => openShop(this, () => this.win2()) });
      btns.push({ label: '重玩本关', onClick: () => this.goLevel(this.li) });
      ui.modal(html, btns);
    });
  }
  /** re-open the result actions after the shop */
  win2() {
    ui.modal(`<h2>准备好了？</h2><p>金币：<span class="coins">${Store.d.coins}</span></p>`, [
      ...(this.li + 1 < LEVELS.length ? [{ label: '下一关', sub: LEVELS[this.li + 1].title, cls: 'pri', onClick: () => this.goLevel(this.li + 1) }] : []),
      { label: '重玩本关', onClick: () => this.goLevel(this.li) },
    ]);
  }

  fail() {
    this.ended = true; this.aiming = false; this.previewG.clear(); ui.timer(null);
    Synth.trombone();
    const btns: any[] = [{ label: '再来一次', cls: 'pri', onClick: () => this.goLevel(this.li) }];
    if (!this.flags.revived) btns.push({ label: '看广告复活', sub: '+2 发弹药', cls: 'hot', onClick: () => this.revive() });
    btns.push({ label: '关卡选择', onClick: () => openLevelSelect(this) });
    this.time.delayedCall(900, () => ui.modal(`<h2>弹药耗尽</h2><div class="sub">${this.def.title}</div><p class="quip">${pick(FAIL_LINES)}</p>`, btns));
  }
  revive() {
    this.flags.revived = true;
    const ad = ADS.find(a => a.id === 'revive')!;
    let n = 3;
    const show = () => ui.modal(`<h2>${ad.title}</h2><p>${ad.body}</p><p class="quip">广告剩余 ${n} 秒……</p>`, []);
    show();
    const tick = window.setInterval(() => {
      n--;
      if (n > 0) { show(); return; }
      window.clearInterval(tick);
      ui.closeModal();
      const first = AMMO_ORDER.find(id => this.ammo[id] !== undefined && id !== 'doubt') ?? 'fact';
      this.ammo[first] = (this.ammo[first] ?? 0) + 2; this.sel = first;
      ui.setAmmo(this.ammo, this.sel);
      this.ended = false; this.lastShotAt = this.time.now;
      this.statRaw('adsBought', 1); this.stat('traffic', 3);
      this.sysMsg('感谢观看。你的注意力已成功变现。', '广告');
    }, 1000);
  }

  finish(id: 'A' | 'B' | 'C') {
    if (this.ended) return;
    this.ended = true; this.aiming = false; this.previewG.clear();
    const d = Store.d;
    d.best[5] = Math.max(d.best[5], Math.round(this.score));
    d.run.score += Math.round(this.score);
    Store.ending(id); Store.save();
    if (id === 'C') { Synth.setMusic('none'); this.cameras.main.fadeOut(1800, 255, 244, 223); }
    else { this.fx.slowmo(900, 0.2); this.cameras.main.fadeOut(1600, 20, 8, 30); }
    this.time.delayedCall(id === 'C' ? 1900 : 1700, () => this.scene.start('Ending', { id }));
  }

  goLevel(i: number) { ui.closeModal(); this.scene.restart({ level: i }); }
}
