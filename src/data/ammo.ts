import type { AmmoId } from '../state';

export interface AmmoSpec {
  id: AmmoId;
  name: string;
  short: string;
  desc: string;
  r: number;
  density: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  /** fraction of world gravity this projectile feels */
  grav: number;
  color: number;
  css: string;
  dmg: number;
  tex: string;
}

export const AMMO: Record<AmmoId, AmmoSpec> = {
  fact: { id: 'fact', name: '事实核查弹', short: '核查', desc: '击碎口号牌，公布核查结果', r: 22, density: 0.006, restitution: 0.2, friction: 0.3, frictionAir: 0.002, grav: 1, color: 0xffffff, css: '#ffffff', dmg: 52, tex: 'am_fact' },
  boomerang: { id: 'boomerang', name: '逻辑回旋镖', short: '回旋', desc: '飞出去会回来，可能打到你自己', r: 18, density: 0.003, restitution: 0.4, friction: 0.1, frictionAir: 0.0, grav: 0.35, color: 0xffd400, css: '#ffd400', dmg: 34, tex: 'am_boom' },
  question: { id: 'question', name: '反问散弹', short: '反问', desc: '空中分裂，让对方陷入思考', r: 18, density: 0.003, restitution: 0.3, friction: 0.1, frictionAir: 0.002, grav: 1, color: 0xff2e88, css: '#ff2e88', dmg: 8, tex: 'am_q' },
  bubble: { id: 'bubble', name: '流量泡泡弹', short: '流量', desc: '目标膨胀后炸成点赞和广告', r: 22, density: 0.0016, restitution: 0.5, friction: 0.1, frictionAir: 0.004, grav: 0.7, color: 0x27e1e6, css: '#27e1e6', dmg: 14, tex: 'am_bubble' },
  duck: { id: 'duck', name: '沉默橡皮鸭', short: '鸭子', desc: '全场安静三秒', r: 26, density: 0.002, restitution: 0.55, friction: 0.2, frictionAir: 0.002, grav: 1, color: 0xffd400, css: '#ffe14d', dmg: 10, tex: 'am_duck' },
  doubt: { id: 'doubt', name: '自我怀疑弹', short: '怀疑', desc: '最稀有。也会削减你自己的确信', r: 22, density: 0.005, restitution: 0.25, friction: 0.2, frictionAir: 0.002, grav: 1, color: 0x9b5cff, css: '#9b5cff', dmg: 70, tex: 'am_doubt' },
};

export const AMMO_ORDER: AmmoId[] = ['fact', 'question', 'bubble', 'boomerang', 'duck', 'doubt'];
