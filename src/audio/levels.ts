// levels.ts — samples the master analyser ~30 times a second and publishes
// `audio:levels` for the visual layer.
//
// A 33 ms setInterval only *requests* a sample; the sample itself runs in
// requestAnimationFrame, so there is at most one per painted frame and
// nothing runs while the tab is hidden. Bands are averaged linear
// magnitudes (low < 250 Hz, mid 250–2 kHz, high > 2 kHz), each normalised
// by its own slowly decaying running maximum so any mix lands in 0..1.
import type { Bus } from '../state/events';

const TICK_MS = 33;
const MAX_DECAY = 0.995;     // per frame ≈ 6.5 s half-life at 30 Hz
const MAX_FLOOR = 1e-3;
const BEAT_DECAY = 0.85;

export class LevelMeter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending = false;
  private readonly freq: Float32Array<ArrayBuffer>;
  private readonly time: Float32Array<ArrayBuffer>;
  private readonly max = { rms: MAX_FLOOR, low: MAX_FLOOR, mid: MAX_FLOOR, high: MAX_FLOOR };
  private beat = 0;
  private readonly lowEnd: number;
  private readonly midEnd: number;

  constructor(private readonly ctx: BaseAudioContext, private readonly analyser: AnalyserNode, private readonly bus: Bus) {
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.time = new Float32Array(analyser.fftSize);
    const binHz = ctx.sampleRate / analyser.fftSize;
    this.lowEnd = Math.ceil(250 / binHz);
    this.midEnd = Math.ceil(2000 / binHz);
  }

  /** Hook for rhythmic sources (task 4 lofi kick): sets beat = 1, decays per frame. */
  kick(): void { this.beat = 1; }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(this.sample);
    }, TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private readonly sample = (): void => {
    this.pending = false;
    if (!this.timer || this.ctx.state !== 'running') return;

    this.analyser.getFloatFrequencyData(this.freq);
    this.analyser.getFloatTimeDomainData(this.time);

    let low = 0, mid = 0, high = 0;
    const n = this.freq.length;
    for (let i = 1; i < n; i++) {
      const mag = Math.pow(10, this.freq[i] / 20);       // dB → linear
      if (i < this.lowEnd) low += mag;
      else if (i < this.midEnd) mid += mag;
      else high += mag;
    }
    low /= this.lowEnd - 1;
    mid /= this.midEnd - this.lowEnd;
    high /= n - this.midEnd;

    let sq = 0;
    for (let i = 0; i < this.time.length; i++) sq += this.time[i] * this.time[i];
    const rms = Math.sqrt(sq / this.time.length);

    this.beat *= BEAT_DECAY;
    this.bus.emit('audio:levels', {
      rms: this.norm('rms', rms), low: this.norm('low', low), mid: this.norm('mid', mid), high: this.norm('high', high),
      beat: this.beat < 0.01 ? 0 : this.beat,
    });
  };

  private norm(key: keyof typeof this.max, v: number): number {
    this.max[key] = Math.max(this.max[key] * MAX_DECAY, v, MAX_FLOOR);
    return Math.min(1, v / this.max[key]);
  }
}
