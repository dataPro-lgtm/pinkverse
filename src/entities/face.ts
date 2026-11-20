import Phaser from 'phaser';
import { C } from '../config';

export type Expr = 'idle' | 'shout' | 'smug' | 'hit' | 'shock' | 'think' | 'shy' | 'frozen' | 'happy' | 'sad' | 'sleepy';

export interface FaceOpts { x: number; y: number; eyeR: number; sep: number; mouthY: number; mouthW: number; skin: number; noMouth?: boolean }

/* A redrawable cartoon face: expressions are what sells the comedy. */
export class Face {
  g: Phaser.GameObjects.Graphics;
  expr: Expr = 'idle';
  lx = 0; ly = 0; blinking = false;
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, public o: FaceOpts) {
    this.g = scene.add.graphics();
    parent.add(this.g);
    this.draw();
  }
  set(e: Expr) { if (e !== this.expr) { this.expr = e; this.draw(); } }
  look(x: number, y: number) {
    const nx = Phaser.Math.Clamp(x, -1, 1), ny = Phaser.Math.Clamp(y, -1, 1);
    if (Math.abs(nx - this.lx) + Math.abs(ny - this.ly) < 0.08) return;
    this.lx = nx; this.ly = ny; this.draw();
  }
  blink(on: boolean) { if (on !== this.blinking) { this.blinking = on; this.draw(); } }

  draw() {
    const g = this.g, o = this.o, e = this.expr, ink = C.ink;
    g.clear();
    const r = o.eyeR, ey = o.y, cx = o.x;
    const xs = [cx - o.sep, cx + o.sep];
    const lw = Math.max(2, r * 0.36);
    g.lineStyle(lw, ink, 1);

    if (e === 'hit') {
      xs.forEach((x, k) => { const d = k === 0 ? 1 : -1; g.beginPath(); g.moveTo(x - r * 0.8 * d, ey - r * 0.75); g.lineTo(x + r * 0.6 * d, ey); g.lineTo(x - r * 0.8 * d, ey + r * 0.75); g.strokePath(); });
    } else if (e === 'happy' || e === 'sleepy') {
      xs.forEach(x => { g.beginPath(); if (e === 'happy') g.arc(x, ey + r * 0.35, r * 0.8, Math.PI * 1.15, Math.PI * 1.85, false); else g.arc(x, ey - r * 0.2, r * 0.75, Math.PI * 0.15, Math.PI * 0.85, false); g.strokePath(); });
    } else if (e === 'frozen') {
      xs.forEach(x => g.lineBetween(x - r * 0.8, ey, x + r * 0.8, ey));
    } else {
      xs.forEach((x, k) => {
        g.fillStyle(0xffffff); g.fillEllipse(x, ey, r * 2, r * 2.3); g.strokeEllipse(x, ey, r * 2, r * 2.3);
        let px = this.lx * r * 0.38, py = this.ly * r * 0.38, pr = r * 0.5;
        if (e === 'shock') pr = r * 0.26;
        if (e === 'think') { px = r * 0.25; py = -r * 0.55; }
        if (e === 'shy' || e === 'sad') { px = -r * 0.2; py = r * 0.5; }
        if (this.blinking) { g.lineBetween(x - r * 0.8, ey, x + r * 0.8, ey); }
        else { g.fillStyle(ink); g.fillCircle(x + px, ey + py, pr); g.fillStyle(0xffffff); g.fillCircle(x + px - pr * 0.35, ey + py - pr * 0.35, pr * 0.32); }
        if (e === 'smug') {
          g.fillStyle(o.skin); g.fillRect(x - r * 1.05, ey - r * 1.25, r * 2.1, r * 1.1);
          g.lineBetween(x - r, ey - r * 0.12, x + r, ey - r * 0.12);
        }
        if (e === 'sad') { g.fillStyle(0x9be7ff); g.fillEllipse(x + r * 0.2, ey + r * 1.5, r * 0.5, r * 0.9); }
      });
    }

    // brows
    const by = ey - r * 1.6, bw = r * 1.05;
    g.lineStyle(lw * 1.1, ink, 1);
    xs.forEach((x, k) => {
      const inner = k === 0 ? 1 : -1;
      let yo = 0, yi = 0;
      switch (e) {
        case 'shout': yo = -4; yi = 5; break;
        case 'shock': yo = -6; yi = -6; break;
        case 'think': if (k === 0) { yo = -7; yi = -5; } break;
        case 'shy': case 'sad': yo = 3; yi = -5; break;
        case 'smug': if (k === 1) { yo = -5; yi = 2; } else { yo = -2; yi = -2; } break;
        case 'hit': yo = -2; yi = 4; break;
      }
      g.lineBetween(x - bw * 0.7 * inner, by + yo, x + bw * 0.6 * inner, by + yi);
    });

    if (!o.noMouth) {
      const my = o.mouthY, mw = o.mouthW;
      g.lineStyle(lw, ink, 1);
      switch (e) {
        case 'shout':
          g.fillStyle(0x7a1036); g.fillEllipse(cx, my + mw * 0.12, mw * 1.05, mw * 0.85); g.strokeEllipse(cx, my + mw * 0.12, mw * 1.05, mw * 0.85);
          g.fillStyle(0xff7aa8); g.fillEllipse(cx, my + mw * 0.36, mw * 0.55, mw * 0.25); break;
        case 'shock':
          g.fillStyle(0x7a1036); g.fillEllipse(cx, my + 3, mw * 0.42, mw * 0.55); g.strokeEllipse(cx, my + 3, mw * 0.42, mw * 0.55); break;
        case 'happy':
          g.fillStyle(0x7a1036); g.beginPath(); g.moveTo(cx - mw / 2, my); g.arc(cx, my, mw / 2, Math.PI, 0, true); g.closePath(); g.fillPath(); g.strokePath(); break;
        case 'smug':
          g.beginPath(); g.moveTo(cx - mw * 0.45, my + 2); g.lineTo(cx + mw * 0.1, my + 5); g.lineTo(cx + mw * 0.5, my - 7); g.strokePath(); break;
        case 'hit': case 'shy': {
          g.beginPath(); const n = 5; for (let i = 0; i <= n; i++) { const x = cx - mw * 0.45 + (mw * 0.9 * i) / n; const y = my + (i % 2 ? -4 : 3); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokePath(); break;
        }
        case 'think': g.lineBetween(cx - mw * 0.1, my + 2, cx + mw * 0.3, my); break;
        case 'frozen':
          g.lineBetween(cx - mw / 2, my, cx + mw / 2, my);
          for (let i = 0; i < 6; i++) { const x = cx - mw / 2 + 4 + i * (mw - 8) / 5; g.lineBetween(x, my - 4, x, my + 4); } break;
        case 'sad': case 'sleepy':
          g.beginPath(); g.arc(cx, my + mw * 0.35, mw * 0.32, Math.PI * 1.2, Math.PI * 1.8, false); g.strokePath(); break;
        default:
          g.beginPath(); g.arc(cx, my - mw * 0.25, mw * 0.42, Math.PI * 0.2, Math.PI * 0.8, false); g.strokePath();
      }
    }
    if (e === 'shy' || e === 'happy') { g.fillStyle(C.pink, 0.45); xs.forEach(x => g.fillEllipse(x + (x < cx ? -r * 0.4 : r * 0.4), ey + r * 1.5, r * 1.3, r * 0.6)); }
    if (e === 'shy' || e === 'shock') { g.fillStyle(0x9be7ff); g.fillEllipse(xs[1] + r * 1.7, ey - r * 0.6, r * 0.55, r * 0.9); }
  }
}
