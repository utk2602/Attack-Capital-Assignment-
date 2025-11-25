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
    <aside className="w-20 md:w-64 h-full bg-card border-r border-secondary-200 dark:border-secondary-800 flex flex-col justify-between transition-all duration-300 ease-in-out z-20">
      {/* Logo Area */}
      <div className="p-6 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-glow">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden md:block bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">
            ScribeAI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <button
          onClick={() => onTabChange("home")}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
            activeTab === "home"
              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium"
              : "text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:text-secondary-900 dark:hover:text-secondary-100"
          }`}
        >
          <Mic className={`w-5 h-5 ${activeTab === "home" ? "text-primary-600 dark:text-primary-400" : "text-secondary-500 group-hover:text-secondary-700"}`} />
          <span className="hidden md:inline text-sm">Record</span>
        </button>

        <button
          onClick={() => onTabChange("upload")}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
            activeTab === "upload"
              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium"
              : "text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:text-secondary-900 dark:hover:text-secondary-100"
          }`}
        >
          <Upload className={`w-5 h-5 ${activeTab === "upload" ? "text-primary-600 dark:text-primary-400" : "text-secondary-500 group-hover:text-secondary-700"}`} />
          <span className="hidden md:inline text-sm">Upload</span>
        </button>

        <button
          onClick={() => onTabChange("history")}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
            activeTab === "history"
              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium"
              : "text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:text-secondary-900 dark:hover:text-secondary-100"
          }`}
        >
          <History className={`w-5 h-5 ${activeTab === "history" ? "text-primary-600 dark:text-primary-400" : "text-secondary-500 group-hover:text-secondary-700"}`} />
          <span className="hidden md:inline text-sm">History</span>
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-800 space-y-4">
        <div className="flex items-center justify-between md:justify-start gap-3 px-2">
          <RetroThemeToggle />
          <span className="hidden md:inline text-xs font-medium text-secondary-500 uppercase tracking-wider">Theme</span>
        </div>

        <div className="pt-2">
          <div className="hidden md:block text-xs font-medium text-secondary-500 mb-3 truncate px-2">{userEmail}</div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-secondary-50 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300 hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
