# ==============================================================================
# OJLinker CRM — Production Dockerfile
# ==============================================================================

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: PocketBase Runtime
FROM alpine:3.19

WORKDIR /app
RUN apk add --no-cache ca-certificates sqlite curl

# Copy static frontend distribution
COPY --from=builder /app/dist ./dist

# Copy PocketBase backend and hooks
COPY backend/pocketbase ./backend/pocketbase
COPY backend/pb_migrations ./backend/pb_migrations
COPY backend/pb_hooks ./backend/pb_hooks
COPY backend/scripts ./backend/scripts

EXPOSE 8090
VOLUME ["/app/backend/pb_data"]

CMD ["./backend/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=./backend/pb_data", "--publicDir=./dist", "--indexFallback=true"]
