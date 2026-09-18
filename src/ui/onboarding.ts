import '../styles/onboarding.css';
import type { TaskPreset } from '../state/types';
import { store } from '../state/store';
import { applyPreset } from '../state/presets';

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
  `focused work. Timed sessions carry real breaks between the${NBSP}working stretches. What settles one ` +
  `person may leave another restless, and${NBSP}the${NBSP}right mix shifts with the${NBSP}task. There are ` +
  `no${NBSP}accounts and${NBSP}no${NBSP}tracking: everything stays on${NBSP}your device. Three short ` +
  `questions tune a${NBSP}starting mix for${NBSP}what you are about to${NBSP}do, and${NBSP}you can change ` +
  `any of${NBSP}it${NBSP}once you begin.`;

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

/** Mounts the first-visit welcome and quiz overlay. No-ops once `onboarded` is already true. */
export function mountOnboarding(root?: HTMLElement): void {
  if (store.get().onboarded) return;

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

  const body = document.createElement('div');
  body.className = 'term__body';
  overlay.appendChild(body);

  const bootLog = document.createElement('div');
  bootLog.className = 'term__boot';
  body.appendChild(bootLog);

  const log = document.createElement('div');
  log.className = 'term__log';
  body.appendChild(log);

  const activeStep = document.createElement('div');
  body.appendChild(activeStep);

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
    overlay.remove();
  }

  function finish(task: TaskPreset, noise: NoiseAnswer, output: OutputAnswer): void {
    applyPreset(task, { noise, output });
    store.set((s) => ({ ...s, onboarded: true, playback: 'starting' }));
    teardown();
  }

  function skip(): void {
    finish(DEFAULT_TASK, DEFAULT_NOISE, DEFAULT_OUTPUT);
  }

  function renderActions(showEnter: boolean): void {
    actions.innerHTML = '';

    if (showEnter) {
      const enterBtn = document.createElement('button');
      enterBtn.type = 'button';
      enterBtn.className = 'term__enter';
      enterBtn.textContent = 'Enter';
      enterBtn.addEventListener('click', () => {
        if (answers.task && answers.noise && answers.output) {
          finish(answers.task, answers.noise, answers.output);
        }
      });
      actions.appendChild(enterBtn);
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

    renderActions(false);
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

    renderActions(true);
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

  async function runIntro(): Promise<void> {
    renderActions(false);
    const skipBtn = actions.querySelector<HTMLButtonElement>('.term__skip');
    skipBtn?.focus();

    for (const line of BOOT_LINES) {
      await typeLine(bootLog, line);
    }
    await typeLine(bootLog, BOOT_PROMPT_LINE, 'term__boot-line--prompt');

    const title = document.createElement('h1');
    title.className = 'term__title glitch';
    title.dataset.text = 'INFINITE VOIDSONG';
    title.textContent = 'INFINITE VOIDSONG';
    body.insertBefore(title, log);

    const copy = document.createElement('p');
    copy.className = 'term__copy';
    copy.textContent = WELCOME_COPY;
    body.insertBefore(copy, log);

    const guide = document.createElement('p');
    guide.className = 'term__guide';
    guide.innerHTML = `<span class="term__guide-label">HOW TO MOVE</span> · ${HOW_TO_MOVE}`;
    body.insertBefore(guide, log);

    const section = document.createElement('p');
    section.className = 'term__section';
    section.textContent = 'Quick tuning';
    body.insertBefore(section, log);

    renderStep();
  }

  container.appendChild(overlay);
  void runIntro();
}
