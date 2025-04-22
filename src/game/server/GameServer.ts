import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

// Player data interface
export interface Player {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
}

export class GameServer {
  players: Map<string, Player> = new Map();
  io: SocketIOServer;

  constructor(server: http.Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Handle player joining
      socket.on('join', (username: string) => {
        const player: Player = {
          id: socket.id,
          x: Math.floor(Math.random() * 500),
          y: Math.floor(Math.random() * 500),
          username,
          color: this.getRandomColor()
        };

        this.players.set(socket.id, player);
        console.log(`Player joined: ${username} (${socket.id})`);
        
        // Send the player their own data
        socket.emit('init', player);
        
        // Send the new player to all other players
        socket.broadcast.emit('playerJoined', player);
        
        // Send all existing players to the new player
        const existingPlayers = Array.from(this.players.values())
          .filter(p => p.id !== socket.id);
        
        console.log(`Sending ${existingPlayers.length} existing players to new player`);
        // Always emit existingPlayers event, even with empty array
        socket.emit('existingPlayers', existingPlayers);
      });

      // Handle player movement
      socket.on('move', (position: { x: number, y: number }) => {
        const player = this.players.get(socket.id);
        
        if (player) {
          player.x = position.x;
          player.y = position.y;
          this.players.set(socket.id, player);
          
          // Broadcast position to all other players
          socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: position.x,
            y: position.y
          });
        }
      });
      
      // Handle requests for player data
      socket.on('requestPlayerData', (playerId: string) => {
        console.log(`Player ${socket.id} requested data for player ${playerId}`);
        const player = this.players.get(playerId);
        
        if (player) {
          // Send the requested player data
          socket.emit('playerJoined', player);
        }
      });

      // Handle player disconnection
      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        if (this.players.has(socket.id)) {
          this.players.delete(socket.id);
          this.io.emit('playerLeft', socket.id);
        }
      });
    });
  }

  getRandomColor(): string {
    // Define a larger palette of distinct colors
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#FF33F5', 
      '#F5FF33', '#33FFF5', '#F533FF', '#FF3333',
      '#7D3C98', '#2ECC71', '#F1C40F', '#E74C3C',
      '#3498DB', '#1ABC9C', '#F39C12', '#8E44AD',
      '#2C3E50', '#16A085', '#27AE60', '#D35400',
      '#A569BD', '#76D7C4', '#F7DC6F', '#EC7063'
    ];
    
    // Check which colors are already in use
    const usedColors = new Set(
      Array.from(this.players.values()).map(player => player.color)
    );
    
    // Filter out colors that are already being used
    const availableColors = colors.filter(color => !usedColors.has(color));
    
    // If there are available colors, choose one randomly
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    // If all colors are in use, generate a slightly random variation of an existing color
    if (usedColors.size > 0) {
      // Create a random variation of a random color
      const baseColor = colors[Math.floor(Math.random() * colors.length)];
      return this.getColorVariation(baseColor);
    }
    
    // Fallback to a completely random color
    return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
  }
  
  // Generate a color variation that's visually similar but technically different
  getColorVariation(hexColor: string): string {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Add a small random variation to each component
    const variation = 20; // Adjust how different the variation should be
    
    // Create new RGB values with slight variations
    const newR = Math.min(255, Math.max(0, r + (Math.random() * variation * 2 - variation)));
    const newG = Math.min(255, Math.max(0, g + (Math.random() * variation * 2 - variation)));
    const newB = Math.min(255, Math.max(0, b + (Math.random() * variation * 2 - variation)));
    
    // Convert back to hex
    return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
  }
}