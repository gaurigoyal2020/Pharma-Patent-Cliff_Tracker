FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["sh", "-c", "node --experimental-sqlite src/config/migrate.js && node --experimental-sqlite server.js"]
