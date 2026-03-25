// Game Board — Main game view
import { socketClient } from '../socket.js';
import { navigate } from '../main.js';
import { renderRulesDrawer } from '../components/rulesDrawer.js';

const CHARACTER_INFO = {
  duke: { name: 'Duke', color: '#7B1FA2', image: '/images/Duke.png' },
  assassin: { name: 'Assassin', color: '#C62828', image: '/images/Assassin.png' },
  captain: { name: 'Captain', color: '#1565C0', image: '/images/Captain.png' },
  ambassador: { name: 'Ambassador', color: '#2E7D32', image: '/images/Ambassador.png' },
  contessa: { name: 'Contessa', color: '#E65100', image: '/images/Contessa.png' }
};

const ACTION_INFO = {
  income: { label: 'Income', desc: '+1 coin', color: '#546E7A', icon: '🪙' },
  foreign_aid: { label: 'Foreign Aid', desc: '+2 coins', color: '#546E7A', icon: '💰' },
  coup: { label: 'Coup', desc: '-7 coins, eliminate', color: '#B71C1C', icon: '⚔️' },
  tax: { label: 'Tax', desc: '+3 coins (Duke)', color: '#7B1FA2', icon: '👑' },
  assassinate: { label: 'Assassinate', desc: '-3 coins (Assassin)', color: '#C62828', icon: '🗡️' },
  steal: { label: 'Steal', desc: 'Take 2 coins (Captain)', color: '#1565C0', icon: '💎' },
  exchange: { label: 'Exchange', desc: 'Swap cards (Ambassador)', color: '#2E7D32', icon: '🔄' }
};

let currentState = null;
let timerInterval = null;
let timerData = null;

export function renderGameBoard(container, data = {}) {
  container.innerHTML = `
    <div class="game-page">
      <div class="game-layout">
        <!-- Opponents -->
        <div class="opponents-area" id="opponents-area"></div>

        <!-- Center Area -->
        <div class="center-area">
          <div class="turn-indicator" id="turn-indicator"></div>
          <div class="action-zone" id="action-zone"></div>
          <div class="response-zone" id="response-zone"></div>
        </div>

        <!-- Player's own area -->
        <div class="player-area" id="player-area"></div>
      </div>

      <!-- Event Log Sidebar -->
      <div class="event-log-sidebar" id="event-log-sidebar">
        <h3 class="event-log-title">Event Log</h3>
        <div class="event-log-list" id="event-log-list"></div>
      </div>

      <!-- Rules FAB -->
      <button id="rules-fab-game" class="fab fab-rules" title="Rules">📜</button>

      <!-- Rules Drawer -->
      <div id="rules-drawer" class="drawer drawer-left">
        <div class="drawer-overlay"></div>
        <div class="drawer-content"></div>
      </div>

      <!-- Modals -->
      <div id="modal-overlay" class="modal-overlay" style="display: none;">
        <div class="modal-content" id="modal-content"></div>
      </div>

      <!-- Winner Overlay -->
      <div id="winner-overlay" class="winner-overlay" style="display: none;">
        <div class="winner-card">
          <div class="winner-crown">👑</div>
          <h2 id="winner-name"></h2>
          <p>wins the game!</p>
          <button id="btn-play-again" class="btn btn-primary">Play Again</button>
          <button id="btn-back-home" class="btn btn-ghost">Back to Home</button>
        </div>
      </div>
    </div>
  `;

  // Rules drawer
  document.getElementById('rules-fab-game').addEventListener('click', () => {
    const drawer = document.getElementById('rules-drawer');
    drawer.classList.add('open');
    renderRulesDrawer(drawer.querySelector('.drawer-content'));
  });
  document.querySelector('.drawer-overlay')?.addEventListener('click', () => {
    document.getElementById('rules-drawer').classList.remove('open');
  });

  // Listen for game state updates
  const stateHandler = (state) => {
    currentState = state;
    updateGameBoard(state);
  };
  socketClient.on('gameState', stateHandler);

  // Timer updates
  const timerHandler = (data) => {
    timerData = data;
    startTimer(data);
  };
  socketClient.on('timer', timerHandler);

  // If we have state from navigation, set it
  if (data && data.state) {
    currentState = data.state;
  }

  // If we already have a state (from navigation or previous), render it
  if (currentState) {
    // Small timeout to ensure DOM is fully painted before updating
    setTimeout(() => {
      updateGameBoard(currentState);
    }, 0);
  }
}

