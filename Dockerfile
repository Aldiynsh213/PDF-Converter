FROM node:20-bookworm-slim

WORKDIR /app

# LibreOffice is required for DOC/DOCX/XLS/XLSX/PPT/PPTX to PDF conversion.
# Fonts improve rendering quality for documents.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    fonts-dejavu \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV LIBREOFFICE_PATH=soffice

EXPOSE 3000

CMD ["npm", "start"]
