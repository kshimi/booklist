import { useState, useEffect } from 'react';

// Module-scope cache: isbn → ExternalBookData | 'not_found'
const cache = new Map();

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOpenBD(response) {
  const item = response[0];
  if (!item) return null;
  const summary = item.summary ?? {};
  const texts = item.onix?.CollateralDetail?.TextContent ?? [];
  const descEntry = texts.find(t => t.TextType === '03');

  return {
    coverUrl: summary.cover || null,
    publisher: summary.publisher || null,
    publishedYear: summary.pubdate ? summary.pubdate.slice(0, 4) : null,
    description: descEntry?.Text || null,
    source: 'openbd',
  };
}

function normalizeGoogleBooks(response) {
  const volumeInfo = response.items?.[0]?.volumeInfo;
  if (!volumeInfo) return null;

  return {
    coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
    publisher: volumeInfo.publisher || null,
    publishedYear: volumeInfo.publishedDate?.slice(0, 4) || null,
    description: volumeInfo.description || null,
    source: 'google_books',
  };
}

async function fetchOpenBD(isbn) {
  const response = await fetchWithTimeout(
    `https://api.openbd.jp/v1/get?isbn=${isbn}`
  );
  if (!response || response.length === 0 || response[0] === null) return null;
  return normalizeOpenBD(response);
}

async function fetchGoogleBooks(isbn) {
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  );
  if (!response || !response.items || response.items.length === 0) return null;
  return normalizeGoogleBooks(response);
}

export function useExternalBookData(isbn, preloaded) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | loaded | not_found | error

  useEffect(() => {
    if (!isbn) {
      setStatus('idle');
      setData(null);
      return;
    }

    // Use preloaded data from book-metadata.json if available
    if (preloaded !== undefined && preloaded !== null) {
      const hasData = preloaded.coverUrl || preloaded.publisher ||
                      preloaded.publishedYear || preloaded.description;
      if (hasData) {
        setData({ ...preloaded, source: preloaded.sources?.[0] ?? 'preloaded' });
        setStatus('loaded');
      } else {
        setStatus('not_found');
        setData(null);
      }
      return;
    }

    if (cache.has(isbn)) {
      const cached = cache.get(isbn);
      if (cached === 'not_found') {
        setStatus('not_found');
        setData(null);
      } else {
        setData(cached);
        setStatus('loaded');
      }
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setData(null);

    (async () => {
      let result = null;
      try {
        result = await fetchOpenBD(isbn);
      } catch {
        // OpenBD failed — fall through to Google Books
      }

      if (!result) {
        try {
          result = await fetchGoogleBooks(isbn);
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
      }

      if (cancelled) return;
      if (result) {
        cache.set(isbn, result);
        setData(result);
        setStatus('loaded');
      } else {
        cache.set(isbn, 'not_found');
        setStatus('not_found');
      }
    })();

    return () => { cancelled = true; };
  }, [isbn, preloaded]);

  return { data, status };
}
