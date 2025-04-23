import { Server as SocketIOServer } from "socket.io";
import { NextRequest } from "next/server";
import { GameServer } from "@/game/server/GameServer";

// Store for active socket connections
let io: SocketIOServer;
let gameServer: GameServer;

export async function GET(req: NextRequest) {
  try {
    // This is required for WebSocket upgrade
    const { socket, response } = await (req as any).nextUrl;

    if (!socket) {
      return new Response("WebSocket connection required", { status: 400 });
    }

    // Initialize socket.io server on first connection
    if (!io) {
      const socketIO = new SocketIOServer({
        path: "/api/socket",
        addTrailingSlash: false,
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
          credentials: false,
          allowedHeaders: ["*"],
        },
        transports: ["websocket"],
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
        allowEIO3: true,
        allowUpgrades: false,
        cookie: false,
        maxHttpBufferSize: 1e8,
        serveClient: false,
        allowRequest: (req, callback) => {
          callback(null, true);
        },
      });

      io = socketIO;

      // Create game server with the socket.io instance
      gameServer = new GameServer(io);
      console.log("GameServer initialized in Edge runtime");
    }

    // Attach the server to the event
    (io as any).attachWebSocket(socket, req, response);

    // WebSocket connections need to stay alive
    return new Response(null, {
      status: 101,
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
      },
    });
  } catch (error) {
    console.error("WebSocket connection error:", error);
    return new Response("WebSocket connection failed", { status: 500 });
  }
}
