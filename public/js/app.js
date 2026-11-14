const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const filePanel = document.getElementById("filePanel");
const fileList = document.getElementById("fileList");
const fileCount = document.getElementById("fileCount");
const progressCard = document.getElementById("progressCard");
const progressFill = document.getElementById("progressFill");
const statusTitle = document.getElementById("statusTitle");
const statusPercent = document.getElementById("statusPercent");
const statusText = document.getElementById("statusText");
const convertBtn = document.getElementById("convertBtn");
const mergeImagesCheckbox = document.getElementById("mergeImages");
const doneBox = document.getElementById("doneBox");
const toast = document.getElementById("toast");

let selectedFiles = [];
let fakeProgressTimer = null;
let currentProgress = 0;

dropArea.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  addFiles(Array.from(fileInput.files));
  fileInput.value = "";
});

dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropArea.classList.add("active");
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("active");
});

dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  dropArea.classList.remove("active");
  addFiles(Array.from(event.dataTransfer.files));
});

function addFiles(files) {
  const allowedFiles = files.filter(file => isImage(file) || isDocument(file));

  if (allowedFiles.length !== files.length) {
    showToast("Ada file yang formatnya belum didukung dan tidak dimasukkan.", "error");
  }

  allowedFiles.forEach(file => {
    const alreadyExists = selectedFiles.some(existing =>
      existing.name === file.name &&
      existing.size === file.size &&
      existing.lastModified === file.lastModified
    );

    if (!alreadyExists) {
      selectedFiles.push(file);
    }
  });

  showFileList();
}

function showFileList() {
  fileList.innerHTML = "";

  if (selectedFiles.length === 0) {
    filePanel.style.display = "none";
    return;
  }

  filePanel.style.display = "block";
  fileCount.textContent = `${selectedFiles.length} file dipilih`;

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const icon = isImage(file) ? "🖼️" : "📘";

    item.innerHTML = `
      <div class="file-left">
        <div class="mini-icon">${icon}</div>
        <div style="min-width:0;">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
      <button class="remove-file" title="Hapus file" onclick="removeFile(${index})">×</button>
    `;

    fileList.appendChild(item);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  showFileList();
}

function clearFiles() {
  selectedFiles = [];
  showFileList();
  resetProgress();
  showToast("Semua file dihapus.", "");
}

function formatFileSize(size) {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function isImage(file) {
  return ["image/jpeg", "image/jpg", "image/png"].includes(file.type);
}

function isDocument(file) {
  const allowed = [
    ".doc", ".docx",
    ".xls", ".xlsx",
    ".ppt", ".pptx",
    ".odt", ".ods", ".odp"
  ];

  const fileName = file.name.toLowerCase();
  return allowed.some(ext => fileName.endsWith(ext));
}

function setProgress(percent, title, text) {
  currentProgress = Math.max(0, Math.min(100, Math.round(percent)));

  progressCard.style.display = "block";
  progressFill.style.width = currentProgress + "%";
  statusPercent.textContent = currentProgress + "%";
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function startSmoothProgress(start, end, title, text) {
  stopSmoothProgress();

  currentProgress = Math.max(currentProgress, start);
  setProgress(currentProgress, title, text);

  fakeProgressTimer = setInterval(() => {
    if (currentProgress < end) {
      const step = currentProgress < 60 ? 2 : 1;
      currentProgress = Math.min(currentProgress + step, end);
      setProgress(currentProgress, title, text);
    }
  }, 420);
}

function stopSmoothProgress() {
  if (fakeProgressTimer) {
    clearInterval(fakeProgressTimer);
    fakeProgressTimer = null;
  }
}

function resetProgress() {
  stopSmoothProgress();
  currentProgress = 0;
  progressFill.style.width = "0%";
  statusPercent.textContent = "0%";
  statusTitle.textContent = "Menyiapkan file...";
  statusText.textContent = "Silakan tunggu sebentar.";
  progressCard.style.display = "none";
  doneBox.style.display = "none";
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = "toast";

  if (type === "success") toast.classList.add("success");
  if (type === "error") toast.classList.add("error");

  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 3200);
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  a.remove();

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1200);
}

function getFileNameFromDisposition(disposition, fallbackName) {
  if (!disposition) return fallbackName;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (normalMatch && normalMatch[1]) {
    return normalMatch[1];
  }

  return fallbackName;
}

async function convertFiles() {
  if (selectedFiles.length === 0) {
    showToast("Pilih file terlebih dahulu.", "error");
    return;
  }

  resetProgress();

  convertBtn.disabled = true;
  convertBtn.textContent = "Sedang memproses...";

  const imageFiles = selectedFiles.filter(isImage);
  const documentFiles = selectedFiles.filter(isDocument);

  try {
    setProgress(5, "Menyiapkan file", "File sedang dicek sebelum diproses.");

    if (imageFiles.length > 0) {
      if (mergeImagesCheckbox.checked && imageFiles.length > 1) {
        await mergeImagesToSinglePdf(imageFiles);
      } else {
        await convertImagesOneByOne(imageFiles);
      }
    }

    if (documentFiles.length > 0) {
      await convertDocumentsOnServer(documentFiles);
    }

    stopSmoothProgress();
    setProgress(100, "Selesai", "PDF berhasil dibuat dan proses download sudah dimulai.");
    doneBox.style.display = "block";
    showToast("Convert selesai. File berhasil didownload.", "success");

  } catch (error) {
    stopSmoothProgress();
    console.error(error);
    setProgress(0, "Gagal convert", error.message || "Terjadi kesalahan saat convert.");
    showToast(error.message || "Terjadi kesalahan saat convert.", "error");
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert to PDF";
  }
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      const img = new Image();

      img.onload = function() {
        resolve({
          image: img,
          dataUrl: event.target.result,
          fileName: file.name
        });
      };

      img.onerror = () => reject(new Error("Gambar gagal dibaca."));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error("File gambar gagal dibaca."));
    reader.readAsDataURL(file);
  });
}

