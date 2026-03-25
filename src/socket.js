// Socket.IO client wrapper
import { io } from 'socket.io-client';

class SocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    // Rely on window.location.origin and Vite proxy (or standard production deployment)
    const serverUrl = window.location.origin;

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
      this.emit('_connected', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('_disconnected');
    });

    // Forward all game events
    const events = ['gameState', 'lobbyState', 'timer'];
    events.forEach(event => {
      this.socket.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }

  createRoom(playerName, settings = {}) {
    return new Promise((resolve, reject) => {
      this.socket.emit('createRoom', { playerName, settings }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  joinRoom(roomCode, playerName) {
    return new Promise((resolve, reject) => {
      this.socket.emit('joinRoom', { roomCode, playerName }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  startGame() {
    return new Promise((resolve, reject) => {
      this.socket.emit('startGame', null, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  sendAction(action, targetId = null) {
    return new Promise((resolve, reject) => {
      this.socket.emit('action', { action, targetId }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  sendResponse(response, data = {}) {
    return new Promise((resolve, reject) => {
      this.socket.emit('response', { response, data }, (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp);
      });
    });
  }

  playAgain() {
    return new Promise((resolve, reject) => {
      this.socket.emit('playAgain', null, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  getCharacterInfo() {
    return new Promise((resolve, reject) => {
      this.socket.emit('getCharacterInfo', null, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  // Simple event emitter
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => cb(data));
    }
  }

  get id() {
    return this.socket?.id;
  }
}

export const socketClient = new SocketClient();
