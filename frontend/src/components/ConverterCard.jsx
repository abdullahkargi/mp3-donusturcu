import {
  AlertCircle,
  CheckCircle2,
  Download,
  Link2,
  Loader2,
  Music2
} from "lucide-react";
import QualitySelector from "./QualitySelector.jsx";
import ProgressBar from "./ProgressBar.jsx";

const LINK_TYPES = ["youtube.com/watch", "youtu.be", "Shorts", "Live video"];

export default function ConverterCard({
  url,
  quality,
  status,
  progress,
  error,
  downloadUrl,
  onUrlChange,
  onQualityChange,
  onSubmit
}) {
  const isConverting = status === "converting";
  const isDone = status === "done" && downloadUrl;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            YouTube linki
          </span>
          <div className="relative">
            <Link2
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="url"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              disabled={isConverting}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-14 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-12 pr-4 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-zinc-950"
            />
          </div>
        </label>

        <QualitySelector
          value={quality}
          onChange={onQualityChange}
          disabled={isConverting}
        />

        <button
          type="submit"
          disabled={isConverting}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-base font-bold text-white shadow-lg shadow-zinc-950/15 transition hover:-translate-y-0.5 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-zinc-400 disabled:shadow-none dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {isConverting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Dönüştürülüyor...
            </>
          ) : (
            <>
              <Music2 size={20} />
              Dönüştür
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        {LINK_TYPES.map((format) => (
          <span
            key={format}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
          >
            {format}
          </span>
        ))}
      </div>

      {isConverting && (
        <div className="mt-5">
          <ProgressBar progress={progress} />
        </div>
      )}

      {isDone && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="mt-0.5 flex-none" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-semibold">Dönüştürme tamamlandı</p>
              <a
                href={downloadUrl}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
              >
                <Download size={18} />
                MP3 İndir
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="mt-0.5 flex-none" />
            <p className="text-sm font-medium leading-6">{error}</p>
          </div>
        </div>
      )}
    </section>
  );
}
