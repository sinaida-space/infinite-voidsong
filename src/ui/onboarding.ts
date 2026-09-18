import '../styles/session.css';
import type { TaskPreset } from '../state/types';
import { store } from '../state/store';
import { applyPreset } from '../state/presets';

type NoiseAnswer = 'quiet' | 'home' | 'office' | 'varies';
type OutputAnswer = 'headphones' | 'speakers';

const WELCOME_COPY =
  'Infinite Voidsong plays endless soundscapes, generated live in your browser, to sit behind focused work. ' +
  'Every layer is made on your device: nothing is recorded, and nothing leaves it. ' +
  'Three short questions tune a starting mix for what you are about to do. ' +
  'You can change any of it after, and skip these questions at any point. ' +
  'What settles one person may not settle another, and the right mix can shift with the task.';

const TASK_OPTIONS: Array<{ value: TaskPreset; label: string }> = [
  { value: 'deep-focus', label: 'Deep focus' },
  { value: 'reading-writing', label: 'Reading & writing' },
  { value: 'creative-flow', label: 'Creative flow' },
  { value: 'routine', label: 'Routine' },
  { value: 'break-restore', label: 'Break & restore' },
];

const NOISE_OPTIONS: Array<{ value: NoiseAnswer; label: string }> = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Open office' },
  { value: 'varies', label: 'It varies' },
];

const OUTPUT_OPTIONS: Array<{ value: OutputAnswer; label: string }> = [
  { value: 'headphones', label: 'Headphones' },
  { value: 'speakers', label: 'Speakers' },
];

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
  overlay.className = 'onboarding';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome to Infinite Voidsong');

  const panel = document.createElement('div');
  panel.className = 'onboarding__panel';
  overlay.appendChild(panel);

  function finish(task: TaskPreset, noise: NoiseAnswer, output: OutputAnswer): void {
    applyPreset(task, { noise, output });
    store.set((s) => ({ ...s, onboarded: true, playback: 'starting' }));
    overlay.remove();
  }

  function skip(): void {
    finish(DEFAULT_TASK, DEFAULT_NOISE, DEFAULT_OUTPUT);
  }

  function renderStep(): void {
    panel.innerHTML = '';

    if (!answers.task) {
      renderWelcome();
    } else if (!answers.noise) {
      renderQuestion('What are you working on?', TASK_OPTIONS, (v) => {
        answers.task = v;
      });
    } else if (!answers.output) {
      renderQuestion('How noisy is your space?', NOISE_OPTIONS, (v) => {
        answers.noise = v;
      });
    } else {
      renderQuestion('Headphones or speakers?', OUTPUT_OPTIONS, (v) => {
        answers.output = v;
      });
    }
  }

  function renderWelcome(): void {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'onboarding__eyebrow';
    eyebrow.textContent = 'Welcome';
    panel.appendChild(eyebrow);

    const title = document.createElement('h1');
    title.className = 'onboarding__title';
    title.textContent = 'Infinite Voidsong';
    panel.appendChild(title);

    const copy = document.createElement('p');
    copy.className = 'onboarding__copy';
    copy.textContent = WELCOME_COPY;
    panel.appendChild(copy);

    const actions = document.createElement('div');
    actions.className = 'onboarding__actions';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'onboarding__skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', skip);
    actions.appendChild(skipBtn);

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'onboarding__primary';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
      renderQuestion('What are you working on?', TASK_OPTIONS, (v) => {
        answers.task = v;
      });
    });
    actions.appendChild(continueBtn);

    panel.appendChild(actions);
  }

  function renderQuestion<T extends string>(
    question: string,
    options: Array<{ value: T; label: string }>,
    onPick: (v: T) => void,
  ): void {
    panel.innerHTML = '';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'onboarding__eyebrow';
    eyebrow.textContent = 'Quick tuning';
    panel.appendChild(eyebrow);

    const q = document.createElement('p');
    q.className = 'onboarding__question';
    q.textContent = question;
    panel.appendChild(q);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'onboarding__options';
    optionsWrap.setAttribute('role', 'group');
    optionsWrap.setAttribute('aria-label', question);

    const isFinalStep = answers.task !== null && answers.noise !== null;

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'onboarding__option';
      btn.textContent = opt.label;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        onPick(opt.value);
        if (isFinalStep && answers.task && answers.noise && answers.output) {
          finish(answers.task, answers.noise, answers.output);
        } else {
          renderStep();
        }
      });
      optionsWrap.appendChild(btn);
    }
    panel.appendChild(optionsWrap);

    const actions = document.createElement('div');
    actions.className = 'onboarding__actions';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'onboarding__skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', skip);
    actions.appendChild(skipBtn);

    panel.appendChild(actions);
  }

  container.appendChild(overlay);
  renderStep();
}
