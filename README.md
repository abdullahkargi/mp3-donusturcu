# Hızlı Linkten MP3 Dönüştürücü

Reklamsız, hızlı ve sade bir linkten MP3 dönüştürücü web uygulaması. Kullanıcı doğrudan erişilebilir bir medya dosyası linki girer, backend dosyayı geçici olarak indirir, FFmpeg ile MP3'e çevirir ve indirme linki üretir.

> Bu proje YouTube, Instagram veya TikTok sayfa linklerini çözmez. Linkin doğrudan indirilebilir medya dosyası olması gerekir. Örnek: `https://site.com/video.mp4`

## Özellikler

- React + Vite + Tailwind CSS frontend
- Node.js + Express backend
- FFmpeg ile MP3 dönüştürme
- 128, 192 ve 320 kbps kalite seçimi
- Sadece link ile kullanım, dosya yükleme alanı yok
- Maksimum 500 MB dosya limiti
- Koyu/açık tema
- Mobil uyumlu arayüz
- Kullanıcı dostu hata mesajları
- CORS ayarı environment variable ile yapılır
- Localhost, private IP ve internal network adresleri engellenir
- Geçici indirilen dosyalar ve çıktı MP3 dosyaları otomatik temizlenir

## Desteklenen Link Formatları

Backend yalnızca şu uzantılara sahip doğrudan medya linklerini kabul eder:

`.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`, `.wav`, `.m4a`, `.aac`, `.flac`

## Proje Yapısı

```text
project-root/
  frontend/
    src/
      components/
      lib/
      App.jsx
      main.jsx
      index.css
    package.json
    .env.example
  backend/
    temp/
    outputs/
    server.js
    package.json
    .env.example
  package.json
  README.md
```

## Local Kurulum

Kök klasörde tüm bağımlılıkları tek seferde kurabilirsiniz:

```bash
npm install
```

Sonra frontend ve backend'i birlikte başlatın:

```bash
npm run dev
```

Adresler:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

## Ayrı Ayrı Çalıştırma

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## FFmpeg Kurulumu

Backend MP3 dönüştürme için FFmpeg kullanır.

Windows için FFmpeg kurulumu:

```bash
winget install Gyan.FFmpeg
```

Kurulumu kontrol etmek için:

```bash
ffmpeg -version
```

Projede `ffmpeg-static` bağımlılığı da vardır. Yine de local geliştirmede sistem FFmpeg kurulumu en sorunsuz yoldur. Özel bir FFmpeg binary kullanmak isterseniz backend `.env` dosyasında `FFMPEG_PATH` verebilirsiniz.

`yt-dlp` bu projede gerekli değildir çünkü platformlardan sayfa linki çözme yapılmıyor; yalnızca doğrudan medya dosyası linkleri dönüştürülüyor.

## Environment Variables

Frontend için `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:4000
```

Kod içinde API adresi şu mantıkla alınır:

```js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
```

Backend için `backend/.env.example`:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
MAX_FILE_SIZE_MB=500
OUTPUT_TTL_MINUTES=30
```

Production'da `FRONTEND_URL` içine Vercel frontend adresinizi yazın. Birden fazla origin gerekiyorsa virgülle ayırabilirsiniz:

```env
FRONTEND_URL=https://frontend-linkim.vercel.app,http://localhost:5173
```

## API Endpointleri

### `GET /api/health`

Backend'in çalışıp çalışmadığını kontrol eder.

### `POST /api/convert-link`

Body:

```json
{
  "url": "https://site.com/video.mp4",
  "quality": "192"
}
```

Başarılı cevap:

```json
{
  "message": "Dönüştürme tamamlandı",
  "filename": "converted-uuid.mp3",
  "downloadUrl": "/api/download/converted-uuid.mp3"
}
```

### `GET /api/download/:filename`

Oluşan MP3 dosyasını indirir.

## Vercel Deploy

Frontend Vercel'e deploy edilir.

1. Vercel'de yeni proje oluşturun.
2. Root Directory olarak `frontend` seçin.
3. Build Command:

```bash
npm run build
```

4. Output Directory:

```text
dist
```

5. Environment Variable ekleyin:

```env
VITE_API_URL=https://backend-linkim.onrender.com
```

6. Deploy edin.

## Render Deploy

Backend Render'da Web Service olarak çalışır.

1. Render'da New Web Service oluşturun.
2. Root Directory olarak `backend` seçin.
3. Build Command:

```bash
npm install
```

4. Start Command:

```bash
npm start
```

5. Environment Variable ekleyin:

```env
FRONTEND_URL=https://frontend-linkim.vercel.app
```

Backend `package.json` içindeki start script:

```json
"start": "node server.js"
```

Render ücretsiz planında servis uykuya geçebilir; ilk istek bu yüzden birkaç saniye gecikebilir.

## Arkadaşa Verilecek Link Mantığı

Arkadaşınıza Vercel frontend linkini verin:

```text
https://frontend-linkim.vercel.app
```

Frontend, `VITE_API_URL` ile Render backend'e istek atar. Backend tarafında `FRONTEND_URL` Vercel adresiniz olduğu için CORS izinleri doğru çalışır. Arkadaşınız Render backend linkini ayrıca kullanmak zorunda değildir.

## Sık Karşılaşılan Hatalar

### "Desteklenmeyen link"

Girilen URL doğrudan medya dosyası değildir veya desteklenen uzantılardan biriyle bitmiyordur. Sayfa linki yerine doğrudan `.mp4`, `.m4a`, `.flac` gibi dosya linki kullanın.

### "Dosya boyutu çok büyük"

Dosya 500 MB limitini aşıyordur. Daha küçük bir medya dosyası kullanın.

### "Güvenlik nedeniyle private IP adresleri desteklenmez"

Localhost, `127.0.0.1`, private IP veya internal network adresleri güvenlik nedeniyle engellenir. Public ve doğrudan erişilebilir bir medya linki kullanın.

### CORS hatası

Render backend ortam değişkeninde `FRONTEND_URL` değerinin Vercel frontend adresinizle aynı olduğundan emin olun.

### FFmpeg bulunamadı

Windows'ta şu komutu çalıştırın:

```bash
winget install Gyan.FFmpeg
```

Sonra terminali kapatıp yeniden açın ve `ffmpeg -version` ile kontrol edin.

### Dönüştürme uzun sürüyor

Büyük dosyalarda indirme ve FFmpeg dönüşümü zaman alabilir. Render ücretsiz planında ilk istek de servis uykudan uyandığı için yavaş gelebilir.
