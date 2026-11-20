import Phaser from 'phaser';
import { C, CANNON, FONT, INK } from '../config';

/* The Cannon of Truth: charge squash, recoil, glow, and a crown once you become too certain. */
export class Cannon {
  base: Phaser.GameObjects.Container;
  barrel: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  crown: Phaser.GameObjects.Container;
  angle = -0.75;
  power = 0;
  pivot = { x: CANNON.x, y: CANNON.y - 14 };

  constructor(private s: Phaser.Scene) {
    const ink = C.ink;
    this.barrel = s.add.container(this.pivot.x, this.pivot.y).setDepth(22);
    const bg = s.add.graphics();
    bg.fillStyle(C.yellow); bg.fillRoundedRect(-24, -21, 132, 42, 14); bg.lineStyle(5, ink); bg.strokeRoundedRect(-24, -21, 132, 42, 14);
    bg.fillStyle(C.pink); bg.fillRect(20, -21, 14, 42); bg.fillRect(56, -21, 14, 42);
    bg.lineStyle(5, ink); bg.lineBetween(20, -21, 20, 21); bg.lineBetween(34, -21, 34, 21); bg.lineBetween(56, -21, 56, 21); bg.lineBetween(70, -21, 70, 21);
    bg.fillStyle(C.pink); bg.fillRoundedRect(100, -27, 22, 54, 8); bg.lineStyle(5, ink); bg.strokeRoundedRect(100, -27, 22, 54, 8);
    const t = s.add.text(84, 0, 'TRUTH', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setAngle(90);
    this.glow = s.add.circle(122, 0, 26, C.yellow, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.barrel.add([bg, t, this.glow]);

    this.base = s.add.container(CANNON.x, CANNON.y).setDepth(23);
    const g = s.add.graphics();
    g.fillStyle(C.pink); g.beginPath(); g.moveTo(-56, 40); g.lineTo(56, 40); g.lineTo(34, -26); g.lineTo(-34, -26); g.closePath(); g.fillPath();
    g.lineStyle(5, ink); g.strokePath();
    g.fillStyle(C.yellow); g.fillCircle(0, -14, 20); g.lineStyle(5, ink); g.strokeCircle(0, -14, 20);
    [[-36, 46], [36, 46]].forEach(([x, y]) => { g.fillStyle(0x2b1b42); g.fillCircle(x, y, 22); g.lineStyle(5, ink); g.strokeCircle(x, y, 22); g.fillStyle(C.yellow); g.fillCircle(x, y, 7); });
    const lb = s.add.text(0, 14, '真理', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: INK, strokeThickness: 5 }).setOrigin(0.5);
    this.base.add([g, lb]);

    this.crown = s.add.container(CANNON.x, CANNON.y - 74).setDepth(24).setVisible(false);
    const cg = s.add.graphics();
    cg.fillStyle(C.yellow); cg.beginPath(); cg.moveTo(-30, 10); cg.lineTo(-30, -14); cg.lineTo(-15, 0); cg.lineTo(0, -20); cg.lineTo(15, 0); cg.lineTo(30, -14); cg.lineTo(30, 10); cg.closePath(); cg.fillPath();
    cg.lineStyle(4, ink); cg.strokePath();
    const ct = s.add.text(0, 24, '绝对正确', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffd400', stroke: INK, strokeThickness: 4 }).setOrigin(0.5);
    this.crown.add([cg, ct]);
    this.setAim(this.angle, 0);
  }

  setAim(a: number, p: number) {
    this.angle = a; this.power = p;
    this.barrel.setRotation(a);
    this.barrel.setScale(1 - p * 0.1, 1 + p * 0.08);
    this.glow.setFillStyle(C.yellow, p * 0.55).setRadius(18 + p * 16);
  }

  /** muzzle position for a given aim; the barrel squashes with power, so the preview and the shot share this */
  tipFor(a: number, p: number) {
    const len = 122 * (1 - p * 0.1);
    return { x: this.pivot.x + Math.cos(a) * len, y: this.pivot.y + Math.sin(a) * len };
  }
  tip() { return this.tipFor(this.angle, this.power); }

  recoil() {
    const dx = -Math.cos(this.angle) * 22, dy = -Math.sin(this.angle) * 22;
    this.s.tweens.killTweensOf(this.barrel);
    this.barrel.setPosition(this.pivot.x + dx, this.pivot.y + dy).setScale(1.18, 0.86);
    this.s.tweens.add({ targets: this.barrel, x: this.pivot.x, y: this.pivot.y, scaleX: 1, scaleY: 1, duration: 380, ease: 'Elastic.Out' });
    this.base.setScale(1.08, 0.9);
    this.s.tweens.add({ targets: this.base, scaleX: 1, scaleY: 1, duration: 360, ease: 'Elastic.Out' });
  }

  wiggle() {
    this.s.tweens.add({ targets: [this.base], angle: { from: -8, to: 0 }, duration: 420, ease: 'Elastic.Out' });
  }

  setCrown(on: boolean) {
    if (on === this.crown.visible) return;
    this.crown.setVisible(on);
    if (on) { this.crown.setScale(0); this.s.tweens.add({ targets: this.crown, scale: 1, duration: 500, ease: 'Back.Out' }); }
  }
}
