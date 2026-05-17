const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const crypto = require('crypto');
const archiver = require('archiver');

const app = express();

const PORT = process.env.PORT || 7860;
const HOST = '0.0.0.0';
const LIBREOFFICE_PATH = process.env.LIBREOFFICE_PATH || 'soffice';

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const CONVERTED_DIR = path.join(ROOT_DIR, 'converted');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CONVERTED_DIR, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

function safeFileName(name) {
  const ext = path.extname(name);
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const id = crypto.randomBytes(5).toString('hex');
  return `${base || 'file'}-${id}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, safeFileName(file.originalname)),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

function cleanup(filePath) {
  fs.unlink(filePath, () => {});
}

function convertToPdf(inputPath) {
  return new Promise((resolve, reject) => {
    const inputBase = path.basename(inputPath, path.extname(inputPath));
    const expectedPdf = `${inputBase}.pdf`;
    const expectedPath = path.join(CONVERTED_DIR, expectedPdf);

    const args = [
      '--headless',
      '--nologo',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      CONVERTED_DIR,
      inputPath,
    ];

    execFile(LIBREOFFICE_PATH, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(stderr || stdout || error.message || 'LibreOffice conversion failed')
        );
      }

      if (!fs.existsSync(expectedPath)) {
        return reject(new Error('PDF output was not created.'));
      }

      resolve(expectedPath);
    });
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'PDF Converter API',
    port: PORT,
    libreOffice: LIBREOFFICE_PATH,
  });
});

app.post('/convert', upload.any(), async (req, res) => {
  const uploadedFiles = req.files || [];
  const outputFiles = [];

  try {
    if (!uploadedFiles.length) {
      return res.status(400).send('No files uploaded.');
    }

    for (const file of uploadedFiles) {
      const inputPath = file.path;
      const originalExt = path.extname(file.originalname).toLowerCase();

      if (originalExt === '.pdf') {
        const pdfName = safeFileName(file.originalname);
        const pdfPath = path.join(CONVERTED_DIR, pdfName);
        fs.copyFileSync(inputPath, pdfPath);
        outputFiles.push({
          path: pdfPath,
          name: pdfName,
        });
      } else {
        const pdfPath = await convertToPdf(inputPath);
        const cleanName =
          path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80) + '.pdf';

        outputFiles.push({
          path: pdfPath,
          name: cleanName,
        });
      }

      cleanup(inputPath);
    }

    if (outputFiles.length === 1) {
      const file = outputFiles[0];

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.name}"`
      );

      return res.download(file.path, file.name, (err) => {
        cleanup(file.path);
        if (err) console.error('Download error:', err);
      });
    }

    const zipName = `converted-files-${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.on('end', () => {
      outputFiles.forEach((file) => cleanup(file.path));
    });

    archive.pipe(res);

    outputFiles.forEach((file) => {
      archive.file(file.path, { name: file.name });
    });

    archive.finalize();
  } catch (error) {
    uploadedFiles.forEach((file) => cleanup(file.path));
    outputFiles.forEach((file) => cleanup(file.path));

    console.error('Convert error:', error);

    res.status(500).send(`Failed to convert file: ${error.message}`);
  }
});

app.use((req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.send('PDF Converter is running.');
});

app.listen(PORT, HOST, () => {
  console.log(`PDF Converter running on http://${HOST}:${PORT}`);
});