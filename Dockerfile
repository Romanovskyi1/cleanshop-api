FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build && ls dist/main.js
RUN npm prune --production
EXPOSE 3000
CMD ["node", "dist/main"]
