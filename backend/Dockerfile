FROM node:18-alpine

# better-sqlite3 is a native module, needs build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Make sure the data folder exists
RUN mkdir -p /app/data

EXPOSE 5000

CMD ["npx", "nodemon", "src/server.js"]