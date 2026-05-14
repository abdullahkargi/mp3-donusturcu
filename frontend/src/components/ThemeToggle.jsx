import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-500/60 dark:hover:text-emerald-300"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
