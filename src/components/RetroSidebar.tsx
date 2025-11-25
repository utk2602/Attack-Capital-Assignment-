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
    <aside className="w-20 md:w-64 h-full bg-white dark:bg-black border-r-4 border-black dark:border-white flex flex-col justify-between p-4 transition-all z-20 relative">
      {/* Logo Area */}
      <div className="mb-8 hidden md:block">
        <div className="text-2xl font-black text-black dark:text-white bg-retro-accent p-2 border-4 border-black shadow-retro text-center transform hover:-rotate-1 transition-transform cursor-default">
          SCRIBE
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4">
        <NavButton
          active={activeTab === "home"}
          onClick={() => onTabChange("home")}
          icon={<Mic className="w-6 h-6" />}
          label="Record"
          color="bg-retro-primary"
        />

        <NavButton
          active={activeTab === "upload"}
          onClick={() => onTabChange("upload")}
          icon={<Upload className="w-6 h-6" />}
          label="Upload"
          color="bg-retro-secondary"
        />

        <NavButton
          active={activeTab === "history"}
          onClick={() => onTabChange("history")}
          icon={<History className="w-6 h-6" />}
          label="History"
          color="bg-retro-accent"
        />
      </nav>

      {/* Footer Actions */}
      <div className="space-y-4 pt-4 border-t-4 border-black dark:border-white">
        <div className="flex justify-center md:justify-start">
          <RetroThemeToggle />
        </div>

        {userEmail && (
          <div className="hidden md:block text-xs font-bold truncate px-2 py-1 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600">
            {userEmail}
          </div>
        )}

        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 p-3 font-bold border-4 border-black bg-red-500 text-white hover:bg-red-600 shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          <LogOut className="w-6 h-6" />
          <span className="hidden md:inline">LOGOUT</span>
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 font-bold border-4 border-black transition-all ${
        active
          ? `${color} text-black shadow-retro translate-x-[-2px] translate-y-[-2px]`
          : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-retro"
      }`}
    >
      {icon}
      <span className="hidden md:inline uppercase tracking-wider">{label}</span>
    </button>
  );
}
