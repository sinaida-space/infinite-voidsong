// layer.ts — one mixer slot.
//
//   source → slot gain (crossfade) → output (layer volume) → master input
//
// A source swap builds the new source on its own slot gain and runs an
// equal-power crossfade (3 s) against the outgoing one; the outgoing source
// is also told to stop() so its internal envelope closes, then it is
// disposed once both fades are over. Swapping again mid-fade is safe: each
// outgoing source keeps its own teardown timer.
import { fadeIn, fadeOut, rampTo } from './crossfade';
import type { SoundSource, SourceFactory } from './source';

const CROSSFADE = 3;
const TEARDOWN_MARGIN = 0.5;

interface Slot { source: SoundSource; gain: GainNode; }

export class Layer {
  /** Post-volume output. Task 4 may insert the focus-boost node between this and the master. */
  readonly output: GainNode;
  private current: Slot | null = null;
  private readonly outgoing = new Set<Slot>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly ctx: AudioContext, dest: AudioNode) {
    this.output = new GainNode(ctx, { gain: 0 });
    this.output.connect(dest);
  }

  get source(): SoundSource | null { return this.current?.source ?? null; }

  /** Replace the playing source (null empties the slot). */
  setSource(factory: SourceFactory | null, params: Record<string, number>, at: number): void {
    const old = this.current;
    if (old) {
      fadeOut(old.gain.gain, at, CROSSFADE);
      old.source.stop(at);
      this.outgoing.add(old);
      this.later(at + CROSSFADE + TEARDOWN_MARGIN, () => this.teardown(old));
    }
    this.current = null;
    if (!factory) return;

    const source = factory(this.ctx);
    const gain = new GainNode(this.ctx, { gain: 0 });
    source.connect(gain);
    gain.connect(this.output);
    for (const [k, v] of Object.entries(params)) source.setParam(k, v, 0);
    source.start(at);
    fadeIn(gain.gain, at, CROSSFADE);
    this.current = { source, gain };
  }

  setVolume(v: number, at: number, rampSec: number): void { rampTo(this.output.gain, v, at, rampSec); }

  setParam(key: string, value: number, rampSec: number): void { this.current?.source.setParam(key, value, rampSec); }

  /** Run `fn` once the audio clock passes `audioTime` (cleanup only, never sound). */
  private later(audioTime: number, fn: () => void): void {
    const ms = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  private teardown(slot: Slot): void {
    this.outgoing.delete(slot);
    slot.source.dispose();
    slot.gain.disconnect();
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const slot of this.outgoing) this.teardown(slot);
    if (this.current) { this.teardown(this.current); this.current = null; }
    this.output.disconnect();
  }
}
