// 📁 FILE: rti-trading-backend/deploy.js
// One-click deployment script for RTi Trading Backend

const { exec } = require('child_process');
const fs = require('fs');

console.log('🚀 RTi Trading Backend Deployment Script');
console.log('=========================================\n');

// Check if required files exist
const requiredFiles = ['.env', 'server.js', 'package.json'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
  console.error('❌ Missing required files:', missingFiles.join(', '));
  process.exit(1);
}

// Deployment platforms
const platforms = {
  railway: {
    name: 'Railway',
    commands: [
      'npm install -g @railway/cli',
      'railway login',
      'railway init',
      'railway up'
    ]
  },
  heroku: {
    name: 'Heroku', 
    commands: [
      'npm install -g heroku',
      'heroku login',
      'heroku create rti-trading-backend',
      'git init',
      'git add .',
      'git commit -m "Initial deployment"',
      'heroku git:remote -a rti-trading-backend',
      'git push heroku main'
    ]
  },
  local: {
    name: 'Local Development',
    commands: [
      'npm install',
      'npm run dev'
    ]
  }
};

// Get deployment platform from command line argument
const platform = process.argv[2] || 'local';

if (!platforms[platform]) {
  console.log('Available platforms:');
  Object.keys(platforms).forEach(key => {
    console.log(`  - ${key}: ${platforms[key].name}`);
  });
  console.log('\nUsage: node deploy.js [platform]');
  process.exit(1);
}

const selectedPlatform = platforms[platform];
console.log(`📦 Deploying to: ${selectedPlatform.name}\n`);

// Execute commands sequentially
function executeCommands(commands, index = 0) {
  if (index >= commands.length) {
    console.log('\n✅ Deployment completed successfully!');
    
    if (platform === 'local') {
      console.log('\n🔗 Your backend is running at: http://localhost:5000');
      console.log('📡 Socket.io enabled for real-time features');
      console.log('💳 Stripe integration ready');
      console.log('🔒 Subscription system active');
      console.log('\n📋 Default Admin Login:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('\n🎯 API Endpoints:');
      console.log('   POST /api/auth/login - User login');
      console.log('   POST /api/auth/register - User registration');
      console.log('   GET /api/alerts - Get alerts (limited for FREE users)');
      console.log('   POST /api/subscription/create-checkout-session - Create payment');
    }
    
    return;
  }
  
  const command = commands[index];
  console.log(`⚡ Executing: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error executing command: ${command}`);
      console.error(error.message);
      process.exit(1);
    }
    
    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);
    
    // Continue with next command
    executeCommands(commands, index + 1);
  });
}

// Pre-deployment checks
console.log('🔍 Running pre-deployment checks...\n');

// Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.scripts || !packageJson.scripts.start) {
  console.warn('⚠️  Adding start script to package.json...');
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.start = 'node server.js';
  packageJson.scripts.dev = 'nodemon server.js';
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json\n');
}

// Platform-specific setup
if (platform === 'heroku') {
  // Create Procfile for Heroku
  if (!fs.existsSync('Procfile')) {
    fs.writeFileSync('Procfile', 'web: node server.js');
    console.log('✅ Created Procfile for Heroku\n');
  }
}

if (platform === 'railway') {
  // Create railway.json
  const railwayConfig = {
    build: {
      builder: "nixpacks"
    },
    deploy: {
      startCommand: "node server.js",
      restartPolicyType: "on_failure"
    }
  };
  
  if (!fs.existsSync('railway.json')) {
    fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
    console.log('✅ Created railway.json\n');
  }
}

// Start deployment
console.log('🚀 Starting deployment...\n');
executeCommands(selectedPlatform.commands);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Deployment interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Deployment terminated');
  process.exit(0);
});
