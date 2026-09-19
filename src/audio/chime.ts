// The two session signals: a synth arpeggio in C major on the retro pluck voice.
//
//   down  the work block is over  (C6 down to C4)
//   up    the break is over       (C4 up to C6)
//
// A saw and a slightly detuned square go through a low-pass that snaps shut
// on every note, with a darker echo behind them. Plain oscillators, no
// recordings. It connects to the destination on its own bus, so it is not
// touched by the fade-out of the soundscape, and it takes a BaseAudioContext
// so it can also be rendered offline for measuring.

export type ChimeDirection = 'down' | 'up';

// C major, in hertz.
const C4 = 261.63, E4 = 329.63, G4 = 392.0, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
const UP = [C4, E4, G4, C5, E5, G5, C6];
const DOWN = [...UP].reverse();

const STEP = 0.09;       // seconds between notes
const cents = (f: number, c: number): number => f * 2 ** (c / 1200);

/** Plays the arpeggio now. `level` is 0..1 (about 0.3 is comfortable). Returns its length in seconds. */
export function playChime(ctx: BaseAudioContext, direction: ChimeDirection, level = 0.3): number {
  if (ctx.state === 'suspended' && ctx instanceof AudioContext) void ctx.resume();
  const notes = direction === 'down' ? DOWN : UP;
  const t0 = ctx.currentTime + 0.05;
  const total = notes.length * STEP + 1.8;

  // level -> limiter -> speakers, taken down again once the tail has died away
  const bus = ctx.createGain();
  bus.gain.value = level * 0.9;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 0;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  bus.connect(limiter).connect(ctx.destination);
  window.setTimeout(() => { bus.disconnect(); limiter.disconnect(); }, (t0 - ctx.currentTime + total + 0.5) * 1000);

  // a dotted-eighth style echo; each return is darker than the last
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.21;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.4;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2400;
  echo.connect(echoTone).connect(feedback).connect(echo);
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.5;
  echoTone.connect(echoOut).connect(bus);

  const dry = ctx.createGain();
  dry.connect(bus);
  dry.connect(echo);

  notes.forEach((f, i) => {
    const t = t0 + i * STEP;
    const last = i === notes.length - 1;
    const len = last ? 0.9 : 0.28; // the last note rings on
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(5200, t);
    filter.frequency.exponentialRampToValueAtTime(650, t + 0.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.34, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    filter.connect(env).connect(dry);
    ([['sawtooth', 0], ['square', 12]] as const).forEach(([type, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = cents(f, detune);
      const g = ctx.createGain();
      g.gain.value = type === 'square' ? 0.5 : 0.8;
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + len + 0.05);
    });
  });
  return total;
}
