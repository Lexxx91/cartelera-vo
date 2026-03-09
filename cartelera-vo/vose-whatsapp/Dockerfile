FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY src/ ./src/

# Baileys auth session persisted in a volume
VOLUME /app/auth_session

CMD ["node", "src/index.js"]
