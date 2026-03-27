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
    const subscriptionType = (row['Subscription Order Type'] || '').trim();

    let reason = null;
    if (/\[ビデオ\]|\[Video\]/.test(title)) {
      // Amazon video content with explicit [ビデオ]/[Video] tag
      reason = 'video';
    } else if (/[\[［]雑誌[\]］]/.test(title)) {
      // Magazines tagged with [雑誌] or ［雑誌］ (half-width or fullwidth brackets)
      reason = 'magazine';
    } else if (/無料|試し読み|お試し/.test(title)) {
      // Free trial / sample editions
      reason = 'free_trial';
    } else if (/\(字幕版\)|\(吹替版\)/.test(title)) {
      // Movies sold via Kindle/Prime Video with subtitle/dub markers
      reason = 'video';
    } else if (/STARTER BOOK/.test(title)) {
      // Promotional first-volume samples (e.g. ONE PIECE STARTER BOOK 1)
      reason = 'starter_book';
    } else if (subscriptionType === 'Subscription_Renewal') {
      // Subscription renewals: Kindle Unlimited, Prime
      reason = 'subscription';
    } else if (/予告編/.test(title)) {
      // Movie trailer collections
      reason = 'video';
    } else if (/^第[0-9０-９一二三四五六七八九十]+話/.test(title)) {
      // Single TV episode sales (e.g. "第1話 戦車道、始めます！")
      reason = 'video';
    } else if (/リマスター版/.test(title)) {
      // Remastered video editions (e.g. 進撃の巨人 リマスター版)
      reason = 'video';
    } else if (/リリース記念版/.test(title)) {
      // Release-commemoration promotional editions
      reason = 'promotional';
    } else if (title === 'Not Applicable') {
      // Placeholder entries with no meaningful title
      reason = 'invalid';
    } else if (/^るるぶ/.test(title) || /^地球の歩き方/.test(title)) {
      // Travel guidebooks
      reason = 'travel_guide';
    } else if (/^(YouTube|NHKプラス|TVer|Silk Browser|AirScreen)([ (（]|$)/.test(title)) {
      // Standalone app purchases
      reason = 'app';
    } else if (/\(MAGon\)/.test(title)) {
      // MAGon digital magazine platform items
      reason = 'magazine';
    } else if (/^新潮文庫の100冊/.test(title)) {
      // Annual promotional book catalog (not a book itself)
      reason = 'promotional';
    } else if (/^BRUTUS/.test(title)) {
      // BRUTUS magazine special editions (not always tagged [雑誌])
      reason = 'magazine';
    } else if (/^(劇場版 ?)?SPEC([ 　～]|$)/.test(title)) {
      // SPEC TV drama / theatrical film series sold as Kindle video items
      reason = 'video';
    } else if (/^ネタばれ注意！/.test(title)) {
      // TV show digest summaries
      reason = 'video';
    } else if (
      // Items not detectable by structural pattern; user-requested exclusions
      ['RRR', '突然！２０５０年'].includes(title) ||
      title === '新生グリー誕生' ||
      /^(レモンエンジェル|ＨＯＴＥＬ|ＥＤＥＮ|ハンツー×トラッシュ|生贄投票)/.test(title) ||
      /^一万円でオシャレになる方法/.test(title)
    ) {
      reason = 'excluded';
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
  // Priority 2: trailing 全角space + 上/下/中 (+ optional 巻) e.g. "　上", "　下巻"
  /[\u3000　]\s*[上下中]巻?\s*$/,
  // Priority 2b: trailing 半角space + 上/下/中 (+ optional 巻) e.g. " 上", " 下巻"
  / [上下中]巻?\s*$/,
  // Priority 3: 漢数字 or katakana ニ in （） e.g. （一）〜（十...）, （ニ）
  /[（(][一二三四五六七八九十百千万ニ]+[）)]\s*$/,
  // Priority 4: digits in （）— fullwidth or half-width digits, fullwidth or half-width brackets
  /[（(][０-９0-9]+[）)]\s*$/,
  // Priority 4b: digits + 巻 e.g. " 9巻", "　１６巻"
  /[ \u3000　][０-９0-9]+巻\s*$/,
  // Priority 5: 半角数字 in () e.g. (7)
  /\([0-9]+\)\s*$/,
  // Priority 6: trailing half-width space + Arabic digits (but not if the number is part of a title like "三体Ⅱ")
  / [0-9]+\s*$/,
  // Priority 6b: trailing fullwidth space + Arabic digits e.g. "弱虫ペダル　16"
  /[\u3000　][0-9]+\s*$/,
  // Priority 6c: digits directly attached (no space) — fullwidth e.g. "海猿１２" or half-width e.g. "ムショ医1"
  /[０-９0-9]+\s*$/,
  // Priority 6d: 第n巻 suffix (with or without preceding space) e.g. "第１巻", "第一巻", "限界集落(ギリギリ)温泉第四巻"
  /[ \u3000　]?第[０-９0-9一二三四五六七八九十百千万]+巻?\s*$/,
  // Priority 7: Roman numeral suffix at end (I through XV etc.) — only at end, not within title.
  // NOTE: Intentionally broad — matches any trailing 1-6 char combination of I/V/X.
  // False positives are possible but rare for Japanese book titles.
  / [IVXivx]{1,6}\s*$/,
  // Priority 8: enclosed circled digit ①-⑳ followed by subtitle e.g. "ピーターラビット ①　おはなし　-TITLE-"
  / [\u2460-\u2473].+$/,
  // Priority 9: wave-dash subtitle e.g. "ムショ医 ～再診～"
  / ～[^～]+～\s*$/,
  // Priority 10: space + subtitle ending in 編 e.g. "犬のかがやき かにとなかよく編", "犬のかがやき　日常編"
  // NOTE: Applied last as it is the most aggressive; only triggers when no other pattern matches.
  /[ \u3000　].+編\s*$/,
];

/**
 * Generate a group key by stripping volume suffixes from a title.
 * Applies a series of pre-strip transformations before trying VOLUME_PATTERNS.
 */
function makeGroupKey(title) {
  let key = title;

  // 1. Strip trailing publisher/series suffix in half-width parens e.g. " (モーニングコミックス)".
  //    Only removes parens whose content starts with a non-digit, preserving "(7)"-style volume patterns.
  key = key.replace(/\s*\([^\d()][^()]*\)\s*$/, '').trim();

  // 2. Strip leading and trailing 【...】 markers e.g. "【対訳】" prefix or "【特典付き】" suffix.
  key = key.replace(/^【[^】]*】\s*/, '').replace(/\s*【[^】]*】\s*$/, '').trim();

  // 3. Strip volume-count annotations e.g. "〈全５巻〉".
  key = key.replace(/\s*〈全[０-９0-9]+巻〉\s*/g, ' ').trim();

  // 3b. Strip editorial annotations in 〔〕 e.g. "〔新版〕".
  key = key.replace(/\s*〔[^〕]*〕\s*/g, ' ').trim();

  // 4. Strip subtitle prefix before "──" separator e.g. "サブタイトル──シリーズ名 I" → "シリーズ名 I".
  //    Used in some publishers' format (e.g. ローマ人の物語[電子版]).
  key = key.replace(/^.+──/, '').trim();

  // 5. If title ends with " {word}・シリーズ", use the series label as the group key
  //    e.g. "グレー・レンズマン レンズマン・シリーズ" → "レンズマン・シリーズ".
  const seriesLabelMatch = key.match(/^.+\s(\S+・シリーズ)\s*$/);
  if (seriesLabelMatch) return seriesLabelMatch[1];

  // 6. Strip text that follows a volume bracket mid-title e.g. "チェーザレ（１）　副題 シリーズ名" → "チェーザレ（１）".
  //    Applies when 上下中, digit/kanji/katakana ニ in brackets appears before more text.
  key = key.replace(/([（(][上下中一二三四五六七八九十百千万ニ０-９0-9]+[）)])\s*.+$/, '$1').trim();

  // 7. Strip Roman numeral directly after "]" or "］" e.g. "ローマ人の物語［電子版］XIV" → "ローマ人の物語［電子版］".
  key = key.replace(/(?<=[\]］])[IVXivx]{1,6}\s*$/, '').trim();

  // 8. Strip fullwidth-digit + fullwidth-space + subtitle e.g. "見仏記２　仏友篇" → "見仏記".
  key = key.replace(/[０-９0-9]+[\u3000　].+$/, '').trim();

  // 8b. Strip fullwidth-space + digit(s) + colon + subtitle e.g. "ブス界へようこそ　10: 桔梗信玄" → "ブス界へようこそ".
  key = key.replace(/[\u3000　][０-９0-9]+:.+$/, '').trim();

  // 8c. Strip half-width space + digit(s) + space + subtitle e.g. "史記 1 項羽と劉邦 上" → "史記".
  key = key.replace(/ [0-9]+ .+$/, '').trim();

  // Apply VOLUME_PATTERNS repeatedly until no more patterns match.
  // This handles stacked suffixes e.g. "犬のかがやき　日常編　1" → strip "　1" → strip "　日常編" → "犬のかがやき".
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of VOLUME_PATTERNS) {
      const stripped = key.replace(pattern, '').trim();
      if (stripped !== key.trim() && stripped.length > 0) {
        key = stripped;
        changed = true;
        break;
      }
    }
  }
  return key;
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
