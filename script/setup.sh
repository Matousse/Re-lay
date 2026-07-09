#!/bin/bash
set -e

if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
  echo "  Edit .env and fill in the required values before continuing."
fi

echo "→ Cleaning up old dependencies..."
rm -rf node_modules && rm -rf package-lock.json

echo "→ Installing dependencies..."
npm install

echo "✓ Setup complete. Run 'npm run dev' to start."