function updateGameBoard(state) {
  renderOpponents(state);
  renderPlayerArea(state);
  renderActionZone(state);
  renderResponseZone(state);
  renderTurnIndicator(state);
  renderEventLog(state);

  if (state.winner) {
    showWinner(state);
  }
}

function renderOpponents(state) {
  const area = document.getElementById('opponents-area');
  if (!area) return;

  const myId = socketClient.id;
  const opponents = state.players.filter(p => p.id !== myId);

  area.innerHTML = opponents.map(p => `
    <div class="opponent-panel ${!p.isAlive ? 'eliminated' : ''} ${state.currentPlayerId === p.id ? 'active-turn' : ''}">
      <div class="opponent-name">${p.name}</div>
      <div class="opponent-coins">
        <span class="coin-icon">🪙</span>
        <span class="coin-count">${p.coins}</span>
      </div>
      <div class="opponent-cards">
        ${p.cards.map((c, i) => {
          if (c === 'hidden') {
            return `<div class="card-slot card-hidden"><div class="card-back">?</div></div>`;
          }
          return `<div class="card-slot card-revealed" style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}">
            <img src="${CHARACTER_INFO[c]?.image}" alt="${CHARACTER_INFO[c]?.name}" class="card-img" />
          </div>`;
        }).join('')}
        ${p.deadCards.map(c => `
          <div class="card-slot card-dead" style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}">
            <div class="card-dead-label">${CHARACTER_INFO[c]?.name || c}</div>
            <div class="card-dead-x">✕</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderPlayerArea(state) {
  const area = document.getElementById('player-area');
  if (!area) return;

  const myId = socketClient.id;
  const me = state.players.find(p => p.id === myId);
  if (!me) return;

  const isMyTurn = state.currentPlayerId === myId;

  area.innerHTML = `
    <div class="my-panel ${isMyTurn ? 'active-turn' : ''} ${!me.isAlive ? 'eliminated' : ''}">
      <div class="my-info">
        <span class="my-name">${me.name} ${isMyTurn ? '(Your Turn)' : ''}</span>
        <span class="my-coins"><span class="coin-icon">🪙</span> ${me.coins}</span>
      </div>
      <div class="my-cards">
        ${me.cards.map((c, i) => `
          <div class="my-card-container">
            <div class="my-card-name-label" style="color: ${CHARACTER_INFO[c]?.color || '#fff'}">${CHARACTER_INFO[c]?.name || c}</div>
            <div class="my-card" style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}" data-card-index="${i}">
              <img src="${CHARACTER_INFO[c]?.image}" alt="${CHARACTER_INFO[c]?.name}" class="card-img" />
            </div>
          </div>
        `).join('')}
        ${me.deadCards.map(c => `
          <div class="my-card-container dead-container">
            <div class="my-card-name-label" style="color: ${CHARACTER_INFO[c]?.color || '#fff'}">${CHARACTER_INFO[c]?.name || c}</div>
            <div class="my-card dead" style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}">
              <img src="${CHARACTER_INFO[c]?.image}" alt="${CHARACTER_INFO[c]?.name}" class="card-img" />
              <div class="card-dead-x">✕</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderActionZone(state) {
  const zone = document.getElementById('action-zone');
  if (!zone) return;

  const myId = socketClient.id;
  const isMyTurn = state.currentPlayerId === myId;
  const me = state.players.find(p => p.id === myId);

  if (!isMyTurn || state.phase !== 'action' || !me?.isAlive) {
    zone.innerHTML = '';
    return;
  }

  const actions = state.availableActions;
  if (!actions || actions.length === 0) {
    zone.innerHTML = '';
    return;
  }

  const targets = state.players.filter(p => p.id !== myId && p.isAlive);

  zone.innerHTML = `
    <div class="action-buttons">
      <h3 class="action-title">Choose Your Action</h3>
      <div class="action-grid">
        ${actions.map(a => {
          const info = ACTION_INFO[a.action];
          if (!info) return '';
          const disabled = (a.cost && me.coins < a.cost) ? 'disabled' : '';
          return `
            <button class="action-btn ${disabled}" data-action="${a.action}" data-needs-target="${a.needsTarget || false}"
              style="--action-color: ${info.color}" ${disabled}>
              <span class="action-icon">${info.icon}</span>
              <span class="action-label">${info.label}</span>
              <span class="action-desc">${info.desc}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Target Selection (hidden) -->
    <div id="target-selection" class="target-selection" style="display: none;">
      <h3>Choose a Target</h3>
      <div class="target-buttons">
        ${targets.map(t => `
          <button class="target-btn" data-target-id="${t.id}">
            ${t.name} <span class="target-coins">🪙 ${t.coins}</span>
          </button>
        `).join('')}
      </div>
      <button class="btn btn-ghost btn-small" id="cancel-target">Cancel</button>
    </div>
  `;

  // Action button handlers
  let pendingAction = null;
  zone.querySelectorAll('.action-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const needsTarget = btn.dataset.needsTarget === 'true';

      if (needsTarget) {
        pendingAction = action;
        document.querySelector('.action-buttons').style.display = 'none';
        document.getElementById('target-selection').style.display = 'block';
      } else {
        socketClient.sendAction(action);
      }
    });
  });

  // Target button handlers
  zone.querySelectorAll('.target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pendingAction) {
        socketClient.sendAction(pendingAction, btn.dataset.targetId);
        pendingAction = null;
      }
    });
  });

  // Cancel target
  document.getElementById('cancel-target')?.addEventListener('click', () => {
    pendingAction = null;
    document.querySelector('.action-buttons').style.display = 'block';
    document.getElementById('target-selection').style.display = 'none';
  });
}

function renderResponseZone(state) {
  const zone = document.getElementById('response-zone');
  if (!zone) return;

  const myId = socketClient.id;
  const me = state.players.find(p => p.id === myId);
  const actions = state.availableActions;

  if (!me?.isAlive || !actions || actions.length === 0) {
    zone.innerHTML = '';
    return;
  }

  // Challenge / Block / Pass response zone
  if (state.phase === 'block_window') {
    const actor = state.players.find(p => p.id === state.turnData?.actorId);
    const actionId = state.turnData?.action;
    const actionInfo = ACTION_INFO[actionId];
    const target = state.turnData?.targetId ? state.players.find(p => p.id === state.turnData.targetId) : null;
    
    let actionHtml = actionInfo ? `<span style="color: ${actionInfo.color}">${actionInfo.icon} ${actionInfo.label}</span>` : 'an action';
    if (target) {
      actionHtml += ` <span style="font-size: 0.9em; opacity: 0.8;">on ${target.name}</span>`;
    }

    const hasChallenge = actions.some(a => a.action === 'challenge');
    const blockOptions = actions.filter(a => a.action === 'block');
    const hasPass = actions.some(a => a.action === 'pass');

    if (!hasChallenge && blockOptions.length === 0 && !hasPass) {
      zone.innerHTML = `
        <div class="waiting-message">
           Wait... ${actor?.name || 'Someone'} is playing <strong>${actionId}</strong>
        </div>`;
      return;
    }

    zone.innerHTML = `
      <div class="response-panel">
        <div class="response-timer" id="response-timer"></div>
        <div class="move-announcement">
          <div class="move-actor">${actor?.name || 'Someone'} is playing:</div>
          <div class="move-action-name">${actionHtml}</div>
        </div>
        <p class="response-prompt">Do you want to respond?</p>
        <div class="response-buttons">
          ${hasChallenge ? `<button class="response-btn challenge-btn" data-response="challenge">⚡ Challenge</button>` : ''}
          ${blockOptions.map(b => `
            <button class="response-btn block-btn" data-response="block" data-character="${b.character}"
              style="--block-color: ${CHARACTER_INFO[b.character]?.color || '#666'}">
              🛡️ Block (${CHARACTER_INFO[b.character]?.name})
            </button>
          `).join('')}
          ${hasPass ? `<button class="response-btn pass-btn" data-response="pass">✓ Allow</button>` : ''}
        </div>
      </div>
    `;

    attachResponseHandlers(zone);
    return;
  }

  if (state.phase === 'block_challenge') {
    const blocker = state.players.find(p => p.id === state.turnData?.blockerId);
    const blockChar = state.turnData?.blockClaim;
    const charInfo = CHARACTER_INFO[blockChar];
    
    const hasChallengeBlock = actions.some(a => a.action === 'challenge_block');
    const hasPass = actions.some(a => a.action === 'pass');

    if (!hasChallengeBlock && !hasPass) {
      zone.innerHTML = `<div class="waiting-message">Waiting while ${blocker?.name} blocks...</div>`;
      return;
    }

    zone.innerHTML = `
      <div class="response-panel">
        <div class="response-timer" id="response-timer"></div>
        <div class="move-announcement">
          <div class="move-actor">${blocker?.name || 'Someone'} is blocking with:</div>
          <div class="move-action-name" style="color: ${charInfo?.color || '#fff'}">🛡️ ${charInfo?.name || blockChar}</div>
        </div>
        <p class="response-prompt">Challenge their block?</p>
        <div class="response-buttons">
          ${hasChallengeBlock ? `<button class="response-btn challenge-btn" data-response="challenge_block">⚡ Challenge Block</button>` : ''}
          ${hasPass ? `<button class="response-btn pass-btn" data-response="pass">✓ Allow Block</button>` : ''}
        </div>
      </div>
    `;

    attachResponseHandlers(zone);
    return;
  }

  if (state.phase === 'choose_card') {
    const isChoosing = actions.some(a => a.action === 'choose_card');
    if (isChoosing) {
      zone.innerHTML = `
        <div class="response-panel">
          <p class="response-prompt">Choose a card to lose:</p>
          <div class="choose-card-buttons">
            ${me.cards.map((c, i) => `
              <button class="choose-card-btn" data-card-index="${i}"
                style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}">
                <img src="${CHARACTER_INFO[c]?.image}" alt="${CHARACTER_INFO[c]?.name}" class="card-img-small" />
                <span>${CHARACTER_INFO[c]?.name || c}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;

      zone.querySelectorAll('.choose-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          socketClient.sendResponse('choose_card', { cardIndex: parseInt(btn.dataset.cardIndex) });
        });
      });
      return;
    }
  }

  if (state.phase === 'exchange') {
    const isExchanging = actions.some(a => a.action === 'exchange_choose');
    if (isExchanging && state.turnData?.exchangeCards) {
      const exchangeCards = state.turnData.exchangeCards;
      const numToKeep = me.cards.length;

      zone.innerHTML = `
        <div class="response-panel exchange-panel">
          <p class="response-prompt">Choose ${numToKeep} card${numToKeep > 1 ? 's' : ''} to keep:</p>
          <div class="exchange-card-buttons">
            ${exchangeCards.map((c, i) => `
              <button class="exchange-card-btn" data-index="${i}"
                style="--card-color: ${CHARACTER_INFO[c]?.color || '#666'}">
                <img src="${CHARACTER_INFO[c]?.image}" alt="${CHARACTER_INFO[c]?.name}" class="card-img-small" />
                <span>${CHARACTER_INFO[c]?.name || c}</span>
              </button>
            `).join('')}
          </div>
          <p class="exchange-info">Selected: <span id="selected-count">0</span> / ${numToKeep}</p>
          <button id="confirm-exchange" class="btn btn-primary" disabled>Confirm Exchange</button>
        </div>
      `;

      const selected = new Set();
      zone.querySelectorAll('.exchange-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          if (selected.has(idx)) {
            selected.delete(idx);
            btn.classList.remove('selected');
          } else if (selected.size < numToKeep) {
            selected.add(idx);
            btn.classList.add('selected');
          }
          document.getElementById('selected-count').textContent = selected.size;
          document.getElementById('confirm-exchange').disabled = selected.size !== numToKeep;
        });
      });

      document.getElementById('confirm-exchange')?.addEventListener('click', () => {
        socketClient.sendResponse('exchange_choose', { keptIndices: Array.from(selected) });
      });
      return;
    }
  }

  // Default: waiting
  if (state.phase !== 'action' && state.currentPlayerId !== myId) {
    zone.innerHTML = `<div class="waiting-message">Waiting...</div>`;
  } else {
    zone.innerHTML = '';
  }
}

function attachResponseHandlers(zone) {
  zone.querySelectorAll('.response-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const response = btn.dataset.response;
      const data = {};
      if (response === 'block') {
        data.character = btn.dataset.character;
      }
      socketClient.sendResponse(response, data);
    });
  });
}

function renderTurnIndicator(state) {
  const indicator = document.getElementById('turn-indicator');
  if (!indicator) return;

  const current = state.players.find(p => p.id === state.currentPlayerId);
  const isMyTurn = state.currentPlayerId === socketClient.id;

  if (state.phase === 'game_over') {
    indicator.innerHTML = '';
    return;
  }

  let phaseText = '';
  switch (state.phase) {
    case 'action': phaseText = isMyTurn ? 'Your turn — choose an action' : `${current?.name}'s turn`; break;
    case 'block_window': phaseText = 'Waiting for responses...'; break;
    case 'block_challenge': phaseText = 'Block in progress...'; break;
    case 'choose_card': phaseText = 'Choosing a card to lose...'; break;
    case 'exchange': phaseText = 'Exchanging cards...'; break;
    default: phaseText = `${current?.name}'s turn`;
  }

  indicator.innerHTML = `
    <div class="turn-info ${isMyTurn ? 'my-turn' : ''}">
      <span class="turn-text">${phaseText}</span>
    </div>
  `;
}

function renderEventLog(state) {
  const list = document.getElementById('event-log-list');
  if (!list) return;

  list.innerHTML = state.eventLog.map(e => `
    <div class="event-item">
      <span class="event-text">${e.message}</span>
    </div>
  `).join('');

  list.scrollTop = list.scrollHeight;
}

function startTimer(data) {
  if (timerInterval) clearInterval(timerInterval);

  const timerEl = document.getElementById('response-timer');
  if (!timerEl) return;

  const endTime = data.startedAt + data.duration;

  timerInterval = setInterval(() => {
    const remaining = Math.max(0, endTime - Date.now());
    const pct = (remaining / data.duration) * 100;

    timerEl.innerHTML = `
      <div class="timer-bar">
        <div class="timer-fill" style="width: ${pct}%"></div>
      </div>
      <span class="timer-text">${Math.ceil(remaining / 1000)}s</span>
    `;

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 100);
}

function showWinner(state) {
  const overlay = document.getElementById('winner-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  document.getElementById('winner-name').textContent = state.winner.name;

  document.getElementById('btn-play-again')?.addEventListener('click', async () => {
    try {
      await socketClient.playAgain();
      overlay.style.display = 'none';
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('btn-back-home')?.addEventListener('click', () => {
    window.location.reload();
  });
}
