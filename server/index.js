// Coup Online — Express + Socket.IO Server

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './roomManager.js';
import { CHARACTER_INFO, CHARACTERS } from './gameEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Broadcast game state to all players in a room
function broadcastGameState(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  for (const player of room.game.players) {
    const state = room.game.getStateForPlayer(player.id);
    io.to(player.id).emit('gameState', state);
  }
}

// Broadcast lobby state
function broadcastLobbyState(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const lobbyState = {
    roomCode,
    hostId: room.hostId,
    players: room.game.players.map(p => ({
      id: p.id,
      name: p.name
    })),
    settings: room.settings
  };

  for (const player of room.game.players) {
    io.to(player.id).emit('lobbyState', lobbyState);
  }
}

// Room timers for auto-passing
const roomTimers = new Map();

function startResponseTimer(roomCode) {
  clearResponseTimer(roomCode);

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const timerMs = (room.game.settings.turnTimer || 30) * 1000;

  const timerId = setTimeout(() => {
    const currentRoom = roomManager.getRoom(roomCode);
    if (!currentRoom) return;

    const game = currentRoom.game;
    if (game.phase === 'block_window' || game.phase === 'block_challenge') {
      game.autoPassRemaining();
      broadcastGameState(roomCode);

      // Check if new phase needs a timer
      if (game.phase === 'block_window' || game.phase === 'block_challenge') {
        startResponseTimer(roomCode);
      }
    }
  }, timerMs);

  roomTimers.set(roomCode, {
    id: timerId,
    startedAt: Date.now(),
    duration: timerMs
  });

  // Notify clients of timer
  for (const player of room.game.players) {
    io.to(player.id).emit('timer', {
      duration: timerMs,
      startedAt: Date.now()
    });
  }
}

function clearResponseTimer(roomCode) {
  const timer = roomTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer.id);
    roomTimers.delete(roomCode);
  }
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create room
  socket.on('createRoom', ({ playerName, settings }, callback) => {
    const { roomCode, room } = roomManager.createRoom(socket.id, playerName, settings);
    socket.join(roomCode);
    console.log(`Room ${roomCode} created by ${playerName}`);
    callback({ roomCode });
    broadcastLobbyState(roomCode);
  });

  // Join room
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    const result = roomManager.joinRoom(socket.id, roomCode.toUpperCase(), playerName);
    if (result.error) {
      callback({ error: result.error });
      return;
    }
    socket.join(roomCode.toUpperCase());
    console.log(`${playerName} joined room ${roomCode}`);
    callback({ success: true });
    broadcastLobbyState(roomCode.toUpperCase());
  });

  // Start game
  socket.on('startGame', (_, callback) => {
    const result = roomManager.startGame(socket.id);
    if (result.error) {
      callback({ error: result.error });
      return;
    }
    const roomCode = roomManager.getRoomCodeForSocket(socket.id);
    console.log(`Game started in room ${roomCode}`);
    callback({ success: true });
    broadcastGameState(roomCode);
  });

  // Player action
  socket.on('action', ({ action, targetId }, callback) => {
    const room = roomManager.getRoomForSocket(socket.id);
    if (!room) { callback({ error: 'Not in a room' }); return; }

    const roomCode = roomManager.getRoomCodeForSocket(socket.id);
    const result = room.game.processAction(socket.id, action, targetId);

    if (result.error) {
      callback({ error: result.error });
      return;
    }

    callback({ success: true });
    broadcastGameState(roomCode);

    // Start timer for block/challenge windows
    if (room.game.phase === 'block_window') {
      startResponseTimer(roomCode);
    }
  });

  // Player response (challenge, block, pass, choose_card, exchange_choose)
  socket.on('response', ({ response, data }, callback) => {
    const room = roomManager.getRoomForSocket(socket.id);
    if (!room) { callback({ error: 'Not in a room' }); return; }

    const roomCode = roomManager.getRoomCodeForSocket(socket.id);
    const result = room.game.processResponse(socket.id, response, data);

    if (result.error) {
      callback({ error: result.error });
      return;
    }

    callback({ success: true });
    broadcastGameState(roomCode);

    // Manage timers based on new phase
    if (room.game.phase === 'block_window') {
      startResponseTimer(roomCode);
    } else if (room.game.phase === 'block_challenge') {
      startResponseTimer(roomCode);
    } else {
      clearResponseTimer(roomCode);
    }
  });

  // Play again
  socket.on('playAgain', (_, callback) => {
    const roomCode = roomManager.getRoomCodeForSocket(socket.id);
    if (!roomCode) { callback({ error: 'Not in a room' }); return; }

    const room = roomManager.getRoom(roomCode);
    if (!room) { callback({ error: 'Room not found' }); return; }

    if (room.hostId !== socket.id) {
      callback({ error: 'Only host can restart' });
      return;
    }

    roomManager.resetGame(roomCode);
    const started = room.game.startGame();
    if (!started) {
      callback({ error: 'Need at least 2 players' });
      return;
    }

    callback({ success: true });
    broadcastGameState(roomCode);
  });

  // Get character info
  socket.on('getCharacterInfo', (_, callback) => {
    callback({ characters: CHARACTER_INFO, characterList: CHARACTERS });
  });

  // Chat
  socket.on('chatMessage', (msg) => {
    const roomCode = roomManager.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;
    
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    
    const player = room.game.getPlayer(socket.id);
    if (!player) return;

    io.to(roomCode).emit('chatMessage', {
      playerId: socket.id,
      playerName: player.name,
      message: msg.substring(0, 200),
      timestamp: Date.now()
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const result = roomManager.handleDisconnect(socket.id);

    if (result && !result.deleted) {
      broadcastLobbyState(result.roomCode);
      const room = roomManager.getRoom(result.roomCode);
      if (room && room.game.phase !== 'waiting') {
        broadcastGameState(result.roomCode);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Coup server running on port ${PORT}`);
});
