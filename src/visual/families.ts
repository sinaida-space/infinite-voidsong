// Family and source tables and weight derivation for the tunnel.
// Family order is fixed and shared with the shader's uFamily[7] array.

import { FAMILY_OF, type AppState, type Family, type SourceId } from '../state/types';

export const FAMILIES: readonly Family[] = ['noise', 'water', 'air', 'fire', 'place', 'music', 'tone'];

export type Weights = Record<Family, number>;
export type RGB = [number, number, number];

// Music sources that carry their own tunnel hue (task 19). Any music source missing
// here falls back to the music family hue.
export const MUSIC_SOURCES = ['drone', 'lofi', 'plucks', 'synthwave', 'berlin', 'house', 'chillhop'] as const;
export type MusicSource = typeof MUSIC_SOURCES[number];
export type SourceWeights = Partial<Record<SourceId, number>>;

// Family hues: the only non-brand colours the app may show (spec, task 5).
export const FAMILY_HUE: Record<Family, RGB> = {
  water: hex('#3a7bd5'),
  air:   hex('#cccccc'),
  fire:  hex('#e08a1e'),
  noise: hex('#cd0000'),
  place: hex('#b39a7a'),
  music: hex('#a7bebe'),
  tone:  hex('#f6f6f6'),
};

// Per-source hues for the music family: [near the walls, far in the depth].
// Only synthwave is two-tone; the rest use one hue for both.
export const SOURCE_HUE: Record<MusicSource, [RGB, RGB]> = {
  drone:     [hex('#a7bebe'), hex('#a7bebe')],   // cathode
  lofi:      [hex('#d9a066'), hex('#d9a066')],   // warm amber
  plucks:    [hex('#b9d4cc'), hex('#b9d4cc')],   // pale chalk-teal
  synthwave: [hex('#ff2e88'), hex('#2ee6ff')],   // magenta near, cyan far
  berlin:    [hex('#8a6cff'), hex('#8a6cff')],   // violet
  house:     [hex('#2e7bff'), hex('#2e7bff')],   // electric blue
  chillhop:  [hex('#c9773a'), hex('#c9773a')],   // dusty orange
};

// Neutral gray tunnel for an empty mix (brand Fog).
export const NEUTRAL_HUE: RGB = hex('#999999');

// Base forward speed per family, rings per second at full weight.
export const FAMILY_BASE_SPEED: Record<Family, number> = {
  noise: 0.35, water: 0.30, air: 0.25, fire: 0.40, place: 0.20, music: 0.45, tone: 0.15,
};
export const NEUTRAL_SPEED = 0.25;

export const zeroWeights = (): Weights =>
  ({ noise: 0, water: 0, air: 0, fire: 0, place: 0, music: 0, tone: 0 });

export interface VisualWeights {
  families: Partial<Record<Family, number>>;
  sources: SourceWeights;
}

/** Family weights plus per-source weights for the music family, both from effective
 *  volume (muted, empty or silent slots count as 0), each group normalised to 1.
 *  An empty mix gives empty objects (neutral gray tunnel); a mix without music gives
 *  no source weights (music family hue is not used then anyway). */
export function deriveVisualWeights(state: AppState): VisualWeights {
  const families = weightsFromState(state);
  const sources: SourceWeights = {};
  let sum = 0;
  for (const layer of state.layers) {
    if (layer.source === 'none' || layer.muted || layer.volume <= 0) continue;
    if (FAMILY_OF[layer.source] !== 'music') continue;
    const v = Math.min(1, Math.max(0, layer.volume));
    sources[layer.source] = (sources[layer.source] ?? 0) + v;
    sum += v;
  }
  if (sum > 0) for (const s of Object.keys(sources) as SourceId[]) sources[s]! /= sum;
  return { families, sources };
}

/** Weight per family from the mixer: proportional to effective volume, normalised to 1.
 *  Muted or empty slots count as 0; an empty mix returns all zeros (neutral gray tunnel). */
export function weightsFromState(state: AppState): Weights {
  const w = zeroWeights();
  let sum = 0;
  for (const layer of state.layers) {
    if (layer.source === 'none' || layer.muted || layer.volume <= 0) continue;
    const v = Math.min(1, Math.max(0, layer.volume));
    w[FAMILY_OF[layer.source]] += v;
    sum += v;
  }
  if (sum > 0) for (const f of FAMILIES) w[f] /= sum;
  return w;
}

