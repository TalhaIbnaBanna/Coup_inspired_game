// Main entry point — client-side router and app initialization
import { socketClient } from './socket.js';
import { renderLanding } from './pages/landing.js';
import { renderCreateGame } from './pages/createGame.js';
import { renderJoinGame } from './pages/joinGame.js';
import { renderGameBoard } from './pages/gameBoard.js';

const app = document.getElementById('app');

// Simple client-side router
const routes = {
  landing: renderLanding,
  create: renderCreateGame,
  join: renderJoinGame,
  lobby: null, // handled within create/join flows
  game: renderGameBoard
};

let currentPage = 'landing';

export function navigate(page, data = {}) {
  currentPage = page;
  app.innerHTML = '';
  
  if (routes[page]) {
    routes[page](app, data);
  }
}

// Initialize
socketClient.connect();

socketClient.on('_connected', () => {
  console.log('Socket connected, rendering landing page');
});

// Handle game state updates — auto-navigate to game board
socketClient.on('gameState', (state) => {
  if (currentPage !== 'game') {
    navigate('game', { state });
  }
});

// Start on landing
navigate('landing');
