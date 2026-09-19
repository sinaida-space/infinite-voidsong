import '../styles/onboarding.css';
import type { TaskPreset, TimerPreset } from '../state/types';
import { store } from '../state/store';
import { applyPreset } from '../state/presets';
import { startTimer, setWarmup, setCustomDurations, CUSTOM_WORK_RANGE, CUSTOM_BREAK_RANGE } from '../state/session';
import { createStars } from './stars';
import { mountFooter } from './footer';

type NoiseAnswer = 'quiet' | 'home' | 'office' | 'varies';
type OutputAnswer = 'headphones' | 'speakers';
type SessionChoice = TimerPreset | 'untimed';

const NBSP = '\u00a0';

const BOOT_LINES = [
  'VOIDSONG/1.1 · boot',
  'audio engine ........ ok',
  'tunnel renderer ...... ok',
  'storage ............. local only',
  'network ............. none',
];
const BOOT_PROMPT_LINE = '> sound is generated here or played from short field recordings. nothing leaves your device.';

const INTRO_COPY = `Endless generated soundscapes for${NBSP}focused work.`;

interface ModeDef {
  id: TaskPreset;
  name: string;
  blurb: string;
  session: SessionChoice; // the session that usually goes with it
}

const MODES: ModeDef[] = [
  {
    id: 'deep-focus',
    name: 'Deep focus',
    blurb: `Steady noise, soft rain and${NBSP}a${NBSP}low drone. For analysis, coding and${NBSP}anything that needs your full attention.`,
    session: '50/10',
  },
  {
    id: 'reading-writing',
    name: 'Reading and writing',
    blurb: `Quiet noise and running water, no${NBSP}music. Keeps words clear while you read or${NBSP}write.`,
    session: '25/5',
  },
  {
    id: 'creative-flow',
    name: 'Creative flow',
    blurb: `Café murmur and easy lo-fi beats, a${NBSP}little louder. For ideas, with an${NBSP}optional ten minute warm-up.`,
    session: '90/15',
  },
  {
    id: 'routine',
    name: 'Routine',
    blurb: `Upbeat house and${NBSP}a${NBSP}fan hum. For admin, email and${NBSP}other repetitive tasks.`,
    session: '50/10',
  },
  {
    id: 'break-restore',
    name: 'Break and restore',
    blurb: `Stream, wind and soft plucks at${NBSP}a${NBSP}low level. A${NBSP}real pause instead of more work.`,
    session: 'untimed',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    blurb: `Rain and${NBSP}deep, muffled tones that end in${NBSP}a${NBSP}slow fade after 45 minutes.`,
    session: 'untimed',
  },
];

interface SessionDef {
  id: SessionChoice;
  name: string;
  blurb: string;
}

const SESSIONS: SessionDef[] = [
  {
    id: '25/5',
    name: '25 / 5',
    blurb: `Short sprints, known as the Pomodoro method. Easy to${NBSP}start, so it suits admin or${NBSP}days when motivation is${NBSP}low.`,
  },
  {
    id: '50/10',
    name: '50 / 10',
    blurb: `A longer block for work that needs time to${NBSP}warm up, such as writing or coding, still ending in${NBSP}a${NBSP}proper break.`,
  },
  {
    id: '90/15',
    name: '90 / 15',
    blurb: `One full attention cycle. For deep work you already know how to${NBSP}begin.`,
  },
  {
    id: 'custom',
    name: 'Custom',
    blurb: `Your own lengths: type the minutes of${NBSP}work and${NBSP}the minutes of${NBSP}rest.`,
  },
  {
    id: 'untimed',
    name: 'No timer',
    blurb: `Sound only, for${NBSP}as long as you like.`,
  },
];

const WARMUP_LABEL = 'Warm-up first (10 min)';
const WARMUP_NOTE =
  `Ten minutes of easy start before the first work block. They come on${NBSP}top of the session length, so 25/5 with a${NBSP}warm-up is ` +
  `10 minutes of warm-up, then 25 of${NBSP}work. The sound stays the same and there is no signal when it ends. Timed sessions only.`;

const SESSIONS_NOTE =
  `No study fixes the perfect length. These are common working conventions, so try more than${NBSP}one. ` +
  `What research does support is taking real breaks.`;

interface ChoiceDef<T extends string> {
  id: T;
  name: string;
  blurb: string;
}

