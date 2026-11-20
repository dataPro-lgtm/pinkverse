import Phaser from 'phaser';
import { C } from './config';

/* Every sprite is drawn at boot with Graphics; there are no image files to license or lose. */
export function makeTextures(s: Phaser.Scene) {
  const g = s.make.graphics({ x: 0, y: 0 }, false);
  const done = (key: string, w: number, h: number) => { g.generateTexture(key, w, h); g.clear(); };
  const ink = C.ink;

  // soft spark
  for (let r = 16; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.08 + (16 - r) * 0.05); g.fillCircle(16, 16, r); }
  done('spark', 32, 32);
  g.fillStyle(0xffffff); g.fillRect(0, 0, 8, 8); done('px', 8, 8);
  g.fillStyle(0xffffff); g.fillTriangle(0, 16, 8, 0, 18, 14); done('shard', 18, 16);
  // star
  g.fillStyle(0xffffff); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 6.5 : 15; const x = 16 + Math.cos(a) * r, y = 16 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fillPath(); done('star', 32, 32);
  // heart
  g.fillStyle(0xffffff); g.fillCircle(10, 11, 8); g.fillCircle(22, 11, 8); g.fillTriangle(3, 14, 29, 14, 16, 29); done('heart', 32, 32);
  // thumbs-up "like"
  g.fillStyle(0xffffff); g.fillRoundedRect(4, 13, 7, 15, 2); g.fillRoundedRect(12, 12, 15, 16, 4); g.fillRoundedRect(14, 3, 7, 13, 3); done('like', 32, 32);
  // coin
  g.fillStyle(C.yellow); g.fillCircle(14, 14, 13); g.lineStyle(3, ink); g.strokeCircle(14, 14, 12); g.lineStyle(3, 0xc79a00); g.strokeCircle(14, 14, 7); done('coin', 28, 28);
  // coupon
  g.fillStyle(C.pink); g.fillRoundedRect(0, 0, 44, 24, 4); g.fillStyle(0xffffff); g.fillCircle(0, 12, 5); g.fillCircle(44, 12, 5);
  g.lineStyle(2, 0xffffff); for (let y = 3; y < 22; y += 5) g.lineBetween(30, y, 30, y + 2); done('coupon', 44, 24);
  // question mark glyph
  const q = (cx: number, cy: number, sz: number, col: number) => {
    g.lineStyle(sz * 0.2, col); g.beginPath(); g.arc(cx, cy - sz * 0.18, sz * 0.26, Math.PI * 1.05, Math.PI * 2.35, false); g.strokePath();
    g.lineBetween(cx + sz * 0.02, cy + sz * 0.06, cx, cy + sz * 0.2);
    g.fillStyle(col); g.fillCircle(cx, cy + sz * 0.38, sz * 0.1);
  };
  q(16, 16, 30, 0xffffff); done('qm', 32, 32);
  // halftone dot
  g.fillStyle(0xffffff); g.fillCircle(4, 4, 2.2); done('dot', 8, 8);

  /* ---------- ammo ---------- */
  // fact-check: white ball with red stamp ring
  g.fillStyle(0xffffff); g.fillCircle(24, 24, 22); g.lineStyle(4, ink); g.strokeCircle(24, 24, 21);
  g.lineStyle(4, C.red); g.strokeCircle(24, 24, 13); g.lineBetween(14, 32, 34, 16); done('am_fact', 48, 48);
  // boomerang
  g.fillStyle(C.yellow); g.lineStyle(4, ink);
  g.beginPath(); g.moveTo(6, 30); g.lineTo(22, 6); g.lineTo(42, 30); g.lineTo(34, 34); g.lineTo(22, 18); g.lineTo(14, 34); g.closePath(); g.fillPath(); g.strokePath();
  done('am_boom', 48, 40);
  // question ball
  g.fillStyle(C.pink); g.fillCircle(20, 20, 18); g.lineStyle(4, ink); g.strokeCircle(20, 20, 17); q(20, 21, 26, 0xffffff); done('am_q', 40, 40);
  g.fillStyle(C.pink); g.fillCircle(14, 14, 12); g.lineStyle(3, ink); g.strokeCircle(14, 14, 11); q(14, 15, 18, 0xffffff); done('am_qs', 28, 28);
  // traffic bubble
  g.fillStyle(C.cyan, 0.35); g.fillCircle(24, 24, 22); g.lineStyle(3, 0xffffff, 0.95); g.strokeCircle(24, 24, 21);
  g.fillStyle(0xffffff, 0.9); g.fillEllipse(16, 14, 10, 6);
  g.fillStyle(C.pink); g.fillCircle(21, 26, 5); g.fillCircle(29, 26, 5); g.fillTriangle(16, 28, 34, 28, 25, 37); done('am_bubble', 48, 48);
  // rubber duck
  g.lineStyle(4, ink); g.fillStyle(0xffe14d);
  g.fillEllipse(28, 34, 44, 28); g.strokeEllipse(28, 34, 44, 28);
  g.fillCircle(36, 17, 12); g.strokeCircle(36, 17, 12);
  g.fillStyle(0xff8a00); g.fillTriangle(46, 15, 58, 19, 46, 23);
  g.fillStyle(ink); g.fillCircle(39, 14, 2.6);
  done('am_duck', 60, 50);
  // doubt
  g.fillStyle(C.violet); g.fillCircle(24, 24, 22); g.lineStyle(4, ink); g.strokeCircle(24, 24, 21);
  g.lineStyle(3, 0xffffff, 0.8); g.beginPath(); g.arc(24, 24, 13, 0, Math.PI * 1.5, false); g.strokePath();
  g.beginPath(); g.arc(24, 24, 7, Math.PI, Math.PI * 2.6, false); g.strokePath(); done('am_doubt', 48, 48);

  /* ---------- props ---------- */
  // crate
  g.fillStyle(0xc98a4b); g.fillRect(0, 0, 64, 64); g.lineStyle(5, ink); g.strokeRect(2, 2, 60, 60);
  g.lineStyle(4, 0x8a5a2b); g.lineBetween(8, 8, 56, 56); g.lineBetween(56, 8, 8, 56); g.strokeRect(8, 8, 48, 48); done('crate', 64, 64);
  // hazard tile
  g.fillStyle(C.yellow); g.fillRect(0, 0, 64, 32); g.fillStyle(ink);
  for (let x = -32; x < 64; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.closePath(); g.fillPath(); }
  done('hazard', 64, 32);
  // steel tile
  g.fillStyle(0x5b5f7a); g.fillRect(0, 0, 64, 32); g.fillStyle(0x7d82a3); g.fillRect(0, 0, 64, 6);
  g.fillStyle(0x3b3e55); for (const x of [8, 40]) g.fillCircle(x, 18, 3); done('steel', 64, 32);
  // conveyor tile
  g.fillStyle(0x2a2a3a); g.fillRect(0, 0, 32, 24); g.fillStyle(C.yellow); g.fillRect(0, 2, 32, 4); g.fillStyle(0x50506a); g.fillRect(12, 8, 8, 14); done('belt', 32, 24);
  // monitor
  g.fillStyle(0x23233a); g.fillRoundedRect(0, 0, 60, 46, 6); g.lineStyle(4, ink); g.strokeRoundedRect(2, 2, 56, 42, 6);
  g.fillStyle(C.cyan); g.fillRect(8, 8, 44, 28); g.fillStyle(0xffffff, 0.5); g.fillRect(12, 12, 20, 4); g.fillRect(12, 20, 30, 4); g.fillRect(12, 28, 16, 4); done('monitor', 60, 46);
  // product box
  g.fillStyle(0xf7c8dd); g.fillRect(0, 0, 50, 50); g.lineStyle(4, ink); g.strokeRect(2, 2, 46, 46);
  g.fillStyle(C.pink); g.fillRect(2, 18, 46, 14); g.fillStyle(0xffffff); g.fillRect(8, 22, 34, 6); done('product', 50, 50);
  // gear
  g.fillStyle(0x8f93b3); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.fillRect(32 + Math.cos(a) * 24 - 5, 32 + Math.sin(a) * 24 - 5, 10, 10); }
  g.fillCircle(32, 32, 22); g.fillStyle(0x3b3e55); g.fillCircle(32, 32, 8); done('gear', 64, 64);
  g.destroy();
}
