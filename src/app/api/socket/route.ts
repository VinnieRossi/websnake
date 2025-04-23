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
        },
        transports: ["websocket"], // Force WebSocket transport
        pingTimeout: 60000, // Increase timeout for serverless environment
        pingInterval: 25000, // Increase interval for serverless environment
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
