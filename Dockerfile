FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN ./node_modules/.bin/tsc -p tsconfig.json; find /app -name "main.js" 2>/dev/null; ls -la /app/
EXPOSE 3000
CMD ["node", "dist/main"]
