export const API_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

export async function convertLink({ url, quality }) {
  const response = await fetch(`${API_URL}/api/convert-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url, quality })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error ||
        "Dönüştürme başlatılamadı. Lütfen linki kontrol edip tekrar deneyin."
    );
  }

  return payload;
}

export function buildDownloadUrl(downloadPath) {
  if (!downloadPath) return "";
  if (/^https?:\/\//i.test(downloadPath)) return downloadPath;
  return `${API_URL}${downloadPath.startsWith("/") ? "" : "/"}${downloadPath}`;
}
