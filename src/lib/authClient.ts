/**
 * Better Auth Client
 * Use this in client components
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
