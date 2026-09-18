# Product Specification: Evidence-Based Focus & Creativity Sound Generator

**Version 1.0 — Draft**
**Purpose:** This document specifies the sound content and controls for an online audio tool designed to help users reach and sustain their best cognitive state (deep focus, creative flow, calm), based strictly on peer-reviewed research. Every feature recommendation is tied to published evidence where such evidence exists; gaps in the evidence are flagged honestly.

---

## Table of Contents

1. [What the Science Says — Executive Summary](#1-what-the-science-says--executive-summary)
2. [Core Scientific Principles Driving the Design](#2-core-scientific-principles-driving-the-design)
3. [Sound Library Specification](#3-sound-library-specification)
4. [Controls & Features Specification](#4-controls--features-specification)
5. [Task-to-Sound Matching Matrix](#5-task-to-sound-matching-matrix)
6. [Volume Guidance System](#6-volume-guidance-system)
7. [What NOT to Include (Evidence-Based Anti-Patterns)](#7-what-not-to-include-evidence-based-anti-patterns)
8. [Audio Production Technical Standards](#8-audio-production-technical-standards)
9. [Personalization & Onboarding Engine](#9-personalization--onboarding-engine)
10. [Product Roadmap (MVP → V2 → V3)](#10-product-roadmap-mvp--v2--v3)
11. [Success Metrics](#11-success-metrics)
12. [References](#12-references)

---

## 1. What the Science Says — Executive Summary

| Finding | Evidence strength | Design implication |
|---|---|---|
| Moderate ambient noise (~70 dB) boosts creative cognition vs. quiet (~50 dB); loud noise (85 dB) degrades it. Inverted-U relationship. | Strong (5 experiments, J. Consumer Research) [1] | Offer "creative mode" soundscapes at moderate loudness; warn against over-loud playback |
| White/pink noise gives a **small but significant** focus boost for people with ADHD or high attention difficulties — but slightly *impairs* neurotypical performance. | Strong (2024 meta-analysis, 13 studies) [2] | Personalize by user profile; never force noise on everyone |
| Nature sounds (water, birdsong) improve directed attention, speed up stress recovery, and improve mood versus urban/artificial noise. | Moderate–strong (multiple studies, Attention Restoration Theory) [3][4][5][6] | Nature sounds are a core "restoration" and "soft focus" layer |
| Intrinsically pleasant, high-arousal "happy" music improves **divergent** (creative) thinking vs. silence; no effect on convergent thinking. | Moderate (PLOS ONE experimental study) [7] | Include an upbeat instrumental " brainstorm warm-up" mode |
| Music with lyrics (especially in the reader's own language) reliably impairs reading comprehension and verbal tasks. | Strong (multiple studies + Bayesian meta-analysis of 65 studies) [8][9] | All focus-oriented music must be instrumental; label this clearly |
| Fast AND loud music disrupts reading more than slow/quiet music. | Moderate [10] | Tempo/energy controls per track; focus defaults are slow–moderate |
| Intelligible background speech is the single most damaging office sound for memory and serial tasks; masking speech (reducing intelligibility, STI < ~0.5) restores performance. | Strong (Irrelevant Speech Effect literature) [11][12] | Provide speech-masking noise modes for open offices |
| Self-adjustable masking noise improves concentration, task performance, and attitudes in open-plan offices. | Strong (field + lab studies) [13] | User-controlled masking level is a must-have control |
| Music engineered with rapid amplitude modulations (beta range, ~12–20 Hz) improves sustained attention, activates attentional brain networks (EEG/fMRI); effects are **larger** in people with ADHD symptoms. | Moderate (Nature Communications Biology, 2024) [14] | Add an optional "Focus Boost" depth-of-modulation control |
| Binaural beats: meta-analyses show small-to-medium effects on memory/attention (g ≈ 0.40–0.45), but a 2023 systematic review of brainwave entrainment found inconsistent results (5 of 14 studies support, 8 contradict); one large trial even found generic beats *worsened* learning. | Mixed / weak [15][16][17] | Offer as clearly-labeled optional extra, never a default; keep volume low |

**Bottom line for product design:** the tool should be built around three evidence-backed pillars — (1) **colored noise and steady ambience for masking + arousal regulation**, (2) **nature soundscapes for restoration and emotional state**, and (3) **instrumental music matched to task type** — all wrapped in heavy personalization, because the research consistently shows the "right" sound depends on the person and the task.

---

## 2. Core Scientific Principles Driving the Design

These principles are the theoretical foundation. Every sound and control in sections 3–4 maps to at least one of them.

1. **The Inverted-U (arousal) principle.** Cognitive performance is poor when under-stimulated (too quiet, boring) and poor when over-stimulated (too loud/chaotic). The tool's job is to let each user sit at *their* peak. Moderate ambient noise (~70 dB) enhanced creative task performance vs. 50 dB quiet; 85 dB impaired it [1].
2. **Stochastic resonance / optimal stimulation.** Moderate random noise can push under-aroused brains (e.g., ADHD, low dopamine baseline) to optimal arousal — explaining why white/pink noise helps ADHD groups but slightly hurts already-optimal neurotypical users [2]. Personalization is therefore a scientific requirement, not a nice-to-have.
3. **Speech is the enemy of verbal work.** The phonological loop processes any intelligible speech involuntarily, degrading reading, memory, and arithmetic — independent of volume [11][12]. Masking or eliminating speech is the #1 therapeutic use case in offices.
4. **Attention Restoration Theory (ART) & Stress Recovery Theory (SRT).** Nature sounds engage effortless "soft fascination," letting directed attention recover, and accelerate physiological stress recovery (skin conductance, HRV) [3][4][5]. Nature = the "break" and "mental recovery" mode.
5. **Semantics compete with semantics.** Music with lyrics competes with reading/writing for the same language-processing resources; lyrics in the same language as the text are worst [8][9]. Instrumental-only for verbal tasks.
6. **Arousal–mood effect on creativity.** Pleasant, high-arousal ("happy") music facilitates divergent thinking via positive affect — best used as a warm-up before brainstorming [7]. Convergent problem-solving shows no music benefit.
7. **Targeted acoustic modulation.** Rapid amplitude modulation (AM) of music in the beta band (12–20 Hz) entrains attentional networks (measurable phase-locking in EEG) and improves sustained attention, with bigger benefits for people with attentional difficulties [14]. This is stronger evidence than binaural beats and should be the tool's signature "active" feature.
8. **Honesty about weak evidence.** Binaural beats and "brainwave entrainment" are popular but scientifically shaky [15][17]. Include them (users expect them) but label them "experimental" and never make claims the evidence can't support. This is also a trust differentiator.

---

## 3. Sound Library Specification

The library is organized into **5 sound families**. Every family below includes its evidence and implementation notes.

### Family A — Colored Noise (masking & arousal engine)

| Sound | Spectral profile | Evidence | Recommended use case in app |
|---|---|---|---|
| **White noise** | Equal energy per Hz (hissy static) | Small significant benefit for ADHD/attention difficulties [2]; best speech masking (covers speech frequencies) | "Heavy masking" preset; ADHD mode default option |
| **Pink noise** | −3 dB/octave (like steady rain) | Same meta-analytic benefit as white [2]; gentler for long sessions; used in sleep/memory studies | Default recommendation for new users; long-session focus |
| **Brown/red noise** | −6 dB/octave (deep waterfall rumble) | No clinical trials yet, but workplace spectral-noise studies show pink/red noise outperform quiet on psychomotor speed, working memory, executive function; strong user preference reports [2][18] | Included for preference & low-frequency masking (HVAC rumble, traffic); label "popular, research emerging" |
| **Blue/violet noise** (optional) | Rising energy with frequency | No cognition research | Optional "specialty" slot only; not recommended for focus |

**Implementation requirements:**
- Generated algorithmically (Web Audio API), not looped samples — infinite, seam-free, gapless playback.
- A continuous **Spectral Tilt slider** blending white ↔ pink ↔ brown in real time (more valuable than 3 fixed presets — lets users find their personal optimum).
- Optional subtle "texture" overlays (slow random gain wander of ±2 dB over 10–30 s) to prevent the fatigue of perfect static — but keep changes below the "changing-state" threshold that captures attention [11].

### Family B — Nature & Water Soundscapes (restoration & soft focus)

Evidence: nature sounds improve directed attention on demanding tasks [3], accelerate physiological stress recovery after mental fatigue [4], are perceived as restorative (birdsong most of all) [5], and improved sustained attention more than artificial sounds in comparative studies [19]. Brain imaging shows different functional connectivity under natural vs. urban soundscapes, with performance gains tied to nature [20].

Required scenes (each mixable — see Mixer in §4):
1. **Rain** — light rain, heavy rain, rain on window/tent/car roof, distant thunder roll (no sudden cracks: sudden events = attention capture [11]).
2. **Water** — ocean waves (slow period ≈ 10–20 s), babbling stream/fountain (the exact stimuli used in Alvarsson et al.'s stress-recovery study [4]), river.
3. **Forest & birdsong** — gentle woodland ambience; birdsong should be mixed **sparse and non-repetitive**, since not all bird calls are restorative [5]; avoid loud, harsh, or precisely looping calls (a recognizable 30 s loop becomes its own distraction).
4. **Wind** — soft wind through trees/leaves; avoid whistling tones.
5. **Campfire / night ambience** — fire crackle, distant crickets (crickets were used in the Van Hedger et al. attention study [3]).
6. **Underwater / deep ambience** (optional V2) — low-passed, muffled textures for a "sensory deprivation" feel.

**Implementation requirements:** seamless crossfaded loops ≥ 10 minutes of underlying material for organic scenes; no audible loop points; all sudden transient sounds (thunder cracks, bird screeches, splashes) excluded or ducked below masking threshold.

### Family C — Human & Place Ambiences (creative-mode "moderate noise")

Evidence: moderate multi-talker/ambient noise at ~70 dB enhanced creative cognition in five experiments [1]; coffee-shop-class ambience approximates exactly this level [21].

Required scenes:
1. **Coffee shop / café murmur** — unintelligible babble, cup clinks, espresso machine. **Critical:** speech must remain *unintelligible*; intelligible speech would flip the effect negative (Irrelevant Speech Effect [11][12]). Use 6+ overlapping voices or low-pass/garble processing so no words are discernible.
2. **Library / hall murmur** — quieter variant (~45–50 dB character).
3. **Train / airplane cabin** — steady broadband rumble with movement character; the classic sleeper/focus ambience.
4. **Fan / air-conditioner / vacuum hum** — pure household masking textures (equivalent to pink/brown noise in function; hugely popular anecdotally).
5. **City at night / fireplace room tone** (optional).

### Family D — Instrumental Music Modes (emotion & engagement)

Evidence: lyrics harm verbal work [8][9]; fast+loud music harms reading [10]; happy high-arousal music pre-task boosts divergent creativity [7]; amplitude-modulated instrumental music improves sustained attention [14].

Music catalog rules for **all** focus/reading modes:
- **Instrumental only.** Zero lyrics, zero vocal chops, zero humming. Non-negotiable.
- Tempo ≤ ~100 BPM for focus modes; steady, predictable rhythm; minimal dynamic swings.
- No sudden drops, risers, breakdowns, or solos that demand attention.
- Long-form seamless loops or generative/procedural playback (no jarring track changes or silence gaps between songs).

Required music modes:
1. **Ambient pads / drone** — slow-evolving harmonic beds (Stars-of-the-Lid class). The safest all-task music.
2. **Lo-fi instrumental beats** — steady 70–90 BPM, side-chain "pumping" is acceptable as a natural amplitude modulation; warm, tape-filtered spectrum. For routine/admin tasks and light focus.
3. **Solo piano / neoclassical** — sparse, even-tempered (no virtuosic outbursts).
4. **Deep-focus electronic ("Focus Boost" mode)** — tracks engineered with **rapid amplitude modulation in the beta range (12–20 Hz)** per Woods et al. 2024 [14] — the strongest "active" attention evidence in music. Include a modulation-depth control (see §4).
5. **Brainstorm Warm-up ("Happy Mode")** — high-arousal, positive-valence classical/cinematic instrumental, designed to be played **before or during the first minutes of** creative ideation per Ritter & Ferguson [7]. Explicitly framed as a warm-up session, e.g., a built-in 10-minute timer leading into a quieter mode.
6. **Generative mode (V2)** — procedurally composed endless music so nothing repeats measurably; avoids the annoyance of playlist repetition and the attentional grab of track changes.

### Family E — Brainwave / Psychoacoustic Extras (clearly labeled "Experimental")

| Feature | Evidence status | How to include it |
|---|---|---|
| **Binaural beats** (headphones only): delta/theta (relax), alpha (calm), low-beta (alert), gamma 40 Hz (attention) | Mixed: meta-analyses g ≈ 0.40–0.45 [15][16], but entrainment review mostly negative [17]; some trials show harm from generic settings. The 2025 large trial found benefits only with specific parameter combos (frequency × carrier × masking × timing) | Optional overlay on any soundscape. Presets: "Calm (6 Hz theta)", "Relaxed focus (10 Hz alpha)", "Alert focus (40 Hz gamma)". Show one-line disclaimer: *"Evidence is mixed; some studies show no benefit. If it feels distracting, turn it off."* |
| **Isochronic tones** | Weaker/limited evidence than binaural | Optional; subtle pulse volume |
| **Pink-noise-embedded beats** | Note: studies embedding beats in pink noise tended to find *no* entrainment [17] | Allow both "pure tone" and "embedded" modes; default pure tone under music |

---

## 4. Controls & Features Specification

### 4.1 Primary playback controls

| Control | Spec | Research rationale |
|---|---|---|
| **Master volume with dB estimator** | Volume slider + on-screen estimate of output level in dB bands (Quiet ~40–50 / Moderate ~55–65 / Lively ~65–70 / Too Loud >75) | The dose matters: creative benefit peaks near 70 dB, focus work best 45–55 dB, harm >70–85 dB [1]. Tools today treat volume as raw % only — a science-guided level indicator is a differentiator |
| **Hearing-safety limiter** | Hard ceiling + warning if sustained playback would exceed ~85 dB(A) equivalents; long-session reminders | 85 dB impairs creativity acutely [1]; long-term hearing safety |
| **Mixer: 4-layer soundboard** | Up to 4 simultaneous layers (e.g., pink noise + rain + café + piano), each with volume, mute, solo | Masking needs differ per environment; self-adjustable masking improved real office outcomes [13] |
| **Spectral tilt slider** | Real-time white ↔ pink ↔ brown blend for the noise layer | Individual optima differ; meta-analysis shows individual response dominates [2] |
| **Per-layer EQ (simple)** | 3-band (low/mid/high) tilt per layer | Users in noisy offices need different masking spectra (speech ≈ 500 Hz–4 kHz emphasis to mask talkers) [11][12] |
| **Fade in/out** | All sessions open with 3–10 s fade; all switches crossfade ≥ 2 s | Sudden onsets capture attention (changing-state effect) [11] |

### 4.2 Session & mode controls

| Control | Spec | Research rationale |
|---|---|---|
| **Task modes (presets)** | One-tap sessions: **Deep Focus** (analytical/coding), **Reading & Writing** (verbal), **Creative Flow** (brainstorming), **Admin/Repetitive**, **Break & Restore**, **ADHD Support**. Each = curated layers + volume target + timer. See §5 matrix | Task-dependence is the most replicated finding in this literature (verbal vs. creative vs. routine tasks want different sound) [1][8][11][12] |
| **Session timer with phases** | 25/5 Pomodoro, 50/10, and 90-minute ultradian presets; break phases auto-switch to a **nature "restore" soundscape** and optionally raise volume slightly to signal the transition | Nature sounds measurably speed stress/attention recovery — ideal for breaks [3][4][5] |
| **Brainstorm Warm-up scheduler** | 5–10 min of "happy" high-arousal instrumental music, auto-crossfading into the main work soundscape | Divergent-thinking benefit of happy music is strongest as pre-task induction [7] |
| **Focus Boost slider (AM depth)** | Adjusts depth of 12–20 Hz rapid amplitude modulation on the music layer (0–100%); remembers preference | Directly implements Woods et al. 2024 [14]; intensity should scale up for users reporting attentional difficulties |
| **Adaptive masking (V2, opt-in)** | Uses device microphone (locally, no recording) to estimate ambient noise & speech presence, recommends/adjusts masking level | Masking performance depends on environment SNR/STI [12][13] |
| **Break reminders & ear-reset** | Gentle prompts every 60–90 min; break scenes default to nature | Recovery research + cumulative attentional fatigue [4][12] |

### 4.3 Personalization controls

| Control | Spec | Research rationale |
|---|---|---|
| **Onboarding quiz** | 5 questions: primary work type; environment noise level; distractibility/ADHD-symptom screen (non-diagnostic); headphone vs. speaker; music preference | The ADHD vs. non-ADHD divergence in noise response [2] and entrainment-symptom interaction [14] make this the single most science-relevant personalization |
| **7-day A/B calibration** | App proposes "noise week vs. no-noise week" or "pink vs. brown" self-test with daily 1-tap focus rating, then shows what *their* data says | Recommended practice given individual differences [2][18]; also a retention feature |
| **Saved presets / scenes** | Name, save, share (URL) any mixer state | Self-selected, self-adjustable masking performed best in field studies [13] |
| **Per-mode memory** | App remembers last volume/layers per task mode | Reduces friction; consistency aids habituation (habituation attenuates distraction [11]) |

### 4.4 Experience & UX controls

- **Minimal, calm UI**: single screen, ≤ 3 interactions to sound. The tool is a focus product; cognitive load of the UI itself must be near zero.
- **Dark theme default**, soft motion only (no flashing visualizations); optional subtle generative background.
- **Keyboard shortcuts** (space = play/pause, arrows = volume, 1–6 = modes, M = mute layer) so users never have to look.
- **"Don't break my flow" guarantees**: no autoplaying videos, no voice ads, no mid-session sounds from the app itself, no notifications during sessions.
- **Headphone detection**: binaural beats and 3D features are enabled only when headphones are detected/confirmed; show note that speakers do not produce binaural effects.
- **Sleep timer** (15/30/45/60 min) with long fade-out — the same nature/pink-noise engine doubles as a sleep aid (strong pink-noise sleep literature [2]).
- **Offline mode / downloadable scenes** (PWA) so connectivity can't break a session.
- **Accessibility**: WCAG AA contrast, screen-reader labels on all controls, reduced-motion mode, no essential info conveyed by sound alone.

---

## 5. Task-to-Sound Matching Matrix

This matrix is the heart of the product — it should also be shown to users as "What should I listen to?" guidance.

| User task | Recommended default | Volume target | Explicitly avoid | Key evidence |
|---|---|---|---|---|
| **Reading, writing, studying (verbal)** | Pink/brown noise or soft rain; or silence if environment already quiet. Instrumental-only if music desired | 40–50 dB | Any lyrics (worst in reader's own language), intelligible speech, fast+loud music | [2][8][9][10] |
| **Deep analytical work / coding** | Pink noise, café murmur at moderate level, or ambient pads; ADD "Focus Boost" (12–20 Hz AM) for users with attention difficulties | 45–55 dB | Vocals, complex solos, sudden transitions | [1][14] |
| **Creative brainstorming / ideation** | Warm-up: 10 min happy high-arousal instrumental → then café ambience or nature at lively level | 60–70 dB during ideation | Dead silence (under-stimulates); >80 dB | [1][7] |
| **Repetitive / routine admin** | Lo-fi or upbeat instrumental, fan noise | 55–65 dB | Overly relaxing textures (drowsiness) | Arousal principle [1] |
| **Open-plan office (need speech masking)** | White or pink noise, or steady rain — tuned so nearby speech becomes unintelligible | Just above speech level, typically 50–60 dB | Intelligible-talk background tracks; ANC-only reliance (ANC weak on speech band) | [11][12][13] |
| **ADHD / high distractibility users** | White/pink noise defaults; Focus Boost AM depth higher; keep music very steady | 50–65 dB | Random shuffle, high-novelty tracks | [2][14] |
| **Breaks & mental recovery** | Nature soundscapes (water + sparse birdsong); consider brief silence | 40–55 dB | News, podcasts, speech of any kind | [3][4][5][6] |
| **Pre-sleep wind-down (bonus)** | Pink noise, rain, underwater | 30–40 dB with sleep timer | Binaural "alert" presets | [2] |

---

## 6. Volume Guidance System

Because loudness is the most consequential and least-guided control in existing apps, ship a visible **level guide**:

| Zone (approx. at ear) | Label in UI | Guidance |
|---|---|---|
| 30–40 dB | "Whisper" | Breaks, sleep wind-down |
| 40–50 dB | "Library" | Verbal work: reading, writing |
| 50–60 dB | "Workspace" | General focus; masking in most offices |
| 60–70 dB | "Café" | Creative ideation; ADHS masking [1] |
| 70–85 dB | "Too loud for focus" | Warn: creativity and attention degrade [1] |
| >85 dB | "Blocked" | Hard limit + hearing-safety notice |

Technical note: true absolute dB calibration in a browser is impossible without knowing the device; implement as **estimates** (device-class assumptions + short optional calibration tone procedure) and label them as such. The guidance bands still deliver the science-based message.

---

## 7. What NOT to Include (Evidence-Based Anti-Patterns)

1. **No lyrics anywhere in focus/reading modes.** Not even in an unknown language for L2 speakers — same-language lyrics are worst, but all meaningful lyrics impair verbal processing [8][9].
2. **No intelligible background speech** in any "focus" scene (podcasts, talk radio, half-heard dialogue). It is the best-documented cognitive killer in the entire literature [11][12].
3. **No sudden onsets**: no surprise thunder claps, bird screeches, door slams, phone notification FX inside scenes (changing-state sounds capture attention involuntarily) [11].
4. **No audible loop seams** — a detectable 60-second loop in rain or birdsong becomes a timer the brain tracks. Loops must be long, crossfaded, or algorithmic.
5. **No jarring track changes.** No gaps, no silence between songs, no abrupt genre shifts mid-session; crossfade everything.
6. **Don't oversell binaural beats/"brainwave entrainment".** Marketing them as a proven focus enhancer contradicts the systematic-review evidence [17] and risks regulatory/consumer-trust problems. Position as "experimental."
7. **Don't default everyone to noise.** For neurotypical users in already-quiet rooms, white/pink noise slightly *worsened* task performance in the meta-analysis [2]. The app must offer "silence might be best for you" as an honest outcome of the onboarding quiz.
8. **No mid-session interruptions** from the product itself: no ads, no pop-ups, no reward sounds during focus blocks.
9. **Avoid famous, sing-along music** — familiar hits invite attention and memory retrieval; unknown instrumental material distracts least [8][9].
10. **Don't use high BPM / high dynamic-range music for concentration modes** (fast + loud is the most disruptive combination for reading) [10].

---

## 8. Audio Production Technical Standards

- **Rendering:** Web Audio API; noise generated procedurally via filtered noise buffers (seamless, infinite); scenes built from layered loops with ≥ 10 min base material and randomized micro-variation.
- **Loudness:** normalize all content to about −20 LUFS integrated (background-listening target); content mastered so 60% master volume ≈ the 50–60 dB "Workspace" band on typical devices.
- **Sample format:** 44.1/48 kHz; OGG/Opus primary (small, gapless) with AAC fallback for Safari; avoid MP3 (gapless looping is unreliable).
- **Spectrum shaping:** verify pink = −3 dB/oct, brown = −6 dB/oct with real analyzers; protect sub-bass (<40 Hz) from wasting energy on laptop speakers; gentle high-shelf cut ≥ 12 kHz on white noise to reduce hiss fatigue.
- **Dynamics:** steady-state textures; peak-to-average ratio kept low; nothing in any scene should spike >6 dB above scene average.
- **Binaural engine:** carrier tones default 200–400 Hz region; beat-frequency presets alpha (10 Hz), theta (6 Hz), gamma (40 Hz); mix beats ~18–24 dB below music bed; disable when headphones not confirmed.
- **Focus Boost (AM):** apply 12–20 Hz sinusoidal amplitude modulation to music stems; depth default 30%, range 0–100%; render option offline (pre-modulated files) if CPU becomes an issue on mobile.
- **Performance:** audio graph < 5% CPU on a mid-range phone; instant start (<300 ms); scene switches crossfaded with no dropouts.

---

## 9. Personalization & Onboarding Engine

**First-run flow (≤ 60 seconds):**
1. "What are you working on most?" → maps to a task mode (§5).
2. "How noisy is your space?" (quiet / home / open office / varies) → sets masking defaults.
3. "Do you often find it hard to sustain attention? (many people with ADHD do)" → if yes: default pink-noise-forward profile, higher Focus Boost depth, ADHD mode pinned [2][14]. Phrase carefully as non-diagnostic.
4. "Headphones or speakers?" → gates binaural features.
5. Play 3× 10-second samples (pink noise / rain / café) → "which felt best?" → seeds the first scene and the spectral-tilt position.

**Ongoing adaptation:** end-of-session 1-tap rating ("🎯 focused / 😐 ok / 😵 distracted") feeds a simple preference model; after ~10 sessions show the user their personal "what works for you" card — turning the individual-differences finding [2] into a genuinely personal product.

---

## 10. Product Roadmap (MVP → V2 → V3)

**MVP (v1) — the evidence core**
- Colored noise engine (white/pink/brown + tilt slider), 6 nature scenes, 3 place ambiences, 3 instrumental music modes
- 4-layer mixer, volume with guidance bands, fades, session timer + break auto-switch to nature
- Task-mode presets (Deep Focus, Reading & Writing, Creative Flow, Break)
- Onboarding quiz; saved presets

**V2 — the signature features**
- Focus Boost (12–20 Hz AM depth control) [14]
- Brainstorm Warm-up scheduler [7]
- Binaural-beat overlay (experimental label) + headphone detection
- 7-day A/B self-calibration and personal "what works" report
- PWA offline mode, scene sharing

**V3 — adaptive & generative**
- Adaptive masking via local mic analysis [13]
- Generative endless music per mode
- Team/workspace plans with shared focus sessions; integrations (calendars, task tools)
- Published internal A/B research (contribute back to the science — a credibility moat)

---

## 11. Success Metrics

- **Activation:** % of new users reaching first sound within 60 s of onboarding.
- **Session quality:** median self-rated focus score (1-tap post-session); target ≥ 70% "focused".
- **Habit:** sessions per user per week; 7-day calibration completion rate (target ≥ 30%).
- **Break compliance:** % of timed sessions where users take the nature-sound break.
- **Safety:** % of sessions in the >70 dB band (target < 5%); hearing-warning interactions.
- **Differentiator metric:** % of users who discover their personal optimal sound via calibration and return the next week.

---

## 12. References

1. Mehta, R., Zhu, R., & Cheema, A. (2012). *Is Noise Always Bad? Exploring the Effects of Ambient Noise on Creative Cognition.* Journal of Consumer Research, 39(4), 784–799. [Summary](https://news.illinois.edu/research-too-much-too-little-noise-turns-off-consumers-creativity/) · [ScienceDaily](https://www.sciencedaily.com/releases/2012/05/120514134332.htm)
2. Nigg, J. T., et al. (2024). *Systematic Review and Meta-Analysis: Do White Noise or Pink Noise Help With Task Performance in Youth With ADHD or Elevated Attention Problems?* J. Am. Acad. Child Adolesc. Psychiatry. [PubMed](https://pubmed.ncbi.nlm.nih.gov/38428577/)
3. Van Hedger, S. C., et al. (2019). *Of cricket chirps and car horns: The effect of nature sounds on cognitive performance.* Psychonomic Bulletin & Review. [Link](https://link.springer.com/article/10.3758/s13423-018-1539-1)
4. Alvarsson, J. J., Wiens, S., & Nilsson, M. E. (2010). *Stress recovery during exposure to nature sound and environmental noise.* Int. J. Environ. Res. Public Health, 7(3), 1036–1046. (Discussed in [3] and [5])
5. Ratcliffe, E., Gatersleben, B., & Sowden, P. (2013). *Bird sounds and their contributions to perceived attention restoration and stress recovery.* Journal of Environmental Psychology, 36. [Link](https://www.sciencedirect.com/science/article/abs/pii/S0272494413000650)
6. Jahncke, H., et al. (2011). *Open-plan office noise: Cognitive performance and restoration.* Journal of Environmental Psychology. [Link](https://www.researchgate.net/publication/230867410)
7. Ritter, S. M., & Ferguson, S. (2017). *Happy creativity: Listening to happy music facilitates divergent thinking.* PLOS ONE, 12(9): e0182210. [Link](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0182210)
8. Shih, Y.-N., et al. / Frontiers in Psychology (2024). *Impact of background music on reading comprehension: influence of lyrics language and study habits.* [Link](https://pmc.ncbi.nlm.nih.gov/articles/PMC11027201/) (also citing Anderson & Fuller 2010; Perham & Currie 2014; Bayesian meta-analysis of 65 studies on auditory distraction during reading)
9. Reed, et al. *Background Music: The Effects of Lyrics and Tempo on Reading Comprehension and Speed.* [Link](https://www.semanticscholar.org/paper/e3ae99fbfad727c11de7bb46c5b8434ffbe817f7)
10. Thompson, W. F., et al. (2012). Fast and loud background music disrupts reading comprehension. (Cited within [8])
11. Irrelevant Speech Effect literature — Banbury & Berry; Jones & Macken; Haka, M., et al. (2009) on speech intelligibility (STI) and office task performance. Overview: [Open-plan office noise: susceptibility of cognitive tasks for irrelevant speech](https://cyberleninka.org/article/n/1144574)
12. Jahncke, H. (2013) and related: cognitive performance declines with speech intelligibility up to STI ≈ 0.50. Overview: [MentalMather — How background noise degrades working memory](https://mentalmather.com/articles/open-offices-background-noise-working-memory)
13. Haapakangas, A., et al. (2017). *Effect of self-adjustable masking noise on open-plan office worker's concentration, task performance and attitudes.* Applied Ergonomics. [Link](https://www.sciencedirect.com/science/article/abs/pii/S0003682X16306053)
14. Woods, K. J. P., Sampaio, G., James, T., et al. (2024). *Rapid modulation in music supports attention in listeners with attentional difficulties.* Communications Biology, 7, 1376. [Coverage](https://medicalxpress.com/news/2025-01-music-focus-people-adhd.html)
15. Garcia-Argibay, M., Santed, M. A., & Reales, J. M. (2019). *Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis.* Psychological Research. (Overview: [howworks.ai](https://howworks.ai/blog/do-binaural-beats-work))
16. Basu, A., & Banerjee, B. (2023). *Potential of binaural beats intervention for improving memory and attention: meta-analysis and systematic review.* Psychological Research. [Link](https://link.springer.com/article/10.1007/s00426-022-01706-7)
17. Ingendoh, R. M., Posny, E. S., & Heine, A. (2023). *Binaural beats to entrain the brain? A systematic review.* PLOS ONE, 18(5): e0286023. [Link](https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0286023&type=printable)
18. ScienceInsights (2026). *Which Noise Helps You Focus? White, Pink, or Brown.* [Link](https://scienceinsights.org/which-noise-helps-you-focus-white-pink-or-brown/)
19. Buxton, R. T., et al. (2021) and comparative nature-vs-artificial sound studies; synthesis coverage: [Forest Therapy Hub — Nature sounds vs white noise](https://foresttherapyhub.com/news/94159/)
20. Physiological/Imaging: *Impact of exposure to natural versus urban soundscapes on brain functional connectivity, BOLD entropy and behavior* (2023), Experimental Brain Research. [Link](https://www.sciencedirect.com/science/article/pii/S0013935123025926)
21. DeepHush (2026). *The Best Ambient Sounds for Deep Work: A Complete Guide.* [Link](https://getdeephush.com/blog/best-ambient-sounds-for-deep-work)

---

*Compiled 2026-09-18. Note: this document cites the peer-reviewed literature as retrieved; verify final reference details against the original papers before external publication. Evidence strengths are graded qualitatively: Strong (meta-analyses / multi-experiment papers), Moderate (single well-controlled studies), Mixed/Weak (contradictory or early-stage literature).*
