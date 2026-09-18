// Registry consumed by src/audio/sources/index.ts (task 3): the four music-side
// sources and the Focus Boost node. Contract: docs/PLAN.md §4 / issue #4.
import type { SourceFactory } from './types';
import { drone } from '../sources/drone';
import { lofi } from '../sources/lofi';
import { plucks } from '../sources/plucks';
import { tone } from '../sources/tone';

export { drone, lofi, plucks, tone };
export const MUSIC_SOURCES: Record<'drone' | 'lofi' | 'plucks' | 'tone', SourceFactory> = { drone, lofi, plucks, tone };

export { focusBoostNode } from '../focusboost';
export type { FocusBoostNode } from '../focusboost';
export { onBeat } from './beat';
export type { SoundSource, SourceFactory, LofiSource, BarInfo } from './types';
export { sessionScale, rootName } from './scale';
