"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/authClient";
export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp.email({
          email,
          password,
          name,
        });
      } else {
        await signIn.email({
          email,
          password,
        });
      }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-retro-bg dark:bg-retro-dark p-4">
      <div className="bg-white dark:bg-gray-900 p-8 border-4 border-black dark:border-white shadow-retro w-full max-w-md relative">
        {/* Decorative elements */}
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-retro-accent border-4 border-black"></div>
        <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-retro-primary border-4 border-black"></div>

        <h1 className="text-4xl font-black text-center mb-2 uppercase tracking-tighter">
          ScribeAI
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8 font-bold border-b-4 border-black dark:border-white pb-4">
          {isSignUp ? "JOIN THE REVOLUTION" : "ACCESS TERMINAL"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-1 uppercase">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-4 border-black dark:border-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:bg-retro-secondary/20 transition-colors font-mono"
                required={isSignUp}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-bold mb-1 uppercase">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-4 border-black dark:border-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:bg-retro-secondary/20 transition-colors font-mono"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold mb-1 uppercase">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-4 border-black dark:border-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:bg-retro-secondary/20 transition-colors font-mono"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-100 border-4 border-red-500 text-red-900 px-4 py-2 font-bold text-sm">
              ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-retro-primary text-black font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "PROCESSING..." : isSignUp ? "CREATE ACCOUNT" : "ENTER SYSTEM"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold underline decoration-4 decoration-retro-accent hover:decoration-retro-primary transition-all"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
