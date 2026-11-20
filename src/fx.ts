import Phaser from 'phaser';
import { C, FONT, INK, W } from './config';

export interface Speech { ct: Phaser.GameObjects.Container; h: number; alive: boolean; destroy(): void; place(x: number, y: number): void }

/* Pooled particles and text so the phone never stutters mid-combo. */
export class Fx {
  private em: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {};
  private texts: Phaser.GameObjects.Text[] = [];
  private slowDepth = 0;
  constructor(private s: Phaser.Scene) {
    const mk = (key: string, tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 40) => {
      const e = s.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      this.em[key] = e;
    };
    mk('spark', 'spark', { speed: { min: 160, max: 520 }, lifespan: { min: 250, max: 500 }, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', tint: [0xffffff, C.yellow, C.pinkL] });
    mk('debris', 'shard', { speed: { min: 180, max: 620 }, angle: { min: 200, max: 340 }, gravityY: 1300, lifespan: { min: 600, max: 1100 }, rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.4 }, tint: [C.yellow, 0xffffff, C.pink] });
    mk('heart', 'heart', { speed: { min: 120, max: 420 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 1200, scale: { start: 1, end: 0.4 }, tint: [C.pink, C.pinkL] });
    mk('like', 'like', { speed: { min: 120, max: 460 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 1200, scale: { start: 1, end: 0.4 }, tint: [C.cyan, 0xffffff] });
    mk('coin', 'coin', { speed: { min: 150, max: 380 }, angle: { min: 230, max: 310 }, gravityY: 1100, lifespan: 1100, rotate: { min: 0, max: 360 } });
    mk('coupon', 'coupon', { speed: { min: 150, max: 420 }, angle: { min: 200, max: 340 }, gravityY: 900, lifespan: 1300, rotate: { min: -200, max: 200 } });
    mk('star', 'star', { speed: { min: 100, max: 360 }, lifespan: 800, scale: { start: 1, end: 0 }, tint: [C.yellow, 0xffffff], blendMode: 'ADD' });
    mk('qm', 'qm', { speed: { min: 60, max: 220 }, angle: { min: 230, max: 310 }, gravityY: -60, lifespan: 1200, scale: { start: 0.9, end: 0.3 }, tint: [C.pink, 0xffffff, C.cyan] });
    mk('wood', 'shard', { speed: { min: 180, max: 560 }, angle: { min: 200, max: 340 }, gravityY: 1300, lifespan: { min: 600, max: 1000 }, rotate: { min: 0, max: 360 }, scale: { min: 0.7, max: 1.5 }, tint: [0xc98a4b, 0x8a5a2b, 0xe0b080] });
    mk('glass', 'shard', { speed: { min: 200, max: 700 }, gravityY: 1100, lifespan: { min: 700, max: 1200 }, rotate: { min: 0, max: 360 }, scale: { min: 0.5, max: 1.6 }, tint: [0xffffff, 0xd8f6ff, C.cyan] });
    mk('paper', 'px', { speed: { min: 150, max: 520 }, angle: { min: 200, max: 340 }, gravityY: 700, lifespan: { min: 900, max: 1500 }, rotate: { min: 0, max: 360 }, scaleX: { min: 1, max: 2 }, scaleY: { min: 0.6, max: 1.2 }, tint: [0xffffff, C.pinkL, C.cream] });
    mk('confetti', 'px', { speed: { min: 260, max: 760 }, angle: { min: 220, max: 320 }, gravityY: 700, lifespan: { min: 1400, max: 2400 }, rotate: { min: 0, max: 360 }, scaleX: { min: 0.6, max: 1.4 }, scaleY: { min: 0.3, max: 0.8 }, tint: [C.pink, C.yellow, C.cyan, 0xffffff, C.violet] }, 60);
    mk('smoke', 'spark', { speed: { min: 20, max: 90 }, angle: { min: 240, max: 300 }, lifespan: 900, scale: { start: 0.8, end: 2.2 }, alpha: { start: 0.45, end: 0 }, tint: [0x9a8fb0, 0xcfc8dd] }, 35);
    mk('trail', 'spark', { lifespan: 300, scale: { start: 0.7, end: 0 }, alpha: { start: 0.7, end: 0 }, blendMode: 'ADD' }, 25);
    for (let i = 0; i < 12; i++) {
      const t = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#fff', stroke: INK, strokeThickness: 8 }).setOrigin(0.5).setDepth(80).setVisible(false);
      this.texts.push(t);
    }
  }

  burst(kind: string, x: number, y: number, n: number) {
    const e = this.em[kind]; if (e) e.explode(n, x, y);
  }
  trail(x: number, y: number, tint: number) { const e = this.em.trail; e.setParticleTint(tint); e.emitParticleAt(x, y, 1); }

  comic(x: number, y: number, text: string, o: { size?: number; color?: string; dur?: number; rot?: number } = {}) {
    const t = this.texts.find(q => !q.visible) || this.texts[0];
    this.s.tweens.killTweensOf(t);
    t.setText(text).setFontSize(o.size ?? 44).setColor(o.color ?? '#ffffff');
    const half = Math.min(W / 2 - 10, t.width / 2 + 12);
    t.setPosition(Phaser.Math.Clamp(x, half, W - half), y)
      .setVisible(true).setAlpha(1).setScale(0.3).setRotation(o.rot ?? Phaser.Math.FloatBetween(-0.2, 0.2));
    this.s.tweens.add({ targets: t, scale: 1.15, duration: 140, ease: 'Back.Out', onComplete: () => {
      this.s.tweens.add({ targets: t, scale: 1, y: y - 40, alpha: 0, delay: o.dur ?? 450, duration: 450, ease: 'Quad.In', onComplete: () => t.setVisible(false) });
    } });
  }

  flash(x: number, y: number, r: number, color = 0xffffff) {
    const c = this.s.add.circle(x, y, r, color, 0.9).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: c, scale: 1.8, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  }
  ring(x: number, y: number, color: number, r = 30, life = 380) {
    const c = this.s.add.circle(x, y, r).setStrokeStyle(5, color).setDepth(44);
    this.s.tweens.add({ targets: c, scale: 3, alpha: 0, duration: life, ease: 'Quad.Out', onComplete: () => c.destroy() });
  }
  shake(ms = 140, k = 0.008) { this.s.cameras.main.shake(ms, k); }
  punch(z = 1.035) {
    const cam = this.s.cameras.main;
    this.s.tweens.add({ targets: cam, zoom: z, duration: 80, yoyo: true, ease: 'Quad.Out' });
  }

  /** Real-time slow motion: physics, tweens and timers all slow down together. */
  slowmo(realMs = 420, scale = 0.25) {
    const s: any = this.s;
    this.slowDepth++;
    s.matter.world.engine.timing.timeScale = scale;
    s.tweens.timeScale = scale; s.time.timeScale = scale;
    window.setTimeout(() => {
      this.slowDepth--;
      if (this.slowDepth > 0 || !s.sys || !s.sys.isActive()) return;
      s.matter.world.engine.timing.timeScale = 1; s.tweens.timeScale = 1; s.time.timeScale = 1;
    }, realMs);
  }

  speech(text: string, ms: number, o: { tint?: number; color?: string; size?: number } = {}): Speech {
    const s = this.s;
    const ct = s.add.container(0, 0).setDepth(70);
    const t = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: (o.size ?? 19) + 'px', fontStyle: 'bold', color: o.color ?? INK, wordWrap: { width: 230, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5);
    const w = Math.max(60, t.width + 24), h = t.height + 18;
    const g = s.add.graphics();
    g.fillStyle(o.tint ?? 0xfffaf0); g.lineStyle(4, C.ink);
    g.fillRoundedRect(-w / 2, -h, w, h, 14); g.strokeRoundedRect(-w / 2, -h, w, h, 14);
    g.fillTriangle(-8, -2, 8, -2, -2, 12); g.lineBetween(-8, 0, -2, 12); g.lineBetween(8, 0, -2, 12);
    t.setY(-h / 2);
    ct.add([g, t]);
    ct.setScale(0.2);
    s.tweens.add({ targets: ct, scale: 1, duration: 180, ease: 'Back.Out' });
    const sp: Speech = {
      ct, h, alive: true,
      place: (x, y) => { ct.setPosition(Phaser.Math.Clamp(x, w / 2 + 8, W - w / 2 - 8), Math.max(h + 150, y)); },
      destroy: () => { if (!sp.alive) return; sp.alive = false; s.tweens.add({ targets: ct, scale: 0, alpha: 0, duration: 150, onComplete: () => ct.destroy() }); },
    };
    s.time.delayedCall(ms, () => sp.destroy());
    return sp;
  }
}
