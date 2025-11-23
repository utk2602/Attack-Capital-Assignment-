"use client";

import { Home, History, Settings, LogOut, Mic, Upload } from "lucide-react";
import { RetroThemeToggle } from "./RetroThemeToggle";
import { signOut } from "@/lib/authClient";

interface RetroSidebarProps {
  activeTab: "home" | "history" | "upload";
  onTabChange: (tab: "home" | "history" | "upload") => void;
  userEmail?: string;
}

export function RetroSidebar({ activeTab, onTabChange, userEmail }: RetroSidebarProps) {
  return (
    <aside className="w-20 md:w-64 h-full bg-white dark:bg-black border-r-4 border-black dark:border-white flex flex-col justify-between p-4 transition-all">
      {/* Logo Area */}
      <div className="mb-8 hidden md:block">
        <div className="text-2xl font-black text-black dark:text-white bg-retro-accent p-2 border-4 border-black shadow-retro text-center">
          SCRIBE
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4">
        <button
          onClick={() => onTabChange("home")}
          className={`w-full flex items-center gap-3 p-3 font-bold border-4 border-black transition-all ${
            activeTab === "home"
              ? "bg-retro-primary text-black shadow-retro translate-x-[-2px] translate-y-[-2px]"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <Mic className="w-6 h-6" />
          <span className="hidden md:inline">Record</span>
        </button>

        <button
          onClick={() => onTabChange("upload")}
          className={`w-full flex items-center gap-3 p-3 font-bold border-4 border-black transition-all ${
            activeTab === "upload"
              ? "bg-retro-secondary text-black shadow-retro translate-x-[-2px] translate-y-[-2px]"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <Upload className="w-6 h-6" />
          <span className="hidden md:inline">Upload</span>
        </button>

        <button
          onClick={() => onTabChange("history")}
          className={`w-full flex items-center gap-3 p-3 font-bold border-4 border-black transition-all ${
            activeTab === "history"
              ? "bg-retro-secondary text-black shadow-retro translate-x-[-2px] translate-y-[-2px]"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <History className="w-6 h-6" />
          <span className="hidden md:inline">History</span>
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="space-y-4">
        <div className="flex items-center justify-center md:justify-start gap-3 p-2 border-4 border-black dark:border-white bg-retro-bg dark:bg-gray-900">
          <RetroThemeToggle />
          <span className="hidden md:inline font-bold text-xs uppercase">Theme</span>
        </div>

        <div className="pt-4 border-t-4 border-black dark:border-white">
          <div className="hidden md:block text-xs font-bold mb-2 truncate px-1">{userEmail}</div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 p-2 bg-red-500 text-white font-bold border-4 border-black shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
