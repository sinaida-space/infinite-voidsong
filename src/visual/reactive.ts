// Audio-reactive mapping and motion state for the tunnel.
// Pure state machine: no WebGL, no DOM. The renderer calls update(dt) once per frame
// and reads the resulting FrameParams into uniforms.

import type { LevelFrame } from '../state/events';
import {
  FAMILIES, MUSIC_SOURCES, blendHue, blendMusicHue, blendSpeed, normalizeSources, rotateHue,
  zeroWeights, type RGB, type SourceWeights, type Weights,
} from './families';

export type Motion = 'running' | 'decelerating' | 'still';

const DECEL_SEC = 8;          // decelerating: cubic ease-out to a stop
const XFADE_SEC = 3;          // family crossfade
const BEAT_MS = 300;          // uBeat decay
const MAX_STEP = 0.15;        // no modulated value changes more than 15 % frame to frame
const MAX_LINE_BRIGHT = 0.85; // text on top must stay legible
const BASE_LINE_BRIGHT = 0.80;
const HUE_DRIFT_DEG = 8;      // slow hue wander so no colour sits static
const HUE_DRIFT_HZ = 0.01;

export interface FrameParams {
  speed: number;              // forward speed, 0 when still
  lineBright: number;         // ≤ 0.85
  grain: number;              // noise-family grain amount
  widthAdd: number;           // music-family beat width boost
  beat: number;               // 0..1
  hue: RGB;                   // wall colour near the viewer (drifted)
  hueFar: RGB;                // wall colour deep in the tunnel (drifted)
  weights: Float32Array;      // 7 floats in FAMILIES order
  levels: [number, number, number, number];
}

/** Moves cur toward target by at most 15 % of |cur| per call, with a small floor so 0 can leave 0. */
export function approach(cur: number, target: number, maxStep = MAX_STEP): number {
  const limit = Math.max(Math.abs(cur) * maxStep, 0.004);
  const d = target - cur;
  return Math.abs(d) <= limit ? target : cur + Math.sign(d) * limit;
}

const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

export class Reactive {
  motion: Motion = 'still';
  reducedMotion = false;

  private targetW: Weights = zeroWeights();
  private fromW: Weights = zeroWeights();
  private curW: Weights = zeroWeights();
  private xfadeT = XFADE_SEC;   // seconds into the current crossfade; ≥ XFADE_SEC = done

  // Music source weights, crossfaded like the families (own clock: a source change can
  // arrive mid family crossfade).
  private targetS = normalizeSources({});
  private fromS = normalizeSources({});
  private curS = normalizeSources({});
  private xfadeS = XFADE_SEC;

  private huePhase = 0;         // seconds of hue drift; advances only while the picture moves

  private decelT = 0;           // seconds since decelerating began
  private decelFrom = 1;        // speed scale at that moment

  private levels: LevelFrame = { rms: 0, low: 0, mid: 0, high: 0, beat: 0 };
  private lastBeatIn = 0;
  private beatAge = Infinity;   // seconds since the last kick

  private speed = 0;
  private lineBright = BASE_LINE_BRIGHT;
  private grain = 0;
  private widthAdd = 0;

  readonly params: FrameParams = {
    speed: 0, lineBright: BASE_LINE_BRIGHT, grain: 0, widthAdd: 0, beat: 0,
    hue: blendHue(zeroWeights())[0], hueFar: blendHue(zeroWeights())[1],
    weights: new Float32Array(7), levels: [0, 0, 0, 0],
  };

  /** New family targets; crossfaded over 3 s from wherever the current blend is. */
  setFamilies(w: Weights): void {
    this.fromW = { ...this.curW };
    this.targetW = { ...w };
    this.xfadeT = 0;
  }

  /** New music-source targets (any subset of MUSIC_SOURCES); crossfaded over 3 s. */
  setSources(s: SourceWeights): void {
    this.fromS = { ...this.curS };
    this.targetS = normalizeSources(s);
    this.xfadeS = 0;
  }

  setMotion(m: Motion): void {
    if (m === 'decelerating') {
      if (this.motion === 'still') return;   // nothing to slow down
      this.decelT = 0;
      this.decelFrom = this.motion === 'decelerating' ? this.decelScale() : 1;
    }
    this.motion = m;
    if (m === 'still') this.speed = 0;
  }

