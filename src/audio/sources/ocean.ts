// ocean — pink bed breathing with the swell, foam on the crest.
//
//   pink loop → LPF (cutoff = 700 Hz + LFO1·400 + LFO2·200) → swell gain
//              (0.55 + LFO1·0.30 + LFO2·0.12) → env
//   foam: white loop → HPF 1.5 kHz → foam gain (rises 0.4 s at each crest,
//         decays 1.5 s) → env
//
// LFO1 runs at 1/period (default 14 s); LFO2 at 0.37× that so consecutive
// waves never repeat exactly. Both are sine oscillators feeding AudioParams,
// so the raised-cosine motion costs no JS at all. `ocean.period` retunes
// both LFOs with a ramp.
import { rampTo } from '../crossfade';
import { noiseLoop } from '../dsp';
import { BaseSource } from '../source';

const DEFAULT_PERIOD = 14;
const DETUNE = 0.37;

class OceanSource extends BaseSource {
  private period = DEFAULT_PERIOD;
  private readonly lfo1: OscillatorNode;
  private readonly lfo2: OscillatorNode;

  constructor(ctx: AudioContext) {
    super('ocean', 'water', ctx, 9);

    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 700, Q: 0.7 }));
    const swell = this.own(new GainNode(ctx, { gain: 0.55 }));
    this.play(noiseLoop(ctx, 'pink')).connect(lpf).connect(swell).connect(this.env);

    // Two LFOs, each fanned out to cutoff and gain through its own depth gains.
    this.lfo1 = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 1 / this.period }));
    this.lfo2 = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: DETUNE / this.period }));
    const cut1 = this.own(new GainNode(ctx, { gain: 400 }));
    const cut2 = this.own(new GainNode(ctx, { gain: 200 }));
    const amp1 = this.own(new GainNode(ctx, { gain: 0.30 }));
    const amp2 = this.own(new GainNode(ctx, { gain: 0.12 }));
    this.lfo1.connect(cut1).connect(lpf.frequency);
    this.lfo2.connect(cut2).connect(lpf.frequency);
    this.lfo1.connect(amp1).connect(swell.gain);
    this.lfo2.connect(amp2).connect(swell.gain);

    // Foam: a sine LFO started at phase 0 peaks a quarter period in, so the
    // first crest is at start + period/4 and then every period.
    const hpf = this.own(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1500, Q: 0.7 }));
    const foam = this.own(new GainNode(ctx, { gain: 0 }));
    this.play(noiseLoop(ctx, 'white')).connect(hpf).connect(foam).connect(this.env);
    this.sched.repeat(() => this.period, (t) => {
      foam.gain.setValueAtTime(foam.gain.value, t);
      foam.gain.linearRampToValueAtTime(0.35, t + 0.4);
      foam.gain.setTargetAtTime(0, t + 0.4, 1.5 / 5);
    }, this.period / 4);
  }

  setParam(key: string, value: number, rampSec: number): void {
    if (key !== 'ocean.period') return;
    this.period = Math.min(24, Math.max(8, value));
    const now = this.ctx.currentTime;
    rampTo(this.lfo1.frequency, 1 / this.period, now, rampSec);
    rampTo(this.lfo2.frequency, DETUNE / this.period, now, rampSec);
  }
}

export const ocean = (ctx: AudioContext) => new OceanSource(ctx);
