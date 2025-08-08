#!/bin/bash

TARGET_FILE="server.js"
BACKUP_FILE="server.js.bak"

# Backup the file before making changes
cp "$TARGET_FILE" "$BACKUP_FILE"

# Check if route already exists
if grep -q "app.get('/api/users/active'" "$TARGET_FILE"; then
  echo "✅ Route already exists. No changes made."
  exit 0
fi

# Insert route safely
awk '
/app.listen|module\.exports/ && !added {
  print "\n// ✅ ADDED: Users Active Route"
  print "app.get('\''/api/users/active'\'', (req, res) => {"
  print "  res.json({ count: 7 }); // dummy active user count"
  print "});\n"
  added=1
}
{ print }
' "$TARGET_FILE" > tmp && mv tmp "$TARGET_FILE"

echo "✅ Route '/api/users/active' has been added to $TARGET_FILE"
