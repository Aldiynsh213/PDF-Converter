# PDF Converter Deployment Guide

This project is a single Express web app.

- Frontend: `public/index.html`
- Backend: `server.js`
- Conversion engine: LibreOffice (`soffice`)
- Database: not required

## Why Docker is recommended

This app converts Office documents to PDF, so the production server must have LibreOffice installed.
A normal Node.js deploy may fail if LibreOffice is missing. Docker solves this by installing LibreOffice inside the container.

## Local run

```bash
npm install
npm start
```

Open:

```txt
http://localhost:3000
```

## Docker local test

```bash
docker build -t pdf-converter .
docker run -p 3000:3000 pdf-converter
```

Open:

```txt
http://localhost:3000
```

## Render deploy

1. Push this folder to GitHub.
2. Open Render.
3. New + > Web Service.
4. Connect your GitHub repository.
5. Choose Docker runtime.
6. Root Directory: leave empty if this project is at repo root.
7. Dockerfile Path: `./Dockerfile`.
8. Deploy.

After deploy, test:

```txt
https://your-service.onrender.com/health
```

## Important

Do not upload `node_modules` to GitHub.
Do not upload real files inside `uploads` or `output`.
