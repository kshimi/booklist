'use strict';

const fs = require('fs');
const path = require('path');

const EXCLUDED_NAMES = ['self_check', '20120330_1246_33_0706', 'to_1733_912_003_5_at'];

const GENRE_RULES = [
  { test: (p) => p.includes('エッセイ'), genre: 'エッセイ' },
  { test: (p) => p.includes('日本の作家'), genre: 'フィクション（日本）' },
  { test: (p) => / SF/.test(p) || /\/SF/.test(p), genre: 'SF' },
  { test: (p) => p.includes('ノンフィクション'), genre: 'ノンフィクション' },
  { test: (p) => p.includes('フィクション'), genre: 'フィクション' },
  { test: (p) => p.includes('実用'), genre: '実用' },
  { test: (p) => p.includes('家庭'), genre: '家庭' },
  { test: (p) => p.includes('漫画') || p.includes('コミック'), genre: '漫画・コミック' },
  { test: (p) => p.includes('コンピュータ') || p.includes("O'Reilly"), genre: 'コンピュータ' },
  { test: (p) => p.includes('運転関係'), genre: '運転' },
];

const GENRE_PRIORITY = {
  'SF': 10,
  'フィクション（日本）': 9,
  'エッセイ': 8,
  'ノンフィクション': 7,
  'コンピュータ': 7,
  '運転': 7,
  '実用': 6,
  '家庭': 6,
  '漫画・コミック': 5,
  'フィクション': 4,
  '未分類': 0,
};

/**
 * Parse CSV text into an array of row objects.
 * Handles quoted fields containing commas and newlines.
 */
function parseCSV(text) {
  const records = [];
  let pos = 0;
  const len = text.length;

  function parseField() {
    if (pos >= len) return '';
    if (text[pos] === '"') {
      pos++; // skip opening quote
      let value = '';
      while (pos < len) {
        if (text[pos] === '"') {
          if (pos + 1 < len && text[pos + 1] === '"') {
            value += '"';
            pos += 2;
          } else {
            pos++; // skip closing quote
            break;
          }
        } else {
          value += text[pos++];
        }
      }
      return value;
    } else {
      let value = '';
      while (pos < len && text[pos] !== ',' && text[pos] !== '\n' && text[pos] !== '\r') {
        value += text[pos++];
      }
      return value;
    }
  }

  function parseRecord() {
    const fields = [];
    while (pos < len) {
      fields.push(parseField());
      if (pos < len && text[pos] === ',') {
        pos++;
      } else {
        if (pos < len && text[pos] === '\r') pos++;
        if (pos < len && text[pos] === '\n') pos++;
        break;
      }
    }
    return fields;
  }

  const headerFields = parseRecord();
  const headers = headerFields.map(h => h.trim());

  while (pos < len) {
    if (text[pos] === '\r' || text[pos] === '\n') {
      pos++;
      continue;
    }
    const fields = parseRecord();
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] || '').trim();
    });
    records.push(row);
  }

  return records;
}

/**
 * Filter CSV rows to PDF files only, excluding management files.
 */
function filterRecords(rows) {
  return rows.filter(row => {
    const mimeType = row['MIME タイプ'] || '';
    const filename = row['ファイル名'] || '';
    if (mimeType !== 'application/pdf') return false;
    if (EXCLUDED_NAMES.some(name => filename.includes(name))) return false;
    return true;
  });
}

/**
 * Parse a PDF filename into book metadata fields.
 * Extracts: title, author, isbn, pages, series, version
 */
function parseFilename(filename) {
  let work = filename;

  // Step 1: Version detection and prefix removal
  let version = 'original';
  if (/^kindlep(w)?_/.test(work)) {
    version = 'kindle';
    work = work.replace(/^kindlep(w)?_/, '');
  } else if (work.startsWith('ipad3_')) {
    version = 'ipad3';
    work = work.slice('ipad3_'.length);
  }

  // Step 2: Remove .pdf extension
  if (work.endsWith('.pdf')) {
    work = work.slice(0, -4);
  }

  // Step 3: Extract ISBN (underscore + 10-13 alphanumeric chars at end)
  let isbn = null;
  const isbnMatch = work.match(/_([A-Za-z0-9]{10,13})$/);
  if (isbnMatch) {
    isbn = isbnMatch[1];
    work = work.slice(0, -isbnMatch[0].length);
  }

  // Step 4: Extract page count (space + digits + p at end)
  let pages = null;
  const pagesMatch = work.match(/ (\d+)p$/);
  if (pagesMatch) {
    pages = parseInt(pagesMatch[1], 10);
    work = work.slice(0, -pagesMatch[0].length);
  }

  // Step 5 & 6: Find author as text after the last closing bracket
  const lastClose = Math.max(work.lastIndexOf('）'), work.lastIndexOf(')'));
  let author = '';
  let titlePart = work;

  if (lastClose >= 0) {
    author = work.slice(lastClose + 1).trim();
    titlePart = work.slice(0, lastClose + 1);
  }

  // Extract series names from all bracket groups in titlePart
  const seriesMatches = [];
  const seriesRegex = /[（(]([^）)]+)[）)]/g;
  let seriesMatch;
  while ((seriesMatch = seriesRegex.exec(titlePart)) !== null) {
    const s = seriesMatch[1].trim();
    if (s) seriesMatches.push(s);
  }
  const series = seriesMatches.length > 0 ? seriesMatches.join('／') : null;

  // Step 7: Title is the titlePart with bracket groups and orphaned brackets removed
  const title = titlePart
    .replace(/[（(][^）)]+[）)]/g, '')
    .replace(/[）)（(]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, author, isbn, pages, series, version };
}

