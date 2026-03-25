// Rules Drawer Component

const RULES = {
  characters: [
    {
      name: 'Duke',
      color: '#7B1FA2',
      image: '/images/Duke.png',
      action: 'Tax — Take 3 coins',
      blocks: 'Blocks Foreign Aid',
    },
    {
      name: 'Assassin',
      color: '#C62828',
      image: '/images/Assassin.png',
      action: 'Assassinate — Pay 3 coins, target loses a card',
      blocks: '',
    },
    {
      name: 'Captain',
      color: '#1565C0',
      image: '/images/Captain.png',
      action: 'Steal — Take 2 coins from a player',
      blocks: 'Blocks Stealing',
    },
    {
      name: 'Ambassador',
      color: '#2E7D32',
      image: '/images/Ambassador.png',
      action: 'Exchange — Draw 2 cards, choose 2 to keep',
      blocks: 'Blocks Stealing',
    },
    {
      name: 'Contessa',
      color: '#E65100',
      image: '/images/Contessa.png',
      action: '',
      blocks: 'Blocks Assassination',
    },
  ]
};

export function renderRulesDrawer(container) {
  container.innerHTML = `
    <div class="rules-panel">
      <div class="rules-header">
        <h2>📜 Rules</h2>
        <button class="btn btn-icon-only rules-close" id="rules-close">✕</button>
      </div>

      <div class="rules-content">
        <section class="rules-section">
          <h3>How to Play</h3>
          <p>Coup is a game of <strong>deception & deduction</strong> for 2–6 players. Each player starts with 2 face-down character cards and 2 coins.</p>
          <p>On your turn, take an action. Other players can <strong>challenge</strong> your claim or <strong>block</strong> your action. Last player standing wins!</p>
        </section>

        <section class="rules-section">
          <h3>General Actions</h3>
          <div class="rule-item">
            <span class="rule-icon">🪙</span>
            <div><strong>Income</strong> — Take 1 coin (cannot be blocked)</div>
          </div>
          <div class="rule-item">
            <span class="rule-icon">💰</span>
            <div><strong>Foreign Aid</strong> — Take 2 coins (can be blocked by Duke)</div>
          </div>
          <div class="rule-item">
            <span class="rule-icon">⚔️</span>
            <div><strong>Coup</strong> — Pay 7 coins, target loses a card (cannot be blocked). <em>Mandatory at 10+ coins.</em></div>
          </div>
        </section>

        <section class="rules-section">
          <h3>Characters</h3>
          ${RULES.characters.map(c => `
            <div class="character-rule-card" style="--char-color: ${c.color}">
              <img src="${c.image}" alt="${c.name}" class="char-rule-img" />
              <div class="char-rule-info">
                <strong>${c.name}</strong>
                ${c.action ? `<div class="char-action">${c.action}</div>` : ''}
                ${c.blocks ? `<div class="char-blocks">🛡️ ${c.blocks}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </section>

        <section class="rules-section">
          <h3>Challenges</h3>
          <p>When a player claims a character to take an action or block, <strong>any player</strong> can challenge.</p>
          <ul>
            <li>If the claim is <strong>true</strong>: the challenger loses a card. The player shuffles the revealed card back into the deck and draws a new one.</li>
            <li>If the claim is <strong>false</strong>: the liar loses a card and the action fails.</li>
          </ul>
        </section>

        <section class="rules-section">
          <h3>Key Rules</h3>
          <ul>
            <li>You can claim ANY character, even if you don't have it (bluffing!)</li>
            <li>When you lose both cards, you're eliminated</li>
            <li>You MUST coup if you have 10+ coins</li>
            <li>The deck has 3 copies of each character (15 cards total)</li>
          </ul>
        </section>
      </div>
    </div>
  `;

  document.getElementById('rules-close')?.addEventListener('click', () => {
    document.getElementById('rules-drawer')?.classList.remove('open');
  });
}
