import { Server as SocketIOServer } from "socket.io";
import http from "http";

// Trail segment interface
export interface TrailSegment {
  x: number;
  y: number;
  timestamp: number;
  isInvincible: boolean; // Track if segment was created during invincibility
}

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
  trail: TrailSegment[]; // Trail of light segments behind the player
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
          trail: [], // Initialize empty trail
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
          // Ensure trail array exists
          if (!player.trail) {
            player.trail = [];
          }
          
          // Always add a trail point if player is moving (simplifying for testing)
          if (data.isMoving) {
            // Check if player is currently invincible
            const isInvincible = player.invincibleUntil > Date.now();
            
            // Add new trail segment at current position, marking if created during invincibility
            player.trail.push({
              x: player.x,
              y: player.y,
              timestamp: Date.now(),
              isInvincible: isInvincible
            });
            
            // Only log occasionally to reduce console spam
            if (Math.random() < 0.01) {
              console.log(`Server: Added trail point for ${player.username}, trail length: ${player.trail.length}`);
            }
            
            // Limit trail length to prevent performance issues (keep last 40 segments)
            if (player.trail.length > 40) {
              player.trail = player.trail.slice(-40);
            }
          }
          
          // Update player position and state
          player.x = data.x;
          player.y = data.y;
          if (data.direction) player.direction = data.direction;
          if (data.isMoving !== undefined) player.isMoving = data.isMoving;
          if (data.invincibleUntil) player.invincibleUntil = data.invincibleUntil;
          
          this.players.set(socket.id, player);
          
          // Add trail data to the movement update
          socket.broadcast.emit("playerMoved", {
            id: socket.id,
            ...data,
            trail: player.trail
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
        
        // Determine the type of death for better notifications
        const deathType = data.collisionType || "player";
        
        // Save the victim's username - this is always the username of the player who died
        // NOT data.killedUsername - this might be causing confusion
        const killedUsername = player.username;
        
        // For debugging: Log the raw kill data
        console.log("KILL DATA RECEIVED:", {
          deathType: deathType,
          killerId: data.killedBy,
          killerName: data.killerUsername,
          victimId: socket.id,
          victimName: killedUsername,
          isSelfKill: data.isSelfKill
        });
        
        // 1. Broadcast death to everyone with type of death
        this.io.emit("playerDied", {
          id: socket.id,
          username: player.username,
          deathType: deathType
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
        player.trail = []; // Clear the trail on respawn
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
        
        // Always give the killer a point, even in self-kills for debugging
        // This ensures we get a kill message regardless
        const killerUsername = data.killerUsername || "Unknown";
        
        // For testing: Log the exact killer info for debugging
        console.log("KILL ATTRIBUTION:", {
            killedBy: data.killedBy,
            killerUsername: killerUsername,
            killedUsername: killedUsername,
            deathType: deathType,
            isSelf: data.killedBy === socket.id
        });
        
        // If killed by another player, give them a point
        // Get the correct killer information
        const isSelfKill = data.isSelfKill === true;
        
        // Different logic based on self vs. other kill
        if (data.killedBy && !isSelfKill) {
          // This is when someone else killed the player
          const killer = this.players.get(data.killedBy);
          if (killer) {
            // Award a point to the killer
            killer.score += 1;
            this.players.set(data.killedBy, killer);
            
            console.log(`Awarding kill to ${killer.username} (ID: ${killer.id})`);
            
            // For extra debugging, log all relevant data we're about to send
            const killData = {
              id: data.killedBy,
              score: killer.score,
              username: killer.username,  // Killer's username
              killedUsername: killedUsername, // Victim's username
              deathType: deathType,
              isSelfKill: false // Explicitly mark as not a self-kill
            };
            
            console.log("EMITTING SCORE UPDATE WITH DATA:", killData);
            
            // Include the death type and both usernames in the score update
            this.io.emit("scoreUpdated", killData);
          } else {
            console.log(`Killer not found for ID: ${data.killedBy}`);
          }
        } else {
          // This is a self-kill, send a special notification
          console.log(`Self-kill by ${player.username} (Death type: ${deathType})`);
          
          const selfKillData = {
            id: socket.id,
            score: player.score,
            username: player.username, // Both killer and victim are the same person
            killedUsername: player.username, // The victim is the same as the killer for self-kills
            deathType: deathType,
            isSelfKill: true // Explicitly mark as a self-kill
          };
          
          console.log("EMITTING SELF-KILL DATA:", selfKillData);
          
          this.io.emit("scoreUpdated", selfKillData);
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