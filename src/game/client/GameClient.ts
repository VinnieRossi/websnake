import { io, Socket } from "socket.io-client";
import { Player } from "../server/GameServer";

type GameEventCallback = (data: any) => void;

export class GameClient {
  socket: Socket;
  players: Map<string, Player> = new Map();
  currentPlayer: Player | null = null;
  eventListeners: Map<string, GameEventCallback[]> = new Map();

  // Movement state
  movementKeys: { [key: string]: boolean } = {
    w: false,
    a: false,
    s: false,
    d: false,
  };
  moveSpeed: number = 10;
  isMoving: boolean = false;
  lastMovementUpdate: number = 0;
  movementUpdateInterval: number = 30; // Send updates every 30ms for smoother movement

  // Collision and respawn
  isDead: boolean = false;
  respawnTime: number = 0;
  invincibleUntil: number = 0;
  invincibilityDuration: number = 2000; // 2 seconds of invincibility/blinking
  collisionRadius: number = 45; // Collision detection radius (pixels) - making it much larger for easier testing

  constructor() {
    // Connect to the server
    this.socket = io(window.location.origin);
    this.setupSocketListeners();

    // Start collision checking immediately
    this.startCollisionChecking();
    console.log("Collision checking activated");
  }

  setupSocketListeners() {
    // When we first connect and receive our player data
    this.socket.on("init", (player: Player) => {
      console.log("Init with player data:", player);
      // Initialize score if not present
      if (player.score === undefined) {
        player.score = 0;
      }
      this.currentPlayer = player;
      this.players.set(player.id, player);
      this.triggerEvent("init", player);
    });

    // Score updates
    this.socket.on(
      "scoreUpdated",
      (data: { id: string; score: number; username: string }) => {
        console.log(`Score updated for ${data.username}: ${data.score}`);
        const player = this.players.get(data.id);
        if (player) {
          player.score = data.score;
          this.triggerEvent("scoreUpdated", data);
        }
      }
    );

    // Existing players already in the game
    this.socket.on("existingPlayers", (players: Player[]) => {
      console.log("Received existing players:", players);
      players.forEach((player) => {
        // Ensure the player has the invincibleUntil property
        if (!("invincibleUntil" in player)) {
          player.invincibleUntil = 0; // No invincibility for existing players by default
        }

        this.players.set(player.id, player);
      });
      this.triggerEvent("existingPlayers", players);
    });

    // New player joined
    this.socket.on("playerJoined", (player: Player) => {
      console.log("New player joined:", player);

      // Ensure the player has the invincibleUntil property
      if (!("invincibleUntil" in player)) {
        player.invincibleUntil = Date.now() + 2000; // 2 seconds initial invincibility
      }

      this.players.set(player.id, player);
      this.triggerEvent("playerJoined", player);
    });

    // Player moved
    this.socket.on(
      "playerMoved",
      (data: {
        id: string;
        x: number;
        y: number;
        direction?: "up" | "down" | "left" | "right";
        isMoving?: boolean;
        invincibleUntil?: number;
      }) => {
        const player = this.players.get(data.id);
        if (player) {
          player.x = data.x;
          player.y = data.y;

          // Update direction and movement state if provided
          if (data.direction) {
            player.direction = data.direction;
          }

          if (data.isMoving !== undefined) {
            player.isMoving = data.isMoving;
          }

          // Update invincibility if provided
          if (data.invincibleUntil !== undefined) {
            player.invincibleUntil = data.invincibleUntil;
          }

          this.triggerEvent("playerMoved", {
            id: data.id,
            x: data.x,
            y: data.y,
            direction: player.direction,
            isMoving: player.isMoving,
            invincibleUntil: player.invincibleUntil,
          });
        } else {
          console.warn("Received movement for unknown player:", data.id);
          // Request player data if we somehow missed this player
          this.requestPlayerData(data.id);
        }
      }
    );

    // Player died
    this.socket.on(
      "playerDied",
      (data: { id: string; username?: string; timestamp?: number }) => {
        console.log(
          `DEATH EVENT FROM SERVER: Player ${
            data.username || data.id
          } died at ${new Date(data.timestamp || Date.now()).toISOString()}`
        );

        // If this is us, force respawn handling now
        if (data.id === this.currentPlayer?.id) {
          console.log("I DIED! Waiting for server respawn...");

          // Set local death state - will be reset by respawn
          this.isDead = true;

          // Safety - reset death state after 5 seconds if no respawn received
          setTimeout(() => {
            if (this.isDead) {
              console.log("SAFETY: Resetting death state after timeout");
              this.isDead = false;
            }
          }, 5000);
        } else {
          // Another player died, update their state
          const player = this.players.get(data.id);
          if (player) {
            console.log(`Other player ${player.username} died`);
            // Trigger event for UI updates if needed
            this.triggerEvent("playerDied", {
              id: data.id,
              username: player.username,
            });
          }
        }
      }
    );

    // Self respawn event - for the player who died
    this.socket.on(
      "selfRespawn",
      (data: { x: number; y: number; invincibleUntil: number }) => {
        try {
          console.log("⚠️ RESPAWN EVENT RECEIVED - Player respawning!", data);

          if (!this.currentPlayer) {
            console.error("No current player found during self respawn");
            return;
          }

          // Reset death state
          this.isDead = false;

          // Reset movement keys
          this.movementKeys.w = false;
          this.movementKeys.a = false;
          this.movementKeys.s = false;
          this.movementKeys.d = false;

          // Update player position and state
          this.currentPlayer.x = data.x;
          this.currentPlayer.y = data.y;
          this.currentPlayer.direction = "down";
          this.currentPlayer.isMoving = false;
          this.currentPlayer.invincibleUntil = data.invincibleUntil;

          // Update client state
          this.invincibleUntil = data.invincibleUntil;
          this.respawnTime = Date.now();

          console.log(
            `Now invincible until ${new Date(data.invincibleUntil)}, which is ${
              (data.invincibleUntil - Date.now()) / 1000
            } seconds`
          );

          // Explicitly trigger respawn event to update UI
          this.triggerEvent("playerRespawned", {
            id: this.currentPlayer.id,
            x: data.x,
            y: data.y,
            invincibleUntil: data.invincibleUntil,
          });

          console.log(
            `Self respawned at (${data.x}, ${
              data.y
            }) with invincibility until ${new Date(data.invincibleUntil)}`
          );
        } catch (error) {
          console.error("Error handling self respawn:", error);
        }
      }
    );

    // Server-controlled respawn event
    this.socket.on(
      "serverRespawn",
      (data: { id: string; x: number; y: number; invincibleUntil: number }) => {
        try {
          console.log(
            `SERVER RESPAWN for player ${
              data.id
            } with invincibility until ${new Date(
              data.invincibleUntil
            )}, which is ${
              (data.invincibleUntil - Date.now()) / 1000
            } seconds from now`
          );

          // Make sure the data is valid
          if (!data || !data.id || data.invincibleUntil === undefined) {
            console.error("Invalid respawn data received:", data);
            return;
          }

          const player = this.players.get(data.id);
          if (player) {
            // Direct update of all properties
            player.x = data.x;
            player.y = data.y;
            player.direction = "down";
            player.isMoving = false;
            player.invincibleUntil = data.invincibleUntil;

            // Force debug to understand invincibility status
            console.log(
              `Updated player ${player.username} (${
                player.id
              }) invincible until: ${new Date(player.invincibleUntil)}`
            );

            // If this is the current player, update client state too
            if (this.currentPlayer && player.id === this.currentPlayer.id) {
              this.isDead = false; // No longer dead
              this.invincibleUntil = data.invincibleUntil;
              this.respawnTime = Date.now();

              console.log(
                `This is current player, updating client state. Invincible until: ${new Date(
                  this.invincibleUntil
                )}`
              );
            }

            // Trigger a UI update
            this.triggerEvent("playerRespawned", {
              id: player.id,
              x: data.x,
              y: data.y,
              invincibleUntil: data.invincibleUntil,
            });
          } else {
            console.warn(
              `Player ${data.id} not found for respawn - requesting data`
            );
            this.requestPlayerData(data.id);
          }
        } catch (error) {
          console.error("Error handling server respawn:", error);
        }
      }
    );

    // Player respawned
    this.socket.on(
      "playerRespawned",
      (data: { id: string; x: number; y: number; invincibleUntil: number }) => {
        console.log(
          `Player ${data.id} respawned with invincibility until ${new Date(
            data.invincibleUntil
          )}`
        );

        const player = this.players.get(data.id);
        if (player) {
          // Update player's position and invincibility
          player.x = data.x;
          player.y = data.y;
          player.invincibleUntil = data.invincibleUntil;

          // Trigger event to notify UI components
          this.triggerEvent("playerRespawned", data);
        }
      }
    );

    // Invincibility check - confirmation from server about invincibility status
    this.socket.on(
      "invincibilityCheck",
      (data: { invincibleUntil: number }) => {
        if (this.currentPlayer) {
          console.log(
            `Server confirms invincibility until ${new Date(
              data.invincibleUntil
            )}. That's ${
              (data.invincibleUntil - Date.now()) / 1000
            } seconds from now.`
          );

          // Make sure client and player object both have correct invincibility
          this.currentPlayer.invincibleUntil = data.invincibleUntil;
          this.invincibleUntil = data.invincibleUntil;
        }
      }
    );

    // Player left
    this.socket.on("playerLeft", (playerId: string) => {
      console.log("Player left:", playerId);
      this.players.delete(playerId);
      this.triggerEvent("playerLeft", playerId);
    });
  }

