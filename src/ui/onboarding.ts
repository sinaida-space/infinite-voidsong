import '../styles/onboarding.css';
import type { TaskPreset } from '../state/types';
import { store } from '../state/store';
import { applyPreset } from '../state/presets';
import { createStars } from './stars';

type NoiseAnswer = 'quiet' | 'home' | 'office' | 'varies';
type OutputAnswer = 'headphones' | 'speakers';

const NBSP = ' ';

const BOOT_LINES = [
  'VOIDSONG/1.1 · boot',
  'audio engine ........ ok',
  'tunnel renderer ...... ok',
  'storage ............. local only',
  'network ............. none',
];
const BOOT_PROMPT_LINE = '> all sound is generated in this browser. nothing leaves your device.';

const WELCOME_COPY =
  `Infinite Voidsong generates endless soundscapes right in${NBSP}your browser, built to${NBSP}sit behind ` +
  `focused work. No${NBSP}accounts and no${NBSP}tracking: everything stays on${NBSP}your device.`;

const BASIS_COPY = `Published studies on background sound and attention, and what they do and do${NBSP}not show: `;

const SESSIONS_COPY =
  `Choose a timed session in${NBSP}the Session window: 25/5, 50/10 or 90/15 minutes of${NBSP}work and${NBSP}break. ` +
  `When the${NBSP}work ends the sound fades and a real break begins. The guide explains which to${NBSP}use.`;

const HOW_TO_MOVE = `Space play/pause · 1–6 presets · ↑↓ volume · H hide the${NBSP}interface · ? guide`;

interface Step<T extends string> {
  prompt: string;
  options: Array<{ value: T; label: string }>;
}

const TASK_STEP: Step<TaskPreset> = {
  prompt: 'what are you working on?',
  options: [
    { value: 'deep-focus', label: 'Deep focus' },
    { value: 'reading-writing', label: 'Reading & writing' },
    { value: 'creative-flow', label: 'Creative flow' },
    { value: 'routine', label: 'Routine' },
    { value: 'break-restore', label: 'Break & restore' },
  ],
};

const NOISE_STEP: Step<NoiseAnswer> = {
  prompt: `how noisy is${NBSP}your space?`,
  options: [
    { value: 'quiet', label: 'Quiet' },
    { value: 'home', label: 'Home' },
    { value: 'office', label: 'Open office' },
    { value: 'varies', label: 'It varies' },
  ],
};

const OUTPUT_STEP: Step<OutputAnswer> = {
  prompt: `headphones or${NBSP}speakers?`,
  options: [
    { value: 'headphones', label: 'Headphones' },
    { value: 'speakers', label: 'Speakers' },
  ],
};

const DEFAULT_TASK: TaskPreset = 'deep-focus';
const DEFAULT_NOISE: NoiseAnswer = 'home';
const DEFAULT_OUTPUT: OutputAnswer = 'headphones';

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
  /** Reopen the welcome from the footer: Skip just closes, nothing is reset. */
  replay?: boolean;
}

/** Reopens the welcome screen on demand (footer link). Skip closes it without touching the current mix. */
export function showWelcome(): void {
  mountOnboarding(undefined, { replay: true });
}

