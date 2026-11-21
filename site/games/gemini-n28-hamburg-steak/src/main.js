import { HamburgGame } from './game.js';

const canvas = document.getElementById('game-canvas');
const game = new HamburgGame(canvas);

// Expose for inspection/QA
window.__hamburgGame = game;

// Subtle SVG-only mute button (zero text)
const soundBtn = document.getElementById('sound-toggle');
const iconOn = document.getElementById('icon-sound-on');
const iconOff = document.getElementById('icon-sound-off');

soundBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
});
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const muted = game.sound.toggleMute();
  iconOn.style.display = muted ? 'none' : 'block';
  iconOff.style.display = muted ? 'block' : 'none';
});

// Main animation loop
let lastTime = performance.now();
function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
