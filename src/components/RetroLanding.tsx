"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, FileText, Zap, Shield, Check, Star, ChevronDown, ArrowRight } from "lucide-react";
import { useState } from "react";

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
      <main className="flex-1 flex flex-col items-center relative z-10 pt-20 pb-20 w-full">
        {/* Hero Section */}
        <div className="text-center max-w-5xl px-4 mb-24 relative w-full">
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

        {/* Trusted By Marquee */}
        <div className="w-full border-y-4 border-black bg-white dark:bg-black py-8 mb-24 overflow-hidden">
          <p className="text-center font-bold mb-4 uppercase tracking-widest text-gray-500">Trusted by industry leaders</p>
          <div className="flex justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500 flex-wrap px-4">
             {["ACME CORP", "GLOBEX", "SOYLENT", "UMBRELLA", "CYBERDYNE"].map((company) => (
               <span key={company} className="text-2xl md:text-4xl font-black text-black dark:text-white">{company}</span>
             ))}
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
        <div
          id="features"
          className="max-w-6xl px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32"
        >
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

        {/* Testimonials */}
        <div className="w-full max-w-6xl px-4 mb-32">
          <h2 className="text-4xl md:text-6xl font-black text-center mb-16 uppercase tracking-tighter">
            What People Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="This tool literally saved my career. The transcription is faster than I can think."
              author="Sarah Connor"
              role="Resistance Leader"
              color="bg-retro-primary"
            />
            <TestimonialCard 
              quote="I've used every tool on the market. Scribe is the only one that doesn't suck."
              author="Rick Deckard"
              role="Blade Runner"
              color="bg-retro-secondary"
            />
            <TestimonialCard 
              quote="Simple. Fast. Brutal. Exactly what I needed for my classified meetings."
              author="Fox Mulder"
              role="FBI Agent"
              color="bg-retro-accent"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="w-full max-w-6xl px-4 mb-32">
          <h2 className="text-4xl md:text-6xl font-black text-center mb-16 uppercase tracking-tighter">
            Simple Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <PricingCard 
              title="Starter"
              price="$0"
              features={["5 Hours/mo", "Basic Export", "7 Day Retention"]}
              color="bg-white dark:bg-gray-900"
            />
            <PricingCard 
              title="Pro"
              price="$29"
              features={["Unlimited Hours", "All Export Formats", "Forever Retention", "Priority Support"]}
              color="bg-retro-accent"
              highlighted
            />
            <PricingCard 
              title="Enterprise"
              price="Custom"
              features={["SSO", "Audit Logs", "Dedicated Instance", "SLA"]}
              color="bg-white dark:bg-gray-900"
            />
          </div>
        </div>

        {/* FAQ */}
        <div className="w-full max-w-3xl px-4 mb-32">
          <h2 className="text-4xl md:text-6xl font-black text-center mb-16 uppercase tracking-tighter">
            FAQ
          </h2>
          <div className="space-y-4">
            <FAQItem question="Is my data secure?" answer="Yes. We use military-grade encryption and delete processed audio immediately after transcription." />
            <FAQItem question="Can I export to Notion?" answer="Currently we support Markdown which can be pasted directly into Notion. Direct integration coming soon." />
            <FAQItem question="How accurate is it?" answer="We use the latest Gemini models which typically achieve 98%+ accuracy on clear audio." />
          </div>
        </div>

        {/* CTA */}
        <div className="w-full max-w-4xl px-4 mb-20">
          <div className="bg-retro-primary border-4 border-black p-8 md:p-16 text-center shadow-retro relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20"></div>
            <h2 className="text-4xl md:text-6xl font-black text-black mb-8 uppercase relative z-10">
              Ready to transcribe?
            </h2>
            <button
              onClick={() => router.push("/auth")}
              className="px-12 py-6 bg-black text-white text-2xl font-black border-4 border-white hover:scale-105 transition-transform shadow-[8px_8px_0px_0px_#ffffff] relative z-10"
            >
              GET STARTED NOW
            </button>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full p-8 border-t-4 border-black dark:border-white bg-white dark:bg-black text-center z-10">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-6xl mx-auto gap-4">
          <div className="text-2xl font-black">SCRIBE.AI</div>
          <div className="flex gap-6 font-bold underline decoration-2 underline-offset-4">
            <a href="#" className="hover:text-retro-primary">Twitter</a>
            <a href="#" className="hover:text-retro-primary">GitHub</a>
            <a href="#" className="hover:text-retro-primary">Discord</a>
          </div>
          <p className="font-bold text-gray-500">© 2025 SCRIBE.AI</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all group h-full flex flex-col">
      <div
        className={`w-16 h-16 ${color} border-4 border-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-black mb-2 uppercase">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed flex-1">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role, color }: { quote: string; author: string; role: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro relative">
      <div className={`absolute -top-4 -left-4 w-8 h-8 ${color} border-4 border-black`}></div>
      <div className="mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="w-5 h-5 inline-block fill-black dark:fill-white" />
        ))}
      </div>
      <p className="text-lg font-bold mb-6 italic">"{quote}"</p>
      <div>
        <div className="font-black uppercase">{author}</div>
        <div className="text-sm font-mono text-gray-500">{role}</div>
      </div>
    </div>
  );
}

function PricingCard({ title, price, features, color, highlighted = false }: { title: string; price: string; features: string[]; color: string; highlighted?: boolean }) {
  return (
    <div className={`${color} border-4 border-black dark:border-white p-8 shadow-retro flex flex-col ${highlighted ? 'transform scale-105 z-10' : ''}`}>
      {highlighted && (
        <div className="bg-black text-white text-center font-bold py-1 mb-4 uppercase text-sm">
          Most Popular
        </div>
      )}
      <h3 className="text-2xl font-black uppercase mb-2">{title}</h3>
      <div className="text-5xl font-black mb-8">{price}<span className="text-lg font-normal text-gray-500">/mo</span></div>
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 font-bold">
            <Check className="w-5 h-5" /> {feature}
          </li>
        ))}
      </ul>
      <button className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-black border-2 border-transparent hover:opacity-80 transition-opacity uppercase">
        Choose Plan
      </button>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-4 border-black dark:border-white bg-white dark:bg-gray-900 shadow-retro">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex justify-between items-center font-black text-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {question}
        <ChevronDown className={`w-6 h-6 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t-2 border-black dark:border-gray-700 font-medium text-gray-600 dark:text-gray-300">
          {answer}
        </div>
      )}
    </div>
  );
}
