// Convolution reverb with the shared synthesised impulse. Each source owns its
// own ConvolverNode (so dispose() is local) but the IR buffer is computed once per context.
import { reverbImpulse } from './buffers';
import type { NodeBag } from './util';

export interface Reverb { input: AudioNode; output: AudioNode; }

// `send` is the wet level (0..1); the dry path is wired by the caller.
export function makeReverb(ctx: AudioContext, bag: NodeBag, send: number): Reverb {
  const conv = bag.add(ctx.createConvolver());
  conv.buffer = reverbImpulse(ctx);
  conv.normalize = true;
  const wet = bag.add(ctx.createGain());
  wet.gain.value = send;
  conv.connect(wet);
  return { input: conv, output: wet };
}
