'use client';

import { useEffect, useRef, useState } from 'react';
import { GameClient } from '@/game/client/GameClient';
import { Player } from '@/game/server/GameServer';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  // Initialize game client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const client = new GameClient();
      setGameClient(client);

      // Create stable event handlers that we can remove later
      const handleInit = () => {
        console.log('Game: init event received');
        updatePlayersList(client);
      };

      const handlePlayerJoined = (player: Player) => {
        console.log('Game: playerJoined event received', player);
        updatePlayersList(client);
      };

      const handleExistingPlayers = (players: Player[]) => {
        console.log('Game: existingPlayers event received', players);
        updatePlayersList(client);
      };

      const handlePlayerMoved = () => {
        updatePlayersList(client);
      };

      const handlePlayerLeft = () => {
        console.log('Game: playerLeft event received');
        updatePlayersList(client);
      };

      // Add event listeners
      client.on('init', handleInit);
      client.on('playerJoined', handlePlayerJoined);
      client.on('existingPlayers', handleExistingPlayers);
      client.on('playerMoved', handlePlayerMoved);
      client.on('playerLeft', handlePlayerLeft);

      // Cleanup function to remove event listeners
      return () => {
        client.off('init', handleInit);
        client.off('playerJoined', handlePlayerJoined);
        client.off('existingPlayers', handleExistingPlayers);
        client.off('playerMoved', handlePlayerMoved);
        client.off('playerLeft', handlePlayerLeft);
      };
    }
  }, []);

  // Handle canvas rendering
  useEffect(() => {
    if (!canvasRef.current || !gameClient || !joined) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    
    window.addEventListener('resize', handleResize);

    // Animation loop
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw players
      gameClient.players.forEach((player) => {
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Draw username
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.x, player.y - 30);
      });

      requestAnimationFrame(render);
    };

    const animationId = requestAnimationFrame(render);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [gameClient, joined]);

  // Handle movement
  useEffect(() => {
    if (!canvasRef.current || !gameClient || !joined) return;

    const canvas = canvasRef.current;

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Get click position relative to canvas
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      // Apply scaling to get accurate coordinates regardless of canvas display size
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      gameClient.movePlayer(x, y);
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [gameClient, joined]);

  const updatePlayersList = (client: GameClient) => {
    const allPlayers = Array.from(client.players.values());
    console.log('Updating players list:', allPlayers);
    setPlayers(allPlayers);
  };

  const handleJoin = () => {
    if (gameClient && username.trim() !== '') {
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
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
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
      <h1 className="text-3xl font-bold text-white mb-4">WebSocket MMO</h1>
      <div className="flex w-full max-w-6xl gap-4">
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            className="bg-gray-800 rounded-lg w-full"
            style={{ aspectRatio: '4/3' }}
          />
          <p className="text-white mt-2">Click anywhere to move</p>
        </div>
        <div className="w-64 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-2">Players ({players.length})</h2>
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.id} className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: player.color }}
                />
                <span className="text-white">
                  {player.username} {player.id === gameClient?.currentPlayer?.id ? '(You)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}