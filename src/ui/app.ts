import { mountMixer } from './mixer';
import { mountMaster } from './master';
import { mountTransport } from './transport';
import { mountTimer } from './timer';
import { initShortcuts } from './shortcuts';

// Toasts are rendered by ritual.ts's mountToast(), mounted once from main.ts —
// this module used to have its own `ui:toast` listener, which meant every
// toast rendered twice. Don't add another one here.

export function mountApp(root: HTMLElement): void {
  root.innerHTML = '';
  root.className = 'app-shell';

  const heading = document.createElement('h1');
  heading.className = 'app-title glitch';
  heading.textContent = 'INFINITE VOIDSONG';
  heading.dataset.text = 'INFINITE VOIDSONG';
  // A small secret: the wordmark opens a hidden game (loaded only when it is asked for).
  heading.style.cursor = 'pointer';
  heading.addEventListener('click', () => {
    void import('./pacman').then((m) => m.openPacman());
  });
  root.appendChild(heading);

  const layout = document.createElement('div');
  layout.className = 'app-layout';
  root.appendChild(layout);

  const mixerCol = document.createElement('section');
  mixerCol.className = 'col col-mixer';
  mixerCol.setAttribute('aria-label', 'Layers and master');
  layout.appendChild(mixerCol);

  const sideCol = document.createElement('section');
  sideCol.className = 'col col-side';
  sideCol.setAttribute('aria-label', 'Session, player and presets');
  layout.appendChild(sideCol);

  const mixerMount = document.createElement('div');
  mixerCol.appendChild(mixerMount);

  const masterMount = document.createElement('div');
  mixerCol.appendChild(masterMount);

  // Session first, then the player and the presets below it.
  const timerMount = document.createElement('div');
  timerMount.id = 'timer';
  sideCol.appendChild(timerMount);

  const transportMount = document.createElement('div');
  sideCol.appendChild(transportMount);

  mountMixer(mixerMount);
  mountMaster(masterMount);
  mountTimer(timerMount);
  mountTransport(transportMount);

  // One column on a phone: Session, Player and Presets first, then Mixer and Master, so Play is
  // on the first screen. Two columns on a wide screen: Mixer left, Session right (DOM order
  // follows the visual order in both cases, so keyboard and screen reader order match).
  const wide = matchMedia('(min-width: 960px)');
  const order = (): void => {
    if (wide.matches) layout.insertBefore(mixerCol, sideCol);
    else layout.insertBefore(sideCol, mixerCol);
  };
  order();
  wide.addEventListener('change', order);

  initShortcuts();
}
