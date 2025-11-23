import { Socket } from "socket.io";
import { socketLogger } from "../utils/logger";
export class SocketManager {
  private authenticatedUsers: Map<string, string> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); 
  async authenticate(socket: Socket, token?: string): Promise<string | null> {
    try {
      const cookies = socket.handshake.headers.cookie;

      if (!cookies) {
        console.log(`[Auth] No cookies provided for socket ${socket.id}`);
        return null;
      }
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({
        headers: {
          cookie: cookies,
        },
      });

      if (!session?.user?.id) {
        console.log(`[Auth] Invalid session for socket ${socket.id}`);
        return null;
      }

      const userId = session.user.id;
      this.authenticatedUsers.set(socket.id, userId);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      console.log(`[Auth] Socket ${socket.id} authenticated as ${userId}`);

      return userId;
    } catch (error) {
      console.error(`[Auth] Error for socket ${socket.id}:`, error);
      return null;
    }
  }
  getUserId(socketId: string): string | null {
    return this.authenticatedUsers.get(socketId) || null;
  }
  isAuthenticated(socketId: string): boolean {
    return this.authenticatedUsers.has(socketId);
  }
  getUserSockets(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }
  handleDisconnect(socketId: string) {
    const userId = this.authenticatedUsers.get(socketId);

    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socketId);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    this.authenticatedUsers.delete(socketId);

    socketLogger.disconnected(socketId, "cleanup");
  }
  getStats() {
    return {
      totalConnections: this.authenticatedUsers.size,
      totalUsers: this.userSockets.size,
      avgSocketsPerUser:
        this.userSockets.size > 0 ? this.authenticatedUsers.size / this.userSockets.size : 0,
    };
  }
}

export const socketManager = new SocketManager();
