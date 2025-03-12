# Use Node.js 16 Alpine as the base image
FROM node:16-alpine

# Create and set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install production dependencies inside the container
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose port 8080 for the container
EXPOSE 8080

# Start the Node.js app
CMD ["node", "server.js"]
