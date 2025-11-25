import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { setupRecordingSockets } from "./sockets/recording";
import { initializeTranscriptionWorker } from "./workers/transcription.worker";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let io: Server;

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("client connected:", socket.id);
    setupRecordingSockets(io, socket);

    socket.on("disconnect", () => {
      console.log("client disconnected:", socket.id);
    });
  });

  initializeTranscriptionWorker();

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
