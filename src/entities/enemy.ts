import Phaser from 'phaser';
import { C, FONT, INK, W, H, CANNON } from '../config';
import { Face, Expr } from './face';
import * as Art from './enemyArt';
import { LINES } from '../data/lines';
import { Synth } from '../audio';
import { Store, AmmoId } from '../state';
import type { GameScene } from '../scenes/GameScene';
import type { Speech } from '../fx';

export type EnemyKind = 'repeater' | 'chameleon' | 'speculator' | 'general' | 'seller' | 'right' | 'clone' | 'likegod' | 'mirrorright';
interface Spec { w: number; h: number; hp: number; density: number; required: boolean; kinematic?: boolean }
export const SPEC: Record<EnemyKind, Spec> = {
  repeater: { w: 70, h: 112, hp: 80, density: 0.002, required: true },
  chameleon: { w: 76, h: 100, hp: 110, density: 0.002, required: true },
  speculator: { w: 70, h: 118, hp: 90, density: 0.002, required: true, kinematic: true },
  general: { w: 100, h: 128, hp: 130, density: 0.0025, required: true },
  seller: { w: 70, h: 118, hp: 120, density: 0.002, required: true },
  right: { w: 84, h: 150, hp: 220, density: 0.003, required: true },
  clone: { w: 40, h: 52, hp: 1, density: 0.0015, required: false },
  likegod: { w: 160, h: 160, hp: 320, density: 0.003, required: true, kinematic: true },
  mirrorright: { w: 96, h: 170, hp: 280, density: 0.004, required: true },
};

