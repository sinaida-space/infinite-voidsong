// crickets — synthesized fallback for the recorded crickets loop.
//
//   sine ≈ 4.5 kHz (wanders ±5 %) → pulse gate (sine LFO ≈ 30 Hz, depth 0.5)
//   → chirp gate (opens for ~150 ms every ~0.55 s) → env
//
// Two oscillators and three gains in total; the chirp gate is booked by the scheduler.
import { dB, rand } from '../dsp';
import { BaseSource } from '../source';

class CricketsSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('crickets', 'air', ctx, 0);

    const osc = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 4500 }));
    const pulse = this.own(new GainNode(ctx, { gain: 0.5 }));
    const lfo = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 30 }));
    const depth = this.own(new GainNode(ctx, { gain: 0.5 }));
    const chirp = this.own(new GainNode(ctx, { gain: 0 }));
    lfo.connect(depth).connect(pulse.gain);
    osc.connect(pulse).connect(chirp).connect(this.env);

    this.sched.wander(osc.frequency, 4300, 4700, 6, 14);
    this.sched.wander(lfo.frequency, 26, 34, 5, 12);

    const peak = dB(-16);
    this.sched.repeat(() => rand(0.45, 0.7), (t) => {
      chirp.gain.setValueAtTime(0, t);
      chirp.gain.linearRampToValueAtTime(peak, t + 0.012);
      chirp.gain.setValueAtTime(peak, t + 0.13);
      chirp.gain.linearRampToValueAtTime(0, t + 0.16);
    });
  }
}

export const crickets = (ctx: AudioContext) => new CricketsSource(ctx);