// These two change the mix a little (see applyPreset): more masking noise in an
// open office, a softer mix in a quiet room, a slightly lower volume on speakers.
const SPACES: Array<ChoiceDef<NoiseAnswer>> = [
  { id: 'quiet', name: 'Quiet', blurb: `A quiet room. The mix stays a${NBSP}little softer.` },
  { id: 'home', name: 'Home', blurb: `Everyday sound around you. The mix stays as${NBSP}designed.` },
  { id: 'office', name: 'Open office', blurb: `Talk and${NBSP}movement nearby. The mix adds more masking noise.` },
  { id: 'varies', name: 'It varies', blurb: `Different places on${NBSP}different days. The mix stays as${NBSP}designed.` },
];

const OUTPUTS: Array<ChoiceDef<OutputAnswer>> = [
  { id: 'headphones', name: 'Headphones', blurb: `The full mix at${NBSP}its designed level.` },
  { id: 'speakers', name: 'Speakers', blurb: `The volume goes down a${NBSP}little, because speakers fill the room.` },
];

function findRootOrCreate(id: string): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = id;
  document.body.appendChild(created);
  return created;
}

function reducedMotionActive(): boolean {
  if (store.get().reducedMotion) return true;
  return typeof document !== 'undefined' && document.hidden;
}

/** Types `text` into a freshly appended element, 6 chars per 14ms tick with a 70ms pause after. Instant under reduced motion or a hidden tab. */
async function typeLine(container: HTMLElement, text: string, className?: string): Promise<HTMLElement> {
  const el = document.createElement('p');
  if (className) el.className = className;
  container.appendChild(el);

  if (!reducedMotionActive()) {
    for (let i = 0; i <= text.length; i += 6) {
      el.textContent = text.slice(0, i);
      await new Promise((r) => setTimeout(r, 14));
    }
    await new Promise((r) => setTimeout(r, 70));
  }
  el.textContent = text;
  return el;
}

export interface OnboardingOptions {
  /** Reopen the welcome from the footer: Skip just closes, nothing is reset. (A returning visitor gets the same Skip.) */
  replay?: boolean;
}

/** Reopens the welcome screen on demand (footer link). Skip closes it without touching the current mix. */
export function showWelcome(): void {
  mountOnboarding(undefined, { replay: true });
}

/**
 * Mounts the welcome. It opens on every visit: browsers only allow sound after
 * a tap, so the welcome doubles as the start screen. First a short boot log,
 * then one dialog where you choose a mode and a session. A returning visitor
 * (mix already saved) can Skip to keep that mix untouched.
 */
