import Phaser from 'phaser';
import './style.css';
import { W, H, GRAVITY_Y } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { EndingScene } from './scenes/EndingScene';
import { ui } from './ui';
import { Store } from './state';
import { Synth } from './audio';

Store.load();
if (new URLSearchParams(location.search).has('reset')) { Store.d = { ...Store.d }; localStorage.removeItem('pinkverse-save-v1'); Store.load(); }
Synth.setMuted(Store.d.muted);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1029',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: GRAVITY_Y },
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 6,
      runner: { fps: 60 },
      debug: false,
    } as any,
  },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 1 },
  fps: { target: 60 },
  scene: [BootScene, GameScene, EndingScene],
});

const relayout = () => { if (game.canvas) ui.layout(game.canvas); };
game.events.once('ready', relayout);
window.addEventListener('resize', () => { relayout(); setTimeout(relayout, 120); });
window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
setInterval(relayout, 1000);

// browsers only allow audio after a gesture
const unlock = () => { Synth.init(); };
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.loop.sleep(); else game.loop.wake(); });

(window as any).__pv = { game, Store };
