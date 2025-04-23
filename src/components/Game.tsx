"use client";

import { useEffect, useRef, useState } from "react";
import { GameClient } from "@/game/client/GameClient";
import { Player } from "@/game/server/GameServer";
import { SpriteRenderer } from "@/game/client/SpriteRenderer";

// Define notification type
interface GameNotification {
  id: string;
  message: string;
  timestamp: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const spriteRendererRef = useRef<SpriteRenderer | null>(null);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  // Initialize game client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const client = new GameClient();
      setGameClient(client);

      // Create stable event handlers that we can remove later
      const handleInit = () => {
        console.log("Game: init event received");
        updatePlayersList(client);
      };

      const handlePlayerJoined = (player: Player) => {
        console.log("Game: playerJoined event received", player);
        updatePlayersList(client);
      };

      const handleExistingPlayers = (players: Player[]) => {
        console.log("Game: existingPlayers event received", players);
        updatePlayersList(client);
      };

      const handlePlayerMoved = () => {
        updatePlayersList(client);
      };

      const handlePlayerLeft = () => {
        console.log("Game: playerLeft event received");
        updatePlayersList(client);
      };

      // Death and respawn handlers
      const handlePlayerDied = (data: { id: string }) => {
        console.log("Game: playerDied event received", data);

        // If it's the current player who died
        if (data.id === client.currentPlayer?.id) {
          console.log("YOU DIED!");

          // Auto-clear death state after 1 second in case respawn event fails
          setTimeout(() => {}, 1000);
        }

        updatePlayersList(client);
      };

      const handlePlayerRespawned = (data: { id: string }) => {
        console.log("Game: playerRespawned event received", data);

        // If it's the current player who respawned
        if (data.id === client.currentPlayer?.id) {
          console.log("YOU RESPAWNED!");
          // Force death state to false

          // Make double sure we're not stuck in death state
          setTimeout(() => {}, 100);
        }

        updatePlayersList(client);
      };

      const handlePlayerUpdated = () => {
        console.log("Game: playerUpdated event received");
        updatePlayersList(client);
      };

      // Score update handler
      const handleScoreUpdated = (data: {
        id: string;
        score: number;
        username: string;
        killedUsername?: string;
        deathType?: string;
        isSelfKill?: boolean; // Added this field to receive explicit self-kill flag
        killerIdMatchesVictimId?: boolean; // Added for additional self-kill checking
      }) => {
        console.log("Game: scoreUpdated event received", data);
        updatePlayersList(client);

        // Print the complete data received for debugging
        console.log("COMPLETE SCORE UPDATE DATA:", data);

        // Get names for notification - explicitly separate them
        const killerName = data.username; // This is the killer's username
        const victimName = data.killedUsername || "someone"; // Use a default if not provided

        // ONLY use the explicit isSelfKill flag from the server
        // This is the source of truth about whether the kill was a suicide
        const isSelfKill = data.isSelfKill === true;

        // For additional debugging: log more detailed self-kill detection info
        console.log("Kill notification details:", {
          killer: killerName,
          victim: victimName,
          type: data.deathType,
          isSelfKillFlag: data.isSelfKill === true,
          areNamesEqual: killerName === victimName,
          // Additional checks we can use for debugging
          areIdsEqual: data.id === data.killedBy,
          finalDecision: isSelfKill,
        });

        // Generate a fun, randomized message based on death type
        let message = "";

        if (data.deathType === "trail" && !isSelfKill) {
          // Trail collision messages - when hitting someone else's trail
          const trailMessages = [
            `${killerName}'s light trail eliminated ${victimName}!`,
            `${killerName}'s trail sent ${victimName} back to the start!`,
            `${killerName} caught ${victimName} in their light web!`,
            `${victimName} failed to cross ${killerName}'s laser barrier!`,
            `${killerName} scored a point when ${victimName} hit their trail!`,
          ];
          message =
            trailMessages[Math.floor(Math.random() * trailMessages.length)];
        } else if (data.deathType === "self-trail") {
          // Self trail collision messages
          const selfTrailMessages = [
            `${victimName} got tangled in their own trail. No points for self-destruction!`,
            `${victimName} played themselves in the most literal way!`,
            `${victimName} made a maze they couldn't solve!`,
            `${victimName} became their own worst enemy!`,
            `${victimName} tried to bite their own tail. That's not how you win!`,
          ];
          message =
            selfTrailMessages[
              Math.floor(Math.random() * selfTrailMessages.length)
            ];
        } else {
          // Standard player collision messages
          if (isSelfKill) {
            const selfCollisionMessages = [
              `${victimName} eliminated themselves in confusion! No points awarded.`,
              `${victimName} defeated their own existence! How philosophical!`,
              `${victimName} ragequit in the most dramatic way possible!`,
              `${victimName} decided to restart from scratch! Self-kills don't count for points.`,
              `${victimName} accidentally pressed the self-destruct button!`,
            ];
            message =
              selfCollisionMessages[
                Math.floor(Math.random() * selfCollisionMessages.length)
              ];
          } else {
            const playerCollisionMessages = [
              `${killerName} bumped into ${victimName} and won!`,
              `${killerName} eliminated ${victimName} in a head-on collision!`,
              `${killerName} sent ${victimName} flying off the grid!`,
              `${killerName} showed ${victimName} how to play bumper cars!`,
              `${victimName} was deleted from the game by ${killerName}!`,
            ];
            message =
              playerCollisionMessages[
                Math.floor(Math.random() * playerCollisionMessages.length)
              ];
          }
        }

        // Add a kill notification
        const notification: GameNotification = {
          id: `kill-${Date.now()}`,
          message,
          timestamp: Date.now(),
        };

        setNotifications((prev) => [
          notification,
          ...prev.slice(0, 4), // Keep only the 5 most recent notifications
        ]);
      };

