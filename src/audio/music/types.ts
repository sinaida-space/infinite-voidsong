// The engine contract (docs/PLAN.md §4, "Engine API") lives in ../source;
// this module re-exports it so there is exactly one definition, and keeps
// the music-side additions (LofiSource, BarInfo) that ../source has no
// reason to know about.
import type { SoundSource } from '../source';
export type { SoundSource, SourceFactory } from '../source';

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
