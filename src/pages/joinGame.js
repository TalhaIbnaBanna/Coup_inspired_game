// Join Game Page
import { navigate } from '../main.js';
import { socketClient } from '../socket.js';

export function renderJoinGame(container) {
  container.innerHTML = `
    <div class="page join-game-page">
      <nav class="top-nav">
        <button id="btn-back" class="btn btn-icon-only">←</button>
        <h2 class="nav-title">COUP</h2>
        <div></div>
      </nav>

      <div class="breadcrumb">
        <a href="#" id="breadcrumb-home">Home</a> / Join Game
      </div>

      <div class="page-content">
        <div class="card glass-card">
          <h2 class="card-title">Join Existing Game</h2>

          <div class="form-group">
            <label for="join-name">Your Name *</label>
            <input type="text" id="join-name" class="input" placeholder="Enter your name" maxlength="20" autocomplete="off" />
          </div>

          <div class="form-group">
            <label for="room-code-input">Room Code *</label>
            <input type="text" id="room-code-input" class="input input-code" placeholder="ABC123" maxlength="6" autocomplete="off" style="text-transform: uppercase; letter-spacing: 0.3em; text-align: center; font-size: 1.5rem;" />
          </div>

          <button id="btn-join-game" class="btn btn-secondary btn-full">
            <span class="btn-icon">⬡</span>
            Join Game
          </button>

          <div id="join-error" class="error-message" style="display: none;"></div>

          <!-- Lobby (hidden initially) -->
          <div id="join-lobby" style="display: none; margin-top: 2rem;">
            <h3>Lobby</h3>
            <div class="players-list" id="join-players-list"></div>
            <p class="text-muted">Waiting for host to start the game...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Back
  document.getElementById('btn-back').addEventListener('click', () => navigate('landing'));
  document.getElementById('breadcrumb-home').addEventListener('click', (e) => {
    e.preventDefault();
    navigate('landing');
  });

  // Auto uppercase room code
  document.getElementById('room-code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Join game
  document.getElementById('btn-join-game').addEventListener('click', async () => {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();

    if (!name) { showJoinError('Please enter your name'); return; }
    if (!code || code.length < 4) { showJoinError('Please enter a valid room code'); return; }

    try {
      const btn = document.getElementById('btn-join-game');
      btn.disabled = true;
      btn.textContent = 'Joining...';

      await socketClient.joinRoom(code, name);

      // Show lobby
      btn.style.display = 'none';
      document.getElementById('join-name').disabled = true;
      document.getElementById('room-code-input').disabled = true;
      document.getElementById('join-lobby').style.display = 'block';
      hideJoinError();

    } catch (err) {
      showJoinError(err.message);
      const btn = document.getElementById('btn-join-game');
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">⬡</span> Join Game';
    }
  });

  // Lobby state updates
  socketClient.on('lobbyState', (state) => {
    const list = document.getElementById('join-players-list');
    if (!list) return;

    const avatars = ['🗡️', '🛡️', '👑', '🎭', '⚔️', '🏰'];
    list.innerHTML = state.players.map((p, i) => `
      <div class="player-lobby-item ${p.id === state.hostId ? 'is-host' : ''}">
        <span class="player-avatar">${avatars[i % avatars.length]}</span>
        <span class="player-name">${p.name}</span>
        ${p.id === state.hostId ? '<span class="host-badge">HOST</span>' : ''}
      </div>
    `).join('');
  });
}

function showJoinError(msg) {
  const el = document.getElementById('join-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideJoinError() {
  const el = document.getElementById('join-error');
  if (el) el.style.display = 'none';
}
