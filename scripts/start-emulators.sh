#!/bin/bash

echo "Starting Firebase Emulators for AI Fitness App..."
echo

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null
then
    echo "Firebase CLI is not installed!"
    echo "Please install it using: npm install -g firebase-tools"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "firebase.json not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "Starting emulators..."
echo "- Firestore on port 8080"
echo "- Auth on port 9099"
echo "- Functions on port 5001"
echo "- Storage on port 9199"
echo "- Emulator UI on port 4000"
echo

# Start emulators
firebase emulators:start --import=./emulator-data --export-on-exit

echo
echo "Emulators stopped."