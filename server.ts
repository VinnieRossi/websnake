import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { GameServer } from './src/game/server/GameServer';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Prepare the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize WebSocket game server with the HTTP server
  const gameServer = new GameServer(server);
  console.log('Game server initialized');

  // Start listening
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});