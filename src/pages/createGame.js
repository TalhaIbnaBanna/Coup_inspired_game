// Create Game Page
import { navigate } from '../main.js';
import { socketClient } from '../socket.js';
import { renderRulesDrawer } from '../components/rulesDrawer.js';

export function renderCreateGame(container) {
  container.innerHTML = `
    <div class="page create-game-page">
      <nav class="top-nav">
        <button id="btn-back" class="btn btn-icon-only">←</button>
        <h2 class="nav-title">COUP</h2>
        <button id="btn-rules-nav" class="btn btn-icon-only">📜</button>
      </nav>

      <div class="breadcrumb">
        <a href="#" id="breadcrumb-home">Home</a> / Create New Game
      </div>

      <div class="page-content">
        <div id="create-form" class="card glass-card">
          <h2 class="card-title">Create New Game</h2>

          <div class="form-group">
            <label for="player-name">Your Name *</label>
            <input type="text" id="player-name" class="input" placeholder="Enter your name" maxlength="20" autocomplete="off" />
          </div>

          <div class="form-group">
            <label>Round Time Limit: <span id="timer-value">30</span>s</label>
            <input type="range" id="timer-slider" class="slider" min="10" max="60" value="30" step="5" />
          </div>

          <button id="btn-create-game" class="btn btn-primary btn-full">
            <span class="btn-icon">+</span>
            Create Game
          </button>
        </div>

        <!-- Lobby (hidden initially) -->
        <div id="lobby" class="card glass-card" style="display: none;">
          <h2 class="card-title">Game Lobby</h2>

          <div class="room-code-display">
            <label>Room Code</label>
            <div class="room-code" id="room-code">------</div>
            <button id="btn-copy-code" class="btn btn-ghost btn-small">📋 Copy</button>
          </div>

          <div class="players-list" id="players-list">
            <!-- Dynamic player list -->
          </div>

          <div class="lobby-info">
            <p>Waiting for players... (2–6 needed)</p>
            <p class="text-muted">Share the room code with friends to join!</p>
          </div>

          <button id="btn-start-game" class="btn btn-primary btn-full" disabled>
            Start Game
          </button>
        </div>
      </div>

      <!-- Rules Drawer -->
      <div id="rules-drawer" class="drawer drawer-left">
        <div class="drawer-overlay"></div>
        <div class="drawer-content"></div>
      </div>
    </div>
  `;

  // Timer slider
  const timerSlider = document.getElementById('timer-slider');
  const timerValue = document.getElementById('timer-value');
  timerSlider.addEventListener('input', () => {
    timerValue.textContent = timerSlider.value;
  });

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => navigate('landing'));
  document.getElementById('breadcrumb-home').addEventListener('click', (e) => {
    e.preventDefault();
    navigate('landing');
  });

  // Rules
  const openRules = () => {
    const drawer = document.getElementById('rules-drawer');
    drawer.classList.add('open');
    renderRulesDrawer(drawer.querySelector('.drawer-content'));
  };
  document.getElementById('btn-rules-nav').addEventListener('click', openRules);
  document.querySelector('.drawer-overlay')?.addEventListener('click', () => {
    document.getElementById('rules-drawer').classList.remove('open');
  });

  // Create game
  document.getElementById('btn-create-game').addEventListener('click', async () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) {
      showToast('Please enter your name');
      return;
    }

    const settings = {
      turnTimer: parseInt(timerSlider.value)
    };

    try {
      const btn = document.getElementById('btn-create-game');
      btn.disabled = true;
      btn.textContent = 'Creating...';

      const result = await socketClient.createRoom(name, settings);

      // Show lobby
      document.getElementById('create-form').style.display = 'none';
      document.getElementById('lobby').style.display = 'block';
      document.getElementById('room-code').textContent = result.roomCode;

    } catch (err) {
      showToast(err.message);
      const btn = document.getElementById('btn-create-game');
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">+</span> Create Game';
    }
  });

  // Copy room code
  document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const code = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('Room code copied!');
    });
  });

  // Start game
  document.getElementById('btn-start-game').addEventListener('click', async () => {
    try {
      await socketClient.startGame();
    } catch (err) {
      showToast(err.message);
    }
  });

  // Lobby state updates
  socketClient.on('lobbyState', (state) => {
    updateLobby(state);
  });
}

function updateLobby(state) {
  const playersList = document.getElementById('players-list');
  if (!playersList) return;

  playersList.innerHTML = state.players.map((p, i) => `
    <div class="player-lobby-item ${p.id === state.hostId ? 'is-host' : ''}">
      <span class="player-avatar">${getAvatar(i)}</span>
      <span class="player-name">${p.name}</span>
      ${p.id === state.hostId ? '<span class="host-badge">HOST</span>' : ''}
    </div>
  `).join('');

  const startBtn = document.getElementById('btn-start-game');
  if (startBtn) {
    startBtn.disabled = state.players.length < 2;
    const lobbyInfo = document.querySelector('.lobby-info');
    if (lobbyInfo) {
      lobbyInfo.innerHTML = state.players.length < 2
        ? `<p>Need at least 2 players to start (${state.players.length}/6)</p><p class="text-muted">Share the room code with friends!</p>`
        : `<p>${state.players.length}/6 players ready!</p>`;
    }
  }
}

function getAvatar(index) {
  const avatars = ['🗡️', '🛡️', '👑', '🎭', '⚔️', '🏰'];
  return avatars[index % avatars.length];
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