  onLevels(l: LevelFrame): void {
    this.levels = l;
    // A kick arrives as a jump in the incoming beat value; restart the 300 ms decay.
    if (l.beat > this.lastBeatIn + 0.5) this.beatAge = 0;
    this.lastBeatIn = l.beat;
  }

  get crossfading(): boolean { return this.xfadeT < XFADE_SEC || this.xfadeS < XFADE_SEC; }

  /** True while anything on screen still needs new frames. */
  get animating(): boolean {
    if (this.crossfading) return true;
    if (this.reducedMotion) return false;
    return this.motion === 'running' || this.motion === 'decelerating';
  }

  private decelScale(): number {
    return this.decelFrom * (1 - easeOutCubic(Math.min(1, this.decelT / DECEL_SEC)));
  }

  /** Advances all smoothed values by dt seconds and refreshes params. */
  update(dt: number): FrameParams {
    const p = this.params;

    // Family crossfade (smoothstep over 3 s)
    if (this.xfadeT < XFADE_SEC) {
      this.xfadeT = Math.min(XFADE_SEC, this.xfadeT + dt);
      const x = this.xfadeT / XFADE_SEC;
      const k = x * x * (3 - 2 * x);
      for (const f of FAMILIES) this.curW[f] = this.fromW[f] + (this.targetW[f] - this.fromW[f]) * k;
    }
    FAMILIES.forEach((f, i) => { p.weights[i] = this.curW[f]; });

    // Source crossfade (same curve) feeds the music family's [near, far] hue
    if (this.xfadeS < XFADE_SEC) {
      this.xfadeS = Math.min(XFADE_SEC, this.xfadeS + dt);
      const x = this.xfadeS / XFADE_SEC;
      const k = x * x * (3 - 2 * x);
      for (const s of MUSIC_SOURCES) this.curS[s] = this.fromS[s] + (this.targetS[s] - this.fromS[s]) * k;
    }

    // Motion: running → full scale; decelerating → cubic ease-out over 8 s, then still
    let scale = 0;
    if (this.motion === 'running') scale = 1;
    else if (this.motion === 'decelerating') {
      this.decelT += dt;
      scale = this.decelScale();
      if (this.decelT >= DECEL_SEC) { this.motion = 'still'; scale = 0; }
    }
    if (this.reducedMotion) scale = 0;

    // Hue: family blend with the source blend inside the music slot, then a slow ±8°
    // wander that freezes with the picture (still frame / reduced motion).
    if (!this.reducedMotion && this.motion !== 'still') this.huePhase += dt;
    const drift = HUE_DRIFT_DEG * Math.sin(this.huePhase * 2 * Math.PI * HUE_DRIFT_HZ);
    const [near, far] = blendHue(this.curW, blendMusicHue(this.curS));
    p.hue = rotateHue(near, drift);
    p.hueFar = rotateHue(far, drift);

    const L = this.levels;
    const wNoise = this.curW.noise;
    const wMusic = this.curW.music;

    // Beat: 1 on the kick, linear decay to 0 over 300 ms
    this.beatAge += dt;
    const beat = Math.max(0, 1 - (this.beatAge * 1000) / BEAT_MS);

    // Targets from the spec's mapping, then rate-limited to 15 % per frame.
    // The low band leans on the forward push (±15 % around the family speed).
    const speedTarget = blendSpeed(this.curW) * (0.85 + 0.3 * L.low) * scale;
    const brightTarget = Math.min(MAX_LINE_BRIGHT, BASE_LINE_BRIGHT * (0.92 + 0.12 * L.rms));
    const grainTarget = wNoise * 0.6 * (1 + 0.5 * L.high);
    const widthTarget = 0.3 * beat * wMusic;

    // Deceleration is already a smooth curve; the cap would only delay it, so it applies to
    // the audio modulation only while running.
    this.speed = this.motion === 'running' && !this.reducedMotion
      ? approach(this.speed, speedTarget) : speedTarget;
    this.lineBright = approach(this.lineBright, brightTarget);
    this.grain = approach(this.grain, grainTarget);
    this.widthAdd = approach(this.widthAdd, widthTarget);

    p.speed = this.speed;
    p.lineBright = this.lineBright;
    p.grain = this.grain;
    p.widthAdd = this.widthAdd;
    p.beat = beat;
    p.levels = [L.rms, L.low, L.mid, L.high];
    return p;
  }
}
