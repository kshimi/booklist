'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isbn10to13, mergeInto, runGoogleBooksStep } = require('./enrich.js');

// ---------------------------------------------------------------------------
// isbn10to13
// ---------------------------------------------------------------------------

describe('isbn10to13', () => {
  test('converts valid ISBN-10 to ISBN-13', () => {
    assert.equal(isbn10to13('4101001014'), '9784101001012');
  });

  test('returns null for ISBN shorter than 10 chars', () => {
    assert.equal(isbn10to13('123'), null);
  });

  test('returns null for ISBN with invalid check digit', () => {
    assert.equal(isbn10to13('4101001019'), null);
  });

  test('handles ISBN-10 with X check digit', () => {
    const result = isbn10to13('000000000X');
    // 000000000X: checksum = sum(0*10..0*2) = 0, expected = (11 - 0%11)%11 = 0; X=10 ≠ 0 → null
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// mergeInto
// ---------------------------------------------------------------------------

describe('mergeInto', () => {
  test('fills null fields in base from secondary', () => {
    const base = { coverUrl: null, publisher: 'PubA', publishedYear: null, description: null, sources: ['openbd'] };
    const secondary = { coverUrl: 'http://cover.jpg', publisher: 'PubB', publishedYear: '2020', description: 'desc', sources: ['google_books'] };
    const result = mergeInto(base, secondary);
    assert.equal(result.coverUrl, 'http://cover.jpg');
    assert.equal(result.publisher, 'PubA');   // base value is kept
    assert.equal(result.publishedYear, '2020');
    assert.equal(result.description, 'desc');
    assert.deepEqual(result.sources, ['openbd', 'google_books']);
  });

  test('does not duplicate sources when already present', () => {
    const base = { coverUrl: null, publisher: null, publishedYear: null, description: null, sources: ['google_books'] };
    const secondary = { coverUrl: 'http://img', publisher: null, publishedYear: null, description: null, sources: ['google_books'] };
    const result = mergeInto(base, secondary);
    assert.deepEqual(result.sources, ['google_books']);
  });

  test('returns base unchanged when secondary is null', () => {
    const base = { coverUrl: 'http://a', publisher: 'P', publishedYear: '2020', description: 'd', sources: ['ndl'] };
    const result = mergeInto(base, null);
    assert.deepEqual(result, base);
  });
});

// ---------------------------------------------------------------------------
// runGoogleBooksStep — quota abort behavior
// ---------------------------------------------------------------------------

function makeEntry(description = 'desc') {
  return { coverUrl: null, publisher: 'Pub', publishedYear: '2020', description, sources: ['google_books'] };
}

function makeCtx(isbnKeys) {
  const targets = isbnKeys.map(k => ({ isbn: k }));
  const isbn10to13Map = Object.fromEntries(isbnKeys.map(k => [k, k + '_13']));
  const results = {};
  const failedISBNs = { google: [] };
  return { targets, isbn10to13Map, results, failedISBNs };
}

describe('runGoogleBooksStep', () => {
  test('E-01: HTTP 429 aborts loop — subsequent ISBNs are not fetched', async () => {
    const { targets, isbn10to13Map, results, failedISBNs } = makeCtx(['A', 'B', 'C']);
    const called = [];
    async function fetchFn(isbn13) {
      called.push(isbn13);
      if (isbn13 === 'B_13') throw new Error('HTTP 429 for https://googleapis.com/...');
      return makeEntry();
    }

    await runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs, fetchFn, 0);

    assert.deepEqual(called, ['A_13', 'B_13'], 'C must not be fetched after quota exceeded');
    assert.ok(results['A'], 'A must be recorded before abort');
    assert.equal(results['C'], undefined, 'C must not be recorded');
  });

  test('E-02: warning is logged to stderr on quota exceeded', async () => {
    const { targets, isbn10to13Map, results, failedISBNs } = makeCtx(['A']);
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      await runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs,
        async () => { throw new Error('HTTP 429 for https://googleapis.com/...'); }, 0);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(
      warnings.some(w => w.includes('Quota exceeded')),
      'Expected "[Google Books] Quota exceeded" warning'
    );
  });

  test('E-03: non-429 errors are recorded in failedISBNs.google and loop continues', async () => {
    const { targets, isbn10to13Map, results, failedISBNs } = makeCtx(['A', 'B']);
    async function fetchFn(isbn13) {
      if (isbn13 === 'A_13') throw new Error('HTTP 500 for https://googleapis.com/...');
      return makeEntry('B description');
    }

    await runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs, fetchFn, 0);

    assert.deepEqual(failedISBNs.google, ['A'], 'A must be in failedISBNs.google');
    assert.ok(results['B'], 'B must be processed after A error');
  });

  test('E-04: data fetched before quota exceeded is preserved in results', async () => {
    const { targets, isbn10to13Map, results, failedISBNs } = makeCtx(['A', 'B']);
    async function fetchFn(isbn13) {
      if (isbn13 === 'A_13') return makeEntry('A description');
      throw new Error('HTTP 429 for https://googleapis.com/...');
    }

    await runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs, fetchFn, 0);

    assert.equal(results['A'].description, 'A description', 'A data must be preserved');
    assert.equal(results['B'], undefined, 'B must not be recorded after abort');
  });

  test('E-05: wait is skipped when quota exceeded', async () => {
    const { targets, isbn10to13Map, results, failedISBNs } = makeCtx(['A', 'B']);
    let waitCalls = 0;
    async function fetchFn(isbn13) {
      if (isbn13 === 'A_13') return makeEntry();
      throw new Error('HTTP 429 for https://googleapis.com/...');
    }

    // Use a large delayMs to make an accidental wait detectable via timing
    const start = Date.now();
    await runGoogleBooksStep(targets, results, isbn10to13Map, failedISBNs, fetchFn, 500);
    const elapsed = Date.now() - start;

    // A: success → wait(500) runs. B: 429 → wait must be skipped.
    // Total elapsed should be ~500ms (one wait), not ~1000ms (two waits).
    assert.ok(elapsed < 900, `Expected ~500ms elapsed (one wait), got ${elapsed}ms`);
  });
});
