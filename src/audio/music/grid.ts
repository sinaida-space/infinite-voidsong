// 16-step bar grid as one scheduler lane, shared by the sequenced sources
// (synthwave, berlin, house, chillhop). The lane counts steps and bars, applies
// swing, reads the tempo once per bar so a bar keeps one grid, and calls back
// at the start of each bar and on every step. Timing comes from the audio
// clock through the look-ahead scheduler, never from JS timers.
import type { Step } from './scheduler';

export const STEPS = 16;   // 16th notes per 4/4 bar

export interface GridHooks {
  swing: number;                                             // 0.5 = straight; 0.56 = the first 16th of each pair takes 56 % of the eighth
  bpm: () => number;                                         // read at the top of every bar
  stopped: () => boolean;                                    // true ends the lane
  beginBar: (t: number, bar: number, bpm: number) => void;   // called at step 0, before step()
  step: (t: number, s: number, bar: number) => void;         // called for every 16th
}

export function gridLane(h: GridHooks): Step {
  let bar = 0;
  let stepIndex = 0;
  let barStart = 0;
  let barBpm = h.bpm();

  // Time of step `s` inside the current bar. Swing delays the odd 16ths.
  const stepTime = (s: number): number => {
    const pair = (60 / barBpm / 4) * 2;   // one eighth = two 16ths
    return barStart + Math.floor(s / 2) * pair + (s % 2 ? h.swing * pair : 0);
  };

  return (t: number): number | null => {
    if (h.stopped()) return null;
    if (stepIndex === 0) {
      barBpm = h.bpm();
      barStart = t;
      h.beginBar(t, bar, barBpm);
    }
    h.step(t, stepIndex, bar);
    stepIndex++;
    if (stepIndex < STEPS) return stepTime(stepIndex);
    stepIndex = 0;
    bar++;
    return barStart + (60 / barBpm) * 4;
  };
}

// Pick an index in [0, n) that differs from `last`, so a pattern pool never
// plays the same entry twice in a row (the "no identical consecutive bars" rule).
export function pickDifferent(n: number, last: number): number {
  let p: number;
  do { p = Math.floor(Math.random() * n); } while (p === last);
  return p;
}
