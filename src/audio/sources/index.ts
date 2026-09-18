// SOURCES — every playable source by id. Task 3 owns the eleven ambient
// recipes; drone / lofi / plucks / tone come from the music register (task 4).
import type { SourceId } from '../../state/types';
import type { SourceFactory } from '../source';
import { drone, lofi, plucks, tone } from '../music/register';
import { cabin } from './cabin';
import { cafe } from './cafe';
import { campfire } from './campfire';
import { fan } from './fan';
import { library } from './library';
import { noise } from './noise';
import { ocean } from './ocean';
import { rain } from './rain';
import { stream } from './stream';
import { underwater } from './underwater';
import { wind } from './wind';

export const SOURCES: Record<Exclude<SourceId, 'none'>, SourceFactory> = {
  noise,
  rain, ocean, stream, underwater,
  wind,
  campfire,
  cafe, library, cabin, fan,
  drone, lofi, plucks,
  tone,
};
