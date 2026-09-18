// Small helpers shared by the music sources: ramps, randomness, node bookkeeping.

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Uniform random in [lo, hi).
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
// Exponentially distributed interval with the given mean (Poisson process spacing).
export const expRandom = (mean: number): number => -Math.log(1 - Math.random()) * mean;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Every gain / frequency change is a ramp: anchor the param at its current value
// at `at`, then ramp to `value` over `sec`. Linear ramps may reach 0, so we use
// them for gains; frequencies use exponential ramps (see rampHz) because pitch
// is perceived logarithmically.
export function ramp(param: AudioParam, value: number, at: number, sec: number): void {
  param.cancelScheduledValues(at);
  param.setValueAtTime(param.value, at);
  param.linearRampToValueAtTime(value, at + Math.max(sec, 0.005));
}

export function rampHz(param: AudioParam, hz: number, at: number, sec: number): void {
  param.cancelScheduledValues(at);
  param.setValueAtTime(Math.max(param.value, 1e-3), at);
  param.exponentialRampToValueAtTime(Math.max(hz, 1e-3), at + Math.max(sec, 0.005));
}

// Tracks every node a source creates so dispose() can disconnect all of them.
export class NodeBag {
  private nodes: AudioNode[] = [];
  add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  disposeAll(): void {
    for (const n of this.nodes) {
      if (n instanceof AudioScheduledSourceNode) { try { n.stop(); } catch { /* not started or already stopped */ } }
      try { n.disconnect(); } catch { /* already disconnected */ }
    }
    this.nodes = [];
  }
}
