// Room Manager — handles room creation, joining, and lifecycle

import { CoupGame } from './gameEngine.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socketId, playerName, settings = {}) {
    const roomCode = this.generateRoomCode();
    const game = new CoupGame(settings);
    
    const room = {
      code: roomCode,
      hostId: socketId,
      game,
      settings,
      createdAt: Date.now()
    };

    this.rooms.set(roomCode, room);
    game.addPlayer(socketId, playerName);
    this.socketToRoom.set(socketId, roomCode);

    return { roomCode, room };
  }

  joinRoom(socketId, roomCode, playerName) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.game.phase !== 'waiting') return { error: 'Game already in progress' };
    if (room.game.players.length >= 6) return { error: 'Room is full' };
    
    // Check duplicate name
    const nameExists = room.game.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (nameExists) return { error: 'Name already taken' };

    const added = room.game.addPlayer(socketId, playerName);
    if (!added) return { error: 'Could not join room' };

    this.socketToRoom.set(socketId, roomCode);
    return { room };
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomForSocket(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode);
  }

  getRoomCodeForSocket(socketId) {
    return this.socketToRoom.get(socketId);
  }

  handleDisconnect(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    const player = room.game.getPlayer(socketId);
    const playerName = player?.name || 'Unknown';

    if (room.game.phase === 'waiting') {
      // Remove from lobby
      room.game.removePlayer(socketId);
      room.game.addEvent(`${playerName} left the lobby.`);
    } else {
      // During game: mark as eliminated
      if (player) {
        // Move all cards to dead cards
        player.deadCards.push(...player.cards);
        player.cards = [];
        player.isAlive = false;
        room.game.addEvent(`${playerName} disconnected and was eliminated.`);

        // Check if they were the choosing player
        if (room.game.turnData.choosingPlayerId === socketId ||
            room.game.turnData.actorId === socketId) {
          // Skip their action
          if (!room.game.checkWinner()) {
            room.game.nextTurn();
          }
        }
      }
    }

    this.socketToRoom.delete(socketId);

    // Clean up empty rooms
    const alivePlayers = room.game.players.filter(p =>
      this.socketToRoom.has(p.id)
    );
    if (alivePlayers.length === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, deleted: true };
    }

    // Update host if host left
    if (room.hostId === socketId && alivePlayers.length > 0) {
      room.hostId = alivePlayers[0].id;
    }

    return { roomCode, room, playerName };
  }

  startGame(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { error: 'Not in a room' };

    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== socketId) return { error: 'Only the host can start' };

    const started = room.game.startGame();
    if (!started) return { error: 'Cannot start game (need 2-6 players)' };

    return { room };
  }

  resetGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const settings = room.settings;
    const players = room.game.players.map(p => ({ id: p.id, name: p.name }));

    room.game = new CoupGame(settings);
    for (const p of players) {
      if (this.socketToRoom.has(p.id)) {
        room.game.addPlayer(p.id, p.name);
      }
    }

    return true;
  }
}

export { RoomManager };
