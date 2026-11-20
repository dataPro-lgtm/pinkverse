export type AmmoId = 'fact' | 'boomerang' | 'question' | 'bubble' | 'duck' | 'doubt';

export interface RunStats {
  thinking: number;
  traffic: number;
  certainty: number;
  doubtUsed: number;
  factChecks: number;
  fights: number;
  humiliations: number;
  extreme: number;
  selfHits: number;
  adsBought: number;
  ironies: number;
  score: number;
}

export const emptyRun = (): RunStats => ({
  thinking: 0, traffic: 0, certainty: 0, doubtUsed: 0, factChecks: 0, fights: 0,
  humiliations: 0, extreme: 0, selfHits: 0, adsBought: 0, ironies: 0, score: 0,
});

export interface SaveData {
  v: 1;
  unlocked: number;
  best: number[];
  coins: number;
  up: { power: number; supply: number; scope: number };
  eggs: string[];
  endings: string[];
  muted: boolean;
  skipStory: boolean;
  run: RunStats;
  /** run stats as they were when each level was entered, so a replay does not double count */
  checkpoints: (RunStats | null)[];
}

const KEY = 'pinkverse-save-v1';

function fresh(): SaveData {
  return {
    v: 1, unlocked: 0, best: [0, 0, 0, 0, 0, 0], coins: 0,
    up: { power: 0, supply: 0, scope: 0 }, eggs: [], endings: [],
    muted: false, skipStory: false, run: emptyRun(), checkpoints: [null, null, null, null, null, null],
  };
}

export const Store = {
  d: fresh(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!p || p.v !== 1) return;
      const f = fresh();
      this.d = {
        ...f, ...p,
        run: { ...emptyRun(), ...(p.run || {}) },
        up: { ...f.up, ...(p.up || {}) },
        best: Array.isArray(p.best) ? p.best.concat(f.best).slice(0, 6) : f.best,
        checkpoints: Array.isArray(p.checkpoints) ? p.checkpoints.concat(f.checkpoints).slice(0, 6) : f.checkpoints,
      };
    } catch {
      /* private mode or corrupted data: play without saving */
    }
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch { /* ignore */ }
  },
  resetRun() {
    this.d.run = emptyRun();
    this.d.checkpoints = [null, null, null, null, null, null];
    this.save();
  },
  /** Entering a level restores the stats from when it was first entered, so retries are fair. */
  enterLevel(i: number) {
    const cp = this.d.checkpoints[i];
    if (cp) this.d.run = { ...cp };
    else this.d.checkpoints[i] = { ...this.d.run };
    this.save();
  },
  egg(id: string): boolean {
    if (this.d.eggs.includes(id)) return false;
    this.d.eggs.push(id);
    this.save();
    return true;
  },
  ending(id: string) {
    if (!this.d.endings.includes(id)) { this.d.endings.push(id); this.save(); }
  },
};
