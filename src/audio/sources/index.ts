// SOURCES — every playable source by id. Task 3 owns the eleven ambient
// recipes; drone / lofi / plucks / tone come from the music register (task 4),
// synthwave / berlin / house / chillhop too (task 13).
import type { SourceId } from '../../state/types';
import type { SourceFactory } from '../source';
import { berlin, chillhop, drone, house, lofi, plucks, synthwave, tone } from '../music/register';
import { cabin } from './cabin';
import { cafe } from './cafe';
import { campfire } from './campfire';
import { fan } from './fan';
import { library } from './library';
import { noise } from './noise';
import { ocean } from './ocean';
import { birds as birdsSynth } from './birds';
import { crickets as cricketsSynth } from './crickets';
import { rain as rainSynth } from './rain';
import { sampleLayer } from './sample';
import { stream as streamSynth } from './stream';
import { underwater } from './underwater';
import { wind as windSynth } from './wind';

// Recorded loops (CC0, public/audio) over their synths. File names are fixed
// here on purpose; manifest.json is credits data only and never fetched at runtime.
// Sources without a recording stay synthesized.
const stream = sampleLayer('stream', 'stream.opus', streamSynth, { trimDb: 8 });
const rain = sampleLayer('rain', 'rain.opus', rainSynth, { trimDb: 8 });
const thunder = sampleLayer('thunder', 'thunder.opus', rainSynth, { trimDb: 6 });   // rain with distant thunder
const wind = sampleLayer('wind', 'wind.opus', windSynth, { trimDb: 7 });
const birds = sampleLayer('birds', 'birds.opus', birdsSynth, { trimDb: 9, spread: 0.5 });
const crickets = sampleLayer('crickets', 'crickets.opus', cricketsSynth, { trimDb: 9, spread: 0.5 });

export const SOURCES: Record<Exclude<SourceId, 'none'>, SourceFactory> = {
  noise,
  rain, thunder, ocean, stream, underwater,
  wind, birds, crickets,
  campfire,
  cafe, library, cabin, fan,
  drone, lofi, plucks,
  synthwave, berlin, house, chillhop,
  tone,
};
