#!/bin/bash

SERVER_FILE="./server.js"
CORS_SNIPPET_FILE="./_cors_patch_snippet.js"

# Create the CORS config snippet
cat > "$CORS_SNIPPET_FILE" << 'EOF'
const cors = require('cors');

// Define allowed origins
const allowedOrigins = [
  'https://urban-space-happiness-97xpvg6q4q6xf96j-3000.app.github.dev',
  'https://cashflowops.pro'
];

// Apply CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS blocked for origin: ' + origin), false);
    }
  },
  credentials: true,
}));
EOF

# Check if server.js exists
if [[ ! -f "$SERVER_FILE" ]]; then
  echo "❌ Error: $SERVER_FILE not found. Make sure you're in the right directory."
  exit 1
fi

# Insert the CORS config after express app initialization
echo "🔧 Patching $SERVER_FILE with proper CORS configuration..."

# Backup first
cp "$SERVER_FILE" "$SERVER_FILE.bak"

# Insert the patch below the express app definition
awk '
/const app = express\(\);/ {
  print;
  print "";
  while ((getline line < "./_cors_patch_snippet.js") > 0) print line;
  close("./_cors_patch_snippet.js");
  next
}
{ print }
' "$SERVER_FILE" > "${SERVER_FILE}.patched"

# Replace original file with patched version
mv "${SERVER_FILE}.patched" "$SERVER_FILE"
rm "$CORS_SNIPPET_FILE"

echo "✅ Patch applied. Backup saved as $SERVER_FILE.bak"