  // Request data for a specific player if we somehow missed them
  requestPlayerData(playerId: string) {
    console.log("Requesting data for missing player:", playerId);
    this.socket.emit("requestPlayerData", playerId);
  }

  joinGame(username: string) {
    this.socket.emit("join", username);
  }

  movePlayer(
    x: number,
    y: number,
    direction?: "up" | "down" | "left" | "right",
    isMoving?: boolean
  ) {
    if (this.currentPlayer) {
      this.currentPlayer.x = x;
      this.currentPlayer.y = y;

      // Update direction if provided
      if (direction) {
        this.currentPlayer.direction = direction;
      }

      // Update movement state if provided
      if (isMoving !== undefined) {
        this.currentPlayer.isMoving = isMoving;
      }

      // Set invincibility on the current player
      if (this.isInvincible()) {
        this.currentPlayer.invincibleUntil = this.invincibleUntil;
      } else {
        this.currentPlayer.invincibleUntil = 0;
      }

      // Send to server
      this.socket.emit("move", {
        x,
        y,
        direction: this.currentPlayer.direction,
        isMoving: this.currentPlayer.isMoving,
        invincibleUntil: this.currentPlayer.invincibleUntil,
      });

      // Trigger local event
      this.triggerEvent("playerMoved", {
        id: this.currentPlayer.id,
        x,
        y,
        direction: this.currentPlayer.direction,
        isMoving: this.currentPlayer.isMoving,
        invincibleUntil: this.currentPlayer.invincibleUntil,
      });
    }
  }

