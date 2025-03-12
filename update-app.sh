#!/bin/bash

# Variables (update these as needed)
REPO_URL="https://github.com/SHAKTH1/telecom-survey-app.git"
APP_DIR="/home/ec2-user/telecomapp/telecom-survey-app"

echo "Stopping and removing Docker containers for the app..."
# Navigate to the application directory if it exists and shut down the Docker containers
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" || { echo "Failed to change directory to $APP_DIR"; exit 1; }
  docker compose down
else
  echo "Application directory does not exist. Skipping container shutdown."
fi

echo "Removing old application directory if it exists..."
rm -rf "$APP_DIR"

echo "Ensuring parent directory exists..."
mkdir -p "$(dirname "$APP_DIR")"

echo "Changing directory to parent directory..."
cd "$(dirname "$APP_DIR")" || { echo "Failed to change directory to parent directory."; exit 1; }

echo "Cloning the repository from $REPO_URL..."
git clone "$REPO_URL" "$(basename "$APP_DIR")"
if [ $? -ne 0 ]; then
  echo "Failed to clone repository. Exiting."
  exit 1
fi

cd "$(basename "$APP_DIR")" || exit

echo "Building and starting Docker containers..."
docker compose up -d --build

echo "Deployment complete. Your Dockerized app should now be running 24/7."
