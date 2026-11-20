import Phaser from 'phaser';
import { makeTextures } from '../textures';
import { Store } from '../state';
import { LEVELS } from '../data/levels';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this);
    const q = new URLSearchParams(location.search);
    let level = Store.d.unlocked;
    if (q.has('level')) level = Math.max(0, Math.min(LEVELS.length - 1, (parseInt(q.get('level')!, 10) || 1) - 1));
    this.scene.start('Game', { level });
  }
}
