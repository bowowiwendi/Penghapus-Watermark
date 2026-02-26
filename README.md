# 🎬 Video Watermark Remover Pro

Aplikasi web untuk menghapus watermark dari video menggunakan FFmpeg WASM.

## 🚀 Cara Menjalankan

### Metode 1: Menggunakan Node.js Server (RECOMMENDED)

Server ini sudah menyertakan header **COOP/COEP** yang diperlukan untuk FFmpeg WASM.

```bash
node server.js
```

Kemudian buka: **http://localhost:3000**

### Metode 2: Menggunakan Python

```bash
# Python 3
python -m http.server 8000
```

⚠️ **Catatan**: Server Python default tidak menyertakan header COOP/COEP. FFmpeg mungkin tidak berfungsi.

### Metode 3: Menggunakan VS Code Live Server

1. Install extension "Live Server"
2. Klik kanan pada `index.html` → "Open with Live Server"

⚠️ **Catatan**: Mungkin perlu konfigurasi tambahan untuk header COOP/COEP.

## ⚠️ Persyaratan Penting

### Header COOP/COEP

FFmpeg WASM memerlukan header berikut agar dapat berfungsi:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Jika header ini tidak ada, Anda akan melihat error:
- `SharedArrayBuffer is not defined`
- `FFmpeg failed to load`

### Browser yang Didukung

- ✅ Chrome/Edge 92+
- ✅ Firefox 119+
- ✅ Safari 15+

## 📦 Fitur

- Upload video (MP4, MOV, WEBM)
- Drag & Drop support
- Manual watermark selection
- Auto detect watermark (AI)
- Multiple removal methods (Fast, Clean, AI Pro)
- Export quality options (480p, 720p, 1080p)
- Batch processing

## 🛠️ Tech Stack

- HTML5, CSS3, JavaScript
- FFmpeg WASM (@ffmpeg/ffmpeg@0.12.x)
- Google Fonts (Poppins)

## 📝 Usage

1. Buka aplikasi di browser
2. Upload video Anda
3. Pilih area watermark (klik & drag)
4. Pilih metode removal
5. Klik "Hapus Watermark"
6. Download hasil

## ⚠️ Troubleshooting

### "FFmpeg failed to load"

- Pastikan menggunakan server dengan header COOP/COEP
- Gunakan `node server.js` untuk server lokal
- Refresh halaman browser

### "SharedArrayBuffer is not defined"

- Header COOP/COEP tidak diatur dengan benar
- Browser tidak mendukung SharedArrayBuffer
- Coba update browser ke versi terbaru

### Video processing gagal

- Format video tidak didukung
- File video terlalu besar
- Memori browser tidak cukup

## 📄 License

MIT License
