// dsp.ts — small shared helpers: units, randomness, cached noise material.
//
// Sources other than `noise` run entirely on native nodes. Their noise beds
// are looping AudioBufferSourceNodes fed from buffers generated here (6 s,
// stereo, decorrelated channels). A 6 s loop of filtered noise has no
// audible period, and it costs the audio thread nothing beyond a buffer read.
// The generators mirror src/audio/worklets/noise.worklet.ts (kept in sync by
// hand; the worklet must stay self-contained to bundle as a worker).

export const dB = (db: number): number => Math.pow(10, db / 20);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** Exponential gap for a Poisson process with `ratePerSec` events per second. */
export const poissonGap = (ratePerSec: number): number => -Math.log(1 - Math.random()) / ratePerSec;

export type NoiseColor = 'white' | 'pink' | 'brown';

const NOISE_SECONDS = 6;
const SCALE: Record<NoiseColor, number> = { white: 0.3, pink: 0.097, brown: 0.94 }; // RMS ≈ 0.17 each

/** Fill `out` with one channel of coloured noise, starting from `seed`. */
function fillNoise(out: Float32Array, color: NoiseColor, seed: number): void {
  let x = seed >>> 0 || 1;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
  const scale = SCALE[color];
  for (let i = 0; i < out.length; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;   // xorshift32
    const w = x / 2147483648 - 1;
    if (color === 'white') { out[i] = w * scale; continue; }
    if (color === 'brown') { brown = brown * 0.998 + w * 0.02; out[i] = brown * scale; continue; }
    // Paul Kellet pink
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * scale;
    b6 = w * 0.115926;
  }
}

const bufferCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function cached(ctx: BaseAudioContext, key: string, make: () => AudioBuffer): AudioBuffer {
  let map = bufferCache.get(ctx);
  if (!map) { map = new Map(); bufferCache.set(ctx, map); }
  let buf = map.get(key);
  if (!buf) { buf = make(); map.set(key, buf); }
  return buf;
}

/** Stereo 6 s noise buffer of the given colour, generated once per context. */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  return cached(ctx, `bed:${color}`, () => {
    const buf = ctx.createBuffer(2, Math.floor(NOISE_SECONDS * ctx.sampleRate), ctx.sampleRate);
    fillNoise(buf.getChannelData(0), color, 0x9e3779b9);
    fillNoise(buf.getChannelData(1), color, 0x85ebca6b);
    return buf;
  });
}

/** Mono 1 s white buffer used as grain material (droplets, crackle, page turns). */
export function grainBuffer(ctx: BaseAudioContext): AudioBuffer {
  return cached(ctx, 'grain', () => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    fillNoise(buf.getChannelData(0), 'white', 0xc2b2ae35);
    return buf;
  });
}

/**
 * A looping bed of coloured noise. Starts at a random offset so two beds of
 * the same colour in different layers are never phase-locked. The caller
 * owns start()/stop().
 */
export function noiseLoop(ctx: BaseAudioContext, color: NoiseColor): AudioBufferSourceNode {
  const src = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx, color), loop: true });
  src.loopEnd = NOISE_SECONDS;
  // Offset is applied at start(); keep it on the node so BaseSource.play can use it.
  (src as AudioBufferSourceNode & { __offset?: number }).__offset = Math.random() * NOISE_SECONDS;
  return src;
}

/**
 * Fire one noise grain: a short burst from the grain buffer with a linear
 * attack/decay envelope, routed into `dest` (usually a shared filter).
 * `attack` defaults to a third of the length so sub-10 ms grains stay soft.
 * Nodes disconnect themselves when the grain ends.
 */
export function grain(
  ctx: BaseAudioContext, dest: AudioNode, at: number, lengthSec: number, peak: number, attackSec = lengthSec / 3,
): void {
  const src = new AudioBufferSourceNode(ctx, { buffer: grainBuffer(ctx) });
  const env = new GainNode(ctx, { gain: 0 });
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + attackSec);
  env.gain.linearRampToValueAtTime(0, at + lengthSec);
  src.connect(env).connect(dest);
  src.onended = () => { src.disconnect(); env.disconnect(); };
  src.start(at, Math.random() * 0.9, lengthSec + 0.005);
}

/**
 * Fire one decaying sine "ping" (clinks, bubbles). `glideTo` optionally
 * sweeps the pitch exponentially over the attack + decay.
 */
export function ping(
  ctx: BaseAudioContext, dest: AudioNode, at: number,
  freq: number, peak: number, attackSec: number, decaySec: number, glideTo?: number,
): void {
  const osc = new OscillatorNode(ctx, { type: 'sine', frequency: freq });
  const env = new GainNode(ctx, { gain: 0 });
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + attackSec);
  // setTargetAtTime gives the natural exponential tail; τ = decay / 5 reaches −43 dB by `decay`.
  env.gain.setTargetAtTime(0, at + attackSec, decaySec / 5);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + attackSec + decaySec);
  osc.connect(env).connect(dest);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
  osc.start(at);
  osc.stop(at + attackSec + decaySec * 1.5);
}