      // Add event listeners
      client.on("init", handleInit);
      client.on("playerJoined", handlePlayerJoined);
      client.on("existingPlayers", handleExistingPlayers);
      client.on("playerMoved", handlePlayerMoved);
      client.on("playerLeft", handlePlayerLeft);
      client.on("playerDied", handlePlayerDied);
      client.on("playerRespawned", handlePlayerRespawned);
      client.on("playerUpdated", handlePlayerUpdated);
      client.on("scoreUpdated", handleScoreUpdated);

      // Cleanup function to remove event listeners
      return () => {
        client.off("init", handleInit);
        client.off("playerJoined", handlePlayerJoined);
        client.off("existingPlayers", handleExistingPlayers);
        client.off("playerMoved", handlePlayerMoved);
        client.off("playerLeft", handlePlayerLeft);
        client.off("playerDied", handlePlayerDied);
        client.off("playerRespawned", handlePlayerRespawned);
        client.off("playerUpdated", handlePlayerUpdated);
        client.off("scoreUpdated", handleScoreUpdated);
      };
    }
  }, []);

  // Handle automatic notification expiry
  useEffect(() => {
    if (notifications.length === 0) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      setNotifications(
        (prev) =>
          prev.filter((notification) => now - notification.timestamp < 5000) // Remove notifications older than 5 seconds
      );
    }, 1000);

    return () => clearInterval(intervalId);
  }, [notifications]);

  // Handle canvas rendering
  useEffect(() => {
    if (!canvasRef.current || !gameClient || !joined) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize sprite renderer if not already done
    if (!spriteRendererRef.current) {
      console.log("Creating sprite renderer...");

      // Preload the spritesheet image first
      const preloadImg = new Image();
      preloadImg.onload = () => {
        console.log("Spritesheet preloaded successfully");
      };
      preloadImg.onerror = (err) => {
        console.error("Failed to preload spritesheet:", err);
      };
      preloadImg.src = "/assets/spritesheet.png";

      // Create the sprite renderer with the path
      spriteRendererRef.current = new SpriteRenderer("/assets/spritesheet.png");
    }

    const spriteRenderer = spriteRendererRef.current;

    // Set canvas size initially
    const updateCanvasSize = () => {
      // Fixed logical size for game calculations
      canvas.width = 800;
      canvas.height = 600;
    };

    // Set initial size
    updateCanvasSize();

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener("resize", handleResize);

    // Track last render time for framerate limiting
    let lastRenderTime = 0;
    const targetFPS = 25; // Limit to 25 FPS for better performance
    const frameInterval = 1000 / targetFPS;

    // Animation loop with framerate limiting
    const render = (timestamp: number) => {
      // Limit framerate to reduce flickering
      const elapsed = timestamp - lastRenderTime;
      if (elapsed < frameInterval) {
        requestAnimationFrame(render);
        return;
      }
      lastRenderTime = timestamp - (elapsed % frameInterval);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw ground/background
      ctx.fillStyle = "#1a1a2a"; // Darker background for better trail visibility
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sort players by Y position so characters in front are drawn on top
      const sortedPlayers = Array.from(gameClient.players.values()).sort(
        (a, b) => a.y - b.y
      );

      // Only debug log occasionally to reduce console spam
      if (sortedPlayers.length > 0 && Math.random() < 0.001) {
        console.log(
          "Player trails active:",
          sortedPlayers.some((p) => p.trail && p.trail.length > 0)
        );
      }

      // Draw players
      sortedPlayers.forEach((player) => {
        // Draw player sprite
        const isCurrentPlayer = player.id === gameClient.currentPlayer?.id;

        // Handle invincibility and blinking for all players
        const now = Date.now();

        // Check if the player has the invincibleUntil property
        if (!("invincibleUntil" in player)) {
          // Initialize it if it doesn't exist
          player.invincibleUntil = 0;
        }

        // Debug only for major changes
        if (
          player.invincibleUntil > now &&
          player.id === gameClient.currentPlayer?.id
        ) {
          // Only log once per second
          if (
            Math.floor((player.invincibleUntil - now) / 1000) !==
            Math.floor((player.invincibleUntil - now - 100) / 1000)
          ) {
            console.log(
              `You are invincible for ${Math.ceil(
                (player.invincibleUntil - now) / 1000
              )}s`
            );
          }
        }

        const isInvincible = player.invincibleUntil > now;

        // Apply blinking effect to invincible players, but make it less aggressive
        let isVisible = true;
        if (isInvincible) {
          // Blink more slowly - 3 times per second instead of 5
          // Use a longer period (333ms) for slower, less distracting flashing
          isVisible = Math.floor(now / 333) % 2 === 0;

          // Don't force unnecessary re-renders that could cause flickering
        }

        spriteRenderer.drawPlayer(
          ctx,
          player.x,
          player.y,
          player.direction,
          player.spriteRow,
          player.isMoving,
          isInvincible,
          isVisible,
          player.id,
          player.color, // Pass the player's color for the circle
          player.trail // Pass the player's trail segments
        );

        // Draw username
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;

        // Draw text with outline for better visibility
        const displayName =
          player.id === gameClient.currentPlayer?.id
            ? `${player.username} (You)`
            : player.username;

        ctx.strokeText(displayName, player.x, player.y - 35);
        ctx.fillText(displayName, player.x, player.y - 35);
      });

      requestAnimationFrame(render);
    };

    const animationId = requestAnimationFrame((timestamp) => render(timestamp));

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [gameClient, joined]);

  // Handle keyboard movement with WASD
  useEffect(() => {
    if (!gameClient || !joined) return;

    // Function to handle key press
    const handleKeyDown = (e: KeyboardEvent) => {
      // Convert key to lowercase for consistency
      const key = e.key.toLowerCase();

      // Only handle WASD keys
      if (["w", "a", "s", "d"].includes(key)) {
        // Prevent default actions like scrolling
        e.preventDefault();
        gameClient.setMovementKey(key, true);
      }
    };

    // Function to handle key release
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (["w", "a", "s", "d"].includes(key)) {
        gameClient.setMovementKey(key, false);
      }
    };

    // When tab/window loses focus, stop all movement
    const handleBlur = () => {
      gameClient.movementKeys.w = false;
      gameClient.movementKeys.a = false;
      gameClient.movementKeys.s = false;
      gameClient.movementKeys.d = false;
      gameClient.stopMovement();
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      gameClient.stopMovement();
    };
  }, [gameClient, joined]);

  const updatePlayersList = (client: GameClient) => {
    const allPlayers = Array.from(client.players.values());
    console.log("Updating players list:", allPlayers);
    setPlayers(allPlayers);
  };

  const handleJoin = () => {
    if (gameClient && username.trim() !== "") {
      gameClient.joinGame(username);
      setJoined(true);
    }
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-4xl font-bold mb-8">WebSocket MMO</h1>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-semibold mb-4">Join Game</h2>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-2"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && username.trim() !== "") {
                  handleJoin();
                }
              }}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 bg-gray-900 min-h-screen">
      <div className="w-full max-w-6xl mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">WebSocket MMO</h1>
      </div>
      <div className="flex w-full max-w-6xl gap-4">
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="bg-gray-800 rounded-lg w-full"
            style={{ aspectRatio: "4/3" }}
          />

          {/* No death overlay */}

          {/* Notifications area */}
          <div className="absolute top-2 left-2 right-2 pointer-events-none">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-black bg-opacity-80 text-white px-3 py-2 mb-2 rounded-lg text-sm font-medium animate-fadeIn"
              >
                <span className="font-bold">{notification.message}</span>
              </div>
            ))}
          </div>

          <p className="text-white mt-2">Use WASD keys to move</p>
        </div>
        <div className="w-64 flex flex-col gap-4">
          {/* Leaderboard */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-2">Leaderboard</h2>
            <ul className="space-y-2">
              {[...players]
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 5)
                .map((player, index) => (
                  <li
                    key={player.id}
                    className="flex items-center py-1 px-2 rounded bg-gray-700"
                  >
                    <div className="w-6 text-center font-bold mr-2">
                      {index + 1}.
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <span
                        className={`truncate ${
                          player.id === gameClient?.currentPlayer?.id
                            ? "text-blue-300"
                            : "text-white"
                        }`}
                      >
                        {player.username}
                        {player.id === gameClient?.currentPlayer?.id
                          ? " (You)"
                          : ""}
                      </span>
                      <span className="text-yellow-400 font-bold ml-2">
                        {player.score || 0}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {/* Player list */}
          <div className="bg-gray-800 p-4 rounded-lg flex-1">
            <h2 className="text-xl font-bold text-white mb-2">
              Players ({players.length})
            </h2>
            <ul className="space-y-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center py-1 px-2 rounded hover:bg-gray-700"
                >
                  <div className="flex flex-col justify-center min-w-8">
                    <span
                      className="inline-block w-6 h-6 rounded-full mr-2 bg-cover bg-center"
                      style={{
                        backgroundColor: player.color,
                        boxShadow:
                          player.id === gameClient?.currentPlayer?.id
                            ? "0 0 0 2px #ffffff"
                            : "none",
                      }}
                    />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-white truncate">
                      {player.username}{" "}
                      {player.id === gameClient?.currentPlayer?.id
                        ? "(You)"
                        : ""}
                    </span>
                    <span className="text-yellow-400 font-bold ml-2">
                      {player.score || 0}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
