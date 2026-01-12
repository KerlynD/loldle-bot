FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Fly sets PORT for web apps; your bot doesn't need it but it doesn't hurt.
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