  // For WASD movement
  startMovement() {
    if (!this.isMoving && this.currentPlayer) {
      this.isMoving = true;
      this.processMovement();

      // Also start collision checking independent of movement
      this.startCollisionChecking();
    }
  }

  // AGGRESSIVE collision checking - run very frequently
  startCollisionChecking() {
    console.log("Starting AGGRESSIVE collision checking");

    // Clear any existing interval
    if (this._collisionInterval) {
      clearInterval(this._collisionInterval);
    }

    // Special forced check just once
    setTimeout(() => {
      console.log("INITIAL FORCED CHECK");
      const hit = this.checkCollisions();
      if (hit) console.log("FOUND COLLISION ON STARTUP!");
    }, 2000);

    // Very frequent checking
    this._collisionInterval = setInterval(() => {
      const collision = this.checkCollisions();
      if (collision) {
        console.log("!!!! INTERVAL COLLISION DETECTED !!!!");
      }
    }, 50); // Check every 50ms (very aggressive)

    // Extra interval for a second layer of checking
    setInterval(() => {
      // console.log("Regular collision pulse");
      this.checkCollisions();
    }, 500);
  }

  // Continuous collision checking
  private _collisionInterval: any = null;

  stopMovement() {
    this.isMoving = false;
  }

  setMovementKey(key: string, isPressed: boolean) {
    try {
      // Only handle WASD keys
      if (key in this.movementKeys) {
        // Always allow key presses - we no longer block on death
        this.movementKeys[key] = isPressed;

        // Start or stop movement based on any key being pressed
        const anyKeyPressed = Object.values(this.movementKeys).some(
          (pressed) => pressed
        );

        if (anyKeyPressed) {
          this.startMovement();
        } else {
          this.stopMovement();
        }
      }
    } catch (error) {
      console.error("Error setting movement key:", error);
    }
  }

