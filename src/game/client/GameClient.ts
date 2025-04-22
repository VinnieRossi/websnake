import { io, Socket } from 'socket.io-client';
import { Player } from '../server/GameServer';

type GameEventCallback = (data: any) => void;

export class GameClient {
  socket: Socket;
  players: Map<string, Player> = new Map();
  currentPlayer: Player | null = null;
  eventListeners: Map<string, GameEventCallback[]> = new Map();
  
  // Movement state
  movementKeys: {[key: string]: boolean} = {
    w: false,
    a: false,
    s: false,
    d: false
  };
  moveSpeed: number = 10;
  isMoving: boolean = false;
  lastMovementUpdate: number = 0;
  movementUpdateInterval: number = 30; // Send updates every 30ms for smoother movement

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
  
  // For WASD movement
  startMovement() {
    if (!this.isMoving && this.currentPlayer) {
      this.isMoving = true;
      this.processMovement();
    }
  }
  
  stopMovement() {
    this.isMoving = false;
  }
  
  setMovementKey(key: string, isPressed: boolean) {
    // Only handle WASD keys
    if (key in this.movementKeys) {
      this.movementKeys[key] = isPressed;
      
      // Start or stop movement based on any key being pressed
      const anyKeyPressed = Object.values(this.movementKeys).some(pressed => pressed);
      
      if (anyKeyPressed) {
        this.startMovement();
      } else {
        this.stopMovement();
      }
    }
  }
  
  processMovement() {
    if (!this.isMoving || !this.currentPlayer) return;
    
    const now = Date.now();
    if (now - this.lastMovementUpdate < this.movementUpdateInterval) {
      // Not time to update yet, schedule next frame
      requestAnimationFrame(() => this.processMovement());
      return;
    }
    
    // Calculate movement delta
    let dx = 0;
    let dy = 0;
    
    if (this.movementKeys.w) dy -= this.moveSpeed;
    if (this.movementKeys.s) dy += this.moveSpeed;
    if (this.movementKeys.a) dx -= this.moveSpeed;
    if (this.movementKeys.d) dx += this.moveSpeed;
    
    // Normalize diagonal movement to avoid faster diagonal speed
    if (dx !== 0 && dy !== 0) {
      // Pythagoras normalization
      const factor = this.moveSpeed / Math.sqrt(dx * dx + dy * dy);
      dx *= factor;
      dy *= factor;
    }
    
    if (dx !== 0 || dy !== 0) {
      // Calculate new position
      const newX = Math.max(20, Math.min(780, this.currentPlayer.x + dx));
      const newY = Math.max(20, Math.min(580, this.currentPlayer.y + dy));
      
      // Only update if position actually changed
      if (newX !== this.currentPlayer.x || newY !== this.currentPlayer.y) {
        this.movePlayer(newX, newY);
        this.lastMovementUpdate = now;
      }
    }
    
    // Continue movement in next frame
    requestAnimationFrame(() => this.processMovement());
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