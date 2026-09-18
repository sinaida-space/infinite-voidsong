// engine.ts — the public audio API (§4).
//
// Owns one AudioContext, the master chain, four layers and the level meter.
// `apply(state)` diffs against the last applied state: a changed source
// crossfades over 3 s, a changed volume ramps over 0.3 s, changed params
// ramp over 0.3 s, master volume ramps over 0.3 s. Transport fades (start,
// pause, end) live on their own gain so they never fight the master volume.
//
// Focus Boost (task 4) is not wired here: task 4 inserts its node between
// the music layers' `Layer.output` and `graph.input`.
import type { Bus } from '../state/events';
import type { AppState, LayerState } from '../state/types';
import { fadeIn, fadeOut, rampTo } from './crossfade';
import { dB } from './dsp';
import { buildGraph, type MasterGraph } from './graph';
import { Layer } from './layer';
import { LevelMeter } from './levels';
import { SOURCES } from './sources';
import { loadNoiseWorklet } from './worklets/load';

export type { SoundSource, SourceFactory } from './source';
export { SOURCES } from './sources';

const VOLUME_RAMP = 0.3;
const PARAM_RAMP = 0.3;
const FADE_IN = 6;
const REOPEN = 4;                 // transport fade after end() when a new state arrives
const SIGNATURE_SEC = 4;
const SIGNATURE_HZ = 55;
const SIGNATURE_DB = -12;

export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly graph: MasterGraph;
  private readonly layers: Layer[];
  private readonly meter: LevelMeter;
  private last: AppState | null = null;    // last state pushed into the graph
  private pending: AppState | null = null; // state received before start()
  private started = false;
  private transportOpen = false;
  private generation = 0;                  // invalidates a pause()/end() that start() overtakes

  constructor(private readonly bus: Bus) {
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.graph = buildGraph(this.ctx);
    this.layers = [0, 1, 2, 3].map(() => new Layer(this.ctx, this.graph.input));
    this.meter = new LevelMeter(this.ctx, this.graph.analyser, this.bus);
  }

  get context(): AudioContext { return this.ctx; }
  /** Master analyser (post ceiling). Read-only tap for dev tooling; the app listens to `audio:levels`. */
  get analyser(): AnalyserNode { return this.graph.analyser; }

  /** Resume the context, play the 55 Hz signature swell, fade the transport in over 6 s. */
  async start(): Promise<void> {
    this.generation++;
    if (this.ctx.state !== 'running') await this.ctx.resume();
    await loadNoiseWorklet(this.ctx);          // sources check availability at construction
    this.started = true;

    const now = this.ctx.currentTime;
    if (!this.transportOpen) {
      this.signature(now);
      fadeIn(this.graph.transport.gain, now, FADE_IN);
      this.transportOpen = true;
    }
    this.meter.start();
    this.bus.emit('audio:ready', undefined);

    if (this.pending) { const s = this.pending; this.pending = null; this.apply(s); }
  }

  /** Make the graph match `state`. Before start() the state is parked and applied on start. */
  apply(state: AppState): void {
    if (!this.started) { this.pending = state; return; }
    const now = this.ctx.currentTime;
    const prev = this.last;

    state.layers.forEach((next, i) => this.applyLayer(this.layers[i], prev?.layers[i] ?? null, next, now));

    if (!prev || prev.master.volume !== state.master.volume) {
      rampTo(this.graph.input.gain, state.master.volume, now, VOLUME_RAMP);
    }
    // After end() the transport is closed; a fresh state (the break mix) reopens it gently.
    if (!this.transportOpen && this.ctx.state === 'running') {
      fadeIn(this.graph.transport.gain, now, REOPEN);
      this.transportOpen = true;
    }
    this.last = state;
  }

  /** Fade the transport out, then suspend the context (no CPU while paused). */
  async pause(fadeSec = 1.5): Promise<void> {
    const gen = ++this.generation;
    fadeOut(this.graph.transport.gain, this.ctx.currentTime, fadeSec);
    this.transportOpen = false;
    await wait(fadeSec);
    if (gen !== this.generation) return;      // start() came in during the fade
    this.meter.stop();
    await this.ctx.suspend();
  }

  /** The descent: fade the transport out over `fadeSec`; the context keeps running for the break. */
  async end(fadeSec: number): Promise<void> {
    const gen = ++this.generation;
    fadeOut(this.graph.transport.gain, this.ctx.currentTime, fadeSec);
    this.transportOpen = false;
    await wait(fadeSec);
    if (gen !== this.generation) return;
  }

  /** Tear everything down (harness / tests). Not part of §4 but keeps the graph leak-free. */
  async dispose(): Promise<void> {
    this.generation++;
    this.meter.stop();
    for (const l of this.layers) l.dispose();
    this.graph.dispose();
    this.last = null;
    this.pending = null;
    this.started = false;
    await this.ctx.close();
  }

  private applyLayer(layer: Layer, prev: LayerState | null, next: LayerState, now: number): void {
    if (!prev || prev.source !== next.source) {
      layer.setSource(next.source === 'none' ? null : SOURCES[next.source], next.params, now);
    } else {
      for (const [k, v] of Object.entries(next.params)) {
        if (prev.params[k] !== v) layer.setParam(k, v, PARAM_RAMP);
      }
    }
    const target = next.muted ? 0 : next.volume;
    const prevTarget = prev ? (prev.muted ? 0 : prev.volume) : -1;
    if (target !== prevTarget) layer.setVolume(target, now, VOLUME_RAMP);
  }

  /** The brand sound: a 55 Hz sine that swells to −12 dB and away again over 4 s. */
  private signature(at: number): void {
    const osc = new OscillatorNode(this.ctx, { type: 'sine', frequency: SIGNATURE_HZ });
    const env = new GainNode(this.ctx, { gain: 0 });
    osc.connect(env).connect(this.graph.transport);   // after master volume, so it is the same on every mix
    // Raised-cosine swell drawn with 8 linear segments (no curve events, see crossfade.ts).
    const peak = dB(SIGNATURE_DB);
    env.gain.setValueAtTime(0, at);
    for (let k = 1; k <= 8; k++) {
      const phase = (k / 8) * Math.PI;
      env.gain.linearRampToValueAtTime(peak * (1 - Math.cos(2 * phase)) / 2, at + SIGNATURE_SEC * k / 8);
    }
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
    osc.start(at);
    osc.stop(at + SIGNATURE_SEC + 0.1);
  }
}

const wait = (sec: number) => new Promise<void>((r) => setTimeout(r, sec * 1000));
