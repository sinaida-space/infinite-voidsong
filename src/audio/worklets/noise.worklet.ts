// noise.worklet.ts — runs on the audio rendering thread.
//
// One processor, stereo output, three generators per channel:
//   white  = xorshift32 PRNG, uniform in [-1, 1]
//   pink   = Paul Kellet's 7-pole filter fed by the white stream
//   brown  = leaky integrator of the white stream (gain 0.02, leak 0.998)
// The `tilt` parameter (0 = white, 0.5 = pink, 1 = brown) blends adjacent
// pairs with an equal-power (sin/cos) law so loudness stays flat across the
// sweep. Each channel has its own PRNG seed, so left and right are
// decorrelated and the noise has stereo width.
//
// Scale factors below equalise RMS of the three colours to about 0.17
// (measured offline; see src/audio/dsp.ts which mirrors the generators for
// the buffer-based fallback and for grain material).
//
// The file is self-contained on purpose: it is bundled by Vite as a worker
// entry (`?worker&url`) and loaded with `audioWorklet.addModule`, which the
// CSP `worker-src 'self' blob:` permits.

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor,
): void;

const WHITE_SCALE = 0.3;
const PINK_SCALE = 0.097;
const BROWN_SCALE = 0.94;

class ChannelState {
  seed: number;
  b0 = 0; b1 = 0; b2 = 0; b3 = 0; b4 = 0; b5 = 0; b6 = 0; // pink poles
  brown = 0;
  constructor(seed: number) { this.seed = seed >>> 0 || 1; }

  /** xorshift32 → uniform white sample in [-1, 1]. */
  white(): number {
    let x = this.seed;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.seed = x;
    return x / 2147483648 - 1;
  }

  /** Paul Kellet's "refined" pink filter: −3 dB/octave from ~10 Hz up. */
  pink(w: number): number {
    this.b0 = 0.99886 * this.b0 + w * 0.0555179;
    this.b1 = 0.99332 * this.b1 + w * 0.0750759;
    this.b2 = 0.96900 * this.b2 + w * 0.1538520;
    this.b3 = 0.86650 * this.b3 + w * 0.3104856;
    this.b4 = 0.55000 * this.b4 + w * 0.5329522;
    this.b5 = -0.7616 * this.b5 - w * 0.0168980;
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362;
    this.b6 = w * 0.115926;
    return out;
  }

  /** Leaky integrator: −6 dB/octave, leak keeps DC from wandering off. */
  brownian(w: number): number {
    this.brown = this.brown * 0.998 + w * 0.02;
    return this.brown;
  }
}

class NoiseProcessor extends AudioWorkletProcessor {
  private channels = [new ChannelState(0x9e3779b9), new ChannelState(0x85ebca6b)];
  private alive = true;

  static get parameterDescriptors() {
    return [{ name: 'tilt', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' as const }];
  }

  constructor() {
    super();
    // The owning node posts 'stop' on dispose so process() can return false
    // and let the processor be garbage-collected.
    this.port.onmessage = (e: MessageEvent) => { if (e.data === 'stop') this.alive = false; };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>): boolean {
    if (!this.alive) return false;
    const out = outputs[0];
    if (!out || out.length === 0) return true;

    // Equal-power blend weights for the current tilt (k-rate: one value per block).
    const tilt = params.tilt[0];
    let wWhite = 0, wPink = 0, wBrown = 0;
    if (tilt < 0.5) {
      const theta = (tilt * 2) * Math.PI / 2;
      wWhite = Math.cos(theta); wPink = Math.sin(theta);
    } else {
      const theta = ((tilt - 0.5) * 2) * Math.PI / 2;
      wPink = Math.cos(theta); wBrown = Math.sin(theta);
    }
    wWhite *= WHITE_SCALE; wPink *= PINK_SCALE; wBrown *= BROWN_SCALE;

    for (let c = 0; c < out.length; c++) {
      const buf = out[c];
      const st = this.channels[c % this.channels.length];
      for (let i = 0; i < buf.length; i++) {
        const w = st.white();
        // Every generator advances each sample so a tilt sweep never
        // reveals a "cold" filter state.
        const p = st.pink(w);
        const b = st.brownian(w);
        buf[i] = w * wWhite + p * wPink + b * wBrown;
      }
    }
    return true;
  }
}

registerProcessor('voidsong-noise', NoiseProcessor);
