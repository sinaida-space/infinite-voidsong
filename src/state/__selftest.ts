import assert from 'node:assert';
import { encodeHash, decodeHash, type HashPayload } from './url';
import { PRESET_TABLE } from './presets';
import type { LayerState } from './types';

const payload: HashPayload = {
  layers: [
    { source: 'noise', volume: 0.55, muted: false, params: { 'noise.tilt': 0.6 } },
    { source: 'rain', volume: 0.35, muted: false, params: {} },
    { source: 'drone', volume: 0.3, muted: false, params: {} },
    { source: 'none', volume: 0.5, muted: false, params: {} },
  ] as [LayerState, LayerState, LayerState, LayerState],
  master: { volume: 0.5 },
  focusBoost: { depth: 0.3, rateHz: 16 },
  preset: 'deep-focus',
};

const hash = encodeHash(payload);
assert.ok(hash.startsWith('#v1.'), 'hash must start with #v1.');

const decoded = decodeHash(hash);
assert.deepStrictEqual(decoded, payload, 'round-trip encode/decode must be equal');

for (const [id, def] of Object.entries(PRESET_TABLE)) {
  const hasSound = def.layers.some((l) => l.source !== 'none');
  assert.ok(hasSound, `preset "${id}" must have at least one non-'none' layer`);
}

console.log('state selftest OK');
