#!/bin/bash

# Variables (update these as needed)
REPO_URL="https://github.com/SHAKTH1/telecom-survey-app.git"
APP_DIR="/home/ec2-user/telecomapp/telecom-survey-app"
PORT=80  # Set this to 80 instead of 8080

echo "Stopping any running instance of the app..."
# Option 1: If you use pm2 (recommended for production)
# pm2 delete telecom-survey-app

# Option 2: Kill any running Node process (be cautious if running other Node apps)
pkill -f server.js

echo "Removing old application directory if it exists..."
rm -rf "$APP_DIR"

echo "Cloning the repository..."
git clone "$REPO_URL" "$APP_DIR"

if [ $? -ne 0 ]; then
  echo "Failed to clone repository. Exiting."
  exit 1
fi

cd "$APP_DIR" || exit

echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "npm install failed. Exiting."
  exit 1
fi

echo "Setting PORT environment variable to $PORT..."
export PORT=$PORT

echo "Starting the application on port $PORT..."
# Option A: For development, run in the background using nohup:
nohup node server.js > app.log 2>&1 &

# Option B: If you have pm2 installed, you can use:
# pm2 start server.js --name telecom-survey-app

echo "Deployment complete. Your app should be running on port $PORT."
