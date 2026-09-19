// End-of-session signal: an arpeggio in C major, up and then down, on a synth.
//
// Three voices to choose from. All of them are built from plain oscillators
// (no recordings), start softly, and end in a tail, so nothing startles.
// `playChime` takes any AudioContext and connects to its destination on its own
// bus, so it is not touched by the session's fade-out of the soundscape.

export type ChimeVariant = 'glass' | 'pad' | 'pluck';

export const CHIME_VARIANTS: Array<{ id: ChimeVariant; name: string; blurb: string }> = [
  { id: 'glass', name: 'Glass', blurb: 'Bright bell-like notes with a soft reverb. Light and clear.' },
  { id: 'pad', name: 'Warm pad', blurb: 'Detuned synth notes that overlap, low and warm. The calmest of the three.' },
  { id: 'pluck', name: 'Retro pluck', blurb: 'Snappy synthwave pluck with an echo. The most noticeable.' },
];

// C major, in hertz.
const C4 = 261.63, E4 = 329.63, G4 = 392.0, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

const cents = (f: number, c: number): number => f * 2 ** (c / 1200);

/** A soft tail made from decaying stereo noise. */
function reverbImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  return buf;
}

interface Bus {
  input: GainNode;
}

/** level (0..1) -> gain -> limiter -> speakers. Returns the input of that chain. */
function makeBus(ctx: BaseAudioContext, level: number, when: number, seconds: number): Bus {
  const input = ctx.createGain();
  input.gain.value = level;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 0;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  input.connect(limiter).connect(ctx.destination);
  // Everything is disconnected again once the tail has died away.
  window.setTimeout(() => { input.disconnect(); limiter.disconnect(); }, (when - ctx.currentTime + seconds + 0.5) * 1000);
  return { input };
}

/** Plays a variant now. Returns its length in seconds. `level` is 0..1 (about 0.3 is comfortable). */
export function playChime(ctx: BaseAudioContext, variant: ChimeVariant, level = 0.3): number {
  if (ctx.state === 'suspended' && ctx instanceof AudioContext) void ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  switch (variant) {
    case 'pad': return pad(ctx, t0, level);
    case 'pluck': return pluck(ctx, t0, level);
    default: return glass(ctx, t0, level);
  }
}

// --- 1. Glass: sine bells with two upper partials, a little reverb ---------------------
function glass(ctx: BaseAudioContext, t0: number, level: number): number {
  const notes = [C5, E5, G5, C6, G5, E5, C5]; // up, then down
  const step = 0.15;
  const total = notes.length * step + 2.2;
  const bus = makeBus(ctx, level, t0, total);

  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  const verb = ctx.createConvolver();
  verb.buffer = reverbImpulse(ctx, 1.8);
  wet.connect(verb).connect(bus.input);
  const dry = ctx.createGain();
  dry.connect(bus.input);
  dry.connect(wet);

  notes.forEach((f, i) => {
    const t = t0 + i * step;
    const last = i === notes.length - 1;
    const decay = last ? 1.8 : 0.9;
    // fundamental and two partials, each fading faster than the one below
    ([[1, 0.6, decay], [2.01, 0.22, decay * 0.6], [4.0, 0.08, decay * 0.35]] as const).forEach(([mult, amp, len]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g).connect(dry);
      osc.start(t);
      osc.stop(t + len + 0.05);
    });
  });
  return total;
}

// --- 2. Warm pad: detuned saws through a low-pass, notes overlap -----------------------
function pad(ctx: BaseAudioContext, t0: number, level: number): number {
  const notes = [C4, E4, G4, C5, G4, E4, C4];
  const step = 0.3;
  const total = notes.length * step + 1.6;
  const bus = makeBus(ctx, level * 0.8, t0, total);

  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  const verb = ctx.createConvolver();
  verb.buffer = reverbImpulse(ctx, 2.2);
  wet.connect(verb).connect(bus.input);
  const dry = ctx.createGain();
  dry.connect(bus.input);
  dry.connect(wet);

  notes.forEach((f, i) => {
    const t = t0 + i * step;
    const last = i === notes.length - 1;
    const len = last ? 1.6 : 0.62; // longer than the step, so neighbours overlap
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.linearRampToValueAtTime(1800, t + 0.18);
    filter.frequency.exponentialRampToValueAtTime(700, t + len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.32, t + 0.05);
    env.gain.setValueAtTime(0.32, t + len * 0.45);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    filter.connect(env).connect(dry);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = cents(f, detune);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + len + 0.05);
    }
    const sub = ctx.createOscillator(); // an octave below, for weight
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain).connect(filter);
    sub.start(t);
    sub.stop(t + len + 0.05);
  });
  return total;
}

// --- 3. Retro pluck: saw and square with a snapping filter, and an echo ----------------
function pluck(ctx: BaseAudioContext, t0: number, level: number): number {
  const notes = [C4, E4, G4, C5, E5, G5, C6, G5, E5, C5, G4, E4, C4];
  const step = 0.09;
  const total = notes.length * step + 1.8;
  const bus = makeBus(ctx, level * 0.9, t0, total);

  // a dotted-eighth style echo with a darker return each time
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
  echoTone.connect(echoOut).connect(bus.input);

  const dry = ctx.createGain();
  dry.connect(bus.input);
  dry.connect(echo);

  notes.forEach((f, i) => {
    const t = t0 + i * step;
    const last = i === notes.length - 1;
    const len = last ? 0.9 : 0.28;
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
