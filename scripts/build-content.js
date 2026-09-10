'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'content', 'words.csv');
const LANG_DIR = path.join(ROOT, 'lang');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((key, index) => { row[key.trim()] = (cells[index] || '').trim(); });
    return row;
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { current += char; }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current); current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Rebuilds every lang/<code>/data.json from content/words.csv (the "spreadsheet").
 * @param {(line: string) => void} [log]
 */
function buildContent(log = console.log) {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Spreadsheet not found: ${path.relative(ROOT, CSV_PATH)}`);
  }
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  if (rows.length === 0) throw new Error('Spreadsheet has no word rows.');

  const byLang = new Map();
  const seenIds = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based line numbers
    const lang = row.lang;
    const targetWord = (row.target_word || '').toLowerCase();
    if (!lang) throw new Error(`Row ${rowNumber}: missing "lang".`);
    if (!/^[a-z]+$/.test(targetWord)) throw new Error(`Row ${rowNumber}: "target_word" must be lowercase Roman letters, got "${row.target_word}".`);
    const levelId = Number(row.level_id);
    if (!Number.isInteger(levelId)) throw new Error(`Row ${rowNumber}: "level_id" must be an integer.`);

    const idKey = `${lang}:${levelId}`;
    if (seenIds.has(idKey)) throw new Error(`Row ${rowNumber}: duplicate level_id ${levelId} for lang "${lang}".`);
    seenIds.set(idKey, true);

    const foils = (row.foils || '').split('|').map((letter) => letter.trim().toLowerCase()).filter(Boolean);
    if (foils.some((letter) => !/^[a-z]$/.test(letter))) throw new Error(`Row ${rowNumber}: foils must be single Roman letters, got "${row.foils}".`);

    const letters = targetWord.split('');
    const puzzle = {
      level_id: levelId,
      target_word: targetWord,
      letters,
      foils,
      image: `lang/${lang}/images/${targetWord}.png`,
      hint_image: `lang/${lang}/images/${targetWord}-hint.png`,
      word_audio: `lang/${lang}/audios/${targetWord}.mp3`,
      letter_audio: letters.map((letter) => `lang/${lang}/audios/${letter}.mp3`),
      emoji: row.emoji || '🧩'
    };

    if (!byLang.has(lang)) byLang.set(lang, { display_name: row.display_name || lang, puzzles: [] });
    byLang.get(lang).puzzles.push(puzzle);
  });

  fs.mkdirSync(LANG_DIR, { recursive: true });
  const builtLanguages = [];
  for (const [lang, content] of byLang) {
    content.puzzles.sort((a, b) => a.level_id - b.level_id);
    const outDir = path.join(LANG_DIR, lang);
    fs.mkdirSync(outDir, { recursive: true });
    const data = { schema_version: 1, lang, display_name: content.display_name, puzzles: content.puzzles };
    fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(data, null, 2) + '\n');
    builtLanguages.push({ lang, count: content.puzzles.length });
    log(`  built lang/${lang}/data.json (${content.puzzles.length} words)`);
  }
  log(`Rebuilt ${builtLanguages.length} language pack(s) from ${path.relative(ROOT, CSV_PATH)}.`);
  return builtLanguages;
}

if (require.main === module) {
  try {
    buildContent();
  } catch (error) {
    console.error(`Rebuild failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildContent, LANG_DIR, CSV_PATH };
