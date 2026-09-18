// noise — the coloured-noise generator.
//
//   worklet (white/pink/brown blended by tilt)
//     → high-shelf −4 dB @ 12 kHz (less hiss fatigue)
//     → slow gain wander ±2 dB over 10–30 s (keeps it from feeling frozen)
//     → env
//
// If the worklet failed to load, three looping noise buffers stand in and
// the tilt blend is done with three gains using the same equal-power law.
import { rampTo } from '../crossfade';
import { dB, noiseLoop } from '../dsp';
import { BaseSource } from '../source';
import { hasNoiseWorklet, NOISE_PROCESSOR } from '../worklets/load';

const DEFAULT_TILT = 0.5;

/** Equal-power weights for a tilt in 0..1 (0 white, 0.5 pink, 1 brown). */
function tiltWeights(tilt: number): [number, number, number] {
  if (tilt < 0.5) {
    const th = tilt * 2 * Math.PI / 2;
    return [Math.cos(th), Math.sin(th), 0];
  }
  const th = (tilt - 0.5) * 2 * Math.PI / 2;
  return [0, Math.cos(th), Math.sin(th)];
}

class NoiseSource extends BaseSource {
  private worklet: AudioWorkletNode | null = null;
  private fallbackGains: [GainNode, GainNode, GainNode] | null = null;

  constructor(ctx: AudioContext) {
    super('noise', 'noise', ctx, 0);

    const shelf = this.own(new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 12000, gain: -4 }));
    const wander = this.own(new GainNode(ctx, { gain: 1 }));
    shelf.connect(wander).connect(this.env);
    this.sched.wander(wander.gain, dB(-2), dB(2), 10, 30);

    if (hasNoiseWorklet(ctx)) {
      this.worklet = this.own(new AudioWorkletNode(ctx, NOISE_PROCESSOR, {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        parameterData: { tilt: DEFAULT_TILT },
      }));
      this.worklet.connect(shelf);
    } else {
      const w = tiltWeights(DEFAULT_TILT);
      const colors = ['white', 'pink', 'brown'] as const;
      this.fallbackGains = colors.map((c, i) => {
        const g = this.own(new GainNode(ctx, { gain: w[i] }));
        this.play(noiseLoop(ctx, c)).connect(g).connect(shelf);
        return g;
      }) as [GainNode, GainNode, GainNode];
    }
  }

  setParam(key: string, value: number, rampSec: number): void {
    if (key !== 'noise.tilt') return;
    const tilt = Math.min(1, Math.max(0, value));
    const now = this.ctx.currentTime;
    if (this.worklet) {
      rampTo(this.worklet.parameters.get('tilt')!, tilt, now, rampSec);
    } else if (this.fallbackGains) {
      const w = tiltWeights(tilt);
      this.fallbackGains.forEach((g, i) => rampTo(g.gain, w[i], now, rampSec));
    }
  }

  dispose(): void {
    // Tell the processor to return false from process() so it can be collected.
    this.worklet?.port.postMessage('stop');
    super.dispose();
  }
}

export const noise = (ctx: AudioContext) => new NoiseSource(ctx);
