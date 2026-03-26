const EPOCH = new Date('2000-01-01');

/**
 * Returns today's recommended book and its AI comment (if available).
 *
 * Selection: deterministic by date — daysSinceEpoch(2000-01-01) % books.length
 * This must stay in sync with scripts/generate-ai-comments.js bookIndexForDate().
 */
export function getDailySuggestion(books, bookMetadata, aiComments) {
  if (!books || books.length === 0) return { book: null, comment: null, fallbackText: null };

  const today = new Date();
  const days = Math.floor((today - EPOCH) / 86400000);
  const book = books[days % books.length];

  const aiEntry = aiComments?.[book.id];
  const comment = aiEntry?.comment ?? null;

  const meta = bookMetadata?.[book.isbn] ?? bookMetadata?.[book.id] ?? null;
  const coverUrl = meta?.coverUrl ?? null;
  const fallbackText = comment ? null : (meta?.description ?? null);

  return { book, comment, coverUrl, fallbackText };
}
