import { TamagoyakiGame } from './game.js';

const container = document.getElementById('app');
if (container) {
  new TamagoyakiGame(container);
}
