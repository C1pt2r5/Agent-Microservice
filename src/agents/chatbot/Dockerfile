# Multi-stage build for Chatbot Agent
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chatbot -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary source files for runtime
COPY --from=builder /app/src/agents/chatbot ./src/agents/chatbot
COPY --from=builder /app/src/agents/base ./src/agents/base
COPY --from=builder /app/src/integration ./src/integration
COPY --from=builder /app/src/shared ./src/shared

# Create data directory
RUN mkdir -p /app/data && chown -R chatbot:nodejs /app

# Switch to non-root user
USER chatbot

# Expose ports
EXPOSE 8080 8081 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 8080, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200) process.exit(0); \
        else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV WS_PORT=8081
ENV METRICS_PORT=9090

# Start the application
CMD ["node", "dist/agents/chatbot/index.js"]