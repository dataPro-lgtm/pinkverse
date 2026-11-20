import Phaser from 'phaser';
import { GRAVITY_Y, W, H, C } from '../config';
import { AMMO, AmmoSpec } from '../data/ammo';
import { Synth } from '../audio';
import { COMIC } from '../data/lines';
import type { AmmoId } from '../state';
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './enemy';
import type { Prop } from './props';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Projectile {
  readonly type = 'proj' as const;
  spec: AmmoSpec;
  body: any;
  view: Phaser.GameObjects.Image;
  born: number;
  alive = true;
  returning = false;
  split = false;
  steps = 0;
  rest = 0;
  hits = 0;
  silenced = false;
  popped = false;
  reflected = 0;
  private touched = new Map<any, number>();

  constructor(public gs: GameScene, public ammo: AmmoId, x: number, y: number, vx: number, vy: number, public small = false) {
    this.spec = AMMO[ammo];
    const r = small ? 12 : this.spec.r;
    const tex = small ? 'am_qs' : this.spec.tex;
    this.view = gs.add.image(x, y, tex).setDepth(26);
    if (ammo === 'duck') this.view.setScale(1.05);
    this.body = gs.matter.add.circle(x, y, r, {
      density: this.spec.density, restitution: this.spec.restitution, friction: this.spec.friction,
      frictionAir: this.spec.frictionAir, collisionFilter: { group: -1 }, label: 'proj',
    });
    this.body.ent = this;
    gs.matter.body.setVelocity(this.body, { x: vx, y: vy });
    this.born = gs.time.now;
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }

  /** runs once per fixed physics step */
  preStep() {
    if (!this.alive) return;
    const b = this.body;
    const grav = this.returning ? 0 : this.spec.grav;
    if (grav < 1) b.force.y -= b.mass * GRAVITY_Y * 0.001 * (1 - grav);
    this.steps++;
    if (this.ammo === 'boomerang') {
      if (!this.returning && this.steps > 48) this.startReturn();
      if (this.returning) {
        const home = this.gs.homePoint();
        const dx = home.x - b.position.x, dy = home.y - b.position.y, d = Math.hypot(dx, dy) || 1;
        const sp = 14;
        const nvx = b.velocity.x + (dx / d * sp - b.velocity.x) * 0.07;
        const nvy = b.velocity.y + (dy / d * sp - b.velocity.y) * 0.07;
        this.gs.matter.body.setVelocity(b, { x: nvx, y: nvy });
        if (this.steps > 260) this.kill(true);
      }
    }
  }

  startReturn() {
    if (this.returning) return;
    this.returning = true;
    this.steps = Math.max(this.steps, 48);
    Synth.fire('boomerang');
    this.view.setTint(0xff9a3c);
  }

  update(time: number) {
    if (!this.alive) return;
    const b = this.body;
    this.view.setPosition(b.position.x, b.position.y);
    if (this.ammo === 'boomerang') this.view.rotation += 0.45;
    else this.view.setRotation(b.angle);
    if (b.speed > 3) this.gs.fx.trail(b.position.x, b.position.y, this.spec.color);
    if (this.ammo === 'question' && !this.small && !this.split && time - this.born > 430) this.doSplit();
    if (b.speed < 0.35) this.rest++; else this.rest = 0;
    const life = this.small ? 3200 : 9000;
    if (this.rest > 45 || time - this.born > life) { this.kill(true); return; }
    if (b.position.x < -100 || b.position.x > W + 100 || b.position.y > H + 80) { this.kill(false); return; }
    this.gs.checkRopes(this);
    if (this.ammo === 'bubble' && !this.popped && time - this.born > 4200) { this.popped = true; this.gs.smallBlast(this.x, this.y); this.kill(false); }
  }

  doSplit() {
    if (this.split || !this.alive) return;
    this.split = true;
    const b = this.body;
    const sp = Math.max(8, b.speed);
    const base = Math.atan2(b.velocity.y, b.velocity.x);
    const n = this.gs.questionCount();
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      this.gs.spawnProjectile('question', b.position.x, b.position.y, Math.cos(a) * sp, Math.sin(a) * sp, true);
    }
    this.gs.fx.burst('qm', b.position.x, b.position.y, 6);
    this.gs.fx.flash(b.position.x, b.position.y, 22, C.pink);
    Synth.think();
    this.kill(false);
  }

  onHit(other: Enemy | Prop | null, otherBody: any, rel: number) {
    if (!this.alive) return;
    const now = this.gs.time.now;
    const last = this.touched.get(otherBody) || 0;
    if (now - last < 220) return;
    this.touched.set(otherBody, now);
    const gs = this.gs, x = this.x, y = this.y;
    this.hits++;
    if (rel > 4) { Synth.impact(rel / 14); gs.fx.burst('spark', x, y, Math.min(14, 3 + rel | 0)); }
    if (this.ammo === 'duck' && !this.silenced) { this.silenced = true; gs.silence(this); }
    if (this.ammo === 'question' && !this.small && !this.split) { this.doSplit(); if (!other || other.type !== 'enemy') return; }

    if (other && other.type === 'enemy') {
      const e = other as Enemy;
      if (!e.alive) { if (e.exiting) gs.humiliate(e, true); return; }
      const dmg = this.spec.dmg * Phaser.Math.Clamp(rel / 12, 0.55, 1.6) * gs.powerMult();
      switch (this.ammo) {
        case 'fact':
          Synth.stamp();
          gs.fx.comic(x, y - 50, pick(COMIC.fact), { size: 34, color: '#ff4d4d' });
          e.takeHit(dmg, { type: 'ammo', ammo: 'fact', x, y });
          break;
        case 'boomerang': {
          const back = this.returning;
          if (back) gs.fx.comic(x, y - 50, '背刺逻辑！', { size: 30, color: '#ffd400' });
          e.takeHit(dmg * (back ? 1.5 : 1), { type: 'ammo', ammo: 'boomerang', x, y });
          if (!back) this.startReturn();
          break;
        }
        case 'question':
          gs.questionHit(e);
          e.takeHit(dmg, { type: 'ammo', ammo: 'question', x, y });
          this.kill(true);
          break;
        case 'bubble':
          if (!this.popped) {
            this.popped = true;
            e.takeHit(dmg, { type: 'ammo', ammo: 'bubble', x, y });
            if (e.kind !== 'likegod') e.inflate();
            gs.stat('traffic', 3);
            this.kill(false);
          }
          break;
        case 'duck':
          e.takeHit(dmg, { type: 'ammo', ammo: 'duck', x, y });
          break;
        case 'doubt':
          gs.doubtHit(e, this);
          e.takeHit(dmg, { type: 'ammo', ammo: 'doubt', x, y });
          this.kill(true);
          break;
      }
      return;
    }
    if (other && other.type === 'prop') {
      const p = other as Prop;
      p.ammoHit(this, rel);
      if (this.ammo === 'bubble' && !this.popped && !p.isStatic) { this.popped = true; gs.smallBlast(p.x, p.y); this.kill(false); }
      if (this.ammo === 'doubt' && p.kind === 'mirror') this.kill(true);
    }
  }

  kill(poof: boolean) {
    if (!this.alive) return;
    this.alive = false;
    this.gs.matter.world.remove(this.body);
    if (poof) {
      this.gs.fx.burst('smoke', this.x, this.y, 3);
      this.gs.tweens.add({ targets: this.view, scale: 0, alpha: 0, duration: 200, onComplete: () => this.view.destroy() });
    } else this.view.destroy();
    this.gs.projectileGone(this);
  }
}
