// Session scale: one root (A-flat..C) and one mode (Dorian or Lydian), chosen
// once per page load so every music source agrees on the key.
import { midiToHz, pick } from './util';

export type ModeName = 'dorian' | 'lydian';

// Semitone offsets of the seven scale degrees.
const MODES: Record<ModeName, readonly number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],   // minor with a raised 6th: soft, unresolved
  lydian: [0, 2, 4, 6, 7, 9, 11],   // major with a raised 4th: bright, floating
};
// Five-note subsets that avoid the mode's tension tones; used by plucks.
const PENTATONIC: Record<ModeName, readonly number[]> = {
  dorian: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 7, 9],
};

export interface SessionScale {
  root: number;                  // MIDI note of the root in octave 3: A-flat3 (56) .. C4 (60)
  mode: ModeName;
  steps: readonly number[];      // semitone offsets, 7 entries
  pentatonic: readonly number[]; // semitone offsets, 5 entries
}

const mode = pick<ModeName>(['dorian', 'lydian']);
export const sessionScale: SessionScale = {
  root: 56 + Math.floor(Math.random() * 5),
  mode,
  steps: MODES[mode],
  pentatonic: PENTATONIC[mode],
};

export const rootName = (): string =>
  ['A-flat', 'A', 'B-flat', 'B', 'C'][sessionScale.root - 56] + ' ' + sessionScale.mode;

// Scale degree (any integer; 7 = root an octave up, -1 = 7th below) to MIDI.
export function degreeToMidi(degree: number, steps: readonly number[] = sessionScale.steps): number {
  const n = steps.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return sessionScale.root + octave * 12 + steps[idx];
}
export const degreeToHz = (degree: number, steps?: readonly number[], rootShift = 0): number =>
  midiToHz(degreeToMidi(degree, steps) + foldShift(rootShift));

// A key change of +7 (up a fifth) or -7 (a fourth up in the other direction) is
// folded upward into 0..11 semitones so the bass register never drops: +7 stays
// +7, -7 becomes +5. With the home root at A-flat..C (56..60) the sounding root
// therefore stays within 56..67.
export const foldShift = (semitones: number): number => ((Math.round(semitones) % 12) + 12) % 12;

// Chords as scale-degree roots (0-based), each voiced as a 7th chord: stacked thirds.
export type Roman = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°';
const ROMAN_ROOT: Record<Roman, number> = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5, 'vii°': 6 };
export const romanRoot = (roman: Roman): number => ROMAN_ROOT[roman];
export function chordDegrees(roman: Roman): number[] {
  const r = ROMAN_ROOT[roman];
  return [r, r + 2, r + 4, r + 6];
}

// Harmony Off: ii–V–I–vi, the loop every source has always played.
export const PROGRESSION: readonly Roman[] = ['ii', 'V', 'I', 'vi'];

// Harmony Gentle and Drift: circle-of-fifths chains. Each root sits a fourth
// above the previous one (scale degree + 3), which is the same as a fifth down,
// so every step resolves the way ii–V–I does. All chords are diatonic to the
// session mode because they are stacked from its own steps.
export const PROGRESSION_POOL: readonly (readonly Roman[])[] = [
  ['iii', 'vi', 'ii', 'V', 'I'],
  ['vi', 'ii', 'V', 'I', 'IV'],
  ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
  ['ii', 'V', 'I', 'IV'],
  ['IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
  ['vii°', 'iii', 'vi', 'ii', 'V', 'I'],
  ['V', 'I', 'IV', 'vii°', 'iii', 'vi'],
];
