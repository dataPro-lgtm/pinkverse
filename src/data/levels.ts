import type { AmmoId } from '../state';
import type { MusicMode } from '../audio';

export type PropDef =
  | { t: 'platform'; x: number; y: number; w: number; h: number; style?: 'hazard' | 'shelf' | 'stage' | 'marble' | 'steel' }
  | { t: 'crate'; x: number; y: number; s?: number }
  | { t: 'board'; x: number; y: number; w: number; h: number; text?: string }
  | { t: 'plank'; x: number; y: number; w: number; h?: number; a?: number }
  | { t: 'monitor'; x: number; y: number }
  | { t: 'product'; x: number; y: number }
  | { t: 'bumper'; x: number; y: number; r: number }
  | { t: 'switch'; x: number; y: number; target: string }
  | { t: 'gate'; id: string; x: number; y: number; w: number; h: number }
  | { t: 'conveyor'; x: number; y: number; w: number; speed: number; spawn?: number }
  | { t: 'danmaku'; x: number; y: number; cols: number; rows: number }
  | { t: 'machine'; x: number; y: number }
  | { t: 'extreme'; x: number; y: number }
  | { t: 'pboss'; x: number; y: number }
  | { t: 'rules'; x: number; y: number; i: number }
  | { t: 'mirror'; x: number; y: number; w: number; h: number }
  | { t: 'trophy'; x: number; y: number; anchorY: number };

export type EnemyKindDef = 'repeater' | 'chameleon' | 'speculator' | 'general' | 'seller' | 'right';
export interface EnemyDef { k: EnemyKindDef; x: number; y: number; move?: { x0: number; x1: number; period: number } }

export interface LevelDef {
  id: number;
  title: string;
  sub: string;
  theme: 'factory' | 'arena' | 'mall' | 'hq' | 'show' | 'mirror';
  music: MusicMode;
  ammo: Partial<Record<AmmoId, number>>;
  props: PropDef[];
  enemies: EnemyDef[];
  timer?: number;
  unlock?: AmmoId;
}

