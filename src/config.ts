export const W = 720;
export const H = 1280;
export const FLOOR_Y = 1140;
export const CANNON = { x: 104, y: 1070 };
export const GRAVITY_Y = 1.5;
/** Matter adds gravity * 0.001 * delta^2 per fixed step; the aim preview integrates the same way. */
export const G_STEP = GRAVITY_Y * 0.001 * (1000 / 60) * (1000 / 60);
export const SPEED_MIN = 7;
export const SPEED_MAX = 26;

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';

export const C = {
  pink: 0xff2e88,
  pinkD: 0xc2185b,
  pinkL: 0xffb3d4,
  yellow: 0xffd400,
  ink: 0x1b1029,
  cyan: 0x27e1e6,
  cream: 0xfff3df,
  purple: 0x3a1c5c,
  violet: 0x9b5cff,
  white: 0xffffff,
  red: 0xff4d4d,
  green: 0x3ddc84,
  skin: 0xffd7b8,
  navy: 0x24305e,
};
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const INK = '#1b1029';
