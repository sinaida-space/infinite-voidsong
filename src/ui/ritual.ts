import { bus } from '../state/events';
import { formatMMSS } from '../state/session';

/** Break screen: a centred, large "Break. Back in mm:ss" message, announced politely. */
export function createBreakScreen(): { el: HTMLElement; update: (remainingMs: number) => void } {
  const el = document.createElement('div');
  el.className = 'ritual';
  el.hidden = true;

  const message = document.createElement('p');
  message.className = 'ritual__message';
  message.setAttribute('aria-live', 'polite');
  el.appendChild(message);

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
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (el) el.hidden = true;
    }, ms);
  });
}
