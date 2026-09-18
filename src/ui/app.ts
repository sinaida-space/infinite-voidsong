import { mountMixer } from './mixer';
import { mountMaster } from './master';
import { mountTransport } from './transport';
import { initShortcuts } from './shortcuts';

// Toasts are rendered by ritual.ts's mountToast(), mounted once from main.ts —
// this module used to have its own `ui:toast` listener, which meant every
// toast rendered twice. Don't add another one here.

export function mountApp(root: HTMLElement): void {
  root.innerHTML = '';
  root.className = 'app-shell';

  const heading = document.createElement('h1');
  heading.className = 'app-title';
  heading.textContent = 'Infinite Voidsong';
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
  sideCol.setAttribute('aria-label', 'Transport and presets');
  layout.appendChild(sideCol);

  const mixerMount = document.createElement('div');
  mixerCol.appendChild(mixerMount);

  const masterMount = document.createElement('div');
  mixerCol.appendChild(masterMount);

  const transportMount = document.createElement('div');
  sideCol.appendChild(transportMount);

  mountMixer(mixerMount);
  mountMaster(masterMount);
  mountTransport(transportMount);

  initShortcuts();
}
