// engine.ts — the public audio API (§4).
//
// Owns one AudioContext, the master chain, four layers and the level meter.
// `apply(state)` diffs against the last applied state: a changed source
// crossfades over 3 s, a changed volume ramps over 0.3 s, changed params
// ramp over 0.3 s, master volume ramps over 0.3 s. Transport fades (start,
// pause, end) live on their own gain so they never fight the master volume.
//
// Focus Boost: every layer routes through its own `focusBoostNode` on the
// way to `graph.input`. The node is a no-op pass-through at depth 0 (its
// default), so apply() only feeds it the real `state.focusBoost` while that
// layer's current source is family 'music'; every other layer is held at
// depth 0, which keeps the boost out of every other family without
// rebuilding the audio graph on a source swap.
import type { Bus } from '../state/events';
import { FAMILY_OF, type AppState, type FocusBoost, type LayerState } from '../state/types';
import { fadeIn, fadeOut, rampTo } from './crossfade';
import { dB } from './dsp';
import { focusBoostNode, type FocusBoostNode } from './focusboost';
import { buildGraph, type MasterGraph } from './graph';
import { Layer } from './layer';
import { LevelMeter } from './levels';
import { onBeat } from './music/register';
import { setHarmonyMode } from './music/harmony';
import { SOURCES } from './sources';
import { loadNoiseWorklet } from './worklets/load';

const FOCUS_BOOST_BYPASS: FocusBoost = { depth: 0, rateHz: 16 };

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
  private readonly focusBoosts: FocusBoostNode[];
  private readonly meter: LevelMeter;
  private readonly unsubscribeBeat: () => void;
  private last: AppState | null = null;    // last state pushed into the graph
  private pending: AppState | null = null; // state received before start()
  private started = false;
  private transportOpen = false;
  private held = false;                     // silence on purpose (end of work, pause): nothing reopens the sound until start()
  private generation = 0;                  // invalidates a pause()/end() that start() overtakes

  constructor(private readonly bus: Bus) {
    // iOS Safari mutes Web Audio while the hardware silent switch is on, unless the page
    // asks for the playback category (Audio Session API, iOS 16.4+).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) { try { session.type = 'playback'; } catch { /* unsupported value */ } }
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.graph = buildGraph(this.ctx);
    this.focusBoosts = [0, 1, 2, 3].map(() => focusBoostNode(this.ctx));
    this.layers = [0, 1, 2, 3].map((i) => new Layer(this.ctx, this.focusBoosts[i].input, i));
    this.focusBoosts.forEach((fb) => fb.output.connect(this.graph.input));
    this.meter = new LevelMeter(this.ctx, this.graph.analyser, this.bus);
    // Lofi kicks (music/beat.ts) feed the level meter so LevelFrame.beat is non-zero on the beat.
    this.unsubscribeBeat = onBeat(() => this.meter.kick());
  }

  get context(): AudioContext { return this.ctx; }
  /** Master analyser (post ceiling). Read-only tap for dev tooling; the app listens to `audio:levels`. */
  get analyser(): AnalyserNode { return this.graph.analyser; }

  /** Resume the context, play the 55 Hz signature swell, fade the transport in over 6 s. */
  async start(): Promise<void> {
    this.generation++;
    this.held = false;
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

    setHarmonyMode(state.harmony);   // before the layers, so a source created below already sees it
    state.layers.forEach((next, i) => this.applyLayer(this.layers[i], prev?.layers[i] ?? null, next, now));
    state.layers.forEach((next, i) => this.applyFocusBoost(this.focusBoosts[i], prev, state, next, i));

    if (!prev || prev.master.volume !== state.master.volume) {
      rampTo(this.graph.input.gain, state.master.volume, now, VOLUME_RAMP);
    }
    // After end() or pause() the transport stays closed until start(): a state change must not bring the sound back.
    if (!this.transportOpen && !this.held && this.ctx.state === 'running') {
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
    this.held = true;
    await wait(fadeSec);
    if (gen !== this.generation) return;      // start() came in during the fade
    this.meter.stop();
    await this.ctx.suspend();
  }

  /** The descent: fade the transport out over `fadeSec` and stay silent (the break) until start(). The context keeps running so the end-of-work and end-of-break signals can sound. */
  async end(fadeSec: number): Promise<void> {
    const gen = ++this.generation;
    fadeOut(this.graph.transport.gain, this.ctx.currentTime, fadeSec);
    this.transportOpen = false;
    this.held = true;
    await wait(fadeSec);
    if (gen !== this.generation) return;
  }

  /** Tear everything down (harness / tests). Not part of §4 but keeps the graph leak-free. */
  async dispose(): Promise<void> {
    this.generation++;
    this.unsubscribeBeat();
    this.meter.stop();
    for (const l of this.layers) l.dispose();
    for (const fb of this.focusBoosts) fb.dispose();
    this.graph.dispose();
    this.last = null;
    this.pending = null;
    this.started = false;
    await this.ctx.close();
  }

  /** Feeds `state.focusBoost` to layer `i`'s node only while its source is family 'music'; bypasses it otherwise. */
  private applyFocusBoost(node: FocusBoostNode, prev: AppState | null, state: AppState, next: LayerState, i: number): void {
    const family = next.source === 'none' ? null : FAMILY_OF[next.source];
    const target = family === 'music' ? state.focusBoost : FOCUS_BOOST_BYPASS;

    const prevLayer = prev?.layers[i] ?? null;
    const prevFamily = prevLayer && prevLayer.source !== 'none' ? FAMILY_OF[prevLayer.source] : null;
    const prevTarget = prevFamily === 'music' ? prev!.focusBoost : FOCUS_BOOST_BYPASS;

    if (!prev || target.depth !== prevTarget.depth || target.rateHz !== prevTarget.rateHz) {
      node.set(target);
    }
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
