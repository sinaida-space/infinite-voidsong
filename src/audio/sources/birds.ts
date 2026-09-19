// birds — synthesized fallback for the recorded birdsong loop.
//
//   short phrases of 2–4 sine chirps (2.2–5.2 kHz, each gliding up or down)
//   → bandpass 3.8 kHz (Q 0.6) → env
//
// A phrase every 1.5–6 s, chirps 90–160 ms apart. Quiet and cheap: each
// chirp is one oscillator that removes itself when it ends.
import { dB, ping, rand } from '../dsp';
import { BaseSource } from '../source';

const clampHz = (hz: number): number => Math.min(5200, Math.max(2200, hz));

class BirdsSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('birds', 'air', ctx, 0);

    const bp = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 3800, Q: 0.6 }));
    bp.connect(this.env);

    this.sched.repeat(() => rand(1.5, 6), (t) => {
      const chirps = 2 + Math.floor(Math.random() * 3);
      let at = t;
      let base = rand(2500, 4500);
      for (let i = 0; i < chirps; i++) {
        const glide = clampHz(base * (Math.random() < 0.5 ? rand(0.75, 0.9) : rand(1.1, 1.3)));
        ping(ctx, bp, at, base, dB(-16), 0.008, rand(0.05, 0.1), glide);
        at += rand(0.09, 0.16);
        base = clampHz(base * rand(0.9, 1.1));
      }
    });
  }
}

export const birds = (ctx: AudioContext) => new BirdsSource(ctx);
