import { Server as SocketIOServer } from "socket.io";
import http from "http";

// Player data interface
export interface Player {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
  direction: "up" | "down" | "left" | "right";
  spriteRow: number; // Row in the spritesheet (based on character type)
  isMoving: boolean;
  invincibleUntil: number; // Timestamp when invincibility ends (0 if not invincible)
  score: number; // Player's score (number of kills)
}

export class GameServer {
  players: Map<string, Player> = new Map();
  io: SocketIOServer;

  constructor(server: http.Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    console.log("GameServer constructor called, setting up handlers");
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Handle player joining
      socket.on("join", (username: string) => {
        console.log(`Join request from ${username}`);
        const player: Player = {
          id: socket.id,
          x: Math.floor(Math.random() * 500),
          y: Math.floor(Math.random() * 500),
          username,
          color: this.getRandomColor(),
          direction: "down", // Default facing downward
          spriteRow: Math.floor(Math.random() * 5), // Random character sprite (0-4)
          isMoving: false,
          invincibleUntil: Date.now() + 2000, // 2 seconds of initial invincibility
          score: 0, // Initialize score to 0
        };

        this.players.set(socket.id, player);
        console.log(`Player joined: ${username} (${socket.id})`);

        // Send the player their own data
        socket.emit("init", player);

        // Send the new player to all other players
        socket.broadcast.emit("playerJoined", player);

        // Send all existing players to the new player
        const existingPlayers = Array.from(this.players.values()).filter(
          (p) => p.id !== socket.id
        );

        console.log(
          `Sending ${existingPlayers.length} existing players to new player`
        );
        socket.emit("existingPlayers", existingPlayers);
      });

      // SIMPLE move handler
      socket.on("move", (data: any) => {
        const player = this.players.get(socket.id);
        if (player) {
          player.x = data.x;
          player.y = data.y;
          if (data.direction) player.direction = data.direction;
          if (data.isMoving !== undefined) player.isMoving = data.isMoving;
          if (data.invincibleUntil) player.invincibleUntil = data.invincibleUntil;
          
          this.players.set(socket.id, player);
          socket.broadcast.emit("playerMoved", {
            id: socket.id,
            ...data
          });
        }
      });

      // ULTRA SIMPLE death handler
      socket.on("killPlayer", (data) => {
        console.log("⚠️ KILL PLAYER EVENT RECEIVED", data);
        
        const player = this.players.get(socket.id);
        if (!player) {
          console.log("Player not found for death!");
          return;
        }
        
        console.log(`Player ${player.username} died, initiating respawn`);
        
        // 1. Broadcast death to everyone
        this.io.emit("playerDied", {
          id: socket.id,
          username: player.username
        });
        
        // 2. Respawn at center with invincibility
        const centerX = 400;
        const centerY = 300;
        const invincibleUntil = Date.now() + 2000;
        
        // 3. Update player state on server
        player.x = centerX;
        player.y = centerY;
        player.direction = "down";
        player.isMoving = false;
        player.invincibleUntil = invincibleUntil;
        this.players.set(socket.id, player);
        
        // 4. Tell the player they died and respawned
        socket.emit("selfRespawn", {
          x: centerX,
          y: centerY,
          invincibleUntil: invincibleUntil
        });
        
        // 5. Tell everyone about the respawn
        this.io.emit("serverRespawn", {
          id: socket.id,
          x: centerX,
          y: centerY,
          invincibleUntil: invincibleUntil
        });
        
        // If killed by another player, give them a point
        if (data.killedBy) {
          const killer = this.players.get(data.killedBy);
          if (killer) {
            killer.score += 1;
            this.players.set(data.killedBy, killer);
            
            this.io.emit("scoreUpdated", {
              id: data.killedBy,
              score: killer.score,
              username: killer.username
            });
          }
        }
      });

      // Handle player disconnection
      socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        if (this.players.has(socket.id)) {
          this.players.delete(socket.id);
          this.io.emit("playerLeft", socket.id);
        }
      });
    });
  }

  getRandomColor(): string {
    // Define a palette of distinct colors
    const colors = [
      "#FF5733", "#33FF57", "#3357FF", "#FF33F5", 
      "#F5FF33", "#33FFF5", "#F533FF", "#FF3333",
      "#7D3C98", "#2ECC71", "#F1C40F", "#E74C3C",
      "#3498DB", "#1ABC9C", "#F39C12", "#8E44AD",
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }
}