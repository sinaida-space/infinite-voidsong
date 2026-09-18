// Plucks: sparse Karplus–Strong notes on the session pentatonic, spaced by a
// Poisson process (mean 8 s, clamped 4–12 s), each at a random soft velocity
// and a random pan, sent generously to the reverb. One in four is a dyad.
import type { SoundSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { karplusStrongBuffer } from '../music/buffers';
import { degreeToHz, sessionScale } from '../music/scale';
import { clamp, dbToGain, expRandom, rand } from '../music/util';

const MEAN_GAP = 8, MIN_GAP = 4, MAX_GAP = 12;
const VEL_MIN_DB = -20, VEL_MAX_DB = -12;
const DYAD_CHANCE = 0.25;
const NOTE_SEC = 2.5;

export const plucks: SourceFactory = (ctx: AudioContext): SoundSource => {
  const shell = makeShell(ctx, { level: 1, fadeIn: 2, fadeOut: 2 });
  const { bag, out } = shell;

  // Notes -> bus -> dry out and wide reverb.
  const bus = bag.add(ctx.createGain());
  const reverb = makeReverb(ctx, bag, 0.7);
  bus.connect(out);
  bus.connect(reverb.input);
  reverb.output.connect(out);

  // A pentatonic index across two octaves around the root: 0..9.
  const pentaHz = (index: number): number => {
    const n = sessionScale.pentatonic.length;
    const octave = Math.floor(index / n) - 1;   // octave below the root .. root octave
    const step = ((index % n) + n) % n;
    return degreeToHz(octave * n + step, sessionScale.pentatonic);
  };

  // One note: pre-rendered KS buffer -> velocity gain -> pan -> bus. A 10 ms
  // gain ramp at the start rounds the burst so the onset never clicks.
  const playNote = (t: number, hz: number, velDb: number): void => {
    const src = ctx.createBufferSource();          // one-shot, not bagged: it ends on its own
    src.buffer = karplusStrongBuffer(ctx, hz, NOTE_SEC);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbToGain(velDb), t + 0.01);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.6, 0.6);
    src.connect(g).connect(pan).connect(bus);
    src.start(t);
    src.stop(t + NOTE_SEC);
    src.onended = () => { src.disconnect(); g.disconnect(); pan.disconnect(); };
  };

  // Scheduler lane: play a note (or a dyad), return the next Poisson time.
  const step = (t: number): number | null => {
    if (shell.stopped) return null;
    const index = Math.floor(rand(0, 10));
    const vel = rand(VEL_MIN_DB, VEL_MAX_DB);
    playNote(t, pentaHz(index), vel);
    if (Math.random() < DYAD_CHANCE) {
      // Second note two or three pentatonic steps up (a 4th/5th-ish), slightly later and softer.
      playNote(t + rand(0.04, 0.09), pentaHz(index + (Math.random() < 0.5 ? 2 : 3)), vel - 3);
    }
    return t + clamp(expRandom(MEAN_GAP), MIN_GAP, MAX_GAP);
  };

  let started = false;
  return {
    id: 'plucks',
    family: 'music',
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      shell.start(t);
      shell.sched.add(t + rand(1, 3), step);
    },
    stop(at) { shell.stop(at); },
    setParam() { /* no user knobs */ },
    dispose() { shell.dispose(); },
  };
};
