'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { XMLParser } = require('fast-xml-parser');

const BOOKS_PATH = path.join(__dirname, '..', 'data', 'books.json');
const METADATA_PATH = path.join(__dirname, '..', 'data', 'book-metadata.json');

const FORCE = process.argv.includes('--force');
const SKIP_GOOGLE = process.argv.includes('--skip-google');

const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// ISBN conversion
// ---------------------------------------------------------------------------

function isbn10to13(isbn10) {
  if (isbn10.length !== 10) return null;
  // Validate ISBN-10 check digit
  const body = isbn10.slice(0, 9);
  if (!/^\d{9}$/.test(body)) return null;
  const sum10 = body.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * (10 - i), 0);
  const expected = (11 - (sum10 % 11)) % 11;
  const checkChar = isbn10[9].toUpperCase();
  const actual = checkChar === 'X' ? 10 : parseInt(checkChar, 10);
  if (isNaN(actual) || actual !== expected) return null;
  // Convert to ISBN-13
  const base = '978' + body;
  const weights = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
  const sum13 = base.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
  const check = (10 - (sum13 % 10)) % 10;
  return base + check;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'booklist-enrich/1.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        } else {
          resolve(body);
        }
      });
    }).on('error', reject);
  });
}

function getJson(url) {
  return withRetry(() => get(url).then(body => JSON.parse(body)));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, maxAttempts = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = /HTTP (429|5\d\d)/.test(err.message);
      if (!isRetryable || attempt === maxAttempts) throw err;
      await wait(baseDelay * attempt);
    }
  }
}

// ---------------------------------------------------------------------------
// openBD
// ---------------------------------------------------------------------------

async function fetchOpenBD(isbn13List) {
  const url = `https://api.openbd.jp/v1/get?isbn=${isbn13List.join(',')}`;
  const data = await getJson(url);
  const results = {};

  for (let i = 0; i < isbn13List.length; i++) {
    const item = data[i];
    if (!item) continue;

    const summary = item.summary ?? {};
    const texts = item.onix?.CollateralDetail?.TextContent ?? [];
    const descEntry = Array.isArray(texts)
      ? texts.find(t => String(t.TextType) === '03')
      : (String(texts.TextType) === '03' ? texts : null);

    const pubdate = summary.pubdate ?? null;
    const publishedYear = pubdate ? String(pubdate).slice(0, 4) : null;

    // coverUrl: fallback to NDL thumbnail if openBD has no cover
    const isbn13 = isbn13List[i];
    const coverUrl = summary.cover || `https://ndlsearch.ndl.go.jp/thumbnail/${isbn13}.jpg`;

    results[isbn13] = {
      coverUrl,
      publisher: summary.publisher || null,
      publishedYear,
      description: descEntry?.Text || null,
      sources: ['openbd'],
    };
  }

  return results;
}

// ---------------------------------------------------------------------------
// NDL Search
// ---------------------------------------------------------------------------

const ndlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchNDL(isbn13) {
  const url = `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&query=isbn=${isbn13}&maximumRecords=1`;
  const xml = await withRetry(() => get(url));
  const parsed = ndlParser.parse(xml);

  const records = parsed?.['srw:searchRetrieveResponse']?.['srw:records']?.['srw:record'];
  if (!records) return null;

  const recordData = Array.isArray(records) ? records[0] : records;
  const rdf = recordData?.['srw:recordData']?.['rdf:RDF'];
  if (!rdf) {
    console.warn(`[NDL] unexpected record structure for ISBN ${isbn13}`);
    return null;
  }

  const dc = rdf['dcndl:BibAdminResource'] ?? rdf['dcndl:BibResource'] ?? null;
  if (!dc) {
    console.warn(`[NDL] no BibResource found for ISBN ${isbn13}`);
    return null;
  }

  const publisher = dc['dcterms:publisher']?.['foaf:Agent']?.['foaf:name']
    ?? dc['dc:publisher']
    ?? null;

  const rawDate = dc['dcterms:date'] ?? dc['dc:date'] ?? null;
  const publishedYear = rawDate ? String(rawDate).slice(0, 4) : null;

  return {
    coverUrl: `https://ndlsearch.ndl.go.jp/thumbnail/${isbn13}.jpg`,
    publisher: typeof publisher === 'string' ? publisher : null,
    publishedYear,
    description: null,
    sources: ['ndl'],
  };
}

// ---------------------------------------------------------------------------
// Google Books
// ---------------------------------------------------------------------------

