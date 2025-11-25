"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, FileText, Zap, Shield } from "lucide-react";

export function RetroLanding() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary-500/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-glow">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">ScribeAI</span>
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20"
        >
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto mt-10 md:mt-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300 text-sm font-medium mb-8 animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
          </span>
          Now with Gemini 2.5 Flash Integration
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-secondary-500 animate-slide-up">
          Meeting notes, <br />
          <span className="text-primary-600">reimagined by AI.</span>
        </h1>
        
        <p className="text-xl text-secondary-500 max-w-2xl mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          Capture every detail with real-time transcription and intelligent summaries. 
          Focus on the conversation, not the note-taking.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <button
            onClick={() => router.push("/auth")}
            className="px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-1"
          >
            Get Started for Free
          </button>
          <button
            onClick={() => window.open("https://github.com/utk2602/Attack-Capital-Assignment-", "_blank")}
            className="px-8 py-4 bg-white dark:bg-secondary-900 text-foreground border border-secondary-200 dark:border-secondary-800 text-lg font-semibold rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-all"
          >
            View on GitHub
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full text-left animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-secondary-900/50 border border-secondary-200 dark:border-secondary-800 backdrop-blur-sm hover:border-primary-200 dark:hover:border-primary-900 transition-colors">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Speed</h3>
            <p className="text-secondary-500">Live transcription with sub-second latency powered by WebSockets.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-secondary-900/50 border border-secondary-200 dark:border-secondary-800 backdrop-blur-sm hover:border-primary-200 dark:hover:border-primary-900 transition-colors">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Summaries</h3>
            <p className="text-secondary-500">AI-generated executive summaries, action items, and key decisions.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/50 dark:bg-secondary-900/50 border border-secondary-200 dark:border-secondary-800 backdrop-blur-sm hover:border-primary-200 dark:hover:border-primary-900 transition-colors">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-secondary-500">Your data is encrypted and stored securely. You own your recordings.</p>
          </div>
        </div>
      </main>
      
      <footer className="py-8 text-center text-secondary-400 text-sm">
        © 2025 ScribeAI. Built for Attack Capital.
      </footer>
    </div>
  );
}
