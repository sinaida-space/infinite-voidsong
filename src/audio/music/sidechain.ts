// Sidechain "pump": the pad gain dips on every kick and recovers over 250 ms.
// Kicks in the pattern pool are never closer than one eighth note (>= 300 ms at
// 100 bpm), so a new dip always starts after the previous recovery has ended
// and the ramp events stay in order.
import type { NodeBag } from './util';

export interface Sidechain {
  node: GainNode;
  duck(at: number, depth: number): void;   // depth = lofi.pump 0..1
}

const DIP_SEC = 0.01;       // fast but still a ramp, no zero-length jump
const RECOVER_SEC = 0.25;

export function makeSidechain(ctx: AudioContext, bag: NodeBag): Sidechain {
  const node = bag.add(ctx.createGain());
  node.gain.value = 1;
  return {
    node,
    duck(at, depth) {
      const g = node.gain;
      g.setValueAtTime(1, at);
      g.linearRampToValueAtTime(1 - Math.min(0.95, depth), at + DIP_SEC);
      g.linearRampToValueAtTime(1, at + DIP_SEC + RECOVER_SEC);
    },
  };
}
