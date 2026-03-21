FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN ./node_modules/.bin/tsc -p tsconfig.json 2>&1 && ls dist/main.js
RUN npm prune --production
EXPOSE 3000
CMD ["node", "dist/main"]
