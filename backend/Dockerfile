FROM node:20-alpine

WORKDIR /app

# Install build tools needed for better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Create data directory (will be overridden by volume mount)
RUN mkdir -p /app/data

# Run migration (creates schema + seeds from CSV) on first start
# The entrypoint checks if the DB already exists to avoid re-seeding
CMD ["sh", "-c", "node src/config/migrate.js && node server.js"]