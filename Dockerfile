FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p data

ENV NODE_ENV=production
ENV TRUST_PROXY=1
EXPOSE 3000

CMD ["node", "server/index.js"]
