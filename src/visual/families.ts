// Family tables and weight derivation for the tunnel.
// Order is fixed and shared with the shader's uFamily[7] array.

import { FAMILY_OF, type AppState, type Family } from '../state/types';

export const FAMILIES: readonly Family[] = ['noise', 'water', 'air', 'fire', 'place', 'music', 'tone'];

export type Weights = Record<Family, number>;

// Family hues: the only non-brand colours the app may show (spec, task 5).
export const FAMILY_HUE: Record<Family, [number, number, number]> = {
  water: hex('#3a7bd5'),
  air:   hex('#cccccc'),
  fire:  hex('#e08a1e'),
  noise: hex('#cd0000'),
  place: hex('#b39a7a'),
  music: hex('#a7bebe'),
  tone:  hex('#f6f6f6'),
};

// Neutral gray tunnel for an empty mix (brand Fog).
export const NEUTRAL_HUE: [number, number, number] = hex('#999999');

// Base forward speed per family, rings per second at full weight.
export const FAMILY_BASE_SPEED: Record<Family, number> = {
  noise: 0.35, water: 0.30, air: 0.25, fire: 0.40, place: 0.20, music: 0.45, tone: 0.15,
};
export const NEUTRAL_SPEED = 0.25;

export const zeroWeights = (): Weights =>
  ({ noise: 0, water: 0, air: 0, fire: 0, place: 0, music: 0, tone: 0 });

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

/** Weighted hue blend; all-zero weights give the neutral gray. */
export function blendHue(w: Weights): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  let sum = 0;
  for (const f of FAMILIES) {
    const k = w[f];
    if (k <= 0) continue;
    const h = FAMILY_HUE[f];
    out[0] += h[0] * k; out[1] += h[1] * k; out[2] += h[2] * k;
    sum += k;
  }
  if (sum <= 0) return [...NEUTRAL_HUE];
  return [out[0] / sum, out[1] / sum, out[2] / sum];
}

/** Weighted base speed; all-zero weights give the neutral speed. */
export function blendSpeed(w: Weights): number {
  let out = 0, sum = 0;
  for (const f of FAMILIES) { out += FAMILY_BASE_SPEED[f] * w[f]; sum += w[f]; }
  return sum > 0 ? out / sum : NEUTRAL_SPEED;
}

function hex(s: string): [number, number, number] {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
