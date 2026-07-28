"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const initialDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", initialDark);
    document.documentElement.style.colorScheme = initialDark ? "dark" : "light";
    const frame = window.requestAnimationFrame(() => setDark(initialDark));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button type="button" onClick={toggle} title="Toggle theme" aria-label={`Switch to ${dark ? "light" : "dark"} mode`} aria-pressed={dark} className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
