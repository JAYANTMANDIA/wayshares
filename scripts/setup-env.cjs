// Creates a local environment template without overwriting existing credentials.
'use strict';
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('.env already exists; leaving it unchanged.');
  process.exit(0);
}

fs.copyFileSync(examplePath, envPath, { flag: 'wx' });
console.log('Created .env from .env.example. Add your Firebase and provider configuration locally.');