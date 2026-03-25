// Coup Game Engine — server-side authoritative game logic

const CHARACTERS = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

const CHARACTER_INFO = {
  duke: {
    name: 'Duke',
    action: 'tax',
    actionLabel: 'Tax',
    actionDescription: 'Take 3 coins from the treasury',
    blocks: ['foreign_aid'],
    blocksLabel: 'Blocks Foreign Aid',
    color: '#7B1FA2'
  },
  assassin: {
    name: 'Assassin',
    action: 'assassinate',
    actionLabel: 'Assassinate',
    actionDescription: 'Pay 3 coins to force a player to lose a card',
    blocks: [],
    blocksLabel: '',
    color: '#C62828'
  },
  captain: {
    name: 'Captain',
    action: 'steal',
    actionLabel: 'Steal',
    actionDescription: 'Take 2 coins from another player',
    blocks: ['steal'],
    blocksLabel: 'Blocks Stealing',
    color: '#1565C0'
  },
  ambassador: {
    name: 'Ambassador',
    action: 'exchange',
    actionLabel: 'Exchange',
    actionDescription: 'Draw 2 cards, choose 2 to keep',
    blocks: ['steal'],
    blocksLabel: 'Blocks Stealing',
    color: '#2E7D32'
  },
  contessa: {
    name: 'Contessa',
    action: null,
    actionLabel: '',
    actionDescription: '',
    blocks: ['assassinate'],
    blocksLabel: 'Blocks Assassination',
    color: '#E65100'
  }
};

// Which character is needed to perform each action
const ACTION_CHARACTER = {
  tax: 'duke',
  assassinate: 'assassin',
  steal: 'captain',
  exchange: 'ambassador'
};

// Which characters can block each action
const ACTION_BLOCKERS = {
  foreign_aid: ['duke'],
  assassinate: ['contessa'],
  steal: ['captain', 'ambassador']
};

class CoupGame {
  constructor(settings = {}) {
    this.settings = {
      turnTimer: settings.turnTimer || 30,
      ...settings
    };
    this.players = [];
    this.deck = [];
    this.currentPlayerIndex = 0;
    this.phase = 'waiting'; // waiting, action, challenge, block, block_challenge, resolve, choose_card, exchange, game_over
    this.turnData = {};
    this.eventLog = [];
    this.timers = {};
    this.winner = null;
  }

