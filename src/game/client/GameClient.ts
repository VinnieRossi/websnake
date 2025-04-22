import { io, Socket } from 'socket.io-client';
import { Player } from '../server/GameServer';

type GameEventCallback = (data: any) => void;

export class GameClient {
  socket: Socket;
  players: Map<string, Player> = new Map();
  currentPlayer: Player | null = null;
  eventListeners: Map<string, GameEventCallback[]> = new Map();

  constructor() {
    // Connect to the server
    this.socket = io(window.location.origin);
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // When we first connect and receive our player data
    this.socket.on('init', (player: Player) => {
      console.log('Init with player data:', player);
      this.currentPlayer = player;
      this.players.set(player.id, player);
      this.triggerEvent('init', player);
    });

    // Existing players already in the game
    this.socket.on('existingPlayers', (players: Player[]) => {
      console.log('Received existing players:', players);
      players.forEach(player => {
        this.players.set(player.id, player);
      });
      this.triggerEvent('existingPlayers', players);
    });

    // New player joined
    this.socket.on('playerJoined', (player: Player) => {
      console.log('New player joined:', player);
      this.players.set(player.id, player);
      this.triggerEvent('playerJoined', player);
    });

    // Player moved
    this.socket.on('playerMoved', (data: { id: string, x: number, y: number }) => {
      const player = this.players.get(data.id);
      if (player) {
        player.x = data.x;
        player.y = data.y;
        this.triggerEvent('playerMoved', { id: data.id, x: data.x, y: data.y });
      } else {
        console.warn('Received movement for unknown player:', data.id);
        // Request player data if we somehow missed this player
        this.requestPlayerData(data.id);
      }
    });

    // Player left
    this.socket.on('playerLeft', (playerId: string) => {
      console.log('Player left:', playerId);
      this.players.delete(playerId);
      this.triggerEvent('playerLeft', playerId);
    });
  }
  
  // Request data for a specific player if we somehow missed them
  requestPlayerData(playerId: string) {
    console.log('Requesting data for missing player:', playerId);
    this.socket.emit('requestPlayerData', playerId);
  }

  joinGame(username: string) {
    this.socket.emit('join', username);
  }

  movePlayer(x: number, y: number) {
    if (this.currentPlayer) {
      this.currentPlayer.x = x;
      this.currentPlayer.y = y;
      this.socket.emit('move', { x, y });
      this.triggerEvent('playerMoved', { id: this.currentPlayer.id, x, y });
    }
  }

  // Event system to allow components to respond to game events
  on(event: string, callback: GameEventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  off(event: string, callback: GameEventCallback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event) || [];
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private triggerEvent(event: string, data: any) {
    const callbacks = this.eventListeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}