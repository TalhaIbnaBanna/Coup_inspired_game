// Landing Page
import { navigate } from '../main.js';
import { renderRulesDrawer } from '../components/rulesDrawer.js';

export function renderLanding(container) {
  container.innerHTML = `
    <div class="landing-page">
      <div class="landing-bg-overlay"></div>
      <div class="landing-content">
        <div class="landing-header">
          <h1 class="game-title">COUP</h1>
          <p class="game-subtitle">A game of deception, deduction & luck</p>
        </div>

        <div class="character-showcase">
          <div class="character-card-mini" style="--char-color: #7B1FA2">
            <img src="/images/Duke.png" alt="Duke" />
          </div>
          <div class="character-card-mini" style="--char-color: #C62828">
            <img src="/images/Assassin.png" alt="Assassin" />
          </div>
          <div class="character-card-mini" style="--char-color: #1565C0">
            <img src="/images/Captain.png" alt="Captain" />
          </div>
          <div class="character-card-mini" style="--char-color: #2E7D32">
            <img src="/images/Ambassador.png" alt="Ambassador" />
          </div>
          <div class="character-card-mini" style="--char-color: #E65100">
            <img src="/images/Contessa.png" alt="Contessa" />
          </div>
        </div>

        <div class="landing-buttons">
          <button id="btn-create" class="btn btn-primary btn-large">
            <span class="btn-icon">+</span>
            Create New Game
          </button>
          <button id="btn-join" class="btn btn-secondary btn-large">
            <span class="btn-icon">⬡</span>
            Join Game
          </button>
          <button id="btn-rules" class="btn btn-ghost btn-large">
            <span class="btn-icon">📜</span>
            Learn Rules
          </button>
        </div>

        <div class="landing-footer">
          <p>2–6 Players • Free to play • No signup required</p>
        </div>
      </div>

      <!-- Rules FAB -->
      <button id="rules-fab" class="fab fab-rules" title="Game Rules">📜</button>

      <!-- Rules Drawer -->
      <div id="rules-drawer" class="drawer drawer-left">
        <div class="drawer-overlay"></div>
        <div class="drawer-content"></div>
      </div>

      <!-- Image Modal -->
      <div id="image-modal" class="modal-overlay" style="display: none; z-index: 2000; cursor: pointer;">
        <img id="image-modal-content" src="" style="max-height: 90vh; max-width: 90vw; border-radius: var(--radius-md); box-shadow: 0 0 40px rgba(0,0,0,0.8); transition: transform 0.2s;" />
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-create').addEventListener('click', () => {
    navigate('create');
  });

  document.getElementById('btn-join').addEventListener('click', () => {
    navigate('join');
  });

  const openRules = () => {
    const drawer = document.getElementById('rules-drawer');
    drawer.classList.add('open');
    renderRulesDrawer(drawer.querySelector('.drawer-content'));
  };

  document.getElementById('btn-rules').addEventListener('click', openRules);
  document.getElementById('rules-fab').addEventListener('click', openRules);

  document.querySelector('.drawer-overlay')?.addEventListener('click', () => {
    document.getElementById('rules-drawer').classList.remove('open');
  });

  // Image Modal Logic
  document.querySelectorAll('.character-card-mini').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const imgSrc = card.querySelector('img').src;
      document.getElementById('image-modal-content').src = imgSrc;
      document.getElementById('image-modal').style.display = 'flex';
    });
  });

  document.getElementById('image-modal')?.addEventListener('click', () => {
    document.getElementById('image-modal').style.display = 'none';
  });
}
