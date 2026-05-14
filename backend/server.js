import "dotenv/config";

import cors from "cors";
import express from "express";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { constants: youtubeDlConstants } = require("youtube-dl-exec");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const TEMP_DIR = path.join(__dirname, "temp");
const OUTPUT_DIR = path.join(__dirname, "outputs");
const OUTPUT_DIR_RESOLVED = path.resolve(OUTPUT_DIR);
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 500);
const OUTPUT_TTL_MINUTES = Number(process.env.OUTPUT_TTL_MINUTES || 30);
const OUTPUT_TTL_MS = OUTPUT_TTL_MINUTES * 60 * 1000;
const YTDLP_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 10 * 60 * 1000);
const SIZE_LIMIT_MESSAGE =
  "Dosya boyutu çok büyük. Maksimum 500 MB dönüştürebilirsiniz.";
const YOUTUBE_DOMAINS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com"
]);
const ALLOWED_QUALITIES = new Set(["128", "192", "320"]);
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;
const ytdlpPath = process.env.YTDLP_PATH || youtubeDlConstants.YOUTUBE_DL_PATH;

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isPublic = true;
  }
}

await fsp.mkdir(TEMP_DIR, { recursive: true });
await fsp.mkdir(OUTPUT_DIR, { recursive: true });

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError("Bu frontend adresi API tarafından yetkilendirilmemiş.", 403)
      );
    }
  })
);
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "youtube-mp3-backend",
    mode: "youtube-only",
    maxFileSizeMb: MAX_FILE_SIZE_MB
  });
});

app.post("/api/convert-link", async (req, res, next) => {
  let workDir;
  let outputPath;
  let conversionSucceeded = false;

  try {
    const youtubeUrl = validateYouTubeUrl(req.body?.url);
    const quality = validateQuality(req.body?.quality);
    const id = crypto.randomUUID();
    const outputFilename = `converted-${id}.mp3`;

    workDir = path.join(TEMP_DIR, id);
    outputPath = path.join(OUTPUT_DIR, outputFilename);
    await fsp.mkdir(workDir, { recursive: true });

    const producedFile = await downloadYouTubeAudioAsMp3({
      url: youtubeUrl.toString(),
      quality,
      workDir
    });

    await fsp.rename(producedFile, outputPath);
    await assertFileIsReadable(outputPath);

    conversionSucceeded = true;
    scheduleFileRemoval(outputPath, OUTPUT_TTL_MS);

    res.json({
      message: "Dönüştürme tamamlandı",
      filename: outputFilename,
      downloadUrl: `/api/download/${outputFilename}`
    });
  } catch (error) {
    if (!conversionSucceeded && outputPath) {
      await safeRemove(outputPath);
    }
    next(error);
  } finally {
    if (workDir) {
      await safeRemove(workDir);
    }
  }
});

app.get("/api/download/:filename", async (req, res, next) => {
  try {
    const filePath = getSafeOutputPath(req.params.filename);
    await fsp.access(filePath, fs.constants.R_OK);

    res.download(filePath, "youtube-mp3.mp3", (error) => {
      if (!error) {
        scheduleFileRemoval(filePath, 60 * 1000);
      }
    });
  } catch {
    next(new AppError("Dosya bulunamadı veya süresi doldu.", 404));
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Aradığınız API endpoint'i bulunamadı." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || 500;
  const message =
    error.isPublic && error.message
      ? error.message
      : "Dönüştürme sırasında beklenmeyen bir hata oluştu. Lütfen YouTube linkini kontrol edip tekrar deneyin.";

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
});

setInterval(() => {
  cleanupOldFiles(TEMP_DIR, 60 * 60 * 1000);
  cleanupOldFiles(OUTPUT_DIR, OUTPUT_TTL_MS);
}, 15 * 60 * 1000).unref();

cleanupOldFiles(TEMP_DIR, 60 * 60 * 1000);
cleanupOldFiles(OUTPUT_DIR, OUTPUT_TTL_MS);

app.listen(PORT, () => {
  console.log(`Backend çalışıyor: http://localhost:${PORT}`);
});

function validateYouTubeUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new AppError("Lütfen bir YouTube linki girin.", 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new AppError("Link formatı hatalı. Lütfen geçerli bir YouTube URL'si girin.", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new AppError("Sadece http ve https YouTube linkleri desteklenir.", 400);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new AppError("Kullanıcı bilgisi içeren linkler desteklenmez.", 400);
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");
  if (!YOUTUBE_DOMAINS.has(hostname)) {
    throw new AppError("Sadece YouTube video linkleri desteklenir.", 400);
  }

  if (!hasVideoIdentifier(parsedUrl, hostname)) {
    throw new AppError("Lütfen geçerli bir YouTube video linki girin.", 400);
  }

  parsedUrl.hash = "";
  return parsedUrl;
}

function hasVideoIdentifier(parsedUrl, hostname) {
  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    return Boolean(pathParts[0]);
  }

  if (parsedUrl.pathname === "/watch") {
    return Boolean(parsedUrl.searchParams.get("v"));
  }

  if (
    ["shorts", "embed", "live"].includes(pathParts[0]) ||
    hostname.includes("youtube-nocookie.com")
  ) {
    return Boolean(pathParts[1]);
  }

  return false;
}

function validateQuality(rawQuality) {
  const quality = String(rawQuality || "192");
  if (!ALLOWED_QUALITIES.has(quality)) {
    throw new AppError("Geçersiz kalite seçimi. 128, 192 veya 320 kbps seçin.", 400);
  }
  return quality;
}

async function downloadYouTubeAudioAsMp3({ url, quality, workDir }) {
  if (!ffmpegPath) {
    throw new AppError("FFmpeg bulunamadı. Lütfen FFmpeg kurulumunu kontrol edin.", 500);
  }

  if (!ytdlpPath) {
    throw new AppError("yt-dlp bulunamadı. Lütfen bağımlılık kurulumunu kontrol edin.", 500);
  }

  const outputTemplate = path.join(workDir, "audio.%(ext)s");

  try {
    await runYtDlp([
      url,
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      `${quality}K`,
      "--format",
      "bestaudio/best",
      "--output",
      outputTemplate,
      "--no-playlist",
      "--max-filesize",
      `${MAX_FILE_SIZE_MB}M`,
      "--ffmpeg-location",
      ffmpegPath,
      "--restrict-filenames",
      "--windows-filenames",
      "--no-warnings"
    ]);
  } catch (error) {
    throw normalizeYtDlpError(error);
  }

  const mp3Path = await findMp3File(workDir);
  if (!mp3Path) {
    throw new AppError(
      "YouTube videosundan MP3 oluşturulamadı. Lütfen farklı bir video deneyin.",
      400
    );
  }

  return mp3Path;
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args, {
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, YTDLP_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(Object.assign(error, { stdout, stderr }));
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        Object.assign(new Error(stderr || stdout || "yt-dlp failed"), {
          code,
          stdout,
          stderr,
          timedOut
        })
      );
    });
  });
}

