# Use an official Node.js runtime as a parent image.
# (Choose the version that matches your app. Here we use Node 16 Alpine.)
FROM node:16-alpine

# Create and set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install app dependencies (production only)
RUN npm install --production

# Bundle app source inside the Docker image
COPY . .

# Expose the port your app listens on (as per server.js, we use 8080)
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
