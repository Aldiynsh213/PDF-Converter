---
title: PDF Converter
emoji: 📄
colorFrom: yellow
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# PDF Converter

Web app untuk mengubah dokumen Office menjadi PDF. Konversi dijalankan di server memakai LibreOffice (`soffice`).

## Fitur
- Upload hingga 20 file sekaligus, maksimal 50 MB per file
- Konversi ke PDF lewat LibreOffice headless
- Tanpa database; file sementara dibersihkan setelah dikonversi

## Struktur
```
server.js        Express API (/convert, /health)
public/          frontend statis (index.html, css/, js/)
Dockerfile       image dengan LibreOffice terpasang
render.yaml      konfigurasi deploy Render
README_DEPLOY.md panduan deploy
```

## Menjalankan
Butuh LibreOffice terpasang (atau pakai Docker).
```bash
npm install
npm start            # http://localhost:3000
```
Docker:
```bash
docker build -t pdf-converter .
docker run -p 7860:7860 pdf-converter
```
Variabel opsional: `PORT`, `LIBREOFFICE_PATH` (default `soffice`).

## Deploy
Lihat [README_DEPLOY.md](README_DEPLOY.md). Docker disarankan karena server produksi harus punya LibreOffice.

## Lisensi
MIT
