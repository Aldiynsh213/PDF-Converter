const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const crypto = require('crypto');

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
app.use('/converted', express.static(CONVERTED_DIR));

function safeFileName(name) {
  const ext = path.extname(name);
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const id = crypto.randomBytes(6).toString('hex');
  return `${base || 'file'}-${id}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, safeFileName(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

function convertToPdf(inputPath) {
  return new Promise((resolve, reject) => {
    const beforeFiles = new Set(fs.readdirSync(CONVERTED_DIR));

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
          new Error(
            `LibreOffice conversion failed: ${stderr || stdout || error.message}`
          )
        );
      }

      const afterFiles = fs.readdirSync(CONVERTED_DIR);
      const newPdf = afterFiles.find((file) => {
        return !beforeFiles.has(file) && file.toLowerCase().endsWith('.pdf');
      });

      if (!newPdf) {
        const inputBase = path.basename(inputPath, path.extname(inputPath));
        const expectedPdf = `${inputBase}.pdf`;
        const expectedPath = path.join(CONVERTED_DIR, expectedPdf);

        if (fs.existsSync(expectedPath)) {
          return resolve(expectedPdf);
        }

        return reject(new Error('PDF file was not created.'));
      }

      resolve(newPdf);
    });
  });
}

function cleanupFile(filePath) {
  fs.unlink(filePath, () => {});
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
  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded.',
      });
    }

    const results = [];

    for (const file of files) {
      const inputPath = file.path;
      const ext = path.extname(file.originalname).toLowerCase();

      try {
        if (ext === '.pdf') {
          const pdfName = safeFileName(file.originalname);
          const pdfPath = path.join(CONVERTED_DIR, pdfName);
          fs.copyFileSync(inputPath, pdfPath);

          results.push({
            originalName: file.originalname,
            fileName: pdfName,
            downloadUrl: `/download/${pdfName}`,
          });
        } else {
          const pdfName = await convertToPdf(inputPath);

          results.push({
            originalName: file.originalname,
            fileName: pdfName,
            downloadUrl: `/download/${pdfName}`,
          });
        }
      } finally {
        cleanupFile(inputPath);
      }
    }

    res.json({
      success: true,
      count: results.length,
      files: results,
    });
  } catch (error) {
    console.error('Convert error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to convert file.',
      error: error.message,
    });
  }
});

app.get('/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(CONVERTED_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found.');
  }

  res.download(filePath, filename);
});

app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.send('PDF Converter is running.');
});

app.listen(PORT, HOST, () => {
  console.log(`PDF Converter running on http://${HOST}:${PORT}`);
});