/**
 * Estimate genre from folder path using priority-ordered keyword matching.
 */
function estimateGenre(folderPath) {
  for (const rule of GENRE_RULES) {
    if (rule.test(folderPath)) return rule.genre;
  }
  return '未分類';
}

/**
 * Deduplicate file records into unique book entries.
 * Groups by ISBN (if present) or title; prefers original version values.
 */
function deduplicateBooks(files) {
  const groups = new Map();

  for (const file of files) {
    const key = file.isbn !== null ? file.isbn : file.title;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(file);
  }

  const books = [];
  for (const [, group] of groups) {
    const original = group.find(f => f.version === 'original') || group[0];

    const bestGenre = group.reduce((best, f) => {
      const p = GENRE_PRIORITY[f.genre] ?? 0;
      const bestP = GENRE_PRIORITY[best] ?? 0;
      return p > bestP ? f.genre : best;
    }, group[0].genre);

    const isbn = group.find(f => f.isbn !== null)?.isbn ?? null;
    const pages = group.find(f => f.pages !== null)?.pages ?? null;

    books.push({
      title: original.title,
      author: original.author,
      genre: bestGenre,
      series: original.series,
      isbn,
      pages,
      versions: group.map(f => f.version),
      file_url: original.file_url,
      file_id: original.file_id,
    });
  }

  return books;
}

/**
 * Generate a stable unique ID for a book.
 * Uses ISBN if available; otherwise a djb2 hash of the title.
 */
function generateId(book) {
  if (book.isbn) return book.isbn;
  let hash = 5381;
  for (let i = 0; i < book.title.length; i++) {
    hash = (((hash << 5) + hash) + book.title.charCodeAt(i)) >>> 0;
  }
  return 'title_' + hash.toString(16).padStart(8, '0');
}

function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'booklist.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: ${csvPath} not found`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvText);

  const pdfRows = rows.filter(r => r['MIME タイプ'] === 'application/pdf');
  const nonPdfCount = rows.length - pdfRows.length;
  const managementCount = pdfRows.filter(r =>
    EXCLUDED_NAMES.some(n => (r['ファイル名'] || '').includes(n))
  ).length;

  const filtered = filterRecords(rows);

  const files = filtered.map(row => {
    const parsed = parseFilename(row['ファイル名'] || '');
    const genre = estimateGenre(row['フォルダパス'] || '');
    return {
      ...parsed,
      genre,
      folder_path: row['フォルダパス'] || '',
      file_url: row['ファイルURL'] || '',
      file_id: row['ファイルID'] || '',
      file_size_mb: parseFloat(row['ファイルサイズ (MB)'] || '0'),
    };
  });

  const books = deduplicateBooks(files);

  books.sort((a, b) => a.title.localeCompare(b.title, 'ja'));

  const output = books.map(book => ({
    id: generateId(book),
    title: book.title,
    author: book.author,
    genre: book.genre,
    series: book.series,
    isbn: book.isbn,
    pages: book.pages,
    versions: book.versions,
    file_url: book.file_url,
    file_id: book.file_id,
  }));

  const outPath = path.join(__dirname, '..', 'data', 'books.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log('処理完了');
  console.log(`  入力レコード数: ${rows.length}`);
  console.log(`  除外レコード数: ${rows.length - filtered.length} (非PDF: ${nonPdfCount}, 管理用ファイル: ${managementCount})`);
  console.log(`  パース済みファイル数: ${filtered.length}`);
  console.log(`  統合後書籍数: ${output.length}`);
  console.log(`  出力ファイル: data/books.json`);
}

module.exports = { parseCSV, filterRecords, parseFilename, estimateGenre, deduplicateBooks, generateId };

if (require.main === module) {
  main();
}
