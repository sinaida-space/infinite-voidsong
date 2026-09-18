// graph.ts — the master chain.
//
//   layers → input (master volume) → transport (start/pause/end fades)
//          → compressor (brick-wall safety) → ceiling 0.89 → analyser → destination
//
// The compressor only acts on peaks above −6 dBFS; steady beds sit well
// below that. The ceiling leaves 1 dB headroom under full scale on devices
// that overshoot after the compressor's release.

export interface MasterGraph {
  input: GainNode;        // sum of all layers; gain = master volume
  transport: GainNode;    // 0..1 fades owned by the engine
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
  dispose(): void;
}

export function buildGraph(ctx: AudioContext): MasterGraph {
  const input = new GainNode(ctx, { gain: 0 });
  const transport = new GainNode(ctx, { gain: 0 });
  const compressor = new DynamicsCompressorNode(ctx, {
    threshold: -6, knee: 0, ratio: 20, attack: 0.003, release: 0.25,
  });
  const ceiling = new GainNode(ctx, { gain: 0.89 });
  const analyser = new AnalyserNode(ctx, { fftSize: 1024, smoothingTimeConstant: 0.85 });

  input.connect(transport).connect(compressor).connect(ceiling).connect(analyser).connect(ctx.destination);

  return {
    input, transport, compressor, analyser,
    dispose() { for (const n of [input, transport, compressor, ceiling, analyser]) n.disconnect(); },
  };
}
