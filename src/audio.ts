/* All music and sound are synthesized with the Web Audio API: no audio files, no licensing issues. */
export type MusicMode = 'none' | 'funk' | 'break' | 'boss' | 'mirror' | 'mirrorPad' | 'endA' | 'endB' | 'endC';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class SynthImpl {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private timer: number | undefined;
  private nextT = 0;
  private step = 0;
  mode: MusicMode = 'none';
  muted = false;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.seqTick(), 25);
    // iOS: resume when returning to the tab
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.ctx?.state === 'suspended') this.ctx.resume(); });
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  setMusic(mode: MusicMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.step = 0;
    if (this.ctx) {
      this.nextT = this.ctx.currentTime + 0.08;
      this.music.gain.cancelScheduledValues(this.ctx.currentTime);
      this.music.gain.setValueAtTime(0.5, this.ctx.currentTime);
    }
  }

  duck(amount = 0.25, ms = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(amount, t, 0.05);
    this.music.gain.setTargetAtTime(0.5, t + ms / 1000, 0.3);
  }

  /* ---------------- primitives ---------------- */
  private osc(f: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, f2?: number, attack = 0.005, filter?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(filter, t); lp.Q.value = 2;
      lp.frequency.exponentialRampToValueAtTime(Math.max(200, filter * 0.25), t + dur);
      o.connect(lp); lp.connect(g);
    } else o.connect(g);
    g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, dest: AudioNode, q = 1, f2?: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  /* ---------------- drums ---------------- */
  private kick(t: number, v = 0.9) { this.osc(150, t, 0.32, 'sine', v, this.music, 42, 0.002); this.noise(t, 0.03, 0.25 * v, 'highpass', 2000, this.music); }
  private snare(t: number, v = 0.5) { this.noise(t, 0.18, v, 'bandpass', 1800, this.music, 0.7); this.osc(220, t, 0.09, 'triangle', v * 0.5, this.music, 160); }
  private hat(t: number, v = 0.18, open = false) { this.noise(t, open ? 0.22 : 0.045, v, 'highpass', 7500, this.music); }
  private timp(t: number, v = 0.8) { this.osc(70, t, 0.9, 'sine', v, this.music, 48, 0.004); this.noise(t, 0.25, 0.15 * v, 'lowpass', 400, this.music); }
  private crash(t: number) { this.noise(t, 1.2, 0.18, 'highpass', 5000, this.music, 0.5); }

  private brass(root: number, t: number, dur: number, vol: number, chord: number[]) {
    for (const iv of chord) {
      const f = midi(root + iv);
      this.osc(f, t, dur, 'sawtooth', vol, this.music, undefined, 0.012, 2600);
      this.osc(f * 1.006, t, dur, 'sawtooth', vol * 0.6, this.music, undefined, 0.012, 2200);
    }
  }
  private pad(root: number, t: number, dur: number, vol: number, chord: number[]) {
    for (const iv of chord) {
      const ctx = this.ctx!;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = midi(root + iv);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  /* ---------------- sequencer ---------------- */
  private seqTick() {
    const ctx = this.ctx;
    if (!ctx || this.mode === 'none' || this.mode === 'mirror') return;
    const bpm = { funk: 104, break: 126, boss: 88, mirrorPad: 64, endA: 92, endB: 118, endC: 70, none: 100, mirror: 60 }[this.mode];
    const sixteenth = 60 / bpm / 4;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.03;
    while (this.nextT < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextT, sixteenth);
      this.step++;
      this.nextT += sixteenth;
    }
  }

  private playStep(step: number, t: number, s: number) {
    const i = step % 16;
    const bar = Math.floor(step / 16) % 4;
    switch (this.mode) {
      case 'funk': {
        if ([0, 6, 10].includes(i) || (bar === 3 && i === 3)) this.kick(t);
        if (i === 4 || i === 12) this.snare(t, 0.45);
        if (i === 7 || i === 15) this.snare(t, 0.12);
        if (i % 2 === 0) this.hat(t, i === 14 ? 0.14 : 0.1, i === 14);
        const roots = [40, 40, 45, 47];
        const bass = [0, -1, 0, 12, -1, 10, -1, 7, 0, -1, 3, -1, 5, -1, 7, 10];
        if (bass[i] >= 0) this.osc(midi(roots[bar] + bass[i]), t, s * 1.6, 'square', 0.16, this.music, undefined, 0.004, 900);
        if ((i === 6 || i === 14) && bar % 2 === 1) this.brass(roots[bar] + 24, t, s * 1.4, 0.05, [0, 4, 7, 10]);
        if (i === 2 || i === 9) this.osc(midi(roots[bar] + 31), t, 0.08, 'square', 0.04, this.music, undefined, 0.002, 2500);
        break;
      }
      case 'break': {
        if (i === 0 || i === 7 || i === 10) this.kick(t);
        if (i === 4 || i === 12) this.snare(t, 0.5);
        if (i === 15) this.snare(t, 0.15);
        this.hat(t, i % 4 === 2 ? 0.13 : 0.07);
        const roots = [38, 38, 41, 36];
        const bl = [0, -1, 12, -1, 0, 12, -1, 0, -1, 12, 0, -1, 15, -1, 12, 10];
        if (bl[i] >= 0) this.osc(midi(roots[bar] + bl[i]), t, s * 1.2, 'sawtooth', 0.11, this.music, undefined, 0.003, 1200);
        if (i === 0 && bar % 2 === 0) this.brass(roots[bar] + 24, t, s * 3, 0.045, [0, 3, 7]);
        if (i === 8 && bar === 3) this.brass(roots[bar] + 26, t, s * 2, 0.05, [0, 3, 7]);
        break;
      }
      case 'boss': {
        const roots = [48, 44, 41, 43];
        const chords = [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]];
        if (i === 0) this.brass(roots[bar], t, s * 15, 0.035, chords[bar]);
        if (i === 0 || i === 8) this.timp(t, 0.8);
        if (bar === 3 && i >= 12) this.timp(t, 0.35);
        if (i === 4 || i === 12) this.snare(t, 0.25);
        if (i === 0 && bar === 0) this.crash(t);
        if (i % 4 === 2) this.osc(midi(roots[bar] + 24 + chords[bar][(i / 4 | 0) % 3]), t, s * 2, 'triangle', 0.05, this.music);
        break;
      }
      case 'mirrorPad': {
        const roots = [57, 53, 48, 55];
        if (i === 0) this.pad(roots[bar], t, s * 16, 0.035, [0, 4, 7, 12]);
        if (i % 4 === 0) this.osc(midi(roots[bar] + 24 + [0, 7, 4, 12][i / 4]), t, 1.2, 'triangle', 0.03, this.music);
        break;
      }
      case 'endA': {
        if (i === 0) this.brass([48, 53, 55, 48][bar], t, s * 14, 0.03, [0, 4, 7]);
        if (i % 2 === 0) this.noise(t, 0.08, 0.05 + Math.random() * 0.05, 'bandpass', 1500 + Math.random() * 2500, this.music, 0.6);
        break;
      }
      case 'endB': {
        const roots = [60, 65, 67, 60];
        if (i % 4 === 0) this.kick(t, 0.5);
        if (i === 4 || i === 12) this.snare(t, 0.2);
        const mel = [0, 4, 7, 12, 7, 4, 0, 4, 5, 9, 12, 9, 7, 11, 14, 11];
        this.osc(midi(roots[bar] + mel[i]), t, s * 0.9, 'triangle', 0.06, this.music);
        break;
      }
      case 'endC': {
        const roots = [57, 53, 48, 55];
        const arp = [0, 7, 12, 16, 12, 7, 4, 7];
        if (i % 2 === 0) this.osc(midi(roots[bar] + arp[(i / 2) % 8]), t, s * 4, 'triangle', 0.06, this.music, undefined, 0.01);
        if (i === 0) this.pad(roots[bar] - 12, t, s * 16, 0.03, [0, 7, 12]);
        break;
      }
    }
  }

  /* ---------------- sfx ---------------- */
  private ok(key: string, gapMs: number) {
    const now = performance.now();
    if (now - (this.lastSfx[key] || 0) < gapMs) return false;
    this.lastSfx[key] = now;
    return !!this.ctx;
  }
  private get t() { return this.ctx!.currentTime; }

  fire(kind: string) {
    if (!this.ok('fire', 60)) return;
    const t = this.t, d = this.sfx;
    this.osc(160, t, 0.35, 'sine', 0.9, d, 38, 0.002);
    this.noise(t, 0.3, 0.5, 'lowpass', 1800, d, 0.8, 200);
    switch (kind) {
      case 'fact': this.osc(880, t + 0.05, 0.12, 'square', 0.12, d, 660); break;
      case 'boomerang': this.noise(t + 0.03, 0.5, 0.25, 'bandpass', 500, d, 3, 3000); break;
      case 'question': [0, 4, 7].forEach((n, k) => this.osc(midi(76 + n), t + 0.05 + k * 0.05, 0.15, 'triangle', 0.15, d)); break;
      case 'bubble': this.osc(300, t + 0.03, 0.3, 'sine', 0.25, d, 900); break;
      case 'duck': this.squeak(); break;
      case 'doubt': this.noise(t, 0.6, 0.3, 'bandpass', 3000, d, 4, 300); this.osc(440, t, 0.7, 'sine', 0.2, d, 110); break;
    }
  }
  impact(strength = 1) {
    if (!this.ok('impact', 45)) return;
    const t = this.t;
    const v = Math.min(1, 0.3 + strength * 0.5);
    this.osc(120 + Math.random() * 40, t, 0.18, 'sine', 0.7 * v, this.sfx, 50, 0.002);
    this.noise(t, 0.12, 0.35 * v, 'lowpass', 1200, this.sfx);
  }
  wood() { if (!this.ok('wood', 50)) return; const t = this.t; this.noise(t, 0.16, 0.4, 'bandpass', 900, this.sfx, 2); this.osc(260, t, 0.08, 'square', 0.08, this.sfx, 140); }
  glass() { if (!this.ok('glass', 80)) return; const t = this.t; for (let k = 0; k < 5; k++) this.osc(2200 + Math.random() * 1800, t + k * 0.02, 0.25, 'sine', 0.06, this.sfx); this.noise(t, 0.3, 0.2, 'highpass', 4000, this.sfx); }
  stamp() { if (!this.ok('stamp', 80)) return; const t = this.t; this.osc(90, t, 0.2, 'sine', 0.8, this.sfx, 40, 0.001); this.noise(t, 0.05, 0.4, 'highpass', 3000, this.sfx); }
  pop() { if (!this.ok('pop', 30)) return; const t = this.t; this.noise(t, 0.08, 0.45, 'highpass', 2500, this.sfx); this.osc(900, t, 0.1, 'sine', 0.25, this.sfx, 1600); }
  inflate() { if (!this.ok('inflate', 200)) return; this.osc(220, this.t, 1.2, 'sine', 0.2, this.sfx, 900, 0.05); }
  squeak() { if (!this.ok('squeak', 120)) return; const t = this.t; this.osc(900, t, 0.1, 'square', 0.12, this.sfx, 1500); this.osc(1500, t + 0.1, 0.14, 'square', 0.1, this.sfx, 800); }
  think() { if (!this.ok('think', 120)) return; const t = this.t; [0, 3, 7, 10].forEach((n, k) => this.osc(midi(72 + n), t + k * 0.06, 0.25, 'sine', 0.08, this.sfx)); }
  coin() { if (!this.ok('coin', 50)) return; const t = this.t; this.osc(988, t, 0.08, 'square', 0.08, this.sfx); this.osc(1319, t + 0.07, 0.2, 'square', 0.08, this.sfx); }
  combo(n: number) { if (!this.ok('combo', 90)) return; const t = this.t; for (let k = 0; k < Math.min(n, 6); k++) this.osc(midi(72 + k * 3), t + k * 0.04, 0.12, 'triangle', 0.1, this.sfx); }
  shout() {
    if (!this.ok('shout', 300)) return;
    const ctx = this.ctx!, t = this.t;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const bp = ctx.createBiquadFilter(); const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(190 + Math.random() * 60, t);
    lfo.frequency.value = 11; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.04); g.gain.setValueAtTime(0.16, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(bp); bp.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.75); lfo.start(t); lfo.stop(t + 0.75);
  }
  trombone() { if (!this.ok('trombone', 500)) return; const t = this.t; [55, 54, 53].forEach((n, k) => this.osc(midi(n), t + k * 0.32, 0.3, 'sawtooth', 0.12, this.sfx, undefined, 0.02, 1200)); this.osc(midi(52), t + 0.96, 0.9, 'sawtooth', 0.12, this.sfx, midi(46), 0.02, 1200); }
  fanfare() { if (!this.ok('fanfare', 500)) return; const t = this.t; [60, 64, 67, 72].forEach((n, k) => this.brass(n, t + k * 0.12, k === 3 ? 0.8 : 0.14, 0.05, [0, 7])); this.crashSfx(t + 0.36); }
  private crashSfx(t: number) { this.noise(t, 1.0, 0.2, 'highpass', 5000, this.sfx, 0.5); }
  scratch() { if (!this.ok('scratch', 200)) return; const t = this.t; this.noise(t, 0.25, 0.4, 'bandpass', 400, this.sfx, 5, 3000); this.noise(t + 0.22, 0.2, 0.35, 'bandpass', 3000, this.sfx, 5, 500); }
  jingle() { if (!this.ok('jingle', 300)) return; const t = this.t; [84, 88, 91].forEach((n, k) => this.osc(midi(n), t + k * 0.09, 0.3, 'sine', 0.08, this.sfx)); }
  boing() { if (!this.ok('boing', 60)) return; this.osc(180, this.t, 0.3, 'sine', 0.3, this.sfx, 520); }
  doubt() { if (!this.ok('doubtfx', 300)) return; const t = this.t; this.noise(t, 1.2, 0.25, 'bandpass', 200, this.sfx, 2, 4000); this.osc(660, t, 1.4, 'sine', 0.12, this.sfx, 330, 0.3); }
  shatter() { if (!this.ok('shatter', 70)) return; const t = this.t; this.noise(t, 0.35, 0.4, 'highpass', 2500, this.sfx); for (let k = 0; k < 3; k++) this.osc(1500 + Math.random() * 2000, t + k * 0.03, 0.15, 'triangle', 0.05, this.sfx); }
  explode() { if (!this.ok('explode', 60)) return; const t = this.t; this.osc(110, t, 0.6, 'sine', 0.9, this.sfx, 30, 0.002); this.noise(t, 0.7, 0.6, 'lowpass', 2500, this.sfx, 0.7, 150); }
  applause(sec = 2) { if (!this.ctx) return; const t = this.t; for (let k = 0; k < sec * 12; k++) this.noise(t + k / 12 + Math.random() * 0.05, 0.08, 0.08 + Math.random() * 0.06, 'bandpass', 1200 + Math.random() * 2400, this.sfx, 0.8); }
  hum() { if (!this.ok('hum', 1000)) return; this.osc(55, this.t, 2.4, 'sine', 0.06, this.sfx, 52, 0.6); }
  ticktock() { if (!this.ok('tick', 40)) return; this.osc(1800, this.t, 0.03, 'square', 0.05, this.sfx); }
  click() { if (!this.ok('click', 40)) return; this.osc(1200, this.t, 0.05, 'triangle', 0.08, this.sfx, 900); }
}

export const Synth = new SynthImpl();
