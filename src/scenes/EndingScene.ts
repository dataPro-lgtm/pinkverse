import Phaser from 'phaser';
import { C, FONT, H, INK, W } from '../config';
import { ENDINGS, EGGS } from '../data/lines';
import { Store } from '../state';
import { Synth } from '../audio';
import { ui } from '../ui';
import { Fx } from '../fx';
import * as Art from '../entities/enemyArt';
import type { Face } from '../entities/face';

type Id = 'A' | 'B' | 'C';

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  create(data: { id: Id }) {
    const id: Id = data?.id ?? 'C';
    const E = ENDINGS[id];
    const fx = new Fx(this);
    ui.showHud(false); ui.timer(null); ui.intro(false); ui.setCombo(0);
    Synth.setMusic(id === 'A' ? 'endA' : id === 'B' ? 'endB' : 'endC');
    this.cameras.main.fadeIn(1400);

    const bgTop = { A: 0x07050d, B: 0x1a0b33, C: 0xfff3df }[id], bgBot = { A: 0x1a1226, B: 0x5a1f6a, C: 0xffd9e8 }[id];
    const g = this.add.graphics(); g.fillGradientStyle(bgTop, bgTop, bgBot, bgBot, 1); g.fillRect(-500, -900, W + 1000, H + 900);
    const floor = this.add.graphics(); floor.fillStyle(id === 'C' ? 0xe8c9b0 : 0x110b1c); floor.fillRect(-500, 900, W + 1000, H);

    const cannon = this.add.container(W / 2, 860);
    const cg = this.add.graphics(); cannon.add(cg);
    cg.fillStyle(C.pink); cg.beginPath(); cg.moveTo(-56, 40); cg.lineTo(56, 40); cg.lineTo(34, -26); cg.lineTo(-34, -26); cg.closePath(); cg.fillPath(); cg.lineStyle(5, C.ink); cg.strokePath();
    cg.fillStyle(C.yellow); cg.fillRoundedRect(-14, id === 'C' ? -30 : -120, 28, id === 'C' ? 40 : 110, 10); cg.lineStyle(5, C.ink); cg.strokeRoundedRect(-14, id === 'C' ? -30 : -120, 28, id === 'C' ? 40 : 110, 10);
    [[-36, 46], [36, 46]].forEach(([x, y]) => { cg.fillStyle(0x2b1b42); cg.fillCircle(x, y, 22); cg.lineStyle(5, C.ink); cg.strokeCircle(x, y, 22); });

    const cast: { ct: Phaser.GameObjects.Container; face: Face }[] = [];
    const makers: ((s: Phaser.Scene, ct: Phaser.GameObjects.Container) => Art.Art)[] = [Art.repeater, Art.chameleon, Art.speculator, Art.seller, (s, c) => Art.right(s, c), Art.general];

    if (id === 'A') {
      const spot = this.add.graphics(); spot.fillStyle(0xffffff, 0.08); spot.fillTriangle(W / 2, 0, W / 2 - 220, 940, W / 2 + 220, 940);
      const crown = this.add.graphics(); crown.fillStyle(C.yellow); crown.beginPath(); crown.moveTo(W / 2 - 36, 712); crown.lineTo(W / 2 - 36, 684); crown.lineTo(W / 2 - 18, 700); crown.lineTo(W / 2, 676); crown.lineTo(W / 2 + 18, 700); crown.lineTo(W / 2 + 36, 684); crown.lineTo(W / 2 + 36, 712); crown.closePath(); crown.fillPath(); crown.lineStyle(4, C.ink); crown.strokePath();
      makers.forEach((mk, i) => {
        const x = 90 + i * 108, y = 1060;
        const ct = this.add.container(x, y).setScale(0.62); const a = mk(this, ct); a.face.set('happy'); cast.push({ ct, face: a.face });
        this.tweens.add({ targets: ct, y: y - 12, duration: 180 + i * 20, yoyo: true, repeat: 14 });
      });
      Synth.applause(4);
      cast.forEach((c, i) => this.time.delayedCall(4200 + i * 900, () => this.tweens.add({ targets: c.ct, alpha: 0, x: c.ct.x + (i % 2 ? 60 : -60), duration: 800 })));
      this.time.delayedCall(10500, () => { this.tweens.add({ targets: [spot, crown], alpha: 0.4, duration: 1600 }); this.cameras.main.zoomTo(1.25, 4000); });
    } else if (id === 'B') {
      for (const [x, y, sc] of [[150, 500, 3], [560, 420, 2.4], [360, 760, 2]] as const) {
        const gear = this.add.image(x, y, 'gear').setScale(sc).setAlpha(0.35).setTint(C.pink);
        this.tweens.add({ targets: gear, angle: x > 300 ? -360 : 360, duration: 6000, repeat: -1 });
      }
      const god = this.add.container(W / 2, -200).setScale(0.75); const a = Art.likegod(this, god); a.face.set('happy');
      this.tweens.add({ targets: god, y: 660, duration: 2600, ease: 'Bounce.Out' });
      const badge = this.add.text(W / 2, 1000, '首席流量制造者', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffd400', stroke: INK, strokeThickness: 8 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, scale: { from: 2, to: 1 }, delay: 2800, duration: 600, ease: 'Back.Out' });
      this.time.addEvent({ delay: 220, repeat: 60, callback: () => fx.burst(Math.random() < 0.5 ? 'like' : 'heart', Phaser.Math.Between(40, W - 40), 120, 2) });
      this.time.delayedCall(7000, () => { this.tweens.add({ targets: cannon, scale: 0.4, angle: 360 * 3, duration: 3000, ease: 'Sine.InOut' }); this.cameras.main.zoomTo(0.8, 5000); });
    } else {
      const ring = [[W / 2 - 230, 960], [W / 2 - 140, 1060], [W / 2, 1100], [W / 2 + 140, 1060], [W / 2 + 230, 960], [W / 2, 740]];
      const talk = ['我可能错了。', '你说得也有道理。', '嗯……', '我先听你说完。', '那个证据我没看过。', '我们换个方式聊？'];
      makers.forEach((mk, i) => {
        const [x, y] = ring[i];
        const ct = this.add.container(x, y).setScale(0.6); const a = mk(this, ct); a.face.set(i % 2 ? 'think' : 'idle'); cast.push({ ct, face: a.face });
        if (x > W / 2) ct.setScale(-0.6, 0.6);
        this.time.delayedCall(2200 + i * 1300, () => { const sp = fx.speech(talk[i], 3000); sp.place(x, y - 80); a.face.set('happy'); });
      });
      cannon.setY(880).setScale(0.8);
      this.time.delayedCall(1500, () => this.cameras.main.zoomTo(0.72, 12000, 'Sine.easeInOut'));
    }

    const r = Store.d.run;
    const lines = [...E.lines, `思考 ${Math.round(r.thinking)} · 流量 ${Math.round(r.traffic)} · 确信 ${Math.round(r.certainty)}`];
    ui.ending(E.title, lines, E.caption, [
      { label: '再玩一次（新的一局）', cls: 'pri', onClick: () => { Store.resetRun(); ui.closeModal(); this.scene.start('Game', { level: 0 }); } },
      { label: `关卡选择 · 结局 ${Store.d.endings.length}/3 · 彩蛋 ${Store.d.eggs.length}/${EGGS.length}`, onClick: () => { ui.closeModal(); this.scene.start('Game', { level: 0, select: true }); } },
    ], id === 'C');
  }
}
