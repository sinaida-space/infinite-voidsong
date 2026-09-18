// Pre-rendered AudioBuffers: noise beds, Karplus–Strong strings, reverb impulse.
// Rendering in JS once is cheaper on mobile than running extra nodes forever,
// and keeps this task off AudioWorklets (task 3 owns those).

const whiteCache = new WeakMap<AudioContext, AudioBuffer>();
const pinkCache = new WeakMap<AudioContext, AudioBuffer>();
const irCache = new WeakMap<AudioContext, AudioBuffer>();
const ksCache = new WeakMap<AudioContext, Map<number, AudioBuffer>>();

// 2 s of white noise, looped by the drum hits (they only read a few ms at a random offset).
export function whiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = whiteCache.get(ctx);
  if (buf) return buf;
  buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  whiteCache.set(ctx, buf);
  return buf;
}

// 4 s of stereo pink noise (Paul Kellet's 3-pole approximation, -3 dB/oct),
// looped by the tone source. Two independent channels so the band sounds wide.
export function pinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = pinkCache.get(ctx);
  if (buf) return buf;
  buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 4), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;   // 0.2 keeps peaks inside ±1
    }
  }
  pinkCache.set(ctx, buf);
  return buf;
}

// Karplus–Strong plucked string at `hz`: a noise burst circulates in a delay line
// of N = sampleRate / hz samples through a two-point average (the low-pass in
// the feedback path) scaled by `loss` per period, so highs die first and the
// note decays like a real string. Rendered per pitch and cached.
export function karplusStrongBuffer(ctx: AudioContext, hz: number, seconds = 2.5, loss = 0.996): AudioBuffer {
  let perCtx = ksCache.get(ctx);
  if (!perCtx) { perCtx = new Map(); ksCache.set(ctx, perCtx); }
  const key = Math.round(hz * 10);
  const cached = perCtx.get(key);
  if (cached) return cached;

  const sr = ctx.sampleRate;
  const N = Math.max(2, Math.round(sr / hz));
  const buf = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
  const y = buf.getChannelData(0);
  // Excitation: one period of noise, gently pre-smoothed so the attack has body rather than fizz.
  let prev = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; y[i] = 0.5 * (w + prev); prev = w; }
  for (let i = N; i < y.length; i++) y[i] = loss * 0.5 * (y[i - N] + y[i - N + 1]);
  // Fade the last 50 ms so a stopped voice never clicks.
  const tail = Math.floor(sr * 0.05);
  for (let i = 0; i < tail; i++) y[y.length - 1 - i] *= i / tail;

  perCtx.set(key, buf);
  return buf;
}

// Synthesised reverb impulse: 2.5 s of exponentially decayed stereo noise whose
// low-pass cutoff falls over time (air absorbs highs first). One-pole LPF:
// y += (1 - a) * (x - y) with a = exp(-2*pi*fc/sr).
export function reverbImpulse(ctx: AudioContext, seconds = 2.5): AudioBuffer {
  let buf = irCache.get(ctx);
  if (buf) return buf;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  buf = ctx.createBuffer(2, len, sr);
  const decayRate = 6.9 / seconds;   // ln(1000): -60 dB at the end of the tail
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const fc = 8000 - 7000 * (t / seconds);            // 8 kHz -> 1 kHz across the tail
      const a = Math.exp(-2 * Math.PI * fc / sr);
      const x = (Math.random() * 2 - 1) * Math.exp(-decayRate * t);
      y += (1 - a) * (x - y);
      d[i] = y;
    }
  }
  irCache.set(ctx, buf);
  return buf;
}