async function fetchGoogleBooks(isbn13) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`;
  const data = await getJson(url);
  const volumeInfo = data?.items?.[0]?.volumeInfo;
  if (!volumeInfo) return null;

  const rawDate = volumeInfo.publishedDate ?? null;
  const publishedYear = rawDate ? String(rawDate).slice(0, 4) : null;
  const coverUrl = volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null;

  return {
    coverUrl,
    publisher: volumeInfo.publisher || null,
    publishedYear,
    description: volumeInfo.description || null,
    sources: ['google_books'],
  };
}

// ---------------------------------------------------------------------------
// Merge helper: fill null fields from a secondary result
// ---------------------------------------------------------------------------

function mergeInto(base, secondary) {
  if (!secondary) return base;
  const merged = { ...base };
  for (const key of ['coverUrl', 'publisher', 'publishedYear', 'description']) {
    if (!merged[key] && secondary[key]) {
      merged[key] = secondary[key];
    }
  }
  if (!merged.sources.includes(secondary.sources[0])) {
    merged.sources = [...merged.sources, ...secondary.sources];
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const books = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));

  let metadata = {};
  if (fs.existsSync(METADATA_PATH)) {
    metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  }

  // Collect ISBNs to fetch
  const targets = books
    .filter(b => b.isbn && b.isbn.length >= 10)
    .filter(b => FORCE || !(b.isbn in metadata));

  if (targets.length === 0) {
    console.log('Nothing to fetch. Use --force to re-fetch all.');
    return;
  }

  console.log(`Fetching ${targets.length} ISBNs (force=${FORCE}, skip-google=${SKIP_GOOGLE})`);

  // Convert ISBN-10 → ISBN-13
  const isbn10to13Map = {};
  const isbn13to10Map = {};
  for (const b of targets) {
    const isbn13 = isbn10to13(b.isbn);
    if (isbn13) {
      isbn10to13Map[b.isbn] = isbn13;
      isbn13to10Map[isbn13] = b.isbn;
    }
  }

  const isbn13List = Object.values(isbn10to13Map);
  const results = {}; // isbn10 → metadata entry
  const failedISBNs = { ndl: [], google: [] };

  // --- Step 1: openBD (bulk, 100 at a time) ---
  let openBDHits = 0;
  const chunks = [];
  for (let i = 0; i < isbn13List.length; i += 100) {
    chunks.push(isbn13List.slice(i, i + 100));
  }

  console.log(`[openBD] ${chunks.length} request(s) for ${isbn13List.length} ISBNs`);
  for (const chunk of chunks) {
    try {
      const chunkResults = await fetchOpenBD(chunk);
      for (const [isbn13, entry] of Object.entries(chunkResults)) {
        const isbn10 = isbn13to10Map[isbn13];
        if (isbn10) {
          results[isbn10] = entry;
          openBDHits++;
        }
      }
    } catch (err) {
      console.error(`[openBD] request failed: ${err.message}`);
    }
  }
  console.log(`[openBD] ${openBDHits} hits`);

  // --- Step 2: NDL Search (sequential, for openBD misses) ---
  const ndlTargets = targets.filter(b => !results[b.isbn]);
  let ndlHits = 0;
  console.log(`[NDL] ${ndlTargets.length} ISBNs to try`);
  for (const b of ndlTargets) {
    const isbn13 = isbn10to13Map[b.isbn];
    if (!isbn13) continue;
    try {
      const entry = await fetchNDL(isbn13);
      if (entry) {
        results[b.isbn] = entry;
        ndlHits++;
      }
    } catch (err) {
      failedISBNs.ndl.push(b.isbn);
    }
    await wait(300);
  }
  console.log(`[NDL] ${ndlHits} hits`);

  // --- Step 3: Google Books (sequential, for description gaps) ---
  if (!SKIP_GOOGLE) {
    const gbTargets = targets.filter(b => !results[b.isbn]?.description);
    let gbHits = 0;
    console.log(`[Google Books] ${gbTargets.length} ISBNs to try`);
    for (const b of gbTargets) {
      const isbn13 = isbn10to13Map[b.isbn];
      if (!isbn13) continue;
      try {
        const entry = await fetchGoogleBooks(isbn13);
        if (entry) {
          if (results[b.isbn]) {
            results[b.isbn] = mergeInto(results[b.isbn], entry);
          } else {
            results[b.isbn] = entry;
          }
          gbHits++;
        }
      } catch (err) {
        failedISBNs.google.push(b.isbn);
      }
      await wait(500);
    }
    console.log(`[Google Books] ${gbHits} hits`);
  }

  // Record all targets (including total misses) and merge into existing metadata
  const today = TODAY;
  for (const b of targets) {
    const entry = results[b.isbn] ?? {
      coverUrl: null,
      publisher: null,
      publishedYear: null,
      description: null,
      sources: [],
    };
    metadata[b.isbn] = { ...entry, fetchedAt: today };
  }

  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');

  const totalHits = Object.values(metadata).filter(e => e.sources.length > 0).length;
  const totalMiss = Object.values(metadata).filter(e => e.sources.length === 0).length;
  console.log(`\nDone. Saved to ${METADATA_PATH}`);
  console.log(`Total records: ${Object.keys(metadata).length} (${totalHits} with data, ${totalMiss} no data)`);
  if (failedISBNs.ndl.length > 0) {
    console.warn(`[NDL] ${failedISBNs.ndl.length} failed: ${failedISBNs.ndl.join(', ')}`);
  }
  if (failedISBNs.google.length > 0) {
    console.warn(`[Google Books] ${failedISBNs.google.length} failed: ${failedISBNs.google.join(', ')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
