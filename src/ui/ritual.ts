import { bus } from '../state/events';
import { formatMMSS } from '../state/session';

function buildWinBar(title: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'win__bar';

  const titleEl = document.createElement('span');
  titleEl.className = 'win__title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  return bar;
}

/** Break screen: a centred "Break. Back in mm:ss" window, announced politely. */
export function createBreakScreen(): { el: HTMLElement; update: (remainingMs: number) => void } {
  const el = document.createElement('div');
  el.className = 'ritual';
  el.hidden = true;

  const win = document.createElement('div');
  win.className = 'win';
  win.appendChild(buildWinBar('Break'));

  const body = document.createElement('div');
  body.className = 'win__body';
  win.appendChild(body);

  const message = document.createElement('p');
  message.className = 'ritual__message';
  message.setAttribute('aria-live', 'polite');
  body.appendChild(message);

  el.appendChild(win);

  function update(remainingMs: number): void {
    message.textContent = `Break. Back in ${formatMMSS(remainingMs)}`;
  }

  update(0);
  return { el, update };
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

/** Mounts a single toast listener; renders `ui:toast` messages near the bottom of the screen. */
export function mountToast(): void {
  bus.on('ui:toast', ({ text, ms }) => {
    let el = document.querySelector<HTMLElement>('.toast');
    let body: HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.className = 'win toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.appendChild(buildWinBar('Notice'));
      body = document.createElement('div');
      body.className = 'win__body toast__body';
      el.appendChild(body);
      document.body.appendChild(el);
    } else {
      body = el.querySelector('.toast__body');
    }
    if (body) body.textContent = text;
    el.hidden = false;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (el) el.hidden = true;
    }, ms);
  });
}
