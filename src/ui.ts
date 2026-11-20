import { W } from './config';
import { AMMO, AMMO_ORDER } from './data/ammo';
import type { AdDef } from './data/lines';
import type { AmmoId } from './state';

export interface Btn { label: string; sub?: string; cls?: string; disabled?: boolean; onClick: () => void }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';

/* DOM overlay sized exactly over the canvas: crisp CJK text and real buttons on phones. */
export class UI {
  root = document.getElementById('ui')!;
  hud = el('div', 'hud off');
  tray = el('div', 'tray off');
  sysBox = el('div', 'sys');
  comboEl = el('div', 'combo');
  card = el('div', 'card');
  ads = el('div', 'ads');
  introEl = el('div', 'intro');
  timerEl = el('div', 'timer');
  modalEl: HTMLElement | null = null;
  private lvEl!: HTMLElement; private nmEl!: HTMLElement; private scoreEl!: HTMLElement; private coinEl!: HTMLElement;
  private meters: Record<'t' | 'f' | 'c', { v: HTMLElement; bar: HTMLElement; box: HTMLElement; last: number }> = {} as any;
  muteBtn!: HTMLButtonElement;
  on = { pause: () => {}, mute: () => {}, ammo: (_id: AmmoId) => {} };

  constructor() {
    const top = el('div', 'row');
    const pause = el('button', 'ibtn', ICON_PAUSE) as HTMLButtonElement; pause.setAttribute('aria-label', '暂停');
    pause.onclick = () => this.on.pause();
    const title = el('div', 'title'); this.lvEl = el('div', 'lv'); this.nmEl = el('div', 'nm'); title.append(this.lvEl, this.nmEl);
    this.scoreEl = el('div', 'score', '0<small>SCORE</small>');
    this.muteBtn = el('button', 'ibtn', ICON_SOUND) as HTMLButtonElement; this.muteBtn.setAttribute('aria-label', '静音');
    this.muteBtn.onclick = () => this.on.mute();
    top.append(pause, title, this.scoreEl, this.muteBtn);
    const ms = el('div', 'meters');
    ([['t', '思考'], ['f', '流量'], ['c', '确信']] as const).forEach(([k, name]) => {
      const box = el('div', 'meter ' + k);
      const lb = el('div', 'lb'); const v = el('b', '', '0'); lb.append(el('span', '', name), v);
      const bar = el('div', 'bar'); const fill = el('i'); bar.append(fill);
      box.append(lb, bar); ms.append(box);
      this.meters[k] = { v, bar: fill, box, last: 0 };
    });
    this.hud.append(top, ms);
    this.introEl.innerHTML = '<div class="logo">粉红宇宙<br><em>真理大炮</em></div><div class="en">PINKVERSE · THE CANNON OF TRUTH</div><div class="slogan">当所有人都掌握真理，谁还需要思考？</div>';
    this.timerEl.style.display = 'none';
    this.root.append(this.hud, this.sysBox, this.comboEl, this.timerEl, this.ads, this.card, this.tray, this.introEl);
    this.coinEl = el('span');
  }

  layout(canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect();
    const s = this.root.style;
    s.left = r.left + 'px'; s.top = r.top + 'px'; s.width = r.width + 'px'; s.height = r.height + 'px';
    this.root.style.setProperty('--u', (r.width / W) + 'px');
  }

  showHud(on: boolean) { this.hud.classList.toggle('off', !on); this.tray.classList.toggle('off', !on); }
  setLevel(sub: string, name: string) { this.lvEl.textContent = sub; this.nmEl.textContent = name; }
  setScore(n: number) { this.scoreEl.innerHTML = Math.round(n).toLocaleString('en-US') + '<small>SCORE</small>'; }
  setMuted(m: boolean) { this.muteBtn.classList.toggle('off', m); this.muteBtn.setAttribute('aria-label', m ? '打开声音' : '静音'); }

  setMeters(t: number, f: number, c: number) {
    const max = Math.max(100, t, f, c);
    ([['t', t], ['f', f], ['c', c]] as const).forEach(([k, v]) => {
      const m = this.meters[k]; const val = Math.round(v);
      if (val !== m.last) {
        m.v.textContent = String(val); m.bar.style.width = (Math.max(0, v) / max * 100).toFixed(1) + '%';
        m.box.classList.remove('bump'); void m.box.offsetWidth; m.box.classList.add('bump'); m.last = val;
      }
    });
  }

  setCombo(n: number) {
    if (n < 2) { this.comboEl.classList.remove('on'); return; }
    this.comboEl.innerHTML = `x${n}<small>连击 COMBO</small>`;
    this.comboEl.classList.remove('on'); void this.comboEl.offsetWidth; this.comboEl.classList.add('on');
  }

  setAmmo(counts: Partial<Record<AmmoId, number>>, sel: AmmoId) {
    this.tray.innerHTML = '';
    for (const id of AMMO_ORDER) {
      if (counts[id] === undefined) continue;
      const a = AMMO[id]; const n = counts[id]!;
      const b = el('button', 'am' + (id === sel ? ' sel' : '') + (n <= 0 ? ' empty' : '')) as HTMLButtonElement;
      b.setAttribute('aria-label', `${a.name}，剩余 ${n}`);
      b.innerHTML = `<span class="dot" style="background:${a.css}"></span><span class="n">${a.short}</span><span class="c">${n}</span>`;
      b.onclick = () => this.on.ammo(id);
      this.tray.append(b);
    }
  }

