import "dotenv/config";

import cors from "cors";
import dns from "node:dns";
import express from "express";
import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ipaddr from "ipaddr.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const TEMP_DIR = path.join(__dirname, "temp");
const OUTPUT_DIR = path.join(__dirname, "outputs");
const OUTPUT_DIR_RESOLVED = path.resolve(OUTPUT_DIR);
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 500);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const OUTPUT_TTL_MINUTES = Number(process.env.OUTPUT_TTL_MINUTES || 30);
const OUTPUT_TTL_MS = OUTPUT_TTL_MINUTES * 60 * 1000;
const MAX_REDIRECTS = 5;

const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".wav",
  ".m4a",
  ".aac",
  ".flac"
]);
const ALLOWED_QUALITIES = new Set(["128", "192", "320"]);
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".test",
  ".invalid"
];
const SIZE_LIMIT_MESSAGE =
  "Dosya boyutu çok büyük. Maksimum 500 MB dönüştürebilirsiniz.";

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

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
    service: "linkten-mp3-backend",
    maxFileSizeMb: MAX_FILE_SIZE_MB
  });
});

app.post("/api/convert-link", async (req, res, next) => {
  let inputPath;
  let outputPath;
  let conversionSucceeded = false;

  try {
    const mediaUrl = validateIncomingUrl(req.body?.url);
    const quality = validateQuality(req.body?.quality);
    const inputExtension = getUrlExtension(mediaUrl);
    const id = crypto.randomUUID();
    const outputFilename = `converted-${id}.mp3`;

    inputPath = path.join(TEMP_DIR, `${id}${inputExtension}`);
    outputPath = path.join(OUTPUT_DIR, outputFilename);

    await downloadToFile(mediaUrl, inputPath);
    await convertToMp3(inputPath, outputPath, quality);

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
    if (inputPath) {
      await safeRemove(inputPath);
    }
  }
});

