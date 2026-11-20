import Phaser from 'phaser';
import { C, FONT, INK } from '../config';
import { Face } from './face';

type S = Phaser.Scene;
type Ct = Phaser.GameObjects.Container;
export interface Art { face: Face; top: number; parts: Record<string, any> }

const ink = C.ink;
const gfx = (s: S, ct: Ct) => { const g = s.add.graphics(); ct.add(g); return g; };
const label = (s: S, ct: Ct, x: number, y: number, t: string, size: number, color = INK) => {
  const tx = s.add.text(x, y, t, { fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold' }).setOrigin(0.5);
  ct.add(tx); return tx;
};

/* 口号复读机: a megaphone for a head */
export function repeater(s: S, ct: Ct): Art {
  const g = gfx(s, ct);
  g.fillStyle(ink); g.fillRoundedRect(-20, 40, 12, 16, 3); g.fillRoundedRect(8, 40, 12, 16, 3);
  g.fillStyle(C.pink); g.fillRoundedRect(-28, -6, 56, 50, 14); g.lineStyle(4, ink); g.strokeRoundedRect(-28, -6, 56, 50, 14);
  g.lineStyle(3, 0xffffff); g.lineBetween(0, -2, 0, 40);
  g.fillStyle(C.yellow); g.fillCircle(-14, 12, 6); g.lineStyle(2, ink); g.strokeCircle(-14, 12, 6);
  const arm = gfx(s, ct);
  arm.fillStyle(C.pink); arm.fillRoundedRect(18, -24, 12, 30, 6); arm.lineStyle(3, ink); arm.strokeRoundedRect(18, -24, 12, 30, 6);
  arm.fillStyle(C.skin); arm.fillCircle(24, -26, 7); arm.strokeCircle(24, -26, 7);
  const horn = gfx(s, ct);
  horn.fillStyle(0xf2f2f7); horn.lineStyle(4, ink);
  horn.beginPath(); horn.moveTo(26, -58); horn.lineTo(26, -30); horn.lineTo(-34, -12); horn.lineTo(-34, -78); horn.closePath(); horn.fillPath(); horn.strokePath();
  horn.fillStyle(C.yellow); horn.beginPath(); horn.moveTo(26, -58); horn.lineTo(26, -30); horn.lineTo(14, -27); horn.lineTo(14, -61); horn.closePath(); horn.fillPath();
  horn.lineStyle(4, ink); horn.strokePath();
  const mouth = s.add.graphics({ x: -34, y: -45 }); ct.add(mouth);
  mouth.fillStyle(0x2a1030); mouth.fillEllipse(0, 0, 18, 62); mouth.lineStyle(4, ink); mouth.strokeEllipse(0, 0, 18, 62);
  const face = new Face(s, ct, { x: 0, y: -48, eyeR: 6.5, sep: 9, mouthY: 0, mouthW: 0, skin: 0xf2f2f7, noMouth: true });
  return { face, top: -80, parts: { mouth, arm } };
}

/* 双标变色龙 */
export function chameleon(s: S, ct: Ct): Art {
  const body = gfx(s, ct);
  const stick = gfx(s, ct);
  stick.lineStyle(5, ink); stick.lineBetween(-30, 6, -38, -56);
  stick.fillStyle(0xffffff); stick.fillRoundedRect(-84, -86, 64, 30, 6); stick.lineStyle(4, ink); stick.strokeRoundedRect(-84, -86, 64, 30, 6);
  const sign = label(s, ct, -52, -71, '支持！', 17);
  const face = new Face(s, ct, { x: 0, y: -36, eyeR: 9, sep: 15, mouthY: -10, mouthW: 26, skin: C.green });
  const draw = (col: number) => {
    body.clear();
    body.lineStyle(7, col); body.beginPath(); body.arc(36, 30, 12, Math.PI * 0.6, Math.PI * 2.4, false); body.strokePath();
    body.lineStyle(4, ink);
    body.fillStyle(col); body.fillRoundedRect(-18, 38, 10, 12, 3); body.fillRoundedRect(8, 38, 10, 12, 3);
    body.fillEllipse(0, 14, 74, 64); body.strokeEllipse(0, 14, 74, 64);
    body.fillStyle(0xffffff, 0.35); body.fillEllipse(4, 22, 40, 34);
    body.fillStyle(col); body.fillCircle(0, -16, 27); body.strokeCircle(0, -16, 27);
    body.fillCircle(-15, -36, 14); body.strokeCircle(-15, -36, 14); body.fillCircle(15, -36, 14); body.strokeCircle(15, -36, 14);
    face.o.skin = col; face.draw();
  };
  draw(C.green);
  return { face, top: -92, parts: { draw, sign } };
}

/* 热搜投机商 surfing a trend line */
export function speculator(s: S, ct: Ct): Art {
  const board = gfx(s, ct);
  const drawBoard = (up: boolean) => {
    board.clear();
    board.fillStyle(C.yellow); board.fillEllipse(0, 66, 136, 18); board.lineStyle(4, ink); board.strokeEllipse(0, 66, 136, 18);
    board.lineStyle(5, up ? C.green : C.red); board.beginPath();
    const pts = up ? [[-52, 70], [-26, 64], [-8, 68], [14, 60], [44, 56]] : [[-52, 58], [-26, 62], [-8, 60], [14, 68], [44, 72]];
    pts.forEach((p, i) => i ? board.lineTo(p[0], p[1]) : board.moveTo(p[0], p[1])); board.strokePath();
  };
  drawBoard(true);
  const g = gfx(s, ct);
  g.fillStyle(C.navy); g.fillRoundedRect(-17, 38, 13, 20, 3); g.fillRoundedRect(4, 38, 13, 20, 3);
  g.fillRoundedRect(-30, -10, 60, 52, 10); g.lineStyle(4, ink); g.strokeRoundedRect(-30, -10, 60, 52, 10);
  g.fillStyle(0xffffff); g.fillTriangle(-11, -10, 11, -10, 0, 14);
  g.fillStyle(C.pink); g.fillTriangle(-4, -6, 4, -6, 0, 22);
  g.lineStyle(3, C.yellow); g.beginPath(); g.arc(0, -8, 16, Math.PI * 0.15, Math.PI * 0.85, false); g.strokePath();
  g.fillStyle(C.skin); g.fillCircle(0, -34, 25); g.lineStyle(4, ink); g.strokeCircle(0, -34, 25);
  g.fillStyle(ink); g.beginPath(); g.moveTo(-26, -40); g.lineTo(-22, -60); g.lineTo(10, -64); g.lineTo(28, -50); g.lineTo(26, -38); g.lineTo(6, -52); g.closePath(); g.fillPath();
  g.fillStyle(0x111111); g.fillEllipse(-9, -55, 14, 8); g.fillEllipse(9, -55, 14, 8);
  const face = new Face(s, ct, { x: 0, y: -36, eyeR: 6.5, sep: 10, mouthY: -20, mouthW: 18, skin: C.skin });
  return { face, top: -70, parts: { drawBoard } };
}

/* 键盘大将军 on a gaming throne */
export function general(s: S, ct: Ct): Art {
  const mon = gfx(s, ct);
  [[-62, -92], [-20, -100], [22, -92]].forEach(([x, y]) => { mon.fillStyle(0x23233a); mon.fillRect(x, y, 40, 30); mon.fillStyle(C.cyan, 0.8); mon.fillRect(x + 4, y + 4, 32, 22); mon.lineStyle(3, ink); mon.strokeRect(x, y, 40, 30); });
  const chair = gfx(s, ct);
  chair.fillStyle(0xd7263d); chair.fillRoundedRect(-46, -66, 92, 100, 18); chair.lineStyle(4, ink); chair.strokeRoundedRect(-46, -66, 92, 100, 18);
  chair.fillStyle(ink); chair.fillRect(-10, -66, 20, 100);
  chair.lineStyle(5, ink); chair.lineBetween(0, 34, 0, 56); chair.lineBetween(-26, 60, 26, 60);
  chair.fillStyle(ink); chair.fillCircle(-26, 61, 5); chair.fillCircle(26, 61, 5);
  const g = gfx(s, ct);
  g.fillStyle(0x6b7a3a); g.fillEllipse(0, 10, 86, 62); g.lineStyle(4, ink); g.strokeEllipse(0, 10, 86, 62);
  g.fillStyle(C.yellow); g.fillCircle(-18, 6, 5); g.fillCircle(-6, 8, 5); g.fillStyle(C.red); g.fillCircle(-12, 18, 5);
  g.fillStyle(C.skin); g.fillCircle(0, -30, 28); g.lineStyle(4, ink); g.strokeCircle(0, -30, 28);
  g.fillStyle(C.navy); g.fillRoundedRect(-30, -66, 60, 22, 8); g.strokeRoundedRect(-30, -66, 60, 22, 8);
  g.fillStyle(ink); g.fillRect(-34, -48, 68, 6);
  g.fillStyle(C.yellow); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 3.5 : 8; const x = Math.cos(a) * r, y = -56 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fillPath();
  g.lineStyle(5, ink); g.beginPath(); g.arc(0, -36, 32, Math.PI * 1.05, Math.PI * 1.95, false); g.strokePath();
  g.fillStyle(ink); g.fillRoundedRect(-36, -40, 9, 18, 3); g.fillRoundedRect(27, -40, 9, 18, 3);
  g.lineStyle(3, ink); g.lineBetween(-32, -24, -14, -14); g.fillCircle(-12, -14, 3);
  const kb = gfx(s, ct);
  kb.fillStyle(0x1f1f2e); kb.fillRoundedRect(-52, 30, 104, 18, 4); kb.lineStyle(3, ink); kb.strokeRoundedRect(-52, 30, 104, 18, 4);
  kb.fillStyle(C.pink); for (let i = 0; i < 9; i++) kb.fillRect(-46 + i * 11, 35, 7, 4);
  kb.fillStyle(C.cyan); for (let i = 0; i < 8; i++) kb.fillRect(-41 + i * 11, 41, 7, 3);
  const face = new Face(s, ct, { x: 0, y: -30, eyeR: 7, sep: 11, mouthY: -12, mouthW: 20, skin: C.skin });
  return { face, top: -104, parts: { chair, mon } };
}

/* 爱国带货王: a glam livestream seller */
export function seller(s: S, ct: Ct): Art {
  const ring = gfx(s, ct);
  ring.lineStyle(10, 0xffffff, 0.25); ring.strokeCircle(0, -40, 46); ring.lineStyle(5, 0xffffff, 0.95); ring.strokeCircle(0, -40, 46);
  const g = gfx(s, ct);
  g.fillStyle(0xb44cff); [[-22, -50, 16], [22, -50, 16], [-14, -68, 16], [14, -68, 16], [0, -74, 16], [-26, -32, 12], [26, -32, 12]].forEach(a => g.fillCircle(a[0], a[1], a[2]));
  g.fillStyle(ink); g.fillRoundedRect(-17, 38, 12, 20, 3); g.fillRoundedRect(5, 38, 12, 20, 3);
  g.fillStyle(0xffc400); g.beginPath(); g.moveTo(-22, -10); g.lineTo(22, -10); g.lineTo(32, 42); g.lineTo(-32, 42); g.closePath(); g.fillPath();
  g.lineStyle(4, ink); g.strokePath();
  g.fillStyle(0xffffff); for (let i = 0; i < 12; i++) g.fillCircle(-24 + Math.random() * 48, -2 + Math.random() * 40, 1.6);
  g.fillStyle(C.red); g.beginPath(); g.moveTo(-24, -4); g.lineTo(-14, -10); g.lineTo(28, 30); g.lineTo(20, 38); g.closePath(); g.fillPath();
  g.fillStyle(C.skin); g.fillCircle(0, -36, 23); g.lineStyle(4, ink); g.strokeCircle(0, -36, 23);
  g.fillStyle(C.pink); g.fillRoundedRect(-22, -62, 18, 9, 4); g.fillRoundedRect(4, -62, 18, 9, 4); g.lineStyle(2, ink); g.lineBetween(-4, -58, 4, -58);
  const sash = label(s, ct, 4, 14, '抵制', 13, '#ffffff'); sash.setRotation(0.78);
  const stick = gfx(s, ct);
  stick.lineStyle(4, 0x888888); stick.lineBetween(-20, 0, -52, -66);
  stick.fillStyle(ink); stick.fillRoundedRect(-64, -92, 22, 34, 4); stick.fillStyle(C.pink); stick.fillRect(-61, -88, 16, 26);
  const cart = gfx(s, ct);
  cart.lineStyle(3, ink); cart.fillStyle(0xffffff); cart.fillRoundedRect(26, -4, 24, 16, 3); cart.strokeRoundedRect(26, -4, 24, 16, 3);
  cart.lineBetween(20, -10, 26, -4); cart.fillStyle(ink); cart.fillCircle(31, 16, 3); cart.fillCircle(45, 16, 3);
  cart.setVisible(false);
  const face = new Face(s, ct, { x: 0, y: -36, eyeR: 6.5, sep: 10, mouthY: -20, mouthW: 17, skin: C.skin });
  return { face, top: -96, parts: { ring, cart, stick } };
}

/* 绝对正确先生 (also used, tinted, as the mirror boss) */
export function right(s: S, ct: Ct, mirror = false): Art {
  const suit = mirror ? C.pink : 0xf4f4f8;
  const g = gfx(s, ct);
  g.fillStyle(suit); g.fillRoundedRect(-18, 46, 14, 28, 3); g.fillRoundedRect(4, 46, 14, 28, 3);
  g.lineStyle(4, ink); g.strokeRoundedRect(-18, 46, 14, 28, 3); g.strokeRoundedRect(4, 46, 14, 28, 3);
  g.fillStyle(suit); g.fillRoundedRect(-32, -16, 64, 66, 14); g.strokeRoundedRect(-32, -16, 64, 66, 14);
  g.fillStyle(ink); g.fillTriangle(-10, -16, 10, -16, 0, 10);
  g.fillStyle(C.yellow); g.fillCircle(-16, 12, 11); g.lineStyle(3, ink); g.strokeCircle(-16, 12, 11);
  label(s, ct, -16, 12, '100%', 8);
  g.lineStyle(4, 0x8a5a2b); g.lineBetween(30, 6, 54, -40);
  g.fillStyle(C.skin); g.fillCircle(0, -48, 36); g.lineStyle(4, ink); g.strokeCircle(0, -48, 36);
  g.fillStyle(ink); g.fillEllipse(0, -82, 64, 18);
  g.lineStyle(4, ink); g.beginPath(); g.arc(8, -92, 9, Math.PI * 0.9, Math.PI * 2.4, false); g.strokePath();
  if (mirror) {
    g.fillStyle(C.yellow); g.fillRoundedRect(-14, -118, 46, 22, 8); g.lineStyle(4, ink); g.strokeRoundedRect(-14, -118, 46, 22, 8);
    g.fillStyle(ink); g.fillRect(26, -114, 8, 14);
  }
  const face = new Face(s, ct, { x: 0, y: -50, eyeR: 8, sep: 13, mouthY: -26, mouthW: 24, skin: C.skin });
  face.set('smug');
  return { face, top: mirror ? -122 : -100, parts: {} };
}

/* anonymous sock-puppet account */
export function clone(s: S, ct: Ct): Art {
  const g = gfx(s, ct);
  g.fillStyle(0xb9bcc9); g.fillEllipse(0, 4, 42, 46); g.lineStyle(3, ink); g.strokeEllipse(0, 4, 42, 46);
  g.fillStyle(0xe6e7ee); g.fillCircle(0, -4, 9); g.beginPath(); g.arc(0, 18, 13, Math.PI, 0, false); g.fillPath();
  const face = new Face(s, ct, { x: 0, y: -4, eyeR: 3, sep: 4, mouthY: 4, mouthW: 7, skin: 0xe6e7ee });
  return { face, top: -22, parts: {} };
}

/* the traffic god: a giant smiling like-button */
export function likegod(s: S, ct: Ct): Art {
  const g = gfx(s, ct);
  g.fillStyle(C.cyan); g.fillRoundedRect(-82, -78, 164, 156, 34); g.lineStyle(7, C.pink); g.strokeRoundedRect(-82, -78, 164, 156, 34);
  g.lineStyle(4, ink); g.strokeRoundedRect(-86, -82, 172, 164, 38);
  g.fillStyle(0xffffff); g.fillRoundedRect(18, 22, 16, 40, 4); g.fillRoundedRect(36, 18, 34, 46, 8); g.fillRoundedRect(40, -6, 16, 30, 6);
  g.fillStyle(C.yellow); g.beginPath(); g.moveTo(-50, -80); g.lineTo(-34, -112); g.lineTo(-16, -88); g.lineTo(0, -118); g.lineTo(16, -88); g.lineTo(34, -112); g.lineTo(50, -80); g.closePath(); g.fillPath();
  g.lineStyle(4, ink); g.strokePath();
  const face = new Face(s, ct, { x: -16, y: -20, eyeR: 14, sep: 24, mouthY: 26, mouthW: 42, skin: C.cyan });
  face.set('happy');
  return { face, top: -120, parts: {} };
}

/* the ordinary person behind the keyboard */
export function pajama(s: S, ct: Ct): Face {
  const g = gfx(s, ct);
  g.fillStyle(0xbfd7ff); g.fillRoundedRect(-20, -8, 40, 52, 10); g.lineStyle(3, ink); g.strokeRoundedRect(-20, -8, 40, 52, 10);
  g.lineStyle(3, 0x5a7bd8); for (let y = -2; y < 42; y += 9) g.lineBetween(-18, y, 18, y);
  g.fillStyle(C.skin); g.fillCircle(0, -24, 17); g.lineStyle(3, ink); g.strokeCircle(0, -24, 17);
  g.fillStyle(0x5a7bd8); g.beginPath(); g.moveTo(-18, -30); g.lineTo(14, -44); g.lineTo(30, -24); g.lineTo(18, -34); g.closePath(); g.fillPath(); g.fillStyle(0xffffff); g.fillCircle(30, -24, 5);
  g.fillStyle(C.red); g.fillCircle(24, 12, 9); g.lineStyle(2, ink); g.strokeCircle(24, 12, 9); g.lineBetween(24, 12, 24, 6); g.lineBetween(24, 12, 28, 12);
  const f = new Face(s, ct, { x: 0, y: -24, eyeR: 4, sep: 6, mouthY: -14, mouthW: 9, skin: C.skin });
  f.set('sleepy');
  return f;
}
