FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN ./node_modules/.bin/tsc -p tsconfig.json --outDir dist && ls -la dist/ || echo "TSC FAILED"
EXPOSE 3000
CMD ["node", "dist/main"]
