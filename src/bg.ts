import Phaser from 'phaser';
import { C, FLOOR_Y, FONT, H, INK, W } from './config';
import type { LevelDef } from './data/levels';

const NEON = (s: Phaser.Scene, x: number, y: number, text: string, size: number, color: string, rot = 0) => {
  const t = s.add.text(x, y, text, { fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color, stroke: '#ffffff', strokeThickness: 2 }).setOrigin(0.5).setRotation(rot).setDepth(2);
  t.setShadow(0, 0, color, 18, true, true);
  s.tweens.add({ targets: t, alpha: { from: 1, to: 0.55 }, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1800 + Math.random() * 2400 });
  return t;
};

export interface BgRefs { ranks?: Phaser.GameObjects.Text[]; votes?: Phaser.GameObjects.Graphics; spot?: Phaser.GameObjects.Graphics }

/* Each theme is a few dozen shapes: cheap to draw, but enough to give every level its own satire. */
export function drawBackground(s: Phaser.Scene, theme: LevelDef['theme']): BgRefs {
  const refs: BgRefs = {};
  const g = s.add.graphics().setDepth(0);
  const top: Record<string, number> = { factory: 0x2a1640, arena: 0x1a1240, mall: 0x3a1238, hq: 0x0d1430, show: 0x2a0b22, mirror: 0x07050d };
  const bot: Record<string, number> = { factory: 0x7a2a5a, arena: 0x5a1f6a, mall: 0x8a2a5a, hq: 0x1e2a5a, show: 0x6a1a3a, mirror: 0x1a1226 };
  g.fillGradientStyle(top[theme], top[theme], bot[theme], bot[theme], 1); g.fillRect(0, 0, W, H);
  s.add.tileSprite(W / 2, H / 2, W, H, 'dot').setTint(C.pink).setAlpha(theme === 'mirror' ? 0.03 : 0.07).setDepth(0);

  const d = s.add.graphics().setDepth(1);
  switch (theme) {
    case 'factory': {
      d.fillStyle(0x1b1029, 0.55);
      [[40, 520, 70, 600], [150, 640, 90, 480], [610, 700, 110, 420]].forEach(([x, y, w, h]) => d.fillRect(x, y, w, h));
      d.lineStyle(18, 0x4a3a6a, 0.8); d.beginPath(); d.moveTo(0, 300); d.lineTo(260, 300); d.lineTo(260, 120); d.lineTo(W, 120); d.strokePath();
      d.lineStyle(12, 0x5a4a7a, 0.8); d.lineBetween(0, 900, W, 900);
      for (const [x, y, sc] of [[120, 420, 1.6], [300, 210, 1.1], [660, 980, 1.3]] as const) {
        const gear = s.add.image(x, y, 'gear').setScale(sc).setAlpha(0.25).setDepth(1).setTint(0xb08ad0);
        s.tweens.add({ targets: gear, angle: 360, duration: 9000 / sc, repeat: -1 });
      }
      NEON(s, 200, 250, '口号 24H 生产中', 30, '#ff2e88', -0.05);
      NEON(s, 140, 760, '今日产量：∞', 22, '#ffd400');
      break;
    }
    case 'arena': {
      for (const x of [80, 640]) { d.fillStyle(C.yellow, 0.9); d.fillCircle(x, 170, 18); d.fillStyle(C.yellow, 0.08); d.fillTriangle(x, 170, x - 220, 900, x + 220, 900); }
      d.fillStyle(0x0d0820, 0.7); for (let i = 0; i < 30; i++) d.fillCircle(i * 26 + 6, 1000 + (i % 3) * 8, 18);
      const board = s.add.graphics().setDepth(2);
      board.fillStyle(0x0d0820, 0.85); board.fillRoundedRect(220, 175, 300, 150, 16); board.lineStyle(5, C.pink); board.strokeRoundedRect(220, 175, 300, 150, 16);
      s.add.text(370, 200, '热搜榜 TRENDING', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffd400' }).setOrigin(0.5).setDepth(3);
      refs.ranks = [0, 1, 2].map(i => s.add.text(240, 232 + i * 30, '', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: i === 0 ? '#ff2e88' : '#ffffff' }).setDepth(3));
      break;
    }
    case 'mall': {
      d.fillStyle(0xffffff, 0.06); for (let x = 20; x < W; x += 120) d.fillRect(x, 200, 90, 640);
      d.lineStyle(4, 0xffffff, 0.12); for (let y = 260; y < 860; y += 90) d.lineBetween(0, y, W, y);
      NEON(s, 360, 205, '双标百货 DOUBLE STANDARD', 30, '#ff2e88');
      NEON(s, 150, 300, '原则 5 折', 26, '#ffd400', -0.12);
      NEON(s, 600, 760, '立场 买一送一', 22, '#27e1e6', 0.08);
      break;
    }
    case 'hq': {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 8; c++) {
        const x = 24 + c * 90, y = 180 + r * 92;
        d.fillStyle(0x10162e, 0.9); d.fillRect(x, y, 78, 60); d.lineStyle(3, 0x2a3a6a); d.strokeRect(x, y, 78, 60);
        if (Math.random() < 0.7) { const sc = s.add.rectangle(x + 39, y + 30, 66, 48, Math.random() < 0.5 ? C.cyan : C.pink, 0.18).setDepth(1); s.tweens.add({ targets: sc, alpha: { from: 0.05, to: 0.3 }, duration: 300 + Math.random() * 900, yoyo: true, repeat: -1 }); }
      }
      NEON(s, 200, 1000, '键盘战争指挥部', 30, '#27e1e6', -0.03);
      break;
    }
    case 'show': {
      d.fillStyle(0xb0103a); d.fillRect(0, 160, 90, 980); d.fillRect(W - 90, 160, 90, 980);
      d.fillStyle(0x7a0a28); for (let x = 10; x < 90; x += 24) { d.fillRect(x, 160, 8, 980); d.fillRect(W - 90 + x, 160, 8, 980); }
      d.fillStyle(0xd4af37); d.fillRect(0, 150, W, 26);
      refs.spot = s.add.graphics().setDepth(1);
      d.fillStyle(0x0d0820, 0.85); for (let i = 0; i < 26; i++) d.fillCircle(i * 30 + 8, 1110 + (i % 2) * 10, 20);
      NEON(s, 360, 230, '真理选秀 · 第1024季', 30, '#ffd400');
      const v = s.add.graphics().setDepth(2); refs.votes = v;
      break;
    }
    case 'mirror': {
      refs.spot = s.add.graphics().setDepth(1);
      refs.spot.fillStyle(0xffffff, 0.06); refs.spot.fillTriangle(520, 120, 280, 1120, 760, 1120);
      break;
    }
  }
  // floor
  const f = s.add.graphics().setDepth(5);
  f.fillStyle(theme === 'mirror' ? 0x110b1c : 0x1b1029); f.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  f.fillStyle(C.pink); f.fillRect(0, FLOOR_Y, W, 6);
  if (theme === 'factory') { const hz = s.add.tileSprite(W / 2, FLOOR_Y + 22, W, 32, 'hazard').setDepth(5).setAlpha(0.85); hz.setTint(0xffffff); }
  f.fillStyle(0xffffff, 0.04); for (let x = 0; x < W; x += 60) f.fillRect(x, FLOOR_Y + 40, 30, H);
  return refs;
}