/* Coordinates are in the 720x1280 design space; the floor top is at y=1140. */
export const LEVELS: LevelDef[] = [
  {
    id: 0, title: '口号制造厂', sub: 'LEVEL 1 · SLOGAN FACTORY', theme: 'factory', music: 'funk',
    ammo: { fact: 8 }, unlock: 'fact',
    props: [
      { t: 'platform', x: 560, y: 880, w: 300, h: 28 },
      { t: 'board', x: 470, y: 801, w: 28, h: 130, text: '转发即正义' },
      { t: 'board', x: 650, y: 801, w: 28, h: 130, text: '一切都是阴谋' },
      { t: 'plank', x: 560, y: 724, w: 240 },
      { t: 'crate', x: 340, y: 1110 },
      { t: 'crate', x: 340, y: 1050 },
      { t: 'platform', x: 520, y: 560, w: 260, h: 22, style: 'steel' },
      { t: 'machine', x: 640, y: 330 },
    ],
    enemies: [
      { k: 'repeater', x: 560, y: 656 },
      { k: 'repeater', x: 450, y: 1084 },
      { k: 'repeater', x: 480, y: 493 },
    ],
  },
  {
    id: 1, title: '热搜竞技场', sub: 'LEVEL 2 · TRENDING ARENA', theme: 'arena', music: 'funk',
    ammo: { fact: 4, question: 3, bubble: 3 }, unlock: 'bubble',
    props: [
      { t: 'platform', x: 420, y: 1010, w: 64, h: 260, style: 'steel' },
      { t: 'platform', x: 645, y: 960, w: 64, h: 360, style: 'steel' },
      { t: 'platform', x: 545, y: 652, w: 170, h: 22 },
      { t: 'crate', x: 600, y: 610, s: 0.6 },
      { t: 'pboss', x: 96, y: 330 },
    ],
    enemies: [
      { k: 'repeater', x: 420, y: 824 },
      { k: 'repeater', x: 645, y: 724 },
      { k: 'chameleon', x: 520, y: 591 },
      { k: 'speculator', x: 460, y: 430, move: { x0: 300, x1: 640, period: 5200 } },
    ],
  },
  {
    id: 2, title: '双标百货商场', sub: 'LEVEL 3 · DOUBLE-STANDARD MALL', theme: 'mall', music: 'funk',
    ammo: { fact: 3, question: 2, bubble: 3, boomerang: 3 }, unlock: 'boomerang',
    props: [
      { t: 'conveyor', x: 525, y: 900, w: 370, speed: -0.7, spawn: 3200 },
      { t: 'platform', x: 455, y: 660, w: 110, h: 24, style: 'shelf' },
      { t: 'gate', id: 'g1', x: 575, y: 660, w: 130, h: 24 },
      { t: 'platform', x: 675, y: 660, w: 70, h: 24, style: 'shelf' },
      { t: 'switch', x: 694, y: 560, target: 'g1' },
      { t: 'bumper', x: 250, y: 600, r: 34 },
      { t: 'bumper', x: 380, y: 360, r: 30 },
      { t: 'rules', x: 470, y: 760, i: 0 },
      { t: 'rules', x: 250, y: 860, i: 1 },
      { t: 'product', x: 640, y: 1100 },
      { t: 'product', x: 640, y: 1050 },
    ],
    enemies: [
      { k: 'chameleon', x: 575, y: 597 },
      { k: 'chameleon', x: 650, y: 838 },
      { k: 'seller', x: 520, y: 1081 },
    ],
  },
  {
    id: 3, title: '键盘战争指挥部', sub: 'LEVEL 4 · KEYBOARD WAR ROOM', theme: 'hq', music: 'break',
    ammo: { fact: 3, question: 2, bubble: 3, boomerang: 2, duck: 2 }, unlock: 'duck',
    props: [
      { t: 'platform', x: 575, y: 700, w: 270, h: 26, style: 'steel' },
      { t: 'danmaku', x: 420, y: 548, cols: 2, rows: 2 },
      { t: 'monitor', x: 675, y: 658 },
      { t: 'monitor', x: 675, y: 608 },
      { t: 'platform', x: 300, y: 960, w: 190, h: 24, style: 'steel' },
      { t: 'bumper', x: 600, y: 380, r: 32 },
      { t: 'bumper', x: 250, y: 600, r: 30 },
      { t: 'crate', x: 560, y: 1110 },
    ],
    enemies: [
      { k: 'general', x: 590, y: 623 },
      { k: 'repeater', x: 320, y: 892 },
    ],
  },
  {
    id: 4, title: '真理选秀大会', sub: 'LEVEL 5 · TRUTH TALENT SHOW', theme: 'show', music: 'break', timer: 55,
    ammo: { fact: 4, question: 2, bubble: 3, boomerang: 2, duck: 1, doubt: 1 }, unlock: 'doubt',
    props: [
      { t: 'platform', x: 470, y: 990, w: 500, h: 36, style: 'stage' },
      { t: 'platform', x: 300, y: 937, w: 84, h: 70, style: 'marble' },
      { t: 'platform', x: 450, y: 937, w: 84, h: 70, style: 'marble' },
      { t: 'platform', x: 600, y: 937, w: 84, h: 70, style: 'marble' },
      { t: 'extreme', x: 590, y: 300 },
    ],
    enemies: [
      { k: 'repeater', x: 300, y: 846 },
      { k: 'chameleon', x: 450, y: 852 },
      { k: 'seller', x: 600, y: 843 },
      { k: 'speculator', x: 480, y: 600, move: { x0: 320, x1: 650, period: 4600 } },
    ],
  },
  {
    id: 5, title: '镜子里的最终BOSS', sub: 'FINAL · THE MIRROR', theme: 'mirror', music: 'mirror',
    ammo: { fact: 4, question: 3, bubble: 3, boomerang: 3, duck: 2, doubt: 1 },
    props: [
      { t: 'mirror', x: 520, y: 640, w: 250, h: 540 },
      { t: 'platform', x: 520, y: 1112, w: 190, h: 56, style: 'marble' },
    ],
    enemies: [],
  },
];
