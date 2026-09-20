// source.ts — the SoundSource contract (§4) and a base class that handles
// the plumbing every recipe needs: node ownership for leak-free disposal,
// a start/stop envelope, a look-ahead scheduler, and a trim gain.
import type { Family, SourceId } from '../state/types';
import { fadeIn, fadeOut } from './crossfade';
import { dB } from './dsp';
import { Scheduler } from './scheduler';

export interface SoundSource {
  readonly id: SourceId;
  readonly family: Family;
  connect(dest: AudioNode): void;
  start(at: number): void;
  stop(at: number): void;                                   // internal fade ≥ 2 s, then teardown by dispose()
  setParam(key: string, value: number, rampSec: number): void;
  dispose(): void;
}
/** `layerIndex` (0-3) lets a source vary itself per mixer slot; most recipes ignore it. */
export type SourceFactory = (ctx: AudioContext, layerIndex?: number) => SoundSource;

const START_FADE = 0.5;   // the layer crossfade (3 s) does the musical work; this only kills the edge
const STOP_FADE = 2;

export abstract class BaseSource implements SoundSource {
  /** Trim: brings the recipe to its nominal level (≈ −14 dBFS RMS). */
  protected readonly out: GainNode;
  /** Start/stop envelope, everything routes through it. */
  protected readonly env: GainNode;
  protected readonly sched: Scheduler;
  private readonly owned: AudioNode[] = [];
  private readonly players: AudioScheduledSourceNode[] = [];
  private readonly disposers: Array<() => void> = [];
  private stopped = false;

  constructor(
    readonly id: SourceId,
    readonly family: Family,
    protected readonly ctx: AudioContext,
    trimDb = 0,
  ) {
    this.env = new GainNode(ctx, { gain: 0 });
    this.out = new GainNode(ctx, { gain: dB(trimDb) });
    this.env.connect(this.out);
    this.sched = new Scheduler(ctx);
  }

  /** Register a node so dispose() disconnects it. Returns the node for chaining. */
  protected own<T extends AudioNode>(node: T): T { this.owned.push(node); return node; }

  /** Register a scheduled source: started in start(at), stopped in dispose(). */
  protected play<T extends AudioScheduledSourceNode>(node: T): T { this.own(node); this.players.push(node); return node; }

  /** Register extra cleanup (sub-graphs that manage their own nodes). */
  protected onDispose(fn: () => void): void { this.disposers.push(fn); }

  /** Register an extra start hook (sub-graphs that start their own oscillators). */
  protected onStart(fn: (at: number) => void): void { this.starters.push(fn); }
  private readonly starters: Array<(at: number) => void> = [];

  connect(dest: AudioNode): void { this.out.connect(dest); }

  start(at: number): void {
    for (const p of this.players) {
      const offset = (p as AudioScheduledSourceNode & { __offset?: number }).__offset;
      if (offset !== undefined) (p as AudioBufferSourceNode).start(at, offset);
      else p.start(at);
    }
    for (const fn of this.starters) fn(at);
    fadeIn(this.env.gain, at, START_FADE);
    this.sched.start();
  }

  stop(at: number): void {
    if (this.stopped) return;
    this.stopped = true;
    fadeOut(this.env.gain, at, STOP_FADE);
    // Stop booking new events after the fade; already-booked ones ride out inside the fade.
    this.sched.stop();
  }

  setParam(_key: string, _value: number, _rampSec: number): void { /* most recipes have no knobs */ }

  dispose(): void {
    this.sched.dispose();
    for (const fn of this.disposers) fn();
    this.disposers.length = 0;
    for (const p of this.players) { try { p.stop(); } catch { /* never started */ } }
    for (const n of this.owned) n.disconnect();
    this.env.disconnect();
    this.out.disconnect();
    this.owned.length = 0;
    this.players.length = 0;
  }
}
