export type SourceId =
  | 'none'
  | 'noise'                                        // family noise
  | 'rain' | 'ocean' | 'stream' | 'underwater'     // family water
  | 'wind'                                         // family air
  | 'campfire'                                     // family fire
  | 'cafe' | 'library' | 'cabin' | 'fan'           // family place
  | 'drone' | 'lofi' | 'plucks'                    // family music
  | 'tone';                                        // family tone

export type Family = 'noise' | 'water' | 'air' | 'fire' | 'place' | 'music' | 'tone';
export const FAMILY_OF: Record<Exclude<SourceId,'none'>, Family> = { noise:'noise', rain:'water', ocean:'water', stream:'water', underwater:'water', wind:'air', campfire:'fire', cafe:'place', library:'place', cabin:'place', fan:'place', drone:'music', lofi:'music', plucks:'music', tone:'tone' };

export interface LayerState {
  source: SourceId;                 // 'none' = empty slot
  volume: number;                   // 0..1, e.g. 0.6
  muted: boolean;
  params: Record<string, number>;   // per-source knobs, keys below
}
// Param keys and ranges (all numbers, all optional; engine applies defaults):
//   noise.tilt   0..1   0 = white, 0.5 = pink, 1 = brown           default 0.5
//   lofi.bpm     60..100                                            default 78
//   lofi.tape    0..1   lo-fi filter amount                         default 0.5
//   lofi.pump    0..1   sidechain depth                             default 0.4
//   tone.freq    200..12000 Hz                                      default 4000
//   tone.width   0..1   0 = pure sine, 1 = wide band noise          default 0.3
//   ocean.period 8..24 s                                            default 14

export interface FocusBoost { depth: number /* 0..1, default 0 */; rateHz: number /* 12..20, default 16 */; }

export type Band = 'whisper' | 'library' | 'workspace' | 'cafe' | 'loud';
export interface MasterState { volume: number /* 0..1 */; }
export const bandOf = (v: number): Band => v < 0.2 ? 'whisper' : v < 0.4 ? 'library' : v < 0.6 ? 'workspace' : v < 0.8 ? 'cafe' : 'loud';

export type TaskPreset = 'deep-focus' | 'reading-writing' | 'creative-flow' | 'routine' | 'break-restore' | 'sleep';
export type TimerPreset = '25/5' | '50/10' | '90/15';
export type Phase = 'free' | 'warmup' | 'work' | 'ending' | 'break' | 'resume-cue' | 'sleep';

export interface SessionState {
  timer: TimerPreset | null;        // null = untimed
  phase: Phase;                     // 'free' when untimed
  phaseEndsAt: number | null;       // epoch ms
  warmup: boolean;                  // creative-flow 10 min upbeat warm-up
  sleepEndsAt: number | null;       // epoch ms, sleep timer
}

export type Playback = 'idle' | 'starting' | 'playing' | 'paused';

export interface AppState {
  version: 1;
  playback: Playback;
  layers: [LayerState, LayerState, LayerState, LayerState];
  master: MasterState;
  focusBoost: FocusBoost;
  preset: TaskPreset | null;
  session: SessionState;
  onboarded: boolean;
  noticeDismissed: boolean;
  reducedMotion: boolean;           // mirrors prefers-reduced-motion
}

// Example (Deep Focus, 50/10, mid-session):
// { version:1, playback:'playing',
//   layers:[ {source:'noise',volume:0.55,muted:false,params:{'noise.tilt':0.6}},
//            {source:'rain',volume:0.35,muted:false,params:{}},
//            {source:'drone',volume:0.3,muted:false,params:{}},
//            {source:'none',volume:0.5,muted:false,params:{}} ],
//   master:{volume:0.5}, focusBoost:{depth:0.3,rateHz:16}, preset:'deep-focus',
//   session:{timer:'50/10',phase:'work',phaseEndsAt:1789999999000,warmup:false,sleepEndsAt:null},
//   onboarded:true, noticeDismissed:true, reducedMotion:false }