export function mountOnboarding(root?: HTMLElement, options: OnboardingOptions = {}): void {
  if (document.querySelector('.term')) return;
  const returning = store.get().onboarded;

  const container = root ?? findRootOrCreate('onboarding');
  container.innerHTML = '';

  const choice = {
    mode: 'deep-focus' as TaskPreset,
    session: '50/10' as SessionChoice,
    warmup: false,
    sessionTouched: false, // once you pick a session yourself, changing the mode stops changing it
    noise: 'home' as NoiseAnswer,
    output: 'headphones' as OutputAnswer,
  };

  const overlay = document.createElement('div');
  overlay.className = 'term';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome to Infinite Voidsong');

  const stars = createStars(store.get().reducedMotion);
  overlay.appendChild(stars.canvas);

  const body = document.createElement('div');
  body.className = 'term__body';
  overlay.appendChild(body);

  const bootLog = document.createElement('div');
  bootLog.className = 'term__boot';
  body.appendChild(bootLog);

  const actions = document.createElement('div');
  actions.className = 'term__actions';
  body.appendChild(actions);

  let keyHandler: ((e: KeyboardEvent) => void) | null = null;
  function setKeyHandler(fn: ((e: KeyboardEvent) => void) | null): void {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = fn;
    if (keyHandler) window.addEventListener('keydown', keyHandler);
  }

  function teardown(): void {
    setKeyHandler(null);
    stars.stop();
    overlay.remove();
  }

  // --- custom lengths (shown when the Custom session is chosen) --------------------
  let workInput: HTMLInputElement;
  let breakInput: HTMLInputElement;

  function clampMinutes(value: string, range: { min: number; max: number }, fallback: number): number {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(range.max, Math.max(range.min, n)) : fallback;
  }

  // --- finish ----------------------------------------------------------------------
  function begin(): void {
    applyPreset(choice.mode, { noise: choice.noise, output: choice.output });
    if (choice.session === 'custom') {
      setCustomDurations(
        clampMinutes(workInput.value, CUSTOM_WORK_RANGE, 40),
        clampMinutes(breakInput.value, CUSTOM_BREAK_RANGE, 8),
      );
    }
    // Untimed: drop the timer but keep the preset's own sleep fade, if it has one.
    store.set((s) => ({
      ...s,
      onboarded: true,
      playback: s.playback === 'playing' ? s.playback : 'starting',
      session: choice.session === 'untimed' ? { ...s.session, timer: null } : s.session,
    }));
    // The warm-up exists for Creative flow and timed sessions only.
    setWarmup(choice.warmup && choice.mode === 'creative-flow' && choice.session !== 'untimed');
    if (choice.session !== 'untimed') startTimer(choice.session);
    teardown();
  }

  function skip(): void {
    if (options.replay || returning) {
      teardown();
      return;
    }
    // A first visit that skips gets the default: deep focus, 50/10, headphones.
    begin();
  }

  function renderActions(primary: { label: string; onClick: () => void } | null): HTMLButtonElement | null {
    actions.innerHTML = '';

    let primaryBtn: HTMLButtonElement | null = null;
    if (primary) {
      primaryBtn = document.createElement('button');
      primaryBtn.type = 'button';
      primaryBtn.className = 'term__enter';
      primaryBtn.textContent = primary.label;
      primaryBtn.addEventListener('click', primary.onClick);
      actions.appendChild(primaryBtn);
    }

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'term__skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', skip);
    actions.appendChild(skipBtn);

    const privacy = document.createElement('a');
    privacy.className = 'term__privacy';
    privacy.href = '/privacy.html';
    privacy.textContent = 'Privacy';
    actions.appendChild(privacy);
    return primaryBtn;
  }

  // --- the dialog --------------------------------------------------------------------
  function optionCard(name: string, blurb: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.setAttribute('aria-pressed', 'false');
    const n = document.createElement('span');
    n.className = 'choice__name';
    n.textContent = name;
    const b = document.createElement('span');
    b.className = 'choice__blurb';
    b.textContent = blurb;
    btn.append(n, b);
    return btn;
  }

  function showDialog(): void {
    setKeyHandler(null);
    bootLog.remove();

    const title = document.createElement('h1');
    title.className = 'term__title glitch';
    title.dataset.text = 'INFINITE VOIDSONG';
    title.textContent = 'INFINITE VOIDSONG';
    body.insertBefore(title, actions);

    const intro = document.createElement('p');
    intro.className = 'term__copy';
    intro.textContent = INTRO_COPY;
    body.insertBefore(intro, actions);

    const dialog = document.createElement('section');
    dialog.className = 'term__dialog';
    dialog.setAttribute('aria-label', 'Choose a mode and a session');
    body.insertBefore(dialog, actions);

    // Mode ---------------------------------------------------------------------------
    const modeLabel = document.createElement('p');
    modeLabel.className = 'term__label';
    modeLabel.textContent = '1 · Mode';
    const modeGrid = document.createElement('div');
    modeGrid.className = 'choice-grid';
    modeGrid.setAttribute('role', 'group');
    modeGrid.setAttribute('aria-label', 'Mode');
    const modeCards = new Map<TaskPreset, HTMLButtonElement>();
    for (const m of MODES) {
      const card = optionCard(m.name, m.blurb);
      card.addEventListener('click', () => {
        choice.mode = m.id;
        if (!choice.sessionTouched) choice.session = m.session;
        syncCards();
      });
      modeCards.set(m.id, card);
      modeGrid.appendChild(card);
    }

    // Warm-up: only Creative flow offers it, and only with a timed session ----------------
    const warmBox = document.createElement('label');
    warmBox.className = 'term__warm';
    warmBox.hidden = true;
    const warmHead = document.createElement('span');
    warmHead.className = 'term__warm-head';
    const warmInput = document.createElement('input');
    warmInput.type = 'checkbox';
    warmInput.addEventListener('change', () => { choice.warmup = warmInput.checked; });
    const warmLabel = document.createElement('span');
    warmLabel.textContent = WARMUP_LABEL;
    warmHead.append(warmInput, warmLabel);
    const warmNote = document.createElement('span');
    warmNote.className = 'term__warm-note';
    warmNote.textContent = WARMUP_NOTE;
    warmBox.append(warmHead, warmNote);

    // Session ------------------------------------------------------------------------
    const sessionLabel = document.createElement('p');
    sessionLabel.className = 'term__label';
    sessionLabel.textContent = '2 · Session';
    const sessionGrid = document.createElement('div');
    sessionGrid.className = 'choice-grid';
    sessionGrid.setAttribute('role', 'group');
    sessionGrid.setAttribute('aria-label', 'Session length');
    const sessionCards = new Map<SessionChoice, HTMLButtonElement>();
    for (const sdef of SESSIONS) {
      const card = optionCard(sdef.name, sdef.blurb);
      card.addEventListener('click', () => {
        choice.session = sdef.id;
        choice.sessionTouched = true;
        syncCards();
        if (sdef.id === 'custom') workInput.focus({ preventScroll: true });
      });
      sessionCards.set(sdef.id, card);
      sessionGrid.appendChild(card);
    }

    // Custom fields -----------------------------------------------------------------
    const custom = document.createElement('div');
    custom.className = 'timer__custom';
    custom.hidden = true;
    const field = (label: string, range: { min: number; max: number }, value: number) => {
      const wrap = document.createElement('label');
      wrap.className = 'timer__field';
      const text = document.createElement('span');
      text.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'timer__num';
      input.min = String(range.min);
      input.max = String(range.max);
      input.step = '1';
      input.inputMode = 'numeric';
      input.value = String(value);
      const unit = document.createElement('span');
      unit.textContent = 'min';
      wrap.append(text, input, unit);
      return { wrap, input };
    };
    const sess = store.get().session;
    const w = field('Work', CUSTOM_WORK_RANGE, sess.customWork);
    const b = field('Break', CUSTOM_BREAK_RANGE, sess.customBreak);
    workInput = w.input;
    breakInput = b.input;
    custom.append(w.wrap, b.wrap);

    const note = document.createElement('p');
    note.className = 'term__note';
    note.append(`${SESSIONS_NOTE} `);
    const research = document.createElement('a');
    research.className = 'term__link';
    research.href = '/research.html';
    research.target = '_blank';
    research.rel = 'noopener noreferrer';
    research.textContent = 'Research and sources';
    note.append(research);

    // Your space and listening device: the same kind of choice as mode and session -------
    function choiceSection<T extends string>(
      label: string,
      aria: string,
      defs: Array<ChoiceDef<T>>,
      current: () => T,
      onPick: (v: T) => void,
    ): { label: HTMLParagraphElement; grid: HTMLDivElement; sync: () => void } {
      const heading = document.createElement('p');
      heading.className = 'term__label';
      heading.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'choice-grid';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', aria);
      const cards = new Map<T, HTMLButtonElement>();
      for (const d of defs) {
        const card = optionCard(d.name, d.blurb);
        card.addEventListener('click', () => {
          onPick(d.id);
          syncCards();
        });
        cards.set(d.id, card);
        grid.appendChild(card);
      }
      const sync = (): void => {
        for (const [id, card] of cards) card.setAttribute('aria-pressed', String(id === current()));
      };
      return { label: heading, grid, sync };
    }
    const spaceSection = choiceSection('3 · Your space', 'Your space', SPACES, () => choice.noise, (v) => { choice.noise = v; });
    const outputSection = choiceSection('4 · Listening on', 'Listening on', OUTPUTS, () => choice.output, (v) => { choice.output = v; });

    dialog.append(
      modeLabel, modeGrid, warmBox,
      sessionLabel, sessionGrid, custom, note,
      spaceSection.label, spaceSection.grid,
      outputSection.label, outputSection.grid,
    );

    function syncCards(): void {
      for (const [id, card] of modeCards) card.setAttribute('aria-pressed', String(id === choice.mode));
      for (const [id, card] of sessionCards) card.setAttribute('aria-pressed', String(id === choice.session));
      custom.hidden = choice.session !== 'custom';
      warmBox.hidden = !(choice.mode === 'creative-flow' && choice.session !== 'untimed');
      spaceSection.sync();
      outputSection.sync();
    }
    syncCards();

    renderActions({ label: 'Begin', onClick: begin });

    // The same footer as the app, so the welcome does not just end at the Begin button.
    const footerHost = document.createElement('div');
    footerHost.className = 'term__footer';
    body.appendChild(footerHost);
    mountFooter(footerHost, {
      onHome: () => overlay.scrollTo({ top: 0, behavior: 'smooth' }),
      onWelcome: () => overlay.scrollTo({ top: 0, behavior: 'smooth' }),
    });
    // The dialog always starts at its top, whatever the boot screen's scroll or focus did.
    overlay.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { overlay.scrollTop = 0; });
  }

  async function runIntro(): Promise<void> {
    renderActions(null);

    for (const line of BOOT_LINES) {
      await typeLine(bootLog, line);
    }
    await typeLine(bootLog, BOOT_PROMPT_LINE, 'term__boot-line--prompt');

    // First screen is only the boot log; Continue (or Enter) opens the dialog.
    const continueBtn = renderActions({ label: 'Continue', onClick: showDialog });
    continueBtn?.focus({ preventScroll: true });
    setKeyHandler((e) => {
      if (e.key === 'Enter') showDialog();
    });
  }

  container.appendChild(overlay);
  void runIntro();
}
