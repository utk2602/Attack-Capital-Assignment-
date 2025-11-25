"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, FileText, Zap, Shield } from "lucide-react";

export function RetroLanding() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-retro-bg dark:bg-retro-dark overflow-x-hidden flex flex-col relative font-mono">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000010_1px,transparent_1px),linear-gradient(to_bottom,#00000010_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center z-20 border-b-4 border-black dark:border-white bg-white dark:bg-black sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-retro-primary border-2 border-black animate-pulse"></div>
          <div className="text-2xl md:text-3xl font-black tracking-tighter text-black dark:text-white">
            SCRIBE.AI
          </div>
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="px-6 py-2 bg-retro-accent text-black font-bold border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase"
        >
          Enter System
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center relative z-10 pt-20 pb-20">
        {/* Hero Section */}
        <div className="text-center max-w-5xl px-4 mb-24 relative">
          {/* Decorative shapes */}
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-retro-secondary border-4 border-black shadow-retro rotate-12 hidden md:block"></div>
          <div className="absolute top-1/2 -right-20 w-32 h-32 bg-retro-primary border-4 border-black shadow-retro -rotate-6 rounded-full hidden md:block"></div>

          <div className="inline-block mb-6 px-4 py-2 bg-black text-white dark:bg-white dark:text-black font-bold border-2 border-transparent transform -rotate-2">
            v2.0.0 // NOW LIVE
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-black dark:text-white mb-8 tracking-tighter leading-[0.9] drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] dark:drop-shadow-[6px_6px_0px_rgba(255,255,255,1)]">
            AUDIO <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-retro-primary via-retro-accent to-retro-secondary">
              INTELLIGENCE
            </span>
          </h1>

          <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-300 bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro max-w-2xl mx-auto transform rotate-1 hover:rotate-0 transition-transform duration-300">
            The brutalist audio transcription tool for the modern web. 
            <span className="block mt-2 text-retro-primary">No fluff. Just text.</span>
          </p>

          <div className="mt-12 flex flex-col md:flex-row gap-6 justify-center items-center">
            <button
              onClick={() => router.push("/auth")}
              className="px-8 py-4 bg-black text-white dark:bg-white dark:text-black text-xl font-black border-4 border-transparent hover:border-retro-primary hover:text-retro-primary transition-colors shadow-[8px_8px_0px_0px_#FF6B6B] hover:shadow-[4px_4px_0px_0px_#FF6B6B] hover:translate-x-[4px] hover:translate-y-[4px]"
            >
              START RECORDING_
            </button>
            <a
              href="#features"
              className="px-8 py-4 bg-white dark:bg-black text-black dark:text-white text-xl font-bold border-4 border-black dark:border-white shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              READ DOCS
            </a>
          </div>
        </div>

        {/* Marquee */}
        <div className="w-full bg-retro-accent border-y-4 border-black py-4 overflow-hidden mb-24 transform -rotate-1">
          <div className="animate-marquee whitespace-nowrap flex gap-8 text-2xl font-black text-black uppercase">
            <span>Real-time Transcription</span>
            <span>★</span>
            <span>AI Summaries</span>
            <span>★</span>
            <span>Secure Storage</span>
            <span>★</span>
            <span>Export to JSON/TXT</span>
            <span>★</span>
            <span>Speaker Diarization</span>
            <span>★</span>
            <span>Real-time Transcription</span>
            <span>★</span>
            <span>AI Summaries</span>
            <span>★</span>
            <span>Secure Storage</span>
            <span>★</span>
            <span>Export to JSON/TXT</span>
            <span>★</span>
            <span>Speaker Diarization</span>
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="max-w-6xl px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Mic className="w-8 h-8" />}
            title="Live Recording"
            description="Stream audio directly from your microphone or browser tab with sub-second latency."
            color="bg-retro-primary"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="AI Powered"
            description="Powered by Gemini Flash 2.5 for lightning fast transcription and summarization."
            color="bg-retro-secondary"
          />
          <FeatureCard
            icon={<FileText className="w-8 h-8" />}
            title="Smart Export"
            description="Download your transcripts in multiple formats including JSON, TXT, and SRT."
            color="bg-retro-accent"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-8 border-t-4 border-black dark:border-white bg-white dark:bg-black text-center z-10">
        <p className="font-bold text-black dark:text-white">
          © 2025 SCRIBE.AI // BUILT FOR SPEED
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all group">
      <div className={`w-16 h-16 ${color} border-4 border-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-2xl font-black mb-2 uppercase">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
        {description}
      </p>
    </div>
  );
}
