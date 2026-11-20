import { ui, Btn } from '../ui';
import { Store } from '../state';
import { LEVELS } from '../data/levels';
import { EGGS } from '../data/lines';
import { Synth } from '../audio';
import type { GameScene } from './GameScene';

export function openPause(gs: GameScene) {
  const d = Store.d;
  const html = `<h2>暂停</h2><div class="sub">${gs.def.sub}</div>
    <div class="stats"><span>金币</span><b>${d.coins}</b><span>彩蛋</span><b>${d.eggs.length}/${EGGS.length}</b><span>结局</span><b>${d.endings.length}/3</b></div>
    <div class="eggs">${EGGS.map(e => `<span class="egg ${d.eggs.includes(e.id) ? 'got' : ''}" title="${e.hint}">${d.eggs.includes(e.id) ? e.title : '？' + e.hint}</span>`).join('')}</div>`;
  ui.modal(html, [
    { label: '继续', cls: 'pri', onClick: () => gs.resumeGame() },
    { label: '重新开始本关', onClick: () => { gs.scene.resume(); gs.goLevel(gs.li); } },
    { label: '关卡选择', onClick: () => openLevelSelect(gs) },
    { label: '升级大炮', sub: `金币 ${d.coins}`, onClick: () => openShop(gs, () => openPause(gs)) },
    { label: d.skipStory ? '剧情：已关闭' : '剧情：开启', sub: '点按切换', onClick: () => { d.skipStory = !d.skipStory; Store.save(); openPause(gs); } },
    { label: '新的一局', sub: '清空思考、流量、确信，从第一关开始', onClick: () => confirmNewRun(gs, () => openPause(gs)) },
  ]);
}

export function openLevelSelect(gs: GameScene, fromStart = false) {
  const d = Store.d;
  const html = `<h2>关卡选择</h2><div class="sub">金币 ${d.coins} · 结局 ${d.endings.length}/3 · 彩蛋 ${d.eggs.length}/${EGGS.length}</div>
    <div class="levels">${LEVELS.map((l, i) => `<button class="lvl" data-i="${i}" ${i > d.unlocked ? 'disabled' : ''}><b>${i + 1}. ${l.title}</b><span>${i > d.unlocked ? '未解锁' : d.best[i] ? '最高 ' + d.best[i].toLocaleString('en-US') : '未通关'}</span></button>`).join('')}</div>`;
  const back: Btn = fromStart
    ? { label: '开始', cls: 'pri', onClick: () => gs.beginLevel() }
    : { label: '返回', onClick: () => (gs.paused ? openPause(gs) : ui.closeModal()) };
  const p = ui.modal(html, [back, { label: '新的一局', sub: '清空本局指标，从第一关开始', onClick: () => confirmNewRun(gs, () => openLevelSelect(gs, fromStart)) }]);
  p.querySelectorAll<HTMLButtonElement>('.lvl').forEach(b => b.addEventListener('click', () => { Synth.click(); if (gs.paused) gs.scene.resume(); gs.goLevel(+b.dataset.i!); }));
}

export function confirmNewRun(gs: GameScene, back: () => void) {
  ui.modal(`<h2>新的一局？</h2><p>这会清空本局的思考、流量和确信指标，从第一关重新开始。关卡解锁、金币、彩蛋和结局记录都会保留。</p>`, [
    { label: '确定，重新开始', cls: 'hot', onClick: () => { Store.resetRun(); if (gs.paused) gs.scene.resume(); gs.goLevel(0); } },
    { label: '取消', onClick: back },
  ]);
}

const UPS = [
  { k: 'power' as const, name: '炮管口径', desc: '所有炮弹伤害 +15%', cost: [150, 300, 520] },
  { k: 'supply' as const, name: '弹药补给', desc: '每关每种弹药 +1（怀疑弹除外）', cost: [200, 420] },
  { k: 'scope' as const, name: '精准预判', desc: '瞄准线更长', cost: [120, 260] },
];

export function openShop(gs: GameScene, back: () => void) {
  const render = () => {
    const d = Store.d;
    const html = `<h2>升级大炮</h2><div class="sub">真理也需要装备 · 金币 <span class="coins">${d.coins}</span></div><div class="shop">${UPS.map(u => {
      const lv = d.up[u.k], max = u.cost.length, cost = u.cost[lv];
      return `<div class="item"><div><b>${u.name} ${'●'.repeat(lv)}${'○'.repeat(max - lv)}</b>${u.desc}</div>${lv >= max ? '<button class="btn" disabled>已满级</button>' : `<button class="btn pri" data-k="${u.k}" ${d.coins < cost ? 'disabled' : ''}>${cost} 金币</button>`}</div>`;
    }).join('')}</div><p class="quip">提示：装备再好，也不能替你思考。</p>`;
    const p = ui.modal(html, [{ label: '返回', onClick: back }]);
    p.querySelectorAll<HTMLButtonElement>('[data-k]').forEach(b => b.addEventListener('click', () => {
      const u = UPS.find(x => x.k === b.dataset.k)!; const d2 = Store.d; const cost = u.cost[d2.up[u.k]];
      if (d2.coins < cost) return;
      d2.coins -= cost; d2.up[u.k]++; Store.save(); Synth.coin(); render();
    }));
  };
  render();
}

export function openStory(gs: GameScene, lines: string[], done: () => void) {
  const html = `<div class="story">${lines.map((l, i) => `<p style="animation-delay:${0.2 + i * 0.9}s">${l}</p>`).join('')}</div>`;
  ui.modal(html, [
    { label: '继续', cls: 'pri', onClick: () => { Synth.click(); done(); } },
    { label: '以后都跳过剧情', onClick: () => { Store.d.skipStory = true; Store.save(); done(); } },
  ], { horizontal: true });
}
