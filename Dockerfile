# =====================================================================
#  Immagine di sviluppo/testing per La Tana del Coniglio.
#  Base: eclipse-temurin:21-jre-jammy (Java 21 già incluso).
#  Node.js 22 aggiunto via NodeSource.
# =====================================================================
FROM eclipse-temurin:21-jre-jammy

# Node.js 22 via NodeSource
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Firebase CLI globale: rende "firebase" disponibile nel container.
RUN npm install -g firebase-tools

WORKDIR /app

# Porte: 5173 Vite dev server, 9099 Auth emulator, 8080 Firestore emulator,
# 4000 Emulator UI, 4400 Emulator hub.
EXPOSE 5173 9099 8080 4000 4400

# Comando di default: avvia il dev server (sovrascritto in docker-compose).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
