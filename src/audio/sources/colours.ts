// colours — the noise layers in the mixer: white, pink, brown, no knobs.
// (The older `noise` source, a white ↔ brown blend, only plays saved mixes and
// links; the store turns it into the nearest colour on load.)
//
//   white   flat                        white loop
//   pink    −3 dB/oct                   pink loop
//   brown   −6 dB/oct                   brown loop
//
//   every colour → high shelf −4 dB @ 12 kHz → slow gain wander ±2 dB → env
import type { SourceId } from '../../state/types';
import { dB, noiseLoop, type NoiseColor } from '../dsp';
import { BaseSource } from '../source';

export type ColourId = NoiseColor;   // 'white' | 'pink' | 'brown'

class ColourSource extends BaseSource {
  constructor(ctx: AudioContext, id: ColourId) {
    super(id as SourceId, 'noise', ctx, 1);   // RMS ≈ −15 dBFS, level with the other layers

    const shelf = this.own(new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 12000, gain: -4 }));
    const wander = this.own(new GainNode(ctx, { gain: 1 }));
    shelf.connect(wander).connect(this.env);
    this.sched.wander(wander.gain, dB(-2), dB(2), 10, 30);

    this.play(noiseLoop(ctx, id)).connect(shelf);
  }
}

export const colour = (id: ColourId) => (ctx: AudioContext) => new ColourSource(ctx, id);
