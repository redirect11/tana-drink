# =====================================================================
#  Immagine di sviluppo/testing per La Tana del Coniglio.
#  Include Node.js, la Firebase CLI (firebase-tools) e una JRE
#  necessaria per gli emulatori Firebase (Firestore + UI).
# =====================================================================
FROM node:22-bookworm-slim

# Java 21+ richiesto dagli emulatori Firebase (firebase-tools >= 13).
# Usa il repo Temurin (Adoptium) perché openjdk-21 non è disponibile
# nei repo Debian Bookworm standard né nei backports dell'immagine slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget gnupg \
    && wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public \
       | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" \
       > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends temurin-21-jre curl \
    && rm -rf /var/lib/apt/lists/*

# Firebase CLI globale: rende "firebase" disponibile nel container.
RUN npm install -g firebase-tools

WORKDIR /app

# Porte: 5173 Vite dev server, 8080 Firestore emulator, 4000 Emulator UI,
# 4400 Emulator hub, 5000 Hosting emulator.
EXPOSE 5173 8080 4000 4400 5000

# Comando di default: avvia il dev server (sovrascritto in docker-compose).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
