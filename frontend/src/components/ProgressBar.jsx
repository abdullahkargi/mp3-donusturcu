export default function ProgressBar({ progress }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          Dönüştürülüyor...
        </span>
        <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
