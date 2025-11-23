"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function RetroThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative w-16 h-8 bg-retro-border dark:bg-white rounded-none border-2 border-black transition-colors duration-200 ease-in-out focus:outline-none shadow-retro active:shadow-retro-hover active:translate-x-[2px] active:translate-y-[2px]"
    >
      <div
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-retro-accent border-2 border-black transition-transform duration-200 ease-in-out flex items-center justify-center ${
          isDark ? "translate-x-8" : "translate-x-0"
        }`}
      >
        {isDark ? <Moon className="w-4 h-4 text-black" /> : <Sun className="w-4 h-4 text-black" />}
      </div>
    </button>
  );
}