/** Fills missing families with 0 and normalises so the weights sum to 1 (or stay all-zero). */
export function normalizeWeights(partial: Partial<Weights>): Weights {
  const w = zeroWeights();
  let sum = 0;
  for (const f of FAMILIES) {
    const v = Math.max(0, partial[f] ?? 0);
    w[f] = v;
    sum += v;
  }
  if (sum > 0) for (const f of FAMILIES) w[f] /= sum;
  return w;
}

/** Keeps only known music sources, clamps at 0 and normalises to 1 (or stays empty). */
export function normalizeSources(partial: SourceWeights): Record<MusicSource, number> {
  const out = {} as Record<MusicSource, number>;
  let sum = 0;
  for (const s of MUSIC_SOURCES) {
    const v = Math.max(0, partial[s] ?? 0);
    out[s] = v;
    sum += v;
  }
  if (sum > 0) for (const s of MUSIC_SOURCES) out[s] /= sum;
  return out;
}

/** Music family hue as [near, far] from the source blend; no sources → family hue. */
export function blendMusicHue(s: Record<MusicSource, number>): [RGB, RGB] {
  const near: RGB = [0, 0, 0], far: RGB = [0, 0, 0];
  let sum = 0;
  for (const src of MUSIC_SOURCES) {
    const k = s[src];
    if (k <= 0) continue;
    const [n, f] = SOURCE_HUE[src];
    near[0] += n[0] * k; near[1] += n[1] * k; near[2] += n[2] * k;
    far[0] += f[0] * k; far[1] += f[1] * k; far[2] += f[2] * k;
    sum += k;
  }
  if (sum <= 0) return [[...FAMILY_HUE.music], [...FAMILY_HUE.music]];
  return [
    [near[0] / sum, near[1] / sum, near[2] / sum],
    [far[0] / sum, far[1] / sum, far[2] / sum],
  ];
}

/** Weighted hue blend as [near, far]; the music family contributes the source blend.
 *  All-zero weights give the neutral gray for both. */
export function blendHue(w: Weights, music: [RGB, RGB] = [FAMILY_HUE.music, FAMILY_HUE.music]): [RGB, RGB] {
  const near: RGB = [0, 0, 0], far: RGB = [0, 0, 0];
  let sum = 0;
  for (const f of FAMILIES) {
    const k = w[f];
    if (k <= 0) continue;
    const n = f === 'music' ? music[0] : FAMILY_HUE[f];
    const d = f === 'music' ? music[1] : FAMILY_HUE[f];
    near[0] += n[0] * k; near[1] += n[1] * k; near[2] += n[2] * k;
    far[0] += d[0] * k; far[1] += d[1] * k; far[2] += d[2] * k;
    sum += k;
  }
  if (sum <= 0) return [[...NEUTRAL_HUE], [...NEUTRAL_HUE]];
  return [
    [near[0] / sum, near[1] / sum, near[2] / sum],
    [far[0] / sum, far[1] / sum, far[2] / sum],
  ];
}

/** Rotates a colour's hue by `degrees` around the gray axis (YIQ chroma rotation). */
export function rotateHue(c: RGB, degrees: number): RGB {
  const a = degrees * Math.PI / 180;
  const cs = Math.cos(a), sn = Math.sin(a);
  // RGB → YIQ
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const i = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2];
  const q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
  const i2 = i * cs - q * sn;
  const q2 = i * sn + q * cs;
  // YIQ → RGB
  return [
    clamp01(y + 0.956 * i2 + 0.621 * q2),
    clamp01(y - 0.272 * i2 - 0.647 * q2),
    clamp01(y - 1.106 * i2 + 1.703 * q2),
  ];
}

/** Weighted base speed; all-zero weights give the neutral speed. */
export function blendSpeed(w: Weights): number {
  let out = 0, sum = 0;
  for (const f of FAMILIES) { out += FAMILY_BASE_SPEED[f] * w[f]; sum += w[f]; }
  return sum > 0 ? out / sum : NEUTRAL_SPEED;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
