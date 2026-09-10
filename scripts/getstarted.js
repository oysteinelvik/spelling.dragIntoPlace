'use strict';

const fs = require('fs');
const path = require('path');
const { buildContent } = require('./build-content');

const ROOT = path.resolve(__dirname, '..');

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    throw new Error(`Node.js 18+ is required (found ${process.versions.node}). Install a newer Node.js and try again.`);
  }
  console.log(`Node.js ${process.versions.node} OK.`);
}

function main() {
  console.log('Setting up Drag Into Place...\n');
  checkNodeVersion();

  fs.mkdirSync(path.join(ROOT, 'dist', 'packages'), { recursive: true });
  console.log('Created dist/packages/ output directory.');

  console.log('\nBuilding language content from content/words.csv...');
  buildContent();

  console.log('\nSetup complete. No extra dependencies are required, this project is dependency-free.');
  console.log('Next steps:');
  console.log('  npm run console    Open the developer console (rebuild, preview, package & upload)');
  console.log('  npm run build:content    Rebuild lang/*/data.json from the spreadsheet only');
  console.log('  npm run build:packages   Build the engine + language ZIPs only');
}

try {
  main();
} catch (error) {
  console.error(`\nSetup failed: ${error.message}`);
  process.exitCode = 1;
}
