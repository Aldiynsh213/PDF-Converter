FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p uploads converted

ENV NODE_ENV=production
ENV PORT=7860
ENV LIBREOFFICE_PATH=soffice

EXPOSE 7860

CMD ["npm", "start"]