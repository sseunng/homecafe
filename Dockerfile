# Step 1: Build React Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install --ignore-scripts
RUN npm install --prefix client
COPY . .
RUN npm run build

# Step 2: Run Production Server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --ignore-scripts
RUN npm install --prefix server --only=production
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server

EXPOSE 3000
CMD ["npm", "start"]
