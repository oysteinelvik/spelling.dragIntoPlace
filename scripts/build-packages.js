'use strict';

const fs = require('fs');
const path = require('path');
const { createZip } = require('./lib/zip');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const LANG_DIR = path.join(ROOT, 'lang');
const DIST_DIR = path.join(ROOT, 'dist', 'packages');
const ENGINE_FILES = ['index.html', 'app.js', 'styles.css'];

function walk(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, base));
    else files.push({ name: path.relative(base, full).replace(/\\/g, '/'), data: fs.readFileSync(full) });
  }
  return files;
}

/**
 * Builds the engine ZIP and one language ZIP per language pack currently in lang/.
 * @param {(line: string) => void} [log]
 * @returns {{ engineZip: string, languageZips: string[] }}
 */
function buildPackages(log = console.log) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const engineSlug = CONFIG.engineSlug;

  const engineEntries = ENGINE_FILES.map((name) => {
    const full = path.join(ROOT, name);
    if (!fs.existsSync(full)) throw new Error(`Engine file missing: ${name}`);
    return { name, data: fs.readFileSync(full) };
  });
  const engineZipPath = path.join(DIST_DIR, `${engineSlug}-core.zip`);
  fs.writeFileSync(engineZipPath, createZip(engineEntries));
  log(`  built ${path.relative(ROOT, engineZipPath)} (index.html, app.js, styles.css)`);

  if (!fs.existsSync(LANG_DIR)) throw new Error('No lang/ directory found. Run the rebuild step first.');
  const languageZips = [];
  for (const dirEntry of fs.readdirSync(LANG_DIR, { withFileTypes: true })) {
    if (!dirEntry.isDirectory()) continue;
    const langCode = dirEntry.name;
    const langPath = path.join(LANG_DIR, langCode);
    const files = walk(langPath, LANG_DIR).map((file) => ({ name: `lang/${file.name}`, data: file.data }));
    if (files.length === 0) continue;
    const zipPath = path.join(DIST_DIR, `${engineSlug}-lang-${langCode}.zip`);
    fs.writeFileSync(zipPath, createZip(files));
    languageZips.push(zipPath);
    log(`  built ${path.relative(ROOT, zipPath)} (${files.length} file(s))`);
  }

  log(`Packaged engine + ${languageZips.length} language pack(s) into ${path.relative(ROOT, DIST_DIR)}/.`);
  return { engineZip: engineZipPath, languageZips };
}

if (require.main === module) {
  try {
    buildPackages();
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildPackages, DIST_DIR };
