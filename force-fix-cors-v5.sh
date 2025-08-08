#!/bin/bash

SERVER_FILE="server.js"
BACKUP_FILE="server.js.bak"

echo "📦 Backing up $SERVER_FILE to $BACKUP_FILE..."
cp "$SERVER_FILE" "$BACKUP_FILE"

echo "🧼 Removing all CORS imports and previous middleware blocks..."
# Remove all cors imports and app.use(cors blocks (multi-line)
awk '
BEGIN { inside_block = 0 }
/const cors = require\(.*\)/ { next }
/import cors from/ { next }
/app.use\(cors\(/ { inside_block = 1; next }
inside_block && /\)\);/ { inside_block = 0; next }
inside_block { next }
{ print }
' "$SERVER_FILE" > "$SERVER_FILE.tmp"

echo "🔁 Inserting clean CORS import at the top..."
sed -i "1iconst cors = require('cors');" "$SERVER_FILE.tmp"

echo "🔁 Injecting safe single-line cors middleware..."
awk '
  BEGIN { inserted = 0 }
  /const app = express\(\);/ {
    print
    if (!inserted) {
      print "app.use(cors({ origin: \"*\", credentials: true }));"
      inserted = 1
    }
    next
  }
  { print }
' "$SERVER_FILE.tmp" > "$SERVER_FILE"

rm -f "$SERVER_FILE.tmp"

echo "✅ Ultimate fix applied. Now try: node server.js"
