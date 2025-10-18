#!/bin/bash 

# Function to display error and pause
error_and_pause() {
    echo "ERROR: $1"
    echo "Press any key to continue..."
    read -n 1 -s
    exit 1
}

# Copy docs plugin SQL files
mkdir -p dist/plugins/docs/server/VFS2/SQL 

if ! cp plugins/docs/server/VFS2/SQL/*.sql dist/plugins/docs/server/VFS2/SQL/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/server/VFS2/SQL/*.sql to dist/plugins/docs/server/VFS2/SQL/"
fi

if ! cp plugins/docs/*.yaml dist/plugins/docs/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/*.yaml to dist/plugins/docs/"
fi


echo "All files copied successfully!"