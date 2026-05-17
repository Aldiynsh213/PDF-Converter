const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const archiver = require("archiver");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

const uploadDir = path.resolve("uploads");
const outputDir = path.resolve("output");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const allowedExtensions = [
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".odt", ".ods", ".odp"
];

const libreOfficePaths = [
  process.env.LIBREOFFICE_PATH,
  "soffice",
  "/usr/bin/soffice",
  "/usr/lib/libreoffice/program/soffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
].filter(Boolean);

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log("Gagal hapus file:", filePath);
  }
}

function cleanOldFiles(folder, maxAgeMinutes = 30) {
  if (!fs.existsSync(folder)) return;

  const now = Date.now();
  const maxAge = maxAgeMinutes * 60 * 1000;

  fs.readdirSync(folder).forEach((file) => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > maxAge) {
      safeDelete(filePath);
    }
  });
}

function convertWithLibreOffice(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    let index = 0;

    function tryNextPath() {
      if (index >= libreOfficePaths.length) {
        return reject(new Error("LibreOffice tidak ditemukan. Cek path soffice.exe."));
      }

      const libreOfficePath = libreOfficePaths[index];

      console.log("Mencoba LibreOffice:", libreOfficePath);
      console.log("Input:", inputPath);
      console.log("Output:", outputDir);

      execFile(
        libreOfficePath,
        [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          outputDir,
          inputPath
        ],
        (error, stdout, stderr) => {
          if (error) {
            console.log("Gagal dengan path:", libreOfficePath);
            console.log("Error:", error.message);
            console.log("STDERR:", stderr);

            index++;
            tryNextPath();
            return;
          }

          console.log("STDOUT:", stdout);
          console.log("STDERR:", stderr);

          resolve();
        }
      );
    }

    tryNextPath();
  });
}


app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    name: "PDF Converter API",
    libreOffice: libreOfficePaths[0] || "auto"
  });
});

app.post("/convert-multiple", upload.array("files", 20), async (req, res) => {
  cleanOldFiles(uploadDir);
  cleanOldFiles(outputDir);

  if (!req.files || req.files.length === 0) {
    return res.status(400).send("Tidak ada file yang diupload.");
  }

  const uploadedFiles = [];
  const convertedFiles = [];

  try {
    for (const file of req.files) {
      const originalName = file.originalname;
      const ext = path.extname(originalName).toLowerCase();

      if (!allowedExtensions.includes(ext)) {
        safeDelete(file.path);
        continue;
      }

      const safeOriginalName = originalName.replace(/[^\w.\-() ]/g, "_");
      const inputFileName = `${Date.now()}-${file.filename}-${safeOriginalName}`;
      const inputPath = path.join(uploadDir, inputFileName);

      fs.renameSync(file.path, inputPath);
      uploadedFiles.push(inputPath);

      await convertWithLibreOffice(inputPath, outputDir);

      const expectedPdfName = path.basename(inputFileName, ext) + ".pdf";
      const expectedPdfPath = path.join(outputDir, expectedPdfName);

      if (!fs.existsSync(expectedPdfPath)) {
        throw new Error("PDF tidak ditemukan setelah proses convert.");
      }

      const finalPdfName = originalName.replace(ext, ".pdf");
      const finalPdfPath = path.join(outputDir, `${Date.now()}-${file.filename}-${finalPdfName}`);

      fs.renameSync(expectedPdfPath, finalPdfPath);

      convertedFiles.push({
        path: finalPdfPath,
        name: finalPdfName
      });
    }

    uploadedFiles.forEach(safeDelete);

    if (convertedFiles.length === 0) {
      return res.status(400).send("Tidak ada file yang berhasil dikonversi.");
    }

    if (convertedFiles.length === 1) {
      const singleFile = convertedFiles[0];

      return res.download(singleFile.path, singleFile.name, () => {
        safeDelete(singleFile.path);
      });
    }

    const zipName = "hasil-convert-pdf.zip";
    const zipPath = path.join(outputDir, `${Date.now()}-${zipName}`);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    output.on("close", () => {
      convertedFiles.forEach((file) => safeDelete(file.path));

      res.download(zipPath, zipName, () => {
        safeDelete(zipPath);
      });
    });

    archive.on("error", (error) => {
      throw error;
    });

    archive.pipe(output);

    convertedFiles.forEach((file) => {
      archive.file(file.path, { name: file.name });
    });

    archive.finalize();

  } catch (error) {
    console.error("ERROR CONVERT:", error.message);

    if (req.files) {
      req.files.forEach((file) => safeDelete(file.path));
    }

    uploadedFiles.forEach(safeDelete);
    convertedFiles.forEach((file) => safeDelete(file.path));

    res.status(500).send(error.message || "Terjadi kesalahan saat convert dokumen.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});