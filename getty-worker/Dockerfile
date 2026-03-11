FROM node:20-slim

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Install Chromium browser for Playwright
RUN npx playwright install --with-deps chromium

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Create directories for persistent state and temp downloads
RUN mkdir -p /data/getty-state /data/media/tmp

EXPOSE 3001

CMD ["node", "dist/server.js"]
