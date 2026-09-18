// Registry consumed by src/audio/sources/index.ts (task 3): the music-side
// sources (four from issue #4, four electronic ones from issue #12) and the
// Focus Boost node. Contract: docs/PLAN.md §4 / issue #4.
import type { SourceFactory } from './types';
import { drone } from '../sources/drone';
import { lofi } from '../sources/lofi';
import { plucks } from '../sources/plucks';
import { tone } from '../sources/tone';
import { synthwave } from '../sources/synthwave';
import { berlin } from '../sources/berlin';
import { house } from '../sources/house';
import { chillhop } from '../sources/chillhop';

export { drone, lofi, plucks, tone, synthwave, berlin, house, chillhop };
export type MusicSourceId = 'drone' | 'lofi' | 'plucks' | 'tone' | 'synthwave' | 'berlin' | 'house' | 'chillhop';
export const MUSIC_SOURCES: Record<MusicSourceId, SourceFactory> = { drone, lofi, plucks, tone, synthwave, berlin, house, chillhop };

export { focusBoostNode } from '../focusboost';
export type { FocusBoostNode } from '../focusboost';
export { onBeat } from './beat';
export type { SoundSource, SourceFactory, LofiSource, SequencedSource, BarInfo } from './types';
export { sessionScale, rootName } from './scale';
