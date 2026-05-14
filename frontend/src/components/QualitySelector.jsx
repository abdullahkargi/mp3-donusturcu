const QUALITIES = [
  { value: "128", label: "128 kbps" },
  { value: "192", label: "192 kbps" },
  { value: "320", label: "320 kbps" }
];

export default function QualitySelector({ value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        MP3 kalitesi
      </span>
      <div
        role="radiogroup"
        aria-label="MP3 kalitesi"
        className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {QUALITIES.map((quality) => {
          const selected = value === quality.value;

          return (
            <button
              key={quality.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(quality.value)}
              className={`min-h-11 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-300"
                  : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white"
              }`}
            >
              {quality.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
