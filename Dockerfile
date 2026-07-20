FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3456
ENV DATA_DIR=/data

EXPOSE 3456

CMD ["node", "server.js"]
