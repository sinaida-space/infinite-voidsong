// Phrase building for Harmony Gentle and Drift. A 16-step bar becomes a two-bar
// phrase (A A') or a four-bar phrase (A A' A B): the second bar is the first
// with one or two notes swapped or one hit moved by a step, and B is the same
// idea pushed a little further. Step 0 never moves, so every bar keeps its
// downbeat. Harmony Off never comes through here.

// Swap two cells at most two steps apart. Swapping a hit with a rest moves the hit;
// swapping two notes exchanges them. `minGap` keeps hits at least that many steps
// apart (kicks need two, so the sidechain has recovered before the next dip).
export function varyCells<T>(cells: readonly T[], isHit: (c: T) => boolean, ops = 1, minGap = 1): T[] {
  const n = cells.length;
  const gapsOk = (bar: readonly T[]): boolean => {
    const hits: number[] = [];
    bar.forEach((c, i) => { if (isHit(c)) hits.push(i); });
    for (let k = 0; k < hits.length; k++) {
      const next = k + 1 < hits.length ? hits[k + 1] : hits[0] + n;   // the last hit against the next bar's first
      if (hits.length > 1 && next - hits[k] < minGap) return false;
    }
    return true;
  };

  let out = [...cells];
  for (let done = 0; done < ops; done++) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const i = 1 + Math.floor(Math.random() * (n - 1));                 // never step 0
      const j = i + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2);
      if (j < 1 || j >= n || out[i] === out[j]) continue;
      const trial = [...out];
      [trial[i], trial[j]] = [trial[j], trial[i]];
      if (!gapsOk(trial)) continue;
      out = trial;
      break;
    }
  }
  return out;
}

// A phrase of `bars` bars from one base bar: [A], [A, A'] or [A, A', A, B].
export function buildPhrase<B>(base: B, bars: 1 | 2 | 4, vary: (bar: B, ops: number) => B): B[] {
  if (bars === 1) return [base];
  if (bars === 2) return [base, vary(base, 1)];
  return [base, vary(base, 1), base, vary(base, 3)];
}

// Drum patterns as the lofi and chillhop pools write them: strings of 'x' and '.'.
export interface DrumPattern { kick: string; snare: string; hat: string; }

const strVary = (s: string, ops: number, minGap = 1): string =>
  varyCells(s.split(''), (c) => c === 'x', ops, minGap).join('');

// The kick keeps its two-step spacing, the snare keeps its backbeat, the hats move.
export const varyDrums = (p: DrumPattern, ops: number): DrumPattern => ({
  kick: strVary(p.kick, ops, 2),
  snare: p.snare,
  hat: strVary(p.hat, ops),
});

export const drumPhrase = (base: DrumPattern, bars: 1 | 2 | 4): DrumPattern[] => buildPhrase(base, bars, varyDrums);

// Note lines (arps, sequencer lines): null is a rest, anything else a note.
export const varyLine = <T>(line: readonly (T | null)[], ops: number): (T | null)[] => varyCells(line, (c) => c !== null, ops);
export const linePhrase = <T>(base: readonly (T | null)[], bars: 1 | 2 | 4): (T | null)[][] => buildPhrase(base as (T | null)[], bars, varyLine);
