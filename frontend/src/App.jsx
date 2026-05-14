import { useEffect, useMemo, useState } from "react";
import ConverterCard from "./components/ConverterCard.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { buildDownloadUrl, convertLink } from "./lib/api.js";

const PROGRESS_STEP_MS = 650;

export default function App() {
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) return storedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("192");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [downloadPath, setDownloadPath] = useState("");

  const downloadUrl = useMemo(() => buildDownloadUrl(downloadPath), [downloadPath]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (status !== "converting") return undefined;

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current < 55) return current + 8;
        if (current < 82) return current + 4;
        if (current < 94) return current + 1.5;
        return current;
      });
    }, PROGRESS_STEP_MS);

    return () => window.clearInterval(timer);
  }, [status]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!url.trim()) {
      setError("Lütfen bir medya linki girin.");
      setStatus("idle");
      setProgress(0);
      setDownloadPath("");
      return;
    }

    setError("");
    setDownloadPath("");
    setStatus("converting");
    setProgress(8);

    try {
      const result = await convertLink({ url: url.trim(), quality });
      setProgress(100);
      setDownloadPath(result.downloadUrl);
      setStatus("done");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("idle");
      setProgress(0);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7f5] px-4 py-8 text-zinc-950 sm:px-6 dark:bg-[#111111] dark:text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.18]">
        <div className="h-full w-full bg-[linear-gradient(rgba(24,24,27,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.08)_1px,transparent_1px)] bg-[size:46px_46px] dark:bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center">
        <div className="mb-5 flex justify-end">
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        </div>

        <header className="mb-6 text-center">
          <p className="mb-3 text-sm font-bold uppercase text-emerald-700 dark:text-emerald-300">
            Reklamsız MP3 aracı
          </p>
          <h1 className="text-4xl font-black leading-tight text-zinc-950 sm:text-5xl dark:text-white">
            Hızlı Linkten MP3 Dönüştürücü
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            Doğrudan medya dosyası linklerini saniyeler içinde MP3'e çevir.
          </p>
        </header>

        <ConverterCard
          url={url}
          quality={quality}
          status={status}
          progress={progress}
          error={error}
          downloadUrl={downloadUrl}
          onUrlChange={setUrl}
          onQualityChange={setQuality}
          onSubmit={handleSubmit}
        />

        <div className="mt-5 grid gap-3 text-sm text-zinc-600 sm:grid-cols-3 dark:text-zinc-400">
          <div className="rounded-lg border border-zinc-200 bg-white/75 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
            500 MB limit
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white/75 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
            128 / 192 / 320 kbps
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white/75 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
            Geçici dosya temizliği
          </div>
        </div>
      </div>
    </main>
  );
}
