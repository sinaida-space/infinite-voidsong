// Local copy of the engine contract (docs/PLAN.md §4, "Engine API").
// Task 3 owns the canonical version; task 9 dedupes once both are merged.
import type { SourceId, Family } from '../../state/types';

export interface SoundSource {
  readonly id: SourceId;
  readonly family: Family;
  connect(dest: AudioNode): void;
  start(at: number): void;
  stop(at: number): void;                                   // internal fade >= 2 s, then teardown
  setParam(key: string, value: number, rampSec: number): void;
  dispose(): void;
}
export type SourceFactory = (ctx: AudioContext) => SoundSource;

// One scheduled bar of the lofi source, reported for the harness log and the
// "no identical consecutive bars" assertion.
export interface BarInfo {
  bar: number;          // running bar counter since start()
  time: number;         // audio-clock time of the bar's first step
  bpm: number;
  pattern: number;      // index into the 4-pattern pool
  chord: string | null; // roman numeral when a new chord starts on this bar
  signature: string;    // kick/snare/hat step strings joined; equal strings = identical bars
}

export interface LofiSource extends SoundSource {
  // Called when a kick is scheduled; `time` is the audio-clock time of the hit
  // (at most ~300 ms in the future). levels.ts folds it into LevelFrame.beat.
  onBeat: ((time: number) => void) | null;
  onBar: ((info: BarInfo) => void) | null;
}
