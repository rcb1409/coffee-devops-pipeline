# Use a lightweight Node image with latest security patches
FROM node:20-alpine3.19

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory inside the container
WORKDIR /srv/app

# Copy package files and install dependencies
COPY package*.json ./

# Install dependencies as root
# Use npm install instead of npm ci for more flexibility
RUN npm install --only=production --no-audit --no-fund

# Copy all remaining project files
COPY . .

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /srv/app

# Switch to non-root user
USER nodejs

# Expose app port and start
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "app.js"]