async function mergeImagesToSinglePdf(files) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  for (let i = 0; i < files.length; i++) {
    const percent = 10 + Math.round(((i + 1) / files.length) * 55);
    setProgress(percent, "Menggabungkan gambar", `Memproses gambar ${i + 1} dari ${files.length}.`);

    const data = await readImage(files[i]);
    const img = data.image;

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgRatio = img.width / img.height;
    const pageRatio = pageWidth / pageHeight;

    let renderWidth;
    let renderHeight;

    if (imgRatio > pageRatio) {
      renderWidth = pageWidth - 20;
      renderHeight = renderWidth / imgRatio;
    } else {
      renderHeight = pageHeight - 20;
      renderWidth = renderHeight * imgRatio;
    }

    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    if (i > 0) pdf.addPage();

    const imageType = files[i].type === "image/png" ? "PNG" : "JPEG";
    pdf.addImage(data.dataUrl, imageType, x, y, renderWidth, renderHeight);
  }

  setProgress(82, "Membuat PDF", "Menyimpan gabungan gambar menjadi PDF.");
  pdf.save("gabungan-gambar.pdf");

  await wait(700);
  setProgress(92, "Download dimulai", "File PDF gambar sedang didownload.");
}

async function convertImagesOneByOne(files) {
  const { jsPDF } = window.jspdf;

  for (let i = 0; i < files.length; i++) {
    const percent = 10 + Math.round(((i + 1) / files.length) * 65);
    setProgress(percent, "Convert gambar", `Memproses gambar ${i + 1} dari ${files.length}.`);

    const data = await readImage(files[i]);
    const img = data.image;

    const orientation = img.width > img.height ? "landscape" : "portrait";

    const pdf = new jsPDF({
      orientation: orientation,
      unit: "px",
      format: [img.width, img.height]
    });

    const imageType = files[i].type === "image/png" ? "PNG" : "JPEG";
    pdf.addImage(data.dataUrl, imageType, 0, 0, img.width, img.height);
    pdf.save(files[i].name.replace(/\.[^/.]+$/, "") + ".pdf");

    await wait(300);
  }

  setProgress(92, "Download dimulai", "File PDF gambar sedang didownload.");
}

function convertDocumentsOnServer(files) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    files.forEach(file => {
      formData.append("files", file);
    });

    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/convert", true);
    xhr.responseType = "blob";

    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable) {
        const uploadPercent = Math.round((event.loaded / event.total) * 30);
        setProgress(
          10 + uploadPercent,
          "Upload dokumen",
          `Mengupload dokumen ke server... ${Math.round((event.loaded / event.total) * 100)}%`
        );
      }
    };

    xhr.onloadstart = function() {
      setProgress(8, "Mulai upload", "Dokumen sedang dikirim ke server.");
    };

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 2) {
        startSmoothProgress(
          Math.max(currentProgress, 42),
          88,
          "Convert dokumen",
          "LibreOffice sedang mengubah dokumen menjadi PDF. Waktu proses tergantung ukuran file."
        );
      }
    };

    xhr.onload = function() {
      stopSmoothProgress();

      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(92, "Menyiapkan download", "Hasil convert sedang disiapkan.");

        const blob = xhr.response;
        const disposition = xhr.getResponseHeader("Content-Disposition");
        let fallbackName = files.length > 1 ? "hasil-convert-pdf.zip" : files[0].name.replace(/\.[^/.]+$/, ".pdf");
        const fileName = getFileNameFromDisposition(disposition, fallbackName);

        downloadBlob(blob, fileName);

        setTimeout(() => {
          setProgress(98, "Download dimulai", "File berhasil dibuat. Cek folder download kamu.");
          resolve();
        }, 600);

      } else {
        const reader = new FileReader();

        reader.onload = function() {
          const message = reader.result || "Gagal convert dokumen.";
          reject(new Error(message));
        };

        reader.onerror = function() {
          reject(new Error("Gagal membaca pesan error dari server."));
        };

        reader.readAsText(xhr.response);
      }
    };

    xhr.onerror = function() {
      stopSmoothProgress();
      reject(new Error("Gagal menghubungi server. Pastikan node server.js masih berjalan."));
    };

    xhr.ontimeout = function() {
      stopSmoothProgress();
      reject(new Error("Proses terlalu lama. Coba file yang lebih kecil."));
    };

    xhr.timeout = 5 * 60 * 1000;
    xhr.send(formData);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
