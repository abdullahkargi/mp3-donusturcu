# Hızlı YouTube MP3 Dönüştürücü

Reklamsız, hızlı ve sade bir YouTube'dan MP3 dönüştürücü web uygulaması. Kullanıcı bir YouTube video linki girer, backend `yt-dlp` ile videonun sesini geçici olarak indirir, FFmpeg ile MP3'e çevirir ve indirme linki üretir.

Bu aracı yalnızca hak sahibi olduğunuz, kullanım izniniz olan veya yasal olarak indirebileceğiniz içerikler için kullanın.

## Özellikler

- React + Vite + Tailwind CSS frontend
- Node.js + Express backend
- Sadece YouTube video linki kabul eder
- `youtube.com/watch`, `youtu.be`, Shorts ve live video linkleri desteklenir
- `yt-dlp` ile YouTube ses indirme
- FFmpeg ile MP3 dönüştürme
- İndirilen MP3 dosyasının adı YouTube video başlığından üretilir
- 128, 192 ve 320 kbps kalite seçimi
- Dosya yükleme alanı yok
- Maksimum 500 MB indirme limiti
- Koyu/açık tema
- Mobil uyumlu arayüz
- Kullanıcı dostu hata mesajları
- CORS ayarı environment variable ile yapılır
- Geçici dosyalar otomatik temizlenir

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

Kök klasörde bağımlılıkları kurun:

```bash
npm install
```

Frontend ve backend'i birlikte başlatın:

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

Backend MP3 dönüştürme için FFmpeg kullanır. Projede `ffmpeg-static` bağımlılığı vardır, bu yüzden çoğu ortamda ekstra kurulum yapmadan çalışır. Local geliştirmede sistem FFmpeg kurulumu yine en sorunsuz yoldur.

Windows için FFmpeg kurulumu:

```bash
winget install Gyan.FFmpeg
```

Kurulumu kontrol etmek için:

```bash
ffmpeg -version
```

Özel bir FFmpeg binary kullanmak isterseniz backend `.env` dosyasında `FFMPEG_PATH` verebilirsiniz.

## yt-dlp Bilgisi

YouTube linklerini çözmek için `yt-dlp` gerekir. Bu projede `youtube-dl-exec` paketi kullanılır ve `npm install` sırasında uygun `yt-dlp` binary'sini otomatik indirir.

Windows'ta manuel kurmak isterseniz:

```bash
winget install yt-dlp
```

Render gibi ortamlarda normalde ekstra komut gerekmez. Eğer deploy sırasında GitHub indirme limitine takılırsanız Render environment variable olarak `GH_TOKEN` eklemek yardımcı olabilir.

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
YTDLP_TIMEOUT_MS=600000
```

Production'da `FRONTEND_URL` içine Vercel frontend adresinizi yazın:

```env
FRONTEND_URL=https://frontend-linkim.vercel.app
```

Birden fazla origin gerekiyorsa virgülle ayırabilirsiniz:

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
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
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

### "Sadece YouTube video linkleri desteklenir"

Girilen URL YouTube domaininde değildir. `youtube.com/watch`, `youtu.be` veya YouTube Shorts linki kullanın.

### "Lütfen geçerli bir YouTube video linki girin"

Girilen linkte video ID bulunamamıştır. Playlist veya kanal linki yerine tek bir video linki girin.

### "Dosya boyutu çok büyük"

İndirilecek ses dosyası 500 MB limitini aşıyordur. Daha kısa veya daha küçük bir video deneyin.

### "Bu YouTube videosuna erişilemiyor"

Video private, üyeye özel, yaş kısıtlamalı veya oturum gerektiriyor olabilir. Herkese açık bir video linki deneyin.

### CORS hatası

Render backend ortam değişkeninde `FRONTEND_URL` değerinin Vercel frontend adresinizle aynı olduğundan emin olun.

### FFmpeg bulunamadı

Windows'ta şu komutu çalıştırın:

```bash
winget install Gyan.FFmpeg
```

Sonra terminali kapatıp yeniden açın ve `ffmpeg -version` ile kontrol edin.

### yt-dlp indirilemedi

`npm install` sırasında `youtube-dl-exec` GitHub üzerinden `yt-dlp` indirir. Ağ veya GitHub rate limit sorunu varsa tekrar deneyin ya da environment variable olarak `GH_TOKEN` ekleyin.
