#!/bin/bash

SERVER_FILE="server.js"
BACKUP_FILE="server.js.bak"

echo "📦 Backing up $SERVER_FILE to $BACKUP_FILE..."
cp "$SERVER_FILE" "$BACKUP_FILE"

echo "🧼 Removing duplicate 'const cors = require' statements..."
# Keep only the first occurrence of the cors import
awk '!seen[$0]++ || $0 != "const cors = require('\''cors'\'');"' "$SERVER_FILE" > "$SERVER_FILE.tmp" && mv "$SERVER_FILE.tmp" "$SERVER_FILE"

echo "🧼 Removing duplicate 'app.use(cors' middleware..."
# Remove all duplicate app.use(cors...) blocks except the first
awk '
/app\.use\(cors\(/ {
  if (seen++) next
}
{ print }
' "$SERVER_FILE" > "$SERVER_FILE.tmp" && mv "$SERVER_FILE.tmp" "$SERVER_FILE"

echo "✅ Cleanup complete. Your file is now patched."
