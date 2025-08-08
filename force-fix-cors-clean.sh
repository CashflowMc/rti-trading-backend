#!/bin/bash

echo "📦 Backing up server.js to server.js.bak..."
cp server.js server.js.bak

echo "🧼 Removing all 'const cors = require' and 'import cors' lines..."
sed -i "/require('cors')/d" server.js
sed -i "/import cors/d" server.js

echo "🔁 Inserting CommonJS require('cors') at the top..."
sed -i "1s/^/const cors = require('cors');\n/" server.js

echo "🧼 Removing all 'app.use(cors' middleware..."
sed -i "/app.use(cors/d" server.js

echo "🔁 Adding single safe CORS middleware after express()..."
# Insert after the line where app is defined
sed -i "/const app = express()/a app.use(cors({ origin: '*', credentials: true }));" server.js

echo "✅ Clean and safe CORS patch applied. Try running: node server.js"
