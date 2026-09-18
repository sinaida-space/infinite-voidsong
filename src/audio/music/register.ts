// register.ts — PLACEHOLDER written by task 3 so the SOURCES map type-checks.
// Task 4 replaces this file with the real drone / lofi / plucks / tone
// factories (and focusBoostNode). Until then these four keys are silent
// sources that honour the SoundSource contract.
import type { Family, SourceId } from '../../state/types';
import { BaseSource, type SourceFactory } from '../source';

class SilentSource extends BaseSource {
  constructor(id: SourceId, family: Family, ctx: AudioContext) { super(id, family, ctx); }
}

const silent = (id: SourceId, family: Family): SourceFactory => (ctx) => new SilentSource(id, family, ctx);

export const drone = silent('drone', 'music');
export const lofi = silent('lofi', 'music');
export const plucks = silent('plucks', 'music');
export const tone = silent('tone', 'tone');