/** Mounts the first-visit welcome and quiz overlay. No-ops once `onboarded` is already true, unless replaying. */
export function mountOnboarding(root?: HTMLElement, options: OnboardingOptions = {}): void {
  if (store.get().onboarded && !options.replay) return;
  if (document.querySelector('.term')) return;

  const container = root ?? findRootOrCreate('onboarding');
  container.innerHTML = '';

  const answers: { task: TaskPreset | null; noise: NoiseAnswer | null; output: OutputAnswer | null } = {
    task: null,
    noise: null,
    output: null,
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

  // Quick tuning sits on a red ground so the eye lands on it.
  const tuning = document.createElement('section');
  tuning.className = 'term__tuning';
  tuning.hidden = true;
  tuning.setAttribute('aria-label', 'Quick tuning');
  body.appendChild(tuning);

  const tuningLabel = document.createElement('p');
  tuningLabel.className = 'term__section';
  tuningLabel.textContent = 'Quick tuning';
  tuning.appendChild(tuningLabel);

  const log = document.createElement('div');
  log.className = 'term__log';
  tuning.appendChild(log);

  const activeStep = document.createElement('div');
  tuning.appendChild(activeStep);

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

  function finish(task: TaskPreset, noise: NoiseAnswer, output: OutputAnswer): void {
    applyPreset(task, { noise, output });
    store.set((s) => ({ ...s, onboarded: true, playback: s.playback === 'playing' ? s.playback : 'starting' }));
    teardown();
  }

  function skip(): void {
    if (options.replay) {
      teardown();
      return;
    }
    finish(DEFAULT_TASK, DEFAULT_NOISE, DEFAULT_OUTPUT);
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

  function enterAction(): { label: string; onClick: () => void } {
    return {
      label: 'Enter',
      onClick: () => {
        if (answers.task && answers.noise && answers.output) {
          finish(answers.task, answers.noise, answers.output);
        }
      },
    };
  }

  function echo(label: string): void {
    const line = document.createElement('p');
    line.className = 'term__echo';
    line.textContent = `> ${label.toLowerCase()}`;
    log.appendChild(line);
  }

  function renderQuestion<T extends string>(step: Step<T>, onPick: (v: T) => void): void {
    activeStep.innerHTML = '';

    const prompt = document.createElement('p');
    prompt.className = 'term__prompt';
    prompt.textContent = `> ${step.prompt}`;
    activeStep.appendChild(prompt);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'term__options';
    optionsWrap.setAttribute('role', 'group');
    optionsWrap.setAttribute('aria-label', step.prompt);

    const pick = (index: number): void => {
      const opt = step.options[index];
      if (!opt) return;
      onPick(opt.value);
      echo(opt.label);
      renderStep();
    };

    step.options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'term__option';
      btn.innerHTML = `<span class="term__option-key">[${index + 1}]</span> ${opt.label}`;
      btn.addEventListener('click', () => pick(index));
      optionsWrap.appendChild(btn);
    });
    activeStep.appendChild(optionsWrap);

    setKeyHandler((e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= step.options.length) {
        pick(n - 1);
      }
    });

    renderActions(null);
  }

  function renderReady(): void {
    activeStep.innerHTML = '';

    const ready = document.createElement('p');
    ready.className = 'term__prompt';
    ready.textContent = '> ready when you are';
    activeStep.appendChild(ready);

    setKeyHandler((e) => {
      if (e.key === 'Enter' && answers.task && answers.noise && answers.output) {
        finish(answers.task, answers.noise, answers.output);
      }
    });

    renderActions(enterAction());
  }

  function renderStep(): void {
    if (!answers.task) {
      renderQuestion(TASK_STEP, (v) => {
        answers.task = v;
      });
    } else if (!answers.noise) {
      renderQuestion(NOISE_STEP, (v) => {
        answers.noise = v;
      });
    } else if (!answers.output) {
      renderQuestion(OUTPUT_STEP, (v) => {
        answers.output = v;
      });
    } else {
      renderReady();
    }
  }

  function labelled(label: string, text: string, link?: { href: string; label: string }): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = 'term__copy';
    const tag = document.createElement('span');
    tag.className = 'term__guide-label';
    tag.textContent = label;
    p.append(tag, ` · ${text}`);
    if (link) {
      const a = document.createElement('a');
      a.className = 'term__link';
      a.href = link.href;
      a.textContent = link.label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      p.appendChild(a);
    }
    return p;
  }

  /** Second screen: what it is, what it rests on, sessions, then the red quick-tuning panel. */
  function showBriefing(): void {
    setKeyHandler(null);
    bootLog.remove();

    const title = document.createElement('h1');
    title.className = 'term__title glitch';
    title.dataset.text = 'INFINITE VOIDSONG';
    title.textContent = 'INFINITE VOIDSONG';
    body.insertBefore(title, tuning);

    const copy = document.createElement('p');
    copy.className = 'term__copy';
    copy.textContent = WELCOME_COPY;
    body.insertBefore(copy, tuning);

    body.insertBefore(labelled('BASED ON', BASIS_COPY, { href: '/research.html', label: 'Research and sources' }), tuning);
    body.insertBefore(labelled('SESSIONS', SESSIONS_COPY), tuning);

    const guide = document.createElement('p');
    guide.className = 'term__guide';
    guide.innerHTML = `<span class="term__guide-label">HOW TO MOVE</span> · ${HOW_TO_MOVE}`;
    body.insertBefore(guide, tuning);

    tuning.hidden = false;
    renderStep();
    tuning.scrollIntoView({ block: 'nearest' });
  }

  async function runIntro(): Promise<void> {
    renderActions(null);

    for (const line of BOOT_LINES) {
      await typeLine(bootLog, line);
    }
    await typeLine(bootLog, BOOT_PROMPT_LINE, 'term__boot-line--prompt');

    // First screen is only the boot log; Continue (or Enter) opens the briefing.
    const continueBtn = renderActions({ label: 'Continue', onClick: showBriefing });
    continueBtn?.focus();
    setKeyHandler((e) => {
      if (e.key === 'Enter') showBriefing();
    });
  }

  container.appendChild(overlay);
  void runIntro();
}
