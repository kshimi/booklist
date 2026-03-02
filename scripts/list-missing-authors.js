'use strict';

/**
 * List books with empty author fields that are not yet registered in book-corrections.json.
 *
 * Usage:
 *   node scripts/list-missing-authors.js             # List remaining books without authors
 *   node scripts/list-missing-authors.js --generate  # Generate/update data/book-corrections.json
 */

const fs = require('fs');
const path = require('path');

const BOOKS_PATH = path.join(__dirname, '..', 'data', 'books.json');
const CORRECTIONS_PATH = path.join(__dirname, '..', 'data', 'book-corrections.json');

function loadBooks() {
  if (!fs.existsSync(BOOKS_PATH)) {
    console.error(`Error: ${BOOKS_PATH} not found. Run node scripts/process.js first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8'));
}

function loadCorrections() {
  if (!fs.existsSync(CORRECTIONS_PATH)) return [];
  return JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf-8')).corrections || [];
}

function listMissing() {
  const books = loadBooks();
  const corrections = loadCorrections();
  const registeredTitles = new Set(corrections.map(c => c.original_title));

  const missing = books.filter(b => b.author === '' && !registeredTitles.has(b.title));

  if (missing.length === 0) {
    console.log('著者名が空の未登録書籍はありません。');
    return;
  }

  console.log(`著者名が未設定の書籍: ${missing.length} 件`);
  console.log('');
  missing.forEach((b, i) => {
    console.log(`${i + 1}. ${b.title}`);
  });
}

function generateCorrections() {
  const books = loadBooks();
  const existing = loadCorrections();
  const existingTitles = new Set(existing.map(c => c.original_title));

  const newEntries = books
    .filter(b => b.author === '' && !existingTitles.has(b.title))
    .map(b => ({ original_title: b.title, title: b.title, author: '' }));

  if (newEntries.length === 0) {
    console.log('追加すべきエントリはありません。');
    return;
  }

  const merged = { corrections: [...existing, ...newEntries] };
  fs.writeFileSync(CORRECTIONS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`data/book-corrections.json に ${newEntries.length} 件のエントリを追加しました。`);
  console.log('著者名を調査して author フィールドを記入してください。');
}

const args = process.argv.slice(2);
if (args.includes('--generate')) {
  generateCorrections();
} else {
  listMissing();
}
