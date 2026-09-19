// A small page for listening to the end-of-session sounds side by side (chimes.html).
import { playChime, CHIME_VARIANTS } from '../audio/chime';

const list = document.getElementById('list')!;
const level = document.getElementById('level') as HTMLInputElement;
let ctx: AudioContext | null = null;

CHIME_VARIANTS.forEach((v, i) => {
  const box = document.createElement('section');
  box.className = 'chime';
  box.innerHTML = `<h2>${i + 1} · ${v.name}</h2><p>${v.blurb}</p>`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `Play ${i + 1}`;
  btn.addEventListener('click', () => {
    ctx ??= new AudioContext();
    playChime(ctx, v.id, Number(level.value));
  });
  box.appendChild(btn);
  list.appendChild(box);
});
