// rain — a pink bed plus Poisson droplets.
//
//   pink loop → LPF 6 kHz → bed gain (wander ±1.5 dB) → env
//   droplets: 2–6 ms noise grains → one of five bandpass "lanes"
//             (2.5–7.5 kHz, each panned to its own spot) → env
//
// Droplet density wanders between 40 and 120 per second. Grains are
// sub-10 ms and sit ≈ 14 dB below the bed, as the onset rule requires.
import { dB, grain, noiseLoop, poissonGap, rand } from '../dsp';
import { BaseSource } from '../source';

const LANES = [
  { hz: 2500, pan: -0.7 }, { hz: 3500, pan: 0.4 }, { hz: 4500, pan: -0.2 }, { hz: 6000, pan: 0.8 }, { hz: 7500, pan: -0.5 },
];

class RainSource extends BaseSource {
  private rate = 70;

  constructor(ctx: AudioContext) {
    super('rain', 'water', ctx, 0);

    // Bed
    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 6000, Q: 0.5 }));
    const bed = this.own(new GainNode(ctx, { gain: 1 }));
    this.play(noiseLoop(ctx, 'pink')).connect(lpf).connect(bed).connect(this.env);
    this.sched.wander(bed.gain, dB(-1.5), dB(1.5), 8, 20);

    // Droplet lanes: shared filter + panner per lane, grains are routed by lot.
    const lanes = LANES.map(({ hz, pan }) => {
      const bp = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: hz, Q: 2 }));
      const panner = this.own(new StereoPannerNode(ctx, { pan }));
      bp.connect(panner).connect(this.env);
      return bp;
    });

    // Density drifts slowly; each step is a new Poisson rate.
    this.sched.repeat(() => rand(4, 9), () => { this.rate = rand(40, 120); });
    this.sched.repeat(() => poissonGap(this.rate), (t) => {
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      grain(ctx, lane, t, rand(0.002, 0.006), dB(-14) * 2.5);
    });
  }
}

export const rain = (ctx: AudioContext) => new RainSource(ctx);
