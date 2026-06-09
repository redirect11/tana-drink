# =====================================================================
#  Immagine di sviluppo/testing per La Tana del Coniglio.
#  Include Node.js, la Firebase CLI (firebase-tools) e una JRE
#  necessaria per gli emulatori Firebase (Firestore + UI).
# =====================================================================
FROM node:22-bookworm-slim

# Java 21+ richiesto dagli emulatori Firebase (firebase-tools >= 13).
# openjdk-21 è in bookworm-backports, non nel repo principale.
RUN echo "deb http://deb.debian.org/debian bookworm-backports main" \
      > /etc/apt/sources.list.d/backports.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
         -t bookworm-backports openjdk-21-jre-headless curl \
    && rm -rf /var/lib/apt/lists/*

# Firebase CLI globale: rende "firebase" disponibile nel container.
RUN npm install -g firebase-tools

WORKDIR /app

# Porte: 5173 Vite dev server, 8080 Firestore emulator, 4000 Emulator UI,
# 4400 Emulator hub, 5000 Hosting emulator.
EXPOSE 5173 8080 4000 4400 5000

# Comando di default: avvia il dev server (sovrascritto in docker-compose).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
