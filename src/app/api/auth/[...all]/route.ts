/**
 * Better Auth API Route Handler
 * Handles all auth endpoints: /api/auth/*
 */
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