function normalizeYtDlpError(error) {
  const details = `${error?.stderr || ""}\n${error?.stdout || ""}\n${error?.message || ""}`;
  const normalized = details.toLowerCase();

  if (
    normalized.includes("larger than max-filesize") ||
    normalized.includes("file is larger") ||
    normalized.includes("max-filesize")
  ) {
    return new AppError(SIZE_LIMIT_MESSAGE, 413);
  }

  if (normalized.includes("ffmpeg") && normalized.includes("not found")) {
    return new AppError("FFmpeg bulunamadı. Lütfen FFmpeg kurulumunu kontrol edin.", 500);
  }

  if (
    normalized.includes("private video") ||
    normalized.includes("members-only") ||
    normalized.includes("sign in") ||
    normalized.includes("age-restricted")
  ) {
    return new AppError(
      "Bu YouTube videosuna erişilemiyor. Herkese açık ve erişilebilir bir video linki deneyin.",
      400
    );
  }

  if (
    normalized.includes("video unavailable") ||
    normalized.includes("this video is unavailable") ||
    normalized.includes("not available")
  ) {
    return new AppError("Bu YouTube videosu şu anda erişilebilir değil.", 400);
  }

  if (normalized.includes("unsupported url")) {
    return new AppError("Sadece geçerli YouTube video linkleri desteklenir.", 400);
  }

  if (
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("killed")
  ) {
    return new AppError(
      "Dönüştürme zaman aşımına uğradı. Daha kısa bir video deneyin.",
      408
    );
  }

  return new AppError(
    "YouTube videosu MP3'e dönüştürülemedi. Lütfen linki kontrol edip tekrar deneyin.",
    400
  );
}

async function findMp3File(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const mp3Entries = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")
  );

  if (mp3Entries.length === 0) {
    return null;
  }

  return path.join(directory, mp3Entries[0].name);
}

async function assertFileIsReadable(filePath) {
  const stats = await fsp.stat(filePath);
  if (!stats.isFile() || stats.size === 0) {
    throw new AppError("MP3 dosyası oluşturulamadı. Lütfen tekrar deneyin.", 400);
  }
}

function getSafeOutputPath(filename) {
  if (!/^converted-[0-9a-f-]{36}\.mp3$/i.test(filename)) {
    throw new AppError("Geçersiz dosya adı.", 400);
  }

  const filePath = path.resolve(OUTPUT_DIR, filename);
  if (path.dirname(filePath) !== OUTPUT_DIR_RESOLVED) {
    throw new AppError("Geçersiz dosya yolu.", 400);
  }

  return filePath;
}

function scheduleFileRemoval(filePath, delayMs) {
  setTimeout(() => {
    safeRemove(filePath);
  }, delayMs).unref();
}

async function safeRemove(filePath) {
  try {
    await fsp.rm(filePath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

async function cleanupOldFiles(directory, maxAgeMs) {
  try {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    const now = Date.now();

    await Promise.all(
      entries
        .filter((entry) => entry.name !== ".gitkeep")
        .map(async (entry) => {
          const filePath = path.join(directory, entry.name);
          const stats = await fsp.stat(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await safeRemove(filePath);
          }
        })
    );
  } catch {
    // Cleanup failures should never block conversion.
  }
}
