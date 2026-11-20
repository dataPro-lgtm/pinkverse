import Phaser from 'phaser';
import { C, FONT, INK, W } from '../config';
import { Synth } from '../audio';
import { BOARD_SLOGANS, DANMAKU, DUAL_RULES, SHEET_WORDS, machineLine } from '../data/lines';
import type { PropDef } from '../data/levels';
import type { GameScene } from '../scenes/GameScene';
import type { Projectile } from './projectile';
import type { Speech } from '../fx';

export type PropKind = 'platform' | 'crate' | 'board' | 'plank' | 'monitor' | 'product' | 'sheet' | 'bumper' | 'switch' | 'gate' | 'conveyor'
  | 'dblock' | 'machine' | 'extreme' | 'pboss' | 'rules' | 'mirror' | 'trophy' | 'selfsign';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Prop {
  readonly type = 'prop' as const;
  kind: PropKind;
  body: any = null;
  view!: Phaser.GameObjects.Container;
  isStatic = true;
  alive = true;
  hp = 1;
  w = 0; h = 0;
  data: any = {};
  breakAt = 999;
  debris = 'debris';
  speech?: Speech;

  constructor(public gs: GameScene, def: PropDef | { t: 'sheet' | 'selfsign' | 'dblock'; x: number; y: number; text?: string }) {
    this.kind = def.t as PropKind;
    const s = gs;
    const ct = this.view = s.add.container(def.x, def.y).setDepth(15);
    const g = s.add.graphics(); ct.add(g);
    const mkBody = (w: number, h: number, opts: any) => {
      this.w = w; this.h = h;
      this.body = s.matter.add.rectangle(def.x, def.y, w, h, { friction: 0.6, frictionStatic: 0.8, ...opts });
      this.body.ent = this;
      this.isStatic = !!opts.isStatic;
    };
    const text = (x: number, y: number, t: string, size: number, color = INK, extra: any = {}) => {
      const tx = s.add.text(x, y, t, { fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color, align: 'center', ...extra }).setOrigin(0.5);
      ct.add(tx); return tx;
    };

    switch (def.t) {
      case 'platform': {
        const { w, h } = def; const st = def.style ?? 'hazard';
        if (st === 'hazard' || st === 'steel') {
          const ts = s.add.tileSprite(0, 0, w, h, st === 'hazard' ? 'hazard' : 'steel'); ct.add(ts);
          g.lineStyle(4, C.ink); g.strokeRect(-w / 2, -h / 2, w, h); ct.bringToTop(g);
        } else if (st === 'shelf') {
          g.fillStyle(C.cream); g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle(C.pink); g.fillRect(-w / 2, -h / 2, w, 6); g.lineStyle(4, C.ink); g.strokeRect(-w / 2, -h / 2, w, h);
        } else if (st === 'stage') {
          g.fillStyle(0x5a2d1a); g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle(C.yellow); for (let x = -w / 2 + 14; x < w / 2; x += 34) g.fillCircle(x, h / 2 - 8, 4);
          g.fillStyle(C.pink); g.fillRect(-w / 2, -h / 2, w, 6); g.lineStyle(4, C.ink); g.strokeRect(-w / 2, -h / 2, w, h);
        } else {
          g.fillStyle(0xeeeaf6); g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle(C.pink); g.fillRect(-w / 2, -h / 2 + 8, w, 8); g.lineStyle(4, C.ink); g.strokeRect(-w / 2, -h / 2, w, h);
          g.lineStyle(2, 0xc9c2da); g.lineBetween(-w / 2 + 10, h / 2 - 12, -w / 2 + 30, -h / 2 + 24);
        }
        mkBody(w, h, { isStatic: true, friction: 0.9 });
        break;
      }
      case 'crate': {
        const sz = 60 * (def.s ?? 1);
        ct.add(s.add.image(0, 0, 'crate').setDisplaySize(sz, sz));
        mkBody(sz, sz, { density: 0.0015, restitution: 0.05, friction: 0.7 });
        this.breakAt = 13; this.debris = 'wood';
        break;
      }
      case 'board': {
        const { w, h } = def;
        g.fillStyle(0xffffff); g.fillRect(-w / 2, -h / 2, w, h); g.lineStyle(4, C.pink); g.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4); g.lineStyle(2, C.ink); g.strokeRect(-w / 2, -h / 2, w, h);
        const t = def.text ?? pick(BOARD_SLOGANS);
        this.data.text = t;
        const vertical = h > w * 1.6;
        text(0, 0, vertical ? t.split('').join('\n') : t, vertical ? Math.min(18, (h - 10) / t.length) : 16, INK, { lineSpacing: -4 });
        mkBody(w, h, { density: 0.0012, friction: 0.8 });
        this.breakAt = 11; this.debris = 'paper';
        break;
      }
      case 'plank': {
        const w = def.w, h = def.h ?? 22;
        g.fillStyle(0xc98a4b); g.fillRect(-w / 2, -h / 2, w, h); g.lineStyle(3, 0x8a5a2b); for (let x = -w / 2 + 30; x < w / 2; x += 50) g.lineBetween(x, -h / 2 + 4, x + 14, h / 2 - 4);
        g.lineStyle(4, C.ink); g.strokeRect(-w / 2, -h / 2, w, h);
        mkBody(w, h, { density: 0.001, friction: 0.9, angle: def.a ?? 0 });
        this.breakAt = 15; this.debris = 'wood';
        break;
      }
      case 'monitor': {
        ct.add(s.add.image(0, 0, 'monitor'));
        text(0, -2, pick(['666', '急', '赢', '顶']), 16, '#1b1029');
        mkBody(60, 46, { density: 0.0016, friction: 0.6 });
        this.breakAt = 12; this.debris = 'glass';
        break;
      }
      case 'product': {
        ct.add(s.add.image(0, 0, 'product'));
        text(0, 1, pick(['爱国款', '限定', '信念']), 11);
        text(0, 17, '产地:别问', 7, '#c2185b');
        mkBody(50, 50, { density: 0.001, friction: 0.5 });
        this.breakAt = 14; this.debris = 'paper';
        break;
      }
      case 'sheet': {
        g.fillStyle(0xffffff); g.fillRect(-24, -15, 48, 30); g.lineStyle(3, C.ink); g.strokeRect(-24, -15, 48, 30);
        text(0, 0, (def as any).text ?? pick(SHEET_WORDS), 15, '#c2185b');
        mkBody(48, 30, { density: 0.0006, friction: 0.5 });
        this.breakAt = 9; this.debris = 'paper';
        break;
      }
      case 'bumper': {
        const r = def.r;
        g.fillStyle(C.pink); g.fillCircle(0, 0, r); g.lineStyle(5, C.ink); g.strokeCircle(0, 0, r);
        g.lineStyle(4, 0xffffff, 0.9); g.strokeCircle(0, 0, r * 0.62); g.fillStyle(C.yellow); g.fillCircle(0, 0, r * 0.3);
        this.body = s.matter.add.circle(def.x, def.y, r, { isStatic: true, restitution: 1.15 }); this.body.ent = this; this.w = this.h = r * 2;
        break;
      }
      case 'switch': {
        g.fillStyle(0x3b3e55); g.fillRoundedRect(-18, -32, 36, 64, 8); g.lineStyle(4, C.ink); g.strokeRoundedRect(-18, -32, 36, 64, 8);
        const knob = s.add.graphics(); ct.add(knob);
        knob.fillStyle(C.red); knob.fillCircle(0, -10, 12); knob.lineStyle(4, C.ink); knob.strokeCircle(0, -10, 12);
        this.data.knob = knob;
        text(0, 18, '开关', 12, '#ffffff');
        this.data.target = def.target;
        mkBody(36, 64, { isStatic: true });
        break;
      }
      case 'gate': {
        const ts = s.add.tileSprite(0, 0, def.w, def.h, 'hazard'); ct.add(ts);
        g.lineStyle(4, C.ink); g.strokeRect(-def.w / 2, -def.h / 2, def.w, def.h); ct.bringToTop(g);
        text(0, 0, '活板门', 13, '#ffffff', { stroke: INK, strokeThickness: 4 });
        this.data.id = def.id;
        mkBody(def.w, def.h, { isStatic: true, friction: 0.9 });
        break;
      }
      case 'conveyor': {
        const ts = s.add.tileSprite(0, 0, def.w, 24, 'belt'); ct.add(ts);
        g.fillStyle(0x50506a); for (let x = -def.w / 2 + 12; x < def.w / 2; x += 40) g.fillCircle(x, 16, 9);
        g.lineStyle(4, C.ink); g.strokeRect(-def.w / 2, -12, def.w, 24); ct.bringToTop(g);
        this.data = { ts, speed: def.speed, spawn: def.spawn ?? 0, next: s.time.now + 1500, top: def.y - 12, x0: def.x - def.w / 2, x1: def.x + def.w / 2 };
        mkBody(def.w, 24, { isStatic: true, friction: 0.9 });
        break;
      }
      case 'dblock': {
        g.fillStyle(0x14142a, 0.95); g.fillRoundedRect(-21, -15, 42, 30, 5); g.lineStyle(3, C.cyan); g.strokeRoundedRect(-21, -15, 42, 30, 5);
        text(0, 0, (def as any).text ?? pick(DANMAKU), 15, '#27e1e6');
        mkBody(42, 30, { isStatic: true });
        break;
      }
      case 'machine': {
        g.fillStyle(0x5b5f7a); g.fillRect(28, -90, 26, 40); g.lineStyle(4, C.ink); g.strokeRect(28, -90, 26, 40);
        g.fillStyle(C.yellow); g.fillRoundedRect(-70, -60, 140, 120, 14); g.strokeRoundedRect(-70, -60, 140, 120, 14);
        g.fillStyle(C.ink); g.fillRect(-90, 24, 30, 24);
        g.fillStyle(0xffffff); g.fillRoundedRect(-52, -44, 74, 34, 6); g.lineStyle(3, C.ink); g.strokeRoundedRect(-52, -44, 74, 34, 6);
        const gear = s.add.image(42, 22, 'gear').setScale(0.6); ct.add(gear);
        s.tweens.add({ targets: gear, angle: 360, duration: 2400, repeat: -1 });
        const screen = text(-15, -27, '口号制造机', 13);
        this.data = { gear, screen, next: s.time.now + 2500, broken: false, hits: 0, extra: 0, dead: false };
        this.hp = 3;
        mkBody(140, 120, { isStatic: true });
        break;
      }
      case 'extreme': {
        g.fillStyle(C.ink); g.fillRoundedRect(-96, -36, 192, 72, 12); g.lineStyle(5, C.pink); g.strokeRoundedRect(-96, -36, 192, 72, 12);
        const t1 = text(0, -10, '极端发言', 24, '#ffd400'); const t2 = text(0, 18, '热度 ×10', 15, '#ff2e88');
        this.data = { t1, t2, cd: 0 };
        mkBody(192, 72, { isStatic: true });
        break;
      }
      case 'pboss': {
        g.fillStyle(0x000000, 0.35); g.fillCircle(0, 0, 44); g.lineStyle(4, 0x8a7ca8, 0.6); g.strokeCircle(0, 0, 44);
        g.fillStyle(0xffffff, 0.35); g.fillEllipse(0, 0, 50, 26); g.fillStyle(C.ink, 0.6); g.fillCircle(0, 0, 9);
        text(0, 58, '平台', 16, '#8a7ca8');
        ct.setAlpha(0.6);
        this.body = s.matter.add.circle(def.x, def.y, 44, { isStatic: true, isSensor: true }); this.body.ent = this;
        break;
      }
      case 'rules': {
        const [a, b] = DUAL_RULES[def.i % DUAL_RULES.length];
        g.fillStyle(0xffffff, 0.92); g.fillRoundedRect(-84, -30, 168, 60, 8); g.lineStyle(3, C.ink); g.strokeRoundedRect(-84, -30, 168, 60, 8);
        text(0, -12, a, 15); text(0, 12, b, 15, '#c2185b');
        g.lineStyle(3, C.pink); g.lineBetween(-80, 0, 80, 0);
        ct.setDepth(6);
        break;
      }
      case 'mirror': {
        const { w, h } = def;
        g.fillStyle(0xd4af37); g.fillRoundedRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32, 26); g.lineStyle(5, C.ink); g.strokeRoundedRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32, 26);
        g.fillStyle(0xb9c4d8); g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
        g.fillStyle(0xe7eef8, 0.7); g.fillRoundedRect(-w / 2 + 10, -h / 2 + 10, w * 0.35, h - 20, 12);
        const refl = s.add.container(0, 0); ct.add(refl);
        const shine = s.add.graphics(); ct.add(shine);
        shine.fillStyle(0xffffff, 0.35); shine.fillRect(-12, -h / 2, 24, h); shine.setAngle(18);
        s.tweens.add({ targets: shine, x: { from: -w / 2, to: w / 2 }, duration: 3200, repeat: -1, repeatDelay: 1800 });
        const cracks = s.add.graphics(); ct.add(cracks);
        this.data = { refl, shine, cracks, w, h };
        mkBody(w, h, { isStatic: true, isSensor: true });
        ct.setDepth(8);
        break;
      }
      case 'trophy': {
        g.fillStyle(C.yellow); g.fillRoundedRect(-30, -48, 60, 56, 18); g.lineStyle(4, C.ink); g.strokeRoundedRect(-30, -48, 60, 56, 18);
        g.fillRect(-8, 8, 16, 18); g.strokeRect(-8, 8, 16, 18); g.fillRoundedRect(-26, 26, 52, 16, 4); g.strokeRoundedRect(-26, 26, 52, 16, 4);
        g.lineStyle(5, C.ink); g.beginPath(); g.arc(-32, -24, 12, Math.PI * 0.5, Math.PI * 1.5, false); g.strokePath(); g.beginPath(); g.arc(32, -24, 12, Math.PI * 1.5, Math.PI * 0.5, false); g.strokePath();
        text(0, -22, '真理杯', 14);
        mkBody(64, 92, { density: 0.012, friction: 0.5, restitution: 0.1 });
        const rope = s.add.graphics().setDepth(14);
        const c = s.matter.add.worldConstraint(this.body, def.y - def.anchorY, 0.9, { pointA: { x: def.x, y: def.anchorY }, pointB: { x: 0, y: -46 } });
        this.data = { rope, c, anchor: { x: def.x, y: def.anchorY }, cut: false };
        break;
      }
      case 'selfsign': {
        g.lineStyle(5, C.ink); g.lineBetween(0, 18, 0, 70);
        g.fillStyle(C.pink); g.fillRoundedRect(-40, -18, 80, 36, 8); g.lineStyle(4, C.ink); g.strokeRoundedRect(-40, -18, 80, 36, 8);
        text(0, 0, '绝对正确', 15, '#ffffff');
        mkBody(80, 36, { isStatic: true });
        ct.setDepth(12);
        break;
      }
    }
  }

  get x() { return this.body ? this.body.position.x : this.view.x; }
  get y() { return this.body ? this.body.position.y : this.view.y; }

  update(time: number, dt: number) {
    if (!this.alive) return;
    const b = this.body;
    if (b && !b.isStatic) {
      this.view.setPosition(b.position.x, b.position.y).setRotation(b.angle);
      if (b.position.y > 1400 || b.position.x < -200 || b.position.x > W + 200) { this.remove(); return; }
    }
    switch (this.kind) {
      case 'conveyor': {
        const d = this.data; (d.ts as Phaser.GameObjects.TileSprite).tilePositionX -= d.speed * dt * 0.06;
        if (d.spawn && time > d.next) { d.next = time + d.spawn; this.gs.spawnOnConveyor(this); }
        break;
      }
      case 'machine': {
        const d = this.data;
        if (d.dead) break;
        if (!d.broken && time > d.next) { d.next = time + 4600; this.gs.spawnSheet(this.x - 88, this.y + 30); }
        if (d.broken && time > d.next) {
          d.next = time + 3600;
          if (this.speech) this.speech.destroy();
          this.speech = this.gs.fx.speech(machineLine(), 3000, { tint: 0xfff3a0 });
          this.speech.place(this.x - 60, this.y - 70);
          this.gs.fx.burst('smoke', this.x + 40, this.y - 90, 3);
        }
        break;
      }
      case 'extreme': {
        const a = 0.65 + Math.sin(time / 110) * 0.35; this.data.t1.setAlpha(a);
        break;
      }
      case 'trophy': {
        const d = this.data, r = d.rope as Phaser.GameObjects.Graphics;
        r.clear();
        if (!d.cut) {
          const top = this.topPoint();
          r.lineStyle(4, C.ink); r.lineBetween(d.anchor.x, d.anchor.y, top.x, top.y);
          r.fillStyle(C.ink); r.fillCircle(d.anchor.x, d.anchor.y, 7);
        }
        break;
      }
    }
  }

  topPoint() {
    const b = this.body, a = b.angle;
    return { x: b.position.x + Math.sin(a) * 46, y: b.position.y - Math.cos(a) * 46 };
  }

  cutRope() {
    const d = this.data;
    if (d.cut) return;
    d.cut = true;
    this.gs.matter.world.removeConstraint(d.c);
    Synth.scratch();
    this.gs.fx.comic(d.anchor.x, d.anchor.y + 60, '咔嚓！', { size: 34 });
    this.data.dropping = true;
  }

  /** a projectile touched this prop */
  ammoHit(p: Projectile, rel: number) {
    const gs = this.gs;
    switch (this.kind) {
      case 'board':
        if (p.ammo === 'fact') { gs.factCheck(this); this.shatter(true); }
        else if (rel > this.breakAt) this.shatter();
        break;
      case 'crate': case 'monitor': case 'product': case 'sheet': case 'plank':
        if (rel > this.breakAt * (p.ammo === 'fact' ? 0.8 : 1)) this.shatter();
        break;
      case 'bumper':
        Synth.boing(); gs.fx.ring(this.x, this.y, C.pink, this.w / 2, 300);
        this.view.setScale(1.25); gs.tweens.add({ targets: this.view, scale: 1, duration: 300, ease: 'Back.Out' });
        gs.addScore(10, this.x, this.y);
        break;
      case 'switch': this.press(); break;
      case 'dblock': this.shatter(); gs.addScore(30, this.x, this.y); break;
      case 'machine': this.machineHit(p); break;
      case 'extreme': gs.extremeHit(this); break;
      case 'pboss': gs.platformEgg(this); break;
      case 'mirror': gs.mirrorHit(p, this); break;
      case 'selfsign': if (p.ammo === 'boomerang' && p.returning) gs.selfHit(this, p); break;
    }
  }

  /** a non-projectile body slammed into this prop */
  impact(rel: number, otherStatic: boolean) {
    if (!this.alive || this.isStatic) {
      if (this.kind === 'switch' && rel > 3) this.press();
      if (this.kind === 'dblock' && rel > 6) this.shatter();
      return;
    }
    if (rel > this.breakAt * (otherStatic ? 1.15 : 1)) this.shatter();
  }

  press() {
    if (this.data.pressed) return;
    this.data.pressed = true;
    const knob = this.data.knob as Phaser.GameObjects.Graphics;
    knob.clear(); knob.fillStyle(C.green); knob.fillCircle(0, -4, 12); knob.lineStyle(4, C.ink); knob.strokeCircle(0, -4, 12);
    Synth.click(); Synth.boing();
    this.gs.toggleGate(this.data.target);
  }

  machineHit(p: Projectile) {
    const d = this.data; if (d.dead) return;
    const gs = this.gs;
    gs.fx.burst('spark', this.x, this.y, 12); Synth.impact(1);
    if (!d.broken) {
      this.hp -= p.ammo === 'fact' ? 3 : 1;
      this.view.setX(this.x + 6); gs.tweens.add({ targets: this.view, x: this.x, duration: 260, ease: 'Elastic.Out' });
      if (this.hp <= 0) {
        d.broken = true; d.next = gs.time.now + 900;
        d.screen.setText('故障中…').setColor('#c2185b');
        gs.tweens.killTweensOf(d.gear); gs.tweens.add({ targets: d.gear, angle: '+=720', duration: 900, ease: 'Quad.Out' });
        gs.fx.burst('smoke', this.x, this.y - 40, 10); gs.fx.comic(this.x, this.y - 100, '短路！', { size: 38, color: '#ffd400' });
        gs.sysMsg(gs.sysText('machineBroken'));
        gs.addScore(200, this.x, this.y, true);
      }
    } else {
      d.extra++;
      if (d.extra >= 3) {
        d.dead = true;
        if (this.speech) this.speech.destroy();
        this.speech = gs.fx.speech('本句话是假的。', 2600, { tint: 0xfff3a0 }); this.speech.place(this.x - 60, this.y - 70);
        gs.time.delayedCall(1200, () => { gs.fx.burst('confetti', this.x, this.y, 50); gs.fx.burst('smoke', this.x, this.y, 12); Synth.explode(); d.screen.setText('已停机'); });
        gs.foundEgg('liar');
      }
    }
  }

  shatter(quiet = false) {
    if (!this.alive) return;
    const gs = this.gs;
    gs.fx.burst(this.debris, this.x, this.y, this.kind === 'dblock' ? 8 : 14);
    if (this.debris === 'glass') Synth.glass(); else if (this.debris === 'paper') Synth.shatter(); else Synth.wood();
    if (!quiet && this.kind !== 'sheet') gs.addScore(50, this.x, this.y);
    if (this.kind === 'dblock') gs.danmakuGone(this);
    this.remove();
  }

  remove() {
    if (!this.alive) return;
    this.alive = false;
    if (this.body) this.gs.matter.world.remove(this.body);
    if (this.kind === 'trophy') { const d = this.data; if (!d.cut) this.gs.matter.world.removeConstraint(d.c); d.rope.destroy(); }
    if (this.speech) this.speech.destroy();
    this.view.destroy();
  }

  open() {
    if (!this.alive || this.kind !== 'gate') return;
    this.gs.matter.world.remove(this.body); this.body = null;
    this.gs.tweens.add({ targets: this.view, scaleX: 0, alpha: 0.2, duration: 260, onComplete: () => { this.alive = false; this.view.destroy(); } });
    this.gs.fx.comic(this.x, this.y - 30, '咔哒', { size: 28 });
  }
}

export const DUAL = DUAL_RULES;