  sys(text: string, tag = '系统') {
    const ln = el('div', 'ln', `<b>${esc(tag)}</b>${esc(text)}`);
    this.sysBox.append(ln);
    while (this.sysBox.children.length > 3) this.sysBox.firstElementChild!.remove();
    setTimeout(() => { ln.classList.add('out'); setTimeout(() => ln.remove(), 400); }, 3400);
  }

  fact(target: string, source: string, note: string) {
    this.card.innerHTML = `<h4>事实核查 FACT CHECK</h4><div class="q">“${esc(target)}”</div>
      <div class="row"><span>结论</span><span><b>尚无证据</b></span></div>
      <div class="row"><span>来源</span><span>${esc(source)}</span></div>
      <div class="row"><span>备注</span><span>${esc(note)}</span></div><div class="stamp">待核实</div>`;
    this.card.classList.add('on');
    clearTimeout((this.card as any)._t);
    (this.card as any)._t = setTimeout(() => this.card.classList.remove('on'), 2600);
  }

  /** absurd ads; the close button of the "escape" variant runs away twice */
  ad(def: AdDef, o: { action?: () => void; escape?: boolean; onEscapeDone?: () => void; life?: number } = {}) {
    const box = el('div', 'ad');
    box.innerHTML = `<div><span class="tag">广告</span><span class="tt">${esc(def.title)}</span></div><p>${esc(def.body)}</p>`;
    const close = () => { box.classList.add('out'); setTimeout(() => box.remove(), 300); };
    const x = el('button', 'x', '×') as HTMLButtonElement; x.setAttribute('aria-label', '关闭广告');
    let runs = o.escape ? 2 : 0;
    x.onclick = (ev) => {
      ev.stopPropagation();
      if (runs > 0) { runs--; x.style.transform = `translate(${(Math.random() * -160 - 40).toFixed(0)}%, ${(Math.random() * 160 - 20).toFixed(0)}%)`; return; }
      if (o.escape && o.onEscapeDone) o.onEscapeDone();
      close();
    };
    box.append(x);
    if (def.action && o.action) {
      const b = el('button', 'act', esc(def.action)) as HTMLButtonElement;
      b.onclick = (ev) => { ev.stopPropagation(); o.action!(); close(); };
      box.append(b);
    }
    this.ads.append(box);
    while (this.ads.children.length > 2) this.ads.firstElementChild!.remove();
    setTimeout(close, o.life ?? 6500);
  }

  toast(text: string) {
    const t = el('div', 'toast', esc(text));
    this.root.append(t); setTimeout(() => t.remove(), 2700);
  }

  intro(on: boolean) { this.introEl.classList.toggle('off', !on); }

  timer(sec: number | null) {
    if (sec === null) { this.timerEl.style.display = 'none'; return; }
    this.timerEl.style.display = '';
    this.timerEl.textContent = `节目剩余 ${Math.max(0, Math.ceil(sec))}s`;
    this.timerEl.classList.toggle('low', sec <= 10);
  }

  modal(html: string, btns: Btn[], o: { horizontal?: boolean; cls?: string } = {}) {
    this.closeModal();
    const m = el('div', 'modal');
    const p = el('div', 'panel ' + (o.cls ?? ''), html);
    if (btns.length) {
      const row = el('div', 'btns' + (o.horizontal ? ' h' : ''));
      for (const b of btns) {
        const e = el('button', 'btn ' + (b.cls ?? ''), esc(b.label) + (b.sub ? `<small>${esc(b.sub)}</small>` : '')) as HTMLButtonElement;
        if (b.disabled) e.disabled = true;
        e.onclick = () => b.onClick();
        row.append(e);
      }
      p.append(row);
    }
    m.append(p);
    this.root.append(m);
    this.modalEl = m;
    const first = p.querySelector('button') as HTMLButtonElement | null;
    first?.focus({ preventScroll: true });
    return p;
  }
  closeModal() { this.modalEl?.remove(); this.modalEl = null; }

  ending(title: string, lines: string[], caption: string, btns: Btn[], light = false) {
    this.closeModal();
    const m = el('div', 'ending' + (light ? ' light' : ''));
    let d = 0.6;
    const et = el('div', 'et', esc(title)); et.style.animationDelay = d + 's'; m.append(et);
    for (const l of lines) { d += 1.5; const e = el('div', 'el', esc(l)); e.style.animationDelay = d + 's'; m.append(e); }
    d += 2; const c = el('div', 'cap', esc(caption)); c.style.animationDelay = d + 's'; m.append(c);
    d += 2.4;
    const row = el('div', 'btns'); row.style.animationDelay = d + 's';
    for (const b of btns) { const e = el('button', 'btn ' + (b.cls ?? ''), esc(b.label)) as HTMLButtonElement; e.onclick = () => b.onClick(); row.append(e); }
    m.append(row);
    this.root.append(m);
    this.modalEl = m;
    return d;
  }
}

export const ui = new UI();