export interface HitSrc { type: 'ammo' | 'prop' | 'fall' | 'blast' | 'env'; ammo?: AmmoId; x?: number; y?: number; vx?: number; heavy?: boolean }

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Enemy {
  readonly type = 'enemy' as const;
  spec: Spec;
  view: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Container;
  face: Face;
  parts: Record<string, any>;
  top: number;
  body: any;
  hp: number;
  maxHp: number;
  alive = true;
  exiting = false;
  born: number;
  thinkUntil = 0; frozenUntil = 0; stuckUntil = 0;
  shouting = false; shoutEnd = 0; nextShout: number; volume = 0;
  lastAmmo: AmmoId | null = null; stance = 0;
  heat = 0; shield = 0; shieldG?: Phaser.GameObjects.Graphics;
  inflating = false;
  nextAction: number; nextLine: number;
  move?: { x0: number; x1: number; period: number; y: number };
  clock = 0;
  hpBar: Phaser.GameObjects.Graphics;
  qMark: Phaser.GameObjects.Text;
  speech?: Speech;
  exprUntil = 0; tempExpr: Expr = 'idle';
  baseExpr: Expr = 'idle';
  growth = 1;
  hitCount = 0;
  ringT = 0;
  baseY = 0;
  shieldReadyAt = 0;
  dir = 1;

  constructor(public gs: GameScene, public kind: EnemyKind, x: number, y: number, opt: { move?: { x0: number; x1: number; period: number } } = {}) {
    const s = gs;
    this.spec = SPEC[kind];
    const hpMul = kind === 'clone' ? 1 : gs.enemyHpMult();
    this.maxHp = this.hp = this.spec.hp * hpMul;
    this.view = s.add.container(x, y).setDepth(20);
    this.art = s.add.container(0, 0);
    this.view.add(this.art);
    let a: Art.Art;
    switch (kind) {
      case 'repeater': a = Art.repeater(s, this.art); break;
      case 'chameleon': a = Art.chameleon(s, this.art); break;
      case 'speculator': a = Art.speculator(s, this.art); break;
      case 'general': a = Art.general(s, this.art); break;
      case 'seller': a = Art.seller(s, this.art); break;
      case 'right': a = Art.right(s, this.art); this.baseExpr = 'smug'; break;
      case 'mirrorright': a = Art.right(s, this.art, true); this.baseExpr = 'smug'; break;
      case 'clone': a = Art.clone(s, this.art); break;
      case 'likegod': a = Art.likegod(s, this.art); this.baseExpr = 'happy'; break;
    }
    this.face = a!.face; this.parts = a!.parts; this.top = a!.top;
    const sp = this.spec;
    this.body = s.matter.add.rectangle(x, y, sp.w, sp.h, {
      chamfer: { radius: Math.min(16, sp.w * 0.25) }, density: sp.density, friction: 0.7, frictionStatic: 1, frictionAir: 0.012,
      restitution: 0.05, isStatic: !!sp.kinematic, label: 'enemy',
    });
    this.body.ent = this;
    if (opt.move) this.move = { ...opt.move, y };
    this.born = s.time.now;
    this.baseY = y;
    this.nextShout = this.born + 900 + Math.random() * 1600;
    this.nextAction = this.born + 2200 + Math.random() * 1200;
    this.nextLine = this.born + 2500 + Math.random() * 4000;
    this.hpBar = s.add.graphics().setDepth(30);
    this.qMark = s.add.text(x, y, '?', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ff2e88', stroke: INK, strokeThickness: 7 }).setOrigin(0.5).setDepth(31).setVisible(false);
    this.drawHp();
    // entrance squash so every character "lands" with a little bounce
    this.art.setScale(1.15, 0.8);
    s.tweens.add({ targets: this.art, scaleX: 1, scaleY: 1, duration: 520, ease: 'Elastic.Out' });
  }

  get x() { return this.body ? this.body.position.x : this.view.x; }
  get y() { return this.body ? this.body.position.y : this.view.y; }
  get headY() { return this.y + this.top * this.growth; }

  pickLine(pool: string): string {
    const L = LINES[this.kind];
    const r = Store.d.run;
    if (pool === 'idle') {
      if (r.certainty >= 45 && Math.random() < 0.3) return pick(L.vsCertain);
      if (r.thinking >= 45 && Math.random() < 0.3) return pick(L.vsThinker);
    }
    return pick(L[pool] || L.idle);
  }

  say(text: string, ms = 2300) {
    if (this.speech) this.speech.destroy();
    this.speech = this.gs.fx.speech(text, ms, this.kind === 'mirrorright' ? { tint: 0xffe1ee } : {});
    this.speech.place(this.x, this.headY - 10);
  }

  expr(e: Expr, ms: number) { this.tempExpr = e; this.exprUntil = this.gs.time.now + ms; this.face.set(e); }

  drawHp() {
    const g = this.hpBar; g.clear();
    if (!this.alive || this.kind === 'clone') return;
    const w = this.kind === 'likegod' ? 120 : 64, f = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    g.fillStyle(C.ink, 0.85); g.fillRoundedRect(-w / 2 - 3, -6, w + 6, 12, 5);
    g.fillStyle(f > 0.5 ? C.yellow : f > 0.25 ? 0xff9a3c : C.red); g.fillRoundedRect(-w / 2, -3, w * f, 6, 3);
    if (this.shield > 0) { g.lineStyle(2, C.cyan); g.strokeRoundedRect(-w / 2 - 5, -8, w + 10, 16, 6); }
  }

  update(time: number, dt: number) {
    if (!this.alive) return;
    const b = this.body;
    if (this.move && !this.frozen(time)) {
      this.clock += dt;
      const m = this.move, k = 0.5 + 0.5 * Math.sin((this.clock / m.period) * Math.PI * 2);
      const nx = m.x0 + (m.x1 - m.x0) * k;
      const ny = m.y + Math.sin(this.clock / 380) * 6;
      const d = nx > b.position.x ? -1 : 1;
      this.gs.matter.body.setPosition(b, { x: nx, y: ny });
      if (d !== this.dir) { this.dir = d; this.art.scaleX = Math.abs(this.art.scaleX) * d; }
    }
    if (this.kind === 'likegod') {
      this.clock += dt;
      this.gs.matter.body.setPosition(b, { x: b.position.x, y: this.baseY + Math.sin(this.clock / 600) * 14 });
    }
    this.view.setPosition(b.position.x, b.position.y);
    this.view.setRotation(b.angle);
    if (b.position.y > H + 80 || b.position.x < -120 || b.position.x > W + 120) { this.defeat('fell'); return; }

    const frozen = this.frozen(time), thinking = time < this.thinkUntil;
    let e: Expr = this.baseExpr;
    if (time < this.exprUntil) e = this.tempExpr;
    else if (frozen) e = 'frozen';
    else if (thinking) e = 'think';
    else if (this.shouting) e = 'shout';
    this.face.set(e);
    this.face.blink(Math.sin(time / 170 + this.born) > 0.985);
    const tgt = this.gs.nearestProjectile(b.position.x, b.position.y);
    const lx = tgt ? tgt.x - b.position.x : CANNON.x - b.position.x;
    const ly = tgt ? tgt.y - b.position.y : 0;
    const flip = this.art.scaleX < 0 ? -1 : 1;
    this.face.look((lx / 200) * flip, ly / 200);

    const hy = this.headY - 18;
    this.hpBar.setPosition(b.position.x, hy - (this.speech?.alive ? 0 : 0));
    this.qMark.setVisible(thinking).setPosition(b.position.x + 30, hy - 26 + Math.sin(time / 160) * 5);
    if (this.speech?.alive) this.speech.place(b.position.x, hy - 16);
    if (this.shieldG) this.shieldG.setPosition(b.position.x, b.position.y);

    if (frozen || thinking) { this.shouting = false; this.volume = Math.max(0, this.volume - dt / 600); return; }
    this.behave(time, dt);
  }

  frozen(time: number) { return time < this.frozenUntil; }

  private behave(time: number, dt: number) {
    const gs = this.gs;
    switch (this.kind) {
      case 'repeater': {
        if (!this.shouting && time > this.nextShout && time > this.stuckUntil) {
          this.shouting = true; this.shoutEnd = time + 1200;
          this.say(this.pickLine('idle'), 2000);
          Synth.shout();
          gs.onShout(this);
        }
        if (this.shouting) {
          this.volume = Math.min(1.5, this.volume + dt / 700);
          const m = this.parts.mouth as Phaser.GameObjects.Graphics;
          m.setScale(1 + Math.sin(time / 50) * 0.18 + this.volume * 0.15, 1 + this.volume * 0.12);
          this.ringT -= dt;
          if (this.ringT <= 0) { this.ringT = 180; gs.fx.ring(this.x - 34 * (this.art.scaleX), this.y - 45, C.yellow, 16 + this.volume * 10, 420); }
          if (time > this.shoutEnd) { this.shouting = false; this.nextShout = time + 2400 + Math.random() * 900; (this.parts.mouth as any).setScale(1); }
        } else this.volume = Math.max(0, this.volume - dt / 900);
        break;
      }
      case 'chameleon': {
        if (time > this.nextAction) { this.nextAction = time + 2600 + Math.random() * 600; this.flipStance(); }
        if (time > this.nextLine) { this.nextLine = time + 5200 + Math.random() * 3000; this.say(this.pickLine('idle')); gs.onShout(this); }
        break;
      }
      case 'speculator': {
        if (time > this.nextLine) { this.nextLine = time + 5000 + Math.random() * 3000; this.say(this.pickLine('idle')); }
        break;
      }
      case 'general': {
        if (time > this.nextAction) {
          this.nextAction = time + 8000 + Math.random() * 2000;
          const n = gs.spawnClone(this);
          const r = gs.regenDanmaku();
          if (n || r) this.say(this.pickLine('summon'), 1800);
        } else if (time > this.nextLine) { this.nextLine = time + 5000 + Math.random() * 3000; this.say(this.pickLine('idle')); gs.onShout(this); }
        (this.parts.mon as Phaser.GameObjects.Graphics).setAlpha(0.75 + Math.sin(time / 90) * 0.25);
        break;
      }
      case 'seller': {
        if (time > this.nextAction) {
          this.nextAction = time + 6200 + Math.random() * 1500;
          this.say(this.pickLine('link'), 1500);
          gs.spawnProduct(this.x - 70, this.y - 140);
        } else if (time > this.nextLine) { this.nextLine = time + 4800 + Math.random() * 2600; this.say(this.pickLine('idle')); gs.onShout(this); this.peekCart(); }
        (this.parts.ring as Phaser.GameObjects.Graphics).setAlpha(0.7 + Math.sin(time / 120) * 0.3);
        break;
      }
      case 'clone': {
        if (time > this.nextAction) {
          this.nextAction = time + 1400 + Math.random() * 1800;
          gs.matter.body.setVelocity(this.body, { x: Phaser.Math.FloatBetween(-2.5, 2.5), y: -6 - Math.random() * 3 });
          if (Math.random() < 0.35) this.say(this.pickLine('idle'), 1100);
        }
        break;
      }
      case 'right': case 'mirrorright': case 'likegod': {
        if (time > this.nextLine) { this.nextLine = time + 4600 + Math.random() * 2400; this.say(this.pickLine('idle'), 2600); }
        if (this.kind === 'likegod' && Math.random() < dt / 600) gs.fx.burst('like', this.x + Phaser.Math.Between(-60, 60), this.y - 60, 1);
        break;
      }
    }
  }

  flipStance() {
    this.stance = 1 - this.stance;
    const col = this.stance ? C.pink : C.green;
    this.parts.draw(col);
    (this.parts.sign as Phaser.GameObjects.Text).setText(this.stance ? '反对！' : '支持！');
    this.gs.tweens.add({ targets: this.art, scaleX: { from: this.art.scaleX * 0.2, to: this.art.scaleX }, duration: 220, ease: 'Back.Out' });
  }

  peekCart() {
    const cart = this.parts.cart as Phaser.GameObjects.Graphics;
    cart.setVisible(true);
    this.gs.time.delayedCall(900, () => cart.setVisible(false));
  }

  addHeat() {
    if (this.kind !== 'speculator' || this.shield > 0 || !this.alive) return;
    const now = this.gs.time.now;
    if (now < (this.shieldReadyAt ?? 0)) return;
    this.heat++;
    if (this.heat >= 4) {
      this.shieldReadyAt = now + 9000;
      this.heat = 0; this.shield = 1;
      this.shieldG = this.gs.add.graphics().setDepth(19);
      this.shieldG.lineStyle(4, C.cyan, 0.9); this.shieldG.strokeCircle(0, 0, 78); this.shieldG.fillStyle(C.cyan, 0.12); this.shieldG.fillCircle(0, 0, 78);
      this.say(this.pickLine('shield'), 1400);
      this.drawHp();
    }
  }

  think(ms: number) {
    if (!this.alive) return;
    const now = this.gs.time.now;
    this.thinkUntil = Math.max(this.thinkUntil, now + ms);
    this.shouting = false; this.volume = 0;
    if (this.kind === 'repeater') { this.stuckUntil = now + ms + 1200; this.say(this.pickLine('stuck'), 1800); }
    else if (this.kind === 'right' || this.kind === 'mirrorright') { this.say('我思考过了：我是对的。', 1800); this.thinkUntil = now + 900; }
    Synth.think();
  }

  freeze(ms: number) {
    if (!this.alive) return;
    this.frozenUntil = Math.max(this.frozenUntil, this.gs.time.now + ms);
    this.shouting = false;
    if (this.speech) this.speech.destroy();
  }

  /** returns damage dealt */
  takeHit(dmg: number, src: HitSrc): number {
    const gs = this.gs, now = gs.time.now;
    if (!this.alive) { if (this.exiting && src.type === 'ammo') gs.humiliate(this, true); return 0; }
    if (src.type !== 'ammo' && now - this.born < 1300) return 0;
    const frozen = this.frozen(now), thinking = now < this.thinkUntil;
    let mult = 1;
    if (thinking && src.type === 'ammo' && src.ammo !== 'question') { mult *= 1.5; gs.humiliate(this, false); }
    switch (this.kind) {
      case 'repeater':
        if (!frozen && now >= this.stuckUntil) mult /= 1 + this.volume * 0.6;
        if (this.shouting && src.type === 'ammo') gs.echo(this);
        break;
      case 'chameleon':
        if (src.type === 'ammo' && src.ammo) {
          if (this.lastAmmo === src.ammo && !frozen) { mult *= 2.6; gs.irony(this); this.lastAmmo = null; }
          else { if (!frozen) { mult *= 0.6; this.say(this.pickLine('resist'), 1400); this.flipStance(); } this.lastAmmo = src.ammo; }
        } else mult *= 0.7;
        break;
      case 'speculator':
        if (this.shield > 0 && !frozen) {
          this.shield = 0; this.shieldG?.destroy(); this.shieldG = undefined;
          gs.fx.burst('like', this.x, this.y, 14); Synth.pop(); gs.stat('traffic', 3); gs.dropCoins(this.x, this.y, 3);
          gs.fx.comic(this.x, this.y - 90, '护盾破了！', { size: 30, color: '#27e1e6' });
          this.drawHp(); return 0;
        }
        gs.dropCoins(this.x, this.y, 2);
        break;
      case 'seller': gs.dropLoot(this); break;
      case 'right': case 'mirrorright':
        if (src.type === 'ammo' && src.ammo !== 'doubt') {
          this.say(this.pickLine('hit'), 1600);
          this.growth = Math.min(1.35, this.growth + 0.04);
          this.gs.tweens.add({ targets: this.art, scale: this.growth, duration: 260, ease: 'Back.Out' });
          gs.rightImmune(this);
          return 0;
        }
        if (src.type === 'prop' || src.type === 'env') mult *= 1.4;
        break;
      case 'likegod':
        if (src.ammo === 'bubble') {
          this.hp = Math.min(this.maxHp, this.hp + 30); this.drawHp();
          this.say(this.pickLine('heal'), 1500); gs.stat('traffic', 5);
          this.gs.tweens.add({ targets: this.art, scale: 1.15, duration: 160, yoyo: true });
          return 0;
        }
        break;
    }
    const d = Math.max(0, dmg * mult);
    if (d < 1) return 0;
    this.hp -= d;
    this.hitCount++;
    this.expr(this.kind === 'right' || this.kind === 'mirrorright' ? 'shock' : 'hit', 550);
    if (!this.inflating) {
      // never interrupt an inflation: its completion is what triggers the traffic explosion
      this.gs.tweens.killTweensOf(this.art);
      const sx = this.art.scaleX < 0 ? -this.growth : this.growth;
      this.art.setScale(sx * 1.25, this.growth * 0.78);
      this.gs.tweens.add({ targets: this.art, scaleX: sx, scaleY: this.growth, duration: 420, ease: 'Elastic.Out' });
    }
    if (Math.random() < 0.4 && this.hp > 0) this.say(this.pickLine('hit'), 1500);
    this.drawHp();
    gs.onDamage(this, d, src);
    if (this.hp <= 0) this.defeat(src.type === 'fall' ? 'fell' : 'beaten');
    return d;
  }

  inflate() {
    if (this.inflating || !this.alive) return;
    this.inflating = true;
    Synth.inflate();
    this.expr('shock', 1300);
    const base = this.art.scaleX < 0 ? -1 : 1;
    this.gs.tweens.add({
      targets: this.art, scaleX: base * 1.7, scaleY: 1.7, duration: 1150, ease: 'Sine.In',
      onUpdate: () => { this.art.setRotation(Math.sin(this.gs.time.now / 40) * 0.08); },
      onComplete: () => {
        this.art.setRotation(0); this.art.setScale(base, 1);
        this.inflating = false;
        if (!this.alive) return;
        this.gs.bubbleBlast(this);
      },
    });
  }

  defeat(reason: 'fell' | 'beaten') {
    if (!this.alive) return;
    this.alive = false; this.exiting = true; this.inflating = false;
    const gs = this.gs;
    gs.matter.world.remove(this.body);
    this.hpBar.destroy(); this.qMark.destroy(); this.shieldG?.destroy();
    if (this.speech) this.speech.destroy();
    gs.onDefeat(this, reason);
    const v = this.view, art = this.art;
    gs.tweens.killTweensOf(art);
    const offscreen = v.y > H - 20 || v.x < -60 || v.x > W + 60;
    const finish = () => { this.exiting = false; v.destroy(); gs.onExitDone(this); };
    if (offscreen) {
      gs.fx.comic(Phaser.Math.Clamp(v.x, 90, W - 90), Math.min(v.y, H - 220), '掉粉了！', { size: 34, color: '#ffd400' });
      gs.time.delayedCall(700, finish); return;
    }
    gs.tweens.add({ targets: v, rotation: 0, duration: 200 });
    const lineY = this.y + this.top - 10;
    const sayExit = (delay: number, t?: string) => gs.time.delayedCall(delay, () => { if (v.active) { this.speech = gs.fx.speech(t ?? this.pickLine('exit'), 1800); this.speech.place(v.x, lineY); } });
    switch (this.kind) {
      case 'repeater': {
        this.face.set('shy'); sayExit(150);
        const sign = gs.add.text(0, this.top - 8, '已静音', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#fff', backgroundColor: '#1b1029', padding: { x: 6, y: 3 } }).setOrigin(0.5);
        v.add(sign);
        gs.tweens.add({ targets: this.parts.mouth, scaleY: 0.1, duration: 300 });
        gs.tweens.add({ targets: v, x: W + 140, y: v.y - 10, delay: 1100, duration: 1500, ease: 'Sine.In', onUpdate: () => art.setY(Math.abs(Math.sin(gs.time.now / 90)) * -8), onComplete: finish });
        break;
      }
      case 'chameleon': {
        sayExit(100);
        let n = 0;
        gs.time.addEvent({ delay: 110, repeat: 9, callback: () => { this.parts.draw([C.pink, C.cyan, C.yellow, C.violet, C.green][n++ % 5]); } });
        gs.tweens.add({ targets: v, alpha: 0, delay: 1300, duration: 700, onComplete: () => { gs.fx.comic(v.x, v.y - 40, '隐身了', { size: 28 }); finish(); } });
        break;
      }
      case 'speculator': {
        this.parts.drawBoard(false); this.face.set('shock'); sayExit(100);
        gs.tweens.add({ targets: v, x: v.x + 260, y: H + 160, rotation: 0.9, delay: 900, duration: 1100, ease: 'Quad.In', onComplete: finish });
        break;
      }
      case 'general': {
        gs.tweens.add({ targets: art, rotation: Math.PI * 4, scale: 0.1, duration: 700, ease: 'Quad.In', onComplete: () => {
          art.setVisible(false);
          const pj = gs.add.container(0, 22); v.add(pj);
          const pf = Art.pajama(gs, pj);
          pj.setScale(0.2); gs.tweens.add({ targets: pj, scale: 1.25, duration: 400, ease: 'Back.Out' });
          sayExit(300);
          gs.registerPajama(v);
          gs.time.delayedCall(2400, () => {
            pf.set('sad');
            gs.tweens.add({ targets: v, x: W + 120, duration: 2600, ease: 'Linear', onComplete: finish });
          });
        } });
        break;
      }
      case 'seller': {
        this.face.set('shock');
        gs.tweens.add({ targets: this.parts.ring, scale: 0, duration: 250 });
        const off = gs.add.text(-52, -82, '直播\n已结束', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#fff', align: 'center' }).setOrigin(0.5);
        art.add(off);
        sayExit(150);
        gs.tweens.add({ targets: v, x: W + 140, delay: 1300, duration: 800, ease: 'Quad.In', onComplete: finish });
        break;
      }
      case 'right': case 'mirrorright': {
        this.face.set('shock');
        gs.tweens.add({ targets: art, scaleY: 0.3, scaleX: 1.3, duration: 200, ease: 'Quad.Out' });
        const q = gs.add.text(0, -40, '?', { fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#ffd400', stroke: INK, strokeThickness: 8 }).setOrigin(0.5).setAlpha(0);
        v.add(q);
        gs.tweens.add({ targets: q, alpha: 1, y: -110, delay: 700, duration: 500 });
        gs.time.delayedCall(1700, () => {
          this.face.set('think');
          gs.tweens.add({ targets: art, scaleY: 1, scaleX: 1, duration: 500, ease: 'Back.Out' });
          sayExit(300);
          gs.tweens.add({ targets: v, x: W + 160, delay: 2000, duration: 2600, ease: 'Sine.In', onComplete: finish });
        });
        break;
      }
      case 'likegod': {
        this.face.set('shock'); sayExit(50);
        gs.tweens.add({ targets: art, scale: 0.2, rotation: 6, delay: 600, duration: 900, ease: 'Quad.In', onComplete: () => { gs.fx.burst('like', v.x, v.y, 40); gs.fx.burst('heart', v.x, v.y, 30); Synth.explode(); finish(); } });
        break;
      }
      case 'clone': {
        gs.fx.comic(v.x, v.y - 30, '账号已注销', { size: 22, color: '#b9bcc9' });
        gs.tweens.add({ targets: v, scale: 0, duration: 260, onComplete: finish });
        break;
      }
    }
  }

  destroy() {
    if (this.alive) { this.gs.matter.world.remove(this.body); }
    this.alive = false;
    this.hpBar.destroy(); this.qMark.destroy(); this.shieldG?.destroy(); this.view.destroy();
    if (this.speech) this.speech.destroy();
  }
}
