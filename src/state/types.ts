export type SourceId =
  | 'none'
  | 'noise'                                        // family noise
  | 'rain' | 'thunder' | 'ocean' | 'stream' | 'underwater' // family water
  | 'wind' | 'birds' | 'crickets'                 // family air
  | 'campfire'                                     // family fire
  | 'cafe' | 'library' | 'cabin' | 'fan'           // family place
  | 'drone' | 'lofi' | 'plucks'                    // family music
  | 'synthwave' | 'berlin' | 'house' | 'chillhop'  // family music (electronic)
  | 'tone';                                        // family tone

export type Family = 'noise' | 'water' | 'air' | 'fire' | 'place' | 'music' | 'tone';
export const FAMILY_OF: Record<Exclude<SourceId,'none'>, Family> = { noise:'noise', rain:'water', thunder:'water', ocean:'water', stream:'water', underwater:'water', wind:'air', birds:'air', crickets:'air', campfire:'fire', cafe:'place', library:'place', cabin:'place', fan:'place', drone:'music', lofi:'music', plucks:'music', synthwave:'music', berlin:'music', house:'music', chillhop:'music', tone:'tone' };

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
//   synthwave.bpm  84..100                                          default 92
//   synthwave.tape 0..1   tape filter amount                        default 0.3
//   synthwave.pump 0..1   sidechain depth                           default 0.35
//   synthwave.arp  0..1   arpeggio brightness (bass LPF range)      default 0.5
//   berlin.bpm     70..100                                          default 84
//   berlin.tape    0..1   tape filter amount                        default 0.4
//   berlin.pulse   0..1   soft 8th-note pulse level (0 = off)       default 0.3
//   house.bpm      90..110                                          default 100
//   house.tape     0..1   tape filter amount                        default 0.2
//   house.pump     0..1   sidechain depth                           default 0.5
//   house.filter   0..1   slow global LPF sweep amount              default 0.4
//   chillhop.bpm     60..90                                         default 72
//   chillhop.tape    0..1 tape filter amount                        default 0.6
//   chillhop.pump    0..1 sidechain depth                           default 0.4
//   chillhop.crackle 0..1 vinyl clicks and hiss level               default 0.5

export interface FocusBoost { depth: number /* 0..1, default 0 */; rateHz: number /* 12..20, default 16 */; }

export type Band = 'whisper' | 'library' | 'workspace' | 'cafe' | 'loud';
export interface MasterState { volume: number /* 0..1 */; }
export const bandOf = (v: number): Band => v < 0.2 ? 'whisper' : v < 0.4 ? 'library' : v < 0.6 ? 'workspace' : v < 0.8 ? 'cafe' : 'loud';

export type TaskPreset = 'deep-focus' | 'reading-writing' | 'creative-flow' | 'routine' | 'break-restore' | 'sleep';
export type TimerPreset = '25/5' | '50/10' | '90/15' | 'custom';
export type Phase = 'free' | 'warmup' | 'work' | 'ending' | 'break' | 'resume-cue' | 'sleep';

export interface SessionState {
  timer: TimerPreset | null;        // null = untimed
  phase: Phase;                     // 'free' when untimed
  phaseEndsAt: number | null;       // epoch ms
  customWork: number;               // minutes of work in the 'custom' session, 1..240
  customBreak: number;              // minutes of break in the 'custom' session, 1..60
  warmup: boolean;                  // creative-flow 10 min upbeat warm-up
  sleepEndsAt: number | null;       // epoch ms, sleep timer
}

// Music harmony: Off = ii–V–I–vi and one-bar patterns, Gentle = circle-of-fifths
// progressions and two-bar phrases, Drift = Gentle plus four-bar phrases and slow key moves.
export type HarmonyMode = 'off' | 'gentle' | 'drift';
export const HARMONY_MODES: readonly HarmonyMode[] = ['off', 'gentle', 'drift'];
export const isHarmonyMode = (v: unknown): v is HarmonyMode => v === 'off' || v === 'gentle' || v === 'drift';

export type Playback = 'idle' | 'starting' | 'playing' | 'paused';

export interface AppState {
  version: 1;
  playback: Playback;
  layers: [LayerState, LayerState, LayerState, LayerState];
  master: MasterState;
  focusBoost: FocusBoost;
  preset: TaskPreset | null;
  harmony: HarmonyMode;             // default 'gentle' for new users; saved state without the field loads as 'off'
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
//   session:{timer:'50/10',customWork:40,customBreak:8,phase:'work',phaseEndsAt:1789999999000,warmup:false,sleepEndsAt:null},
//   onboarded:true, noticeDismissed:true, reducedMotion:false }
