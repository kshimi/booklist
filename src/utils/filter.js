/** Keyword match for a book (AND search, partial match, case-insensitive) */
export function matchKeyword(book, keyword) {
  if (!keyword.trim()) return true;
  const words = keyword.toLowerCase().split(/\s+/);
  const target = `${book.title} ${book.author}`.toLowerCase();
  return words.every(word => target.includes(word));
}
