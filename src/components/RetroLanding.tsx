"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function RetroLanding() {
  const router = useRouter();

  return (
    <div className="h-screen w-screen bg-retro-bg dark:bg-retro-dark overflow-hidden flex flex-col relative">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="text-3xl font-black tracking-tighter text-black dark:text-white border-4 border-black dark:border-white p-2 bg-retro-accent shadow-retro">
          SCRIBE.AI
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="px-6 py-3 bg-retro-primary text-black font-bold border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          SIGN IN
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center relative">
        {/* Background Elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-retro-secondary border-4 border-black shadow-retro rotate-12 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-retro-primary border-4 border-black shadow-retro -rotate-6 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-black dark:bg-white rounded-full animate-ping"></div>

        {/* Hero Content */}
        <div className="text-center z-10 max-w-4xl px-4">
          <h1 className="text-7xl md:text-9xl font-black text-black dark:text-white mb-8 tracking-tighter leading-none drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:drop-shadow-[4px_4px_0px_rgba(255,255,255,1)]">
            AUDIO <br />
            <span className="text-retro-secondary">SCRIBING</span> <br />
            REIMAGINED
          </h1>
          <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-300 bg-white dark:bg-black border-4 border-black dark:border-white p-6 shadow-retro inline-block rotate-1">
            Real-time transcription. AI Summaries. Retro Style.
          </p>
        </div>
      </main>
    </div>
  );
}
