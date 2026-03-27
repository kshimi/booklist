'use strict';

const fs = require('fs');
const path = require('path');

const KINDLE_CSV_PATH = path.join(__dirname, '..', 'data', 'kindle-list.csv');
const KINDLE_BOOKS_PATH = path.join(__dirname, '..', 'data', 'kindle-books.json');
const KINDLE_EXCLUDED_PATH = path.join(__dirname, '..', 'data', 'kindle-excluded.csv');
const KINDLE_MERGED_PATH = path.join(__dirname, '..', 'data', 'kindle-merged.csv');

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
      pos++;
      let value = '';
      while (pos < len) {
        if (text[pos] === '"') {
          if (pos + 1 < len && text[pos + 1] === '"') {
            value += '"';
            pos += 2;
          } else {
            pos++;
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
 * Step 1: Deduplicate by ASIN and filter to SUCCESS orders only.
 * Amazon CSV has multiple rows per ASIN (one per Component Type: Tax, Price Amount, etc.)
 */
function deduplicateByAsin(rows) {
  const seen = new Map();
  for (const row of rows) {
    const asin = (row['ASIN'] || '').trim();
    const status = (row['Order Status'] || '').trim();
    if (!asin || status !== 'SUCCESS') continue;
    if (!seen.has(asin)) {
      seen.set(asin, row);
    }
  }
  return Array.from(seen.values());
}

/**
 * Step 2: Filter out non-book items.
 * Returns { books, excluded } where excluded has reason attached.
 */
function filterBooks(rows) {
  const books = [];
  const excluded = [];

  for (const row of rows) {
    const title = (row['Product Name'] || '').trim();
    const asin = (row['ASIN'] || '').trim();

    let reason = null;
    if (/\[ビデオ\]|\[Video\]/.test(title)) {
      reason = 'video';
    } else if (/\[雑誌\]/.test(title)) {
      reason = 'magazine';
    } else if (/無料|試し読み|お試し/.test(title)) {
      reason = 'free_trial';
    }

    if (reason) {
      excluded.push({ asin, title, reason });
    } else {
      books.push(row);
    }
  }

  return { books, excluded };
}

// Volume suffix patterns in priority order.
// Each pattern is tried in sequence; the first match is applied.
const VOLUME_PATTERNS = [
  // Priority 1: （上）（下）（中）
  /[（(][上下中][）)]\s*$/,
  // Priority 2: trailing 全角space + 上/下/中
  /[\u3000　]\s*[上下中]\s*$/,
  // Priority 3: 漢数字 in （） e.g. （一）〜（十...）
  /[（(][一二三四五六七八九十百千万]+[）)]\s*$/,
  // Priority 4: 全角アラビア数字 in （） e.g. （１）〜（n）
  /[（(][０-９]+[）)]\s*$/,
  // Priority 5: 半角数字 in () e.g. (7)
  /\([0-9]+\)\s*$/,
  // Priority 6: trailing half-width space + Arabic digits (but not if the number is part of a title like "三体Ⅱ")
  / [0-9]+\s*$/,
  // Priority 7: Roman numeral suffix at end (I through XV etc.) — only at end, not within title
  / [IVXivx]{1,6}\s*$/,
];

/**
 * Generate a group key by stripping volume suffixes from a title.
 * Tries patterns in priority order; removes the first match found.
 * Also strips trailing whitespace.
 */
function makeGroupKey(title) {
  let key = title;
  for (const pattern of VOLUME_PATTERNS) {
    const stripped = key.replace(pattern, '').trim();
    if (stripped !== key.trim() && stripped.length > 0) {
      return stripped;
    }
  }
  return key.trim();
}

/**
 * Step 3: Merge multi-volume books (上下巻, numbered series) into single entries.
 * Returns { merged: Book[], mergedGroups: MergeRecord[] }
 * where mergedGroups only contains groups with 2+ original entries.
 */
function mergeVolumes(rows) {
  // Build group key → rows mapping, preserving insertion order
  const groups = new Map();

  for (const row of rows) {
    const title = (row['Product Name'] || '').trim();
    const asin = (row['ASIN'] || '').trim();
    const key = makeGroupKey(title);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ title, asin, row });
  }

  const merged = [];
  const mergedGroups = [];

  for (const [key, entries] of groups) {
    const representativeAsin = entries[0].asin;
    const allAsins = entries.map(e => e.asin);
    const allTitles = entries.map(e => e.title);

    merged.push({
      title: key,
      asin: representativeAsin,
      asins: allAsins,
    });

    if (entries.length > 1) {
      mergedGroups.push({
        title: key,
        asin: representativeAsin,
        merged_titles: allTitles.join('|'),
        merged_asins: allAsins.join('|'),
      });
    }
  }

  return { merged, mergedGroups };
}

/**
 * Write a CSV file from an array of objects with given column order.
 */
function writeCsv(filePath, columns, rows) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? '');
      // Quote fields containing comma, newline, or double-quote
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',')
  );
  fs.writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf-8');
}

function main() {
  if (!fs.existsSync(KINDLE_CSV_PATH)) {
    console.error(`Error: ${KINDLE_CSV_PATH} not found`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(KINDLE_CSV_PATH, 'utf-8');
  const rows = parseCSV(csvText);
  console.log(`入力レコード数: ${rows.length}`);

  // Step 1: deduplicate by ASIN, filter to SUCCESS
  const deduped = deduplicateByAsin(rows);
  console.log(`重複排除後（SUCCESS）: ${deduped.length} 件`);

  // Step 2: filter non-books
  const { books, excluded } = filterBooks(deduped);
  console.log(`書籍絞り込み後: ${books.length} 件（除外: ${excluded.length} 件）`);

  // Step 3: merge volumes
  const { merged, mergedGroups } = mergeVolumes(books);
  const mergedCount = books.length - merged.length;
  console.log(`複数巻統合後: ${merged.length} 件（統合: ${mergedGroups.length} グループ、${mergedCount} 件削減）`);

  // Write outputs
  fs.writeFileSync(KINDLE_BOOKS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`出力: ${KINDLE_BOOKS_PATH}`);

  writeCsv(KINDLE_EXCLUDED_PATH, ['asin', 'title', 'reason'], excluded);
  console.log(`出力: ${KINDLE_EXCLUDED_PATH}`);

  writeCsv(KINDLE_MERGED_PATH, ['title', 'asin', 'merged_titles', 'merged_asins'], mergedGroups);
  console.log(`出力: ${KINDLE_MERGED_PATH}`);
}

module.exports = { parseCSV, deduplicateByAsin, filterBooks, makeGroupKey, mergeVolumes };

if (require.main === module) {
  main();
}