  addPlayer(id, name) {
    if (this.players.length >= 6) return false;
    if (this.phase !== 'waiting') return false;
    this.players.push({
      id,
      name,
      coins: 2,
      cards: [],
      deadCards: [],
      isAlive: true
    });
    return true;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.players.splice(idx, 1);
    }
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  getAlivePlayersCount() {
    return this.players.filter(p => p.isAlive).length;
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  startGame() {
    if (this.players.length < 2) return false;

    // Create deck: 3 of each character
    this.deck = [];
    for (const char of CHARACTERS) {
      for (let i = 0; i < 3; i++) {
        this.deck.push(char);
      }
    }
    this.shuffle(this.deck);

    // Deal 2 cards to each player
    for (const player of this.players) {
      player.cards = [this.deck.pop(), this.deck.pop()];
      player.deadCards = [];
      player.coins = 2;
      player.isAlive = true;
    }

    this.currentPlayerIndex = 0;
    this.phase = 'action';
    this.turnData = {};
    this.eventLog = [];
    this.winner = null;

    this.addEvent(`Game started with ${this.players.length} players!`);
    this.addEvent(`${this.getCurrentPlayer().name}'s turn.`);

    return true;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  addEvent(message) {
    this.eventLog.push({
      message,
      timestamp: Date.now()
    });
  }

  // Get the game state from a specific player's perspective
  getStateForPlayer(playerId) {
    const player = this.getPlayer(playerId);
    return {
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.getCurrentPlayer()?.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        coins: p.coins,
        cardCount: p.cards.length,
        cards: p.id === playerId ? p.cards : p.cards.map(() => 'hidden'),
        deadCards: p.deadCards,
        isAlive: p.isAlive
      })),
      turnData: this.getTurnDataForPlayer(playerId),
      eventLog: this.eventLog.slice(-20),
      availableActions: this.getAvailableActions(playerId),
      winner: this.winner ? {
        id: this.winner.id,
        name: this.winner.name
      } : null,
      settings: this.settings
    };
  }

  getTurnDataForPlayer(playerId) {
    if (!this.turnData.action) return {};
    const td = { ...this.turnData };

    // Include exchange cards only for the acting player
    if (td.exchangeCards && td.actorId !== playerId) {
      delete td.exchangeCards;
    }

    return td;
  }

  getAvailableActions(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return [];

    const isCurrentPlayer = this.getCurrentPlayer().id === playerId;

    if (this.phase === 'action' && isCurrentPlayer) {
      const actions = ['income', 'foreign_aid'];
      if (player.coins >= 10) {
        // Must coup
        return [{ action: 'coup', needsTarget: true, cost: 7 }];
      }
      if (player.coins >= 7) {
        actions.push('coup');
      }
      // Character actions (anyone can claim)
      actions.push('tax');
      if (player.coins >= 3) {
        actions.push('assassinate');
      }
      actions.push('steal');
      actions.push('exchange');

      return actions.map(a => {
        const info = { action: a, needsTarget: false, cost: 0 };
        if (a === 'coup') { info.needsTarget = true; info.cost = 7; }
        if (a === 'assassinate') { info.needsTarget = true; info.cost = 3; }
        if (a === 'steal') { info.needsTarget = true; }
        return info;
      });
    }

    if (this.phase === 'challenge' && !isCurrentPlayer && this.turnData.actorId !== playerId) {
      // Other players can challenge
      if (!this.turnData.respondedPlayers?.includes(playerId)) {
        return [{ action: 'challenge' }, { action: 'pass' }];
      }
    }

    if (this.phase === 'block' && isCurrentPlayer) {
      // Current player (who was acted upon or any player for foreign_aid) can block
      return [];
    }

    if (this.phase === 'block_window') {
      const canBlock = this.canPlayerBlock(playerId);
      const canChallenge = !isCurrentPlayer && this.turnData.actorId !== playerId;
      const actions = [];
      if (canBlock && !this.turnData.respondedPlayers?.includes(playerId)) {
        // Determine which characters can block this action
        const blockers = ACTION_BLOCKERS[this.turnData.action] || [];
        for (const blocker of blockers) {
          actions.push({ action: 'block', character: blocker });
        }
      }
      if (!this.turnData.respondedPlayers?.includes(playerId) && this.turnData.actorId !== playerId) {
        actions.push({ action: 'challenge' });
        actions.push({ action: 'pass' });
      }
      return actions;
    }

    if (this.phase === 'block_challenge' && this.turnData.actorId === playerId) {
      // Actor can challenge the block
      if (!this.turnData.blockChallengeResolved) {
        return [{ action: 'challenge_block' }, { action: 'pass' }];
      }
    }

    if (this.phase === 'choose_card' && this.turnData.choosingPlayerId === playerId) {
      return [{ action: 'choose_card' }];
    }

    if (this.phase === 'exchange' && this.turnData.actorId === playerId) {
      return [{ action: 'exchange_choose' }];
    }

    return [];
  }

  canPlayerBlock(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return false;

    const action = this.turnData.action;
    const blockers = ACTION_BLOCKERS[action];
    if (!blockers || blockers.length === 0) return false;

    // For targeted actions, only the target can block
    if (action === 'assassinate' || action === 'steal') {
      return this.turnData.targetId === playerId;
    }

    // For foreign_aid, anyone can block (claiming Duke)
    if (action === 'foreign_aid') {
      return this.turnData.actorId !== playerId;
    }

    return false;
  }

  // Process a player's action
  processAction(playerId, action, targetId = null) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return { error: 'Invalid player' };

    if (this.phase !== 'action') return { error: 'Not action phase' };
    if (this.getCurrentPlayer().id !== playerId) return { error: 'Not your turn' };

    // Must coup at 10+ coins
    if (player.coins >= 10 && action !== 'coup') {
      return { error: 'You must coup with 10+ coins' };
    }

    this.turnData = {
      action,
      actorId: playerId,
      targetId,
      respondedPlayers: [],
      blockChallengeResolved: false
    };

    switch (action) {
      case 'income':
        player.coins += 1;
        this.addEvent(`${player.name} takes Income (+1 coin).`);
        this.nextTurn();
        return { success: true, resolved: true };

      case 'foreign_aid':
        this.addEvent(`${player.name} attempts Foreign Aid (+2 coins).`);
        this.phase = 'block_window';
        this.turnData.respondedPlayers = [playerId]; // actor can't block themselves
        return { success: true, phase: 'block_window' };

      case 'coup':
        if (player.coins < 7) return { error: 'Not enough coins for coup' };
        if (!targetId) return { error: 'Coup requires a target' };
        const coupTarget = this.getPlayer(targetId);
        if (!coupTarget || !coupTarget.isAlive) return { error: 'Invalid target' };
        player.coins -= 7;
        this.addEvent(`${player.name} launches a Coup against ${coupTarget.name}!`);
        this.turnData.choosingPlayerId = targetId;
        this.phase = 'choose_card';
        return { success: true, phase: 'choose_card' };

      case 'tax':
        this.addEvent(`${player.name} claims Duke and takes Tax (+3 coins).`);
        this.turnData.claimedCharacter = 'duke';
        this.phase = 'block_window';
        this.turnData.respondedPlayers = [playerId];
        return { success: true, phase: 'block_window' };

      case 'assassinate':
        if (player.coins < 3) return { error: 'Not enough coins' };
        if (!targetId) return { error: 'Assassinate requires a target' };
        const assTarget = this.getPlayer(targetId);
        if (!assTarget || !assTarget.isAlive) return { error: 'Invalid target' };
        player.coins -= 3;
        this.addEvent(`${player.name} claims Assassin and attempts to assassinate ${assTarget.name}!`);
        this.turnData.claimedCharacter = 'assassin';
        this.phase = 'block_window';
        this.turnData.respondedPlayers = [playerId];
        return { success: true, phase: 'block_window' };

      case 'steal':
        if (!targetId) return { error: 'Steal requires a target' };
        const stealTarget = this.getPlayer(targetId);
        if (!stealTarget || !stealTarget.isAlive) return { error: 'Invalid target' };
        this.addEvent(`${player.name} claims Captain and attempts to steal from ${stealTarget.name}.`);
        this.turnData.claimedCharacter = 'captain';
        this.phase = 'block_window';
        this.turnData.respondedPlayers = [playerId];
        return { success: true, phase: 'block_window' };

      case 'exchange':
        this.addEvent(`${player.name} claims Ambassador and wants to exchange cards.`);
        this.turnData.claimedCharacter = 'ambassador';
        this.phase = 'block_window';
        this.turnData.respondedPlayers = [playerId];
        return { success: true, phase: 'block_window' };

      default:
        return { error: 'Unknown action' };
    }
  }

  // Process a response (challenge, block, pass)
  processResponse(playerId, response, data = {}) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return { error: 'Invalid player' };

    if (response === 'pass') {
      return this.handlePass(playerId);
    }

    if (response === 'challenge') {
      return this.handleChallenge(playerId);
    }

    if (response === 'block') {
      return this.handleBlock(playerId, data.character);
    }

    if (response === 'challenge_block') {
      return this.handleBlockChallenge(playerId);
    }

    if (response === 'choose_card') {
      return this.handleChooseCard(playerId, data.cardIndex);
    }

    if (response === 'exchange_choose') {
      return this.handleExchangeChoose(playerId, data.keptIndices);
    }

    return { error: 'Unknown response' };
  }

  handlePass(playerId) {
    if (!this.turnData.respondedPlayers) {
      this.turnData.respondedPlayers = [];
    }
    if (!this.turnData.respondedPlayers.includes(playerId)) {
      this.turnData.respondedPlayers.push(playerId);
    }

    // Check if the actor needs to respond to a block challenge
    if (this.phase === 'block_challenge') {
      // Actor passed on challenging the block — block succeeds
      this.addEvent(`${this.getPlayer(playerId).name} allows the block.`);
      this.handleBlockSuccess();
      return { success: true };
    }

    // Check if all alive players have responded
    const alivePlayers = this.getAlivePlayers();
    const allResponded = alivePlayers.every(p =>
      this.turnData.respondedPlayers.includes(p.id)
    );

    if (allResponded) {
      // No one challenged or blocked — resolve the action
      this.resolveAction();
    }

    return { success: true };
  }

  handleChallenge(playerId) {
    const challenger = this.getPlayer(playerId);
    const actor = this.getPlayer(this.turnData.actorId);
    const claimedChar = this.turnData.claimedCharacter;

    this.addEvent(`${challenger.name} challenges ${actor.name}'s claim of ${CHARACTER_INFO[claimedChar].name}!`);

    // Check if actor actually has the claimed character
    const hasCharacter = actor.cards.includes(claimedChar);

    if (hasCharacter) {
      // Challenge fails — challenger loses a card
      this.addEvent(`${actor.name} reveals ${CHARACTER_INFO[claimedChar].name}! Challenge failed!`);

      // Actor returns the card and draws a new one
      const cardIndex = actor.cards.indexOf(claimedChar);
      this.deck.push(actor.cards.splice(cardIndex, 1)[0]);
      this.shuffle(this.deck);
      actor.cards.push(this.deck.pop());

      // Challenger must lose a card
      this.turnData.choosingPlayerId = playerId;
      this.turnData.afterChooseCard = 'resolve_action';
      this.phase = 'choose_card';

      this.addEvent(`${challenger.name} must lose a card.`);
      return { success: true, challengeResult: 'failed' };
    } else {
      // Challenge succeeds — actor loses a card
      this.addEvent(`${actor.name} was bluffing! Challenge successful!`);

      // If it was assassinate, refund coins
      if (this.turnData.action === 'assassinate') {
        actor.coins += 3;
      }

      this.turnData.choosingPlayerId = this.turnData.actorId;
      this.turnData.afterChooseCard = 'next_turn';
      this.phase = 'choose_card';

      this.addEvent(`${actor.name} must lose a card.`);
      return { success: true, challengeResult: 'succeeded' };
    }
  }

  handleBlock(playerId, character) {
    const blocker = this.getPlayer(playerId);
    const actor = this.getPlayer(this.turnData.actorId);
    const blockers = ACTION_BLOCKERS[this.turnData.action] || [];

    if (!blockers.includes(character)) {
      return { error: 'Cannot block with this character' };
    }

    this.turnData.blockerId = playerId;
    this.turnData.blockCharacter = character;
    this.turnData.respondedPlayers = [];

    this.addEvent(`${blocker.name} claims ${CHARACTER_INFO[character].name} and blocks ${actor.name}!`);

    // Actor can challenge the block
    this.phase = 'block_challenge';
    return { success: true, phase: 'block_challenge' };
  }

  handleBlockChallenge(playerId) {
    const challenger = this.getPlayer(playerId); // the original actor
    const blocker = this.getPlayer(this.turnData.blockerId);
    const blockChar = this.turnData.blockCharacter;

    this.addEvent(`${challenger.name} challenges ${blocker.name}'s claim of ${CHARACTER_INFO[blockChar].name}!`);

    const hasCharacter = blocker.cards.includes(blockChar);

    if (hasCharacter) {
      // Block challenge fails — blocker had the card, challenger (actor) loses a card
      this.addEvent(`${blocker.name} reveals ${CHARACTER_INFO[blockChar].name}! Block stands!`);

      // Blocker returns card and draws new
      const cardIndex = blocker.cards.indexOf(blockChar);
      this.deck.push(blocker.cards.splice(cardIndex, 1)[0]);
      this.shuffle(this.deck);
      blocker.cards.push(this.deck.pop());

      // Actor loses a card, then block succeeds (action fails)
      this.turnData.choosingPlayerId = playerId;
      this.turnData.afterChooseCard = 'block_success';
      this.phase = 'choose_card';

      this.addEvent(`${challenger.name} must lose a card.`);
      return { success: true, challengeResult: 'failed' };
    } else {
      // Block challenge succeeds — blocker was bluffing, loses a card
      this.addEvent(`${blocker.name} was bluffing! Block fails!`);

      this.turnData.choosingPlayerId = this.turnData.blockerId;
      this.turnData.afterChooseCard = 'resolve_action';
      this.phase = 'choose_card';

      this.addEvent(`${blocker.name} must lose a card.`);
      return { success: true, challengeResult: 'succeeded' };
    }
  }

  handleBlockSuccess() {
    const action = this.turnData.action;
    // If assassination was blocked, coins are already spent
    this.addEvent('The action was blocked.');
    this.nextTurn();
  }

  handleChooseCard(playerId, cardIndex) {
    const player = this.getPlayer(playerId);
    if (this.turnData.choosingPlayerId !== playerId) {
      return { error: 'Not your turn to choose a card' };
    }
    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      return { error: 'Invalid card index' };
    }

    const lostCard = player.cards.splice(cardIndex, 1)[0];
    player.deadCards.push(lostCard);

    this.addEvent(`${player.name} loses their ${CHARACTER_INFO[lostCard].name}.`);

    // Check if player is eliminated
    if (player.cards.length === 0) {
      player.isAlive = false;
      this.addEvent(`${player.name} has been eliminated!`);
    }

    // Check for winner
    if (this.checkWinner()) {
      return { success: true };
    }

    // Continue based on what comes after
    const afterAction = this.turnData.afterChooseCard;
    if (afterAction === 'resolve_action') {
      this.resolveAction();
    } else if (afterAction === 'block_success') {
      this.handleBlockSuccess();
    } else {
      this.nextTurn();
    }

    return { success: true };
  }

  handleExchangeChoose(playerId, keptIndices) {
    const player = this.getPlayer(playerId);
    if (this.turnData.actorId !== playerId) {
      return { error: 'Not your exchange' };
    }

    const allCards = this.turnData.exchangeCards;
    if (!allCards) return { error: 'No exchange cards available' };

    const aliveCardCount = player.cards.length;
    if (!keptIndices || keptIndices.length !== aliveCardCount) {
      return { error: `Must keep exactly ${aliveCardCount} cards` };
    }

    // Validate indices
    for (const idx of keptIndices) {
      if (idx < 0 || idx >= allCards.length) {
        return { error: 'Invalid card index' };
      }
    }

    // Keep selected cards, return the rest to deck
    const keptCards = keptIndices.map(i => allCards[i]);
    const returnedCards = allCards.filter((_, i) => !keptIndices.includes(i));

    player.cards = keptCards;
    this.deck.push(...returnedCards);
    this.shuffle(this.deck);

    this.addEvent(`${player.name} exchanges cards.`);
    this.nextTurn();

    return { success: true };
  }

  resolveAction() {
    const actor = this.getPlayer(this.turnData.actorId);
    const action = this.turnData.action;

    switch (action) {
      case 'foreign_aid':
        actor.coins += 2;
        this.addEvent(`${actor.name} takes Foreign Aid (+2 coins).`);
        break;

      case 'tax':
        actor.coins += 3;
        this.addEvent(`${actor.name} collects Tax (+3 coins).`);
        break;

      case 'assassinate': {
        const target = this.getPlayer(this.turnData.targetId);
        if (target && target.isAlive) {
          if (target.cards.length === 1) {
            // Auto-lose last card
            const lostCard = target.cards.splice(0, 1)[0];
            target.deadCards.push(lostCard);
            target.isAlive = false;
            this.addEvent(`${target.name} loses their ${CHARACTER_INFO[lostCard].name} and is eliminated!`);
            if (this.checkWinner()) return;
          } else {
            this.turnData.choosingPlayerId = this.turnData.targetId;
            this.turnData.afterChooseCard = 'next_turn';
            this.phase = 'choose_card';
            this.addEvent(`${target.name} must lose a card to assassination.`);
            return;
          }
        }
        break;
      }

      case 'steal': {
        const target = this.getPlayer(this.turnData.targetId);
        if (target) {
          const stolen = Math.min(2, target.coins);
          target.coins -= stolen;
          actor.coins += stolen;
          this.addEvent(`${actor.name} steals ${stolen} coins from ${target.name}.`);
        }
        break;
      }

      case 'exchange': {
        // Draw 2 cards from deck
        const drawnCards = [];
        for (let i = 0; i < 2 && this.deck.length > 0; i++) {
          drawnCards.push(this.deck.pop());
        }
        this.turnData.exchangeCards = [...actor.cards, ...drawnCards];
        this.phase = 'exchange';
        this.addEvent(`${actor.name} draws cards for exchange.`);
        return; // Don't advance turn yet
      }
    }

    this.nextTurn();
  }

  checkWinner() {
    const alive = this.getAlivePlayers();
    if (alive.length === 1) {
      this.winner = alive[0];
      this.phase = 'game_over';
      this.addEvent(`🏆 ${alive[0].name} wins the game!`);
      return true;
    }
    return false;
  }

  nextTurn() {
    // Move to next alive player
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } while (!this.players[this.currentPlayerIndex].isAlive);

    this.phase = 'action';
    this.turnData = {};
    this.addEvent(`${this.getCurrentPlayer().name}'s turn.`);
  }

  // Auto-pass all remaining players (timer expired)
  autoPassRemaining() {
    if (this.phase === 'block_window') {
      const alivePlayers = this.getAlivePlayers();
      for (const p of alivePlayers) {
        if (!this.turnData.respondedPlayers?.includes(p.id)) {
          this.turnData.respondedPlayers.push(p.id);
        }
      }
      this.resolveAction();
      return true;
    }
    if (this.phase === 'block_challenge') {
      // Auto-pass means block succeeds
      this.handleBlockSuccess();
      return true;
    }
    return false;
  }
}

export { CoupGame, CHARACTER_INFO, CHARACTERS, ACTION_CHARACTER, ACTION_BLOCKERS };
