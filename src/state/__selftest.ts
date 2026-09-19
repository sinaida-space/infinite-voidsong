import assert from 'node:assert';
import { encodeHash, decodeHash, type HashPayload } from './url';
import { PRESET_TABLE, applyPreset, type PresetContext } from './presets';
import type { LayerState, TaskPreset } from './types';

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

const withHarmony: HashPayload = { ...payload, harmony: 'drift' };
assert.deepStrictEqual(decodeHash(encodeHash(withHarmony)), withHarmony, 'harmony survives the hash round-trip');
assert.strictEqual(decodeHash(hash)?.harmony, undefined, 'a hash without harmony decodes without it (the store reads that as off)');

for (const [id, def] of Object.entries(PRESET_TABLE)) {
  const hasSound = def.layers.some((l) => l.source !== 'none');
  assert.ok(hasSound, `preset "${id}" must have at least one non-'none' layer`);
}

// applyPreset must not throw for any TaskPreset × PresetContext combination
// (regression guard for the task-14 onboarding bug: a throw here left the
// quiz's `finish()` mid-flight, so `onboarded`/`playback` never updated).
const NOISE_ANSWERS: PresetContext['noise'][] = ['quiet', 'home', 'office', 'varies'];
const OUTPUT_ANSWERS: PresetContext['output'][] = ['headphones', 'speakers'];

for (const id of Object.keys(PRESET_TABLE) as TaskPreset[]) {
  applyPreset(id); // no ctx
  for (const noise of NOISE_ANSWERS) {
    for (const output of OUTPUT_ANSWERS) {
      assert.doesNotThrow(
        () => applyPreset(id, { noise, output }),
        `applyPreset("${id}", { noise: "${noise}", output: "${output}" }) must not throw`,
      );
    }
  }
}

console.log('state selftest OK');