  // Collision detection - only the player who initiates the collision should die
  checkCollisions() {
    // 1. Only check if we have a player and we're not dead
    if (!this.currentPlayer || this.isDead) return false;

    // 2. Skip if invincible - we can't die when invincible
    if (Date.now() < this.currentPlayer.invincibleUntil) return false;

    // 3. Loop through all players and check distance
    for (const player of this.players.values()) {
      // Skip self
      if (!player || player.id === this.currentPlayer.id) continue;
      
      // Skip invincible players - we can't kill them
      if (Date.now() < player.invincibleUntil) continue;

      // Get distance between players
      const dx = player.x - this.currentPlayer.x;
      const dy = player.y - this.currentPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check for collision with radius
      if (distance < this.collisionRadius) {
        console.log(`COLLISION with ${player.username} at ${distance.toFixed(0)}px`);

        // Only initiate death if we moved into them (not them into us)
        // We do this by checking if we're currently moving
        if (this.currentPlayer.isMoving) {
          console.log("I'm moving, so I'm the one who dies!");
          
          // Set temporary death flag
          this.isDead = true;

          // Tell server I died
          this.socket.emit("killPlayer", {
            id: this.currentPlayer.id,
            killedBy: player.id,
            forced: true,
          });

          console.log("Death message sent to server");

          // Auto-reset death flag after delay if server doesn't respond
          setTimeout(() => {
            this.isDead = false;
          }, 1000);
          return true;
        } else {
          console.log("I'm not moving, so I don't die from this collision");
        }
      }
    }

    return false;
  }

  // Handle collision with another player - directly tell server
  handleCollisionWith(killedById: string) {
    try {
      if (!this.currentPlayer) return;

      // Only process if we're not already dead
      if (this.isDead) {
        console.log("Already handling a death, ignoring new collision");
        return;
      }

      console.log(`COLLISION DEATH: killed by player ${killedById}`);

      // Set isDead immediately
      this.isDead = true;

      // Tell the server about this collision
      this.socket.emit("killPlayer", {
        id: this.currentPlayer.id,
        killedBy: killedById,
        forced: true, // Force handling the death
      });

      // Trigger death event locally to update UI
      this.triggerEvent("playerDied", { id: this.currentPlayer.id });

      console.log("Death event sent to server. Waiting for respawn...");

      // Reset isDead after a short delay (server should respawn us)
      setTimeout(() => {
        // If server didn't respawn us, make sure we're not stuck
        this.isDead = false;
      }, 500);
    } catch (error) {
      console.error("Error handling collision:", error);
      // Make sure we're not stuck in death state
      this.isDead = false;
    }
  }

  // Respawn player at center
  respawn() {
    if (!this.currentPlayer) return;

    // Respawn at center
    const centerX = 400;
    const centerY = 300;

    // Set invincibility period
    this.respawnTime = Date.now();
    this.invincibleUntil = this.respawnTime + this.invincibilityDuration;

    // Make sure to update the player object as well
    this.currentPlayer.invincibleUntil = this.invincibleUntil;
    this.currentPlayer.x = centerX;
    this.currentPlayer.y = centerY;
    this.currentPlayer.direction = "down";
    this.currentPlayer.isMoving = false;

    // Update death state
    this.isDead = false;

    console.log(
      "Player respawned at center with invincibility until",
      new Date(this.invincibleUntil)
    );

    // DIRECTLY set invincibility and broadcast respawn to all clients
    this.socket.emit("setInvincibility", {
      id: this.currentPlayer.id,
      x: centerX,
      y: centerY,
      invincibleUntil: this.invincibleUntil,
    });

    // Also send the standard respawn event
    this.socket.emit("playerRespawned", {
      x: centerX,
      y: centerY,
      invincibleUntil: this.invincibleUntil,
    });

    // Trigger local respawn event
    this.triggerEvent("playerRespawned", {
      id: this.currentPlayer.id,
      x: centerX,
      y: centerY,
      invincibleUntil: this.invincibleUntil,
    });
  }

  // Check if player is currently invincible
  isInvincible() {
    return Date.now() < this.invincibleUntil;
  }

  // Calculate the blinking effect (visible or not based on time)
  shouldShowInvinciblePlayer() {
    if (!this.isInvincible()) return true;

    // Blink 5 times per second (every 100ms)
    return Math.floor((Date.now() - this.respawnTime) / 100) % 2 === 0;
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

    // Determine direction based on movement keys
    // Prioritize up/down in case of diagonal movement
    let direction: "up" | "down" | "left" | "right" | undefined;

    if (dy < 0) {
      direction = "up";
    } else if (dy > 0) {
      direction = "down";
    } else if (dx < 0) {
      direction = "left";
    } else if (dx > 0) {
      direction = "right";
    }

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
        this.movePlayer(newX, newY, direction, true);
        this.lastMovementUpdate = now;

        // Check for collisions after moving
        this.checkCollisions();
      }
    } else if (this.currentPlayer.isMoving) {
      // Player has stopped moving
      this.movePlayer(
        this.currentPlayer.x,
        this.currentPlayer.y,
        undefined,
        false
      );
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
    callbacks.forEach((callback) => callback(data));
  }
}
