# Multi-stage build for Node.js application
FROM node:18-alpine AS backend-build

# Install build dependencies
RUN apk add --no-cache make gcc g++ python3

# Set working directory for backend
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies for Alpine Linux
RUN npm ci --only=production

# Copy backend source code (excluding node_modules)
COPY backend/ ./

# Ensure SQLite3 is built for Alpine Linux
RUN npm rebuild sqlite3

# Create data directory and set permissions
RUN mkdir -p /app/backend/data && \
    chmod 755 /app/backend/data

# Production image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy backend from build stage
COPY --from=backend-build --chown=nodejs:nodejs /app/backend ./backend

# Copy frontend files
COPY --chown=nodejs:nodejs index.html ./
COPY --chown=nodejs:nodejs script.js ./

# Create data directory with proper permissions
RUN mkdir -p /app/backend/data && \
    chown -R nodejs:nodejs /app && \
    chmod 755 /app/backend/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/scripts/health-check.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/server-sqlite.js"]