app.get("/api/download/:filename", async (req, res, next) => {
  try {
    const filePath = getSafeOutputPath(req.params.filename);
    await fsp.access(filePath, fs.constants.R_OK);

    res.download(filePath, "donusturulen-ses.mp3", (error) => {
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
      : "Dönüştürme sırasında beklenmeyen bir hata oluştu. Lütfen linki kontrol edip tekrar deneyin.";

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

function validateIncomingUrl(rawUrl) {
  const mediaUrl = parseHttpUrl(rawUrl);
  assertAllowedHost(mediaUrl);

  if (!ALLOWED_EXTENSIONS.has(getUrlExtension(mediaUrl))) {
    throw new AppError(
      "Desteklenmeyen link. Lütfen doğrudan .mp4, .mov, .webm, .mkv, .avi, .wav, .m4a, .aac veya .flac medya dosyası linki girin.",
      400
    );
  }

  return mediaUrl;
}

function parseHttpUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new AppError("Lütfen bir medya linki girin.", 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new AppError("Link formatı hatalı. Lütfen geçerli bir URL girin.", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new AppError("Sadece http ve https linkleri desteklenir.", 400);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new AppError("Kullanıcı bilgisi içeren linkler desteklenmez.", 400);
  }

  return parsedUrl;
}

function validateRedirectUrl(rawUrl, baseUrl) {
  const redirectedUrl = new URL(rawUrl, baseUrl);
  const parsedUrl = parseHttpUrl(redirectedUrl.toString());
  assertAllowedHost(parsedUrl);
  return parsedUrl;
}

function validateQuality(rawQuality) {
  const quality = String(rawQuality || "192");
  if (!ALLOWED_QUALITIES.has(quality)) {
    throw new AppError("Geçersiz kalite seçimi. 128, 192 veya 320 kbps seçin.", 400);
  }
  return quality;
}

function getUrlExtension(mediaUrl) {
  return path.posix.extname(mediaUrl.pathname).toLowerCase();
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function assertAllowedHost(mediaUrl) {
  const hostname = normalizeHostname(mediaUrl.hostname);

  if (!hostname) {
    throw new AppError("Linkte geçerli bir alan adı bulunamadı.", 400);
  }

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
    )
  ) {
    throw new AppError("Güvenlik nedeniyle local veya internal adresler desteklenmez.", 400);
  }

  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    throw new AppError("Güvenlik nedeniyle private IP adresleri desteklenmez.", 400);
  }
}

function isBlockedIp(address) {
  try {
    const parsedAddress = ipaddr.parse(address);
    if (parsedAddress.kind() === "ipv6" && parsedAddress.isIPv4MappedAddress()) {
      return isBlockedIp(parsedAddress.toIPv4Address().toString());
    }

    return [
      "unspecified",
      "broadcast",
      "multicast",
      "linkLocal",
      "loopback",
      "private",
      "uniqueLocal",
      "carrierGradeNat",
      "reserved",
      "benchmarking"
    ].includes(parsedAddress.range());
  } catch {
    return true;
  }
}

function safeLookup(hostname, options, callback) {
  const wantsAll = typeof options === "object" && options.all;
  const lookupOptions = {
    family: typeof options === "object" && options.family ? options.family : 0,
    hints: typeof options === "object" ? options.hints || 0 : 0,
    all: true
  };

  dns.lookup(hostname, lookupOptions, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }

    const publicAddresses = addresses.filter(({ address }) => !isBlockedIp(address));
    if (publicAddresses.length === 0) {
      callback(new Error("PRIVATE_NETWORK_BLOCKED"));
      return;
    }

    if (wantsAll) {
      callback(null, publicAddresses);
      return;
    }

    const [firstAddress] = publicAddresses;
    callback(null, firstAddress.address, firstAddress.family);
  });
}

const httpAgent = new http.Agent({ lookup: safeLookup });
const httpsAgent = new https.Agent({ lookup: safeLookup });

async function downloadToFile(mediaUrl, destinationPath, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new AppError("Medya linki çok fazla yönlendirme yapıyor.", 400);
  }

  const transport = mediaUrl.protocol === "https:" ? https : http;
  const agent = mediaUrl.protocol === "https:" ? httpsAgent : httpAgent;

  return new Promise((resolve, reject) => {
    let settled = false;
    let outputStream;
    let activeResponse;

    const fail = async (error) => {
      if (settled) return;
      settled = true;
      request.destroy();
      if (activeResponse) {
        activeResponse.destroy();
      }
      if (outputStream) {
        outputStream.destroy();
      }
      await safeRemove(destinationPath);
      reject(normalizeDownloadError(error));
    };

    const request = transport.request(
      mediaUrl,
      {
        method: "GET",
        agent,
        headers: {
          Accept: "video/*, audio/*, application/octet-stream, */*",
          "User-Agent": "LinktenMP3Donusturucu/1.0"
        }
      },
      (response) => {
        activeResponse = response;
        const statusCode = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          response.resume();
          const location = response.headers.location;
          if (!location) {
            fail(new AppError("Medya linki geçersiz bir yönlendirme döndürdü.", 400));
            return;
          }

          let redirectedUrl;
          try {
            redirectedUrl = validateRedirectUrl(location, mediaUrl);
          } catch (error) {
            fail(error);
            return;
          }

          downloadToFile(redirectedUrl, destinationPath, redirectCount + 1)
            .then((result) => {
              if (settled) return;
              settled = true;
              resolve(result);
            })
            .catch(fail);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          fail(
            new AppError(
              "Medya linkine erişilemedi. Linkin doğrudan indirilebilir olduğundan emin olun.",
              400
            )
          );
          return;
        }

        const contentLength = Number(response.headers["content-length"] || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
          response.resume();
          fail(new AppError(SIZE_LIMIT_MESSAGE, 413));
          return;
        }

        const contentType = String(response.headers["content-type"] || "").toLowerCase();
        if (contentType.includes("text/html")) {
          response.resume();
          fail(
            new AppError(
              "Bu link doğrudan medya dosyası gibi görünmüyor. Lütfen desteklenen dosya uzantılarından birini kullanın.",
              400
            )
          );
          return;
        }

        let downloadedBytes = 0;
        outputStream = fs.createWriteStream(destinationPath, { flags: "wx" });

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_FILE_SIZE_BYTES) {
            fail(new AppError(SIZE_LIMIT_MESSAGE, 413));
          }
        });

        response.on("error", fail);
        outputStream.on("error", fail);
        outputStream.on("finish", () => {
          if (settled) return;
          settled = true;
          resolve({ bytes: downloadedBytes, contentType });
        });

        response.pipe(outputStream);
      }
    );

    request.setTimeout(45 * 1000, () => {
      request.destroy(new AppError("Medya linkinden zamanında yanıt alınamadı.", 408));
    });

    request.on("error", fail);
    request.end();
  });
}

function normalizeDownloadError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.message === "PRIVATE_NETWORK_BLOCKED") {
    return new AppError("Güvenlik nedeniyle private IP adresleri desteklenmez.", 400);
  }

  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET"].includes(error?.code)) {
    return new AppError(
      "Linke ulaşılamadı. Lütfen adresi kontrol edip tekrar deneyin.",
      400
    );
  }

  return new AppError(
    "Medya dosyası indirilemedi. Linkin doğrudan indirilebilir olduğundan emin olun.",
    400
  );
}

function convertToMp3(inputPath, outputPath, quality) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioBitrate(`${quality}k`)
      .audioChannels(2)
      .audioFrequency(44100)
      .format("mp3")
      .outputOptions(["-map_metadata", "-1"])
      .on("end", resolve)
      .on("error", (error) => {
        reject(normalizeFfmpegError(error));
      })
      .save(outputPath);
  });
}

function normalizeFfmpegError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("cannot find ffmpeg")) {
    return new AppError(
      "FFmpeg bulunamadı. Lütfen FFmpeg kurulumunu kontrol edin.",
      500
    );
  }

  if (
    message.includes("does not contain any stream") ||
    message.includes("audio") ||
    message.includes("invalid data")
  ) {
    return new AppError(
      "Bu medya dosyasında MP3'e dönüştürülebilir ses bulunamadı.",
      400
    );
  }

  return new AppError(
    "Medya dosyası MP3'e dönüştürülemedi. Lütfen farklı bir link deneyin.",
    400
  );
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
    await fsp.rm(filePath, { force: true });
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
        .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
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
