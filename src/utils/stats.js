/** Calculate book count per genre */
export function calcGenreStats(books) {
  return books.reduce((acc, book) => {
    acc[book.genre] = (acc[book.genre] ?? 0) + 1;
    return acc;
  }, {});
}

/** Calculate author ranking by book count (top N) */
export function calcAuthorRanking(books, topN = 20) {
  const counts = books.reduce((acc, book) => {
    if (!acc[book.author]) acc[book.author] = { count: 0, genres: {} };
    acc[book.author].count += 1;
    acc[book.author].genres[book.genre] = (acc[book.author].genres[book.genre] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([author, { count, genres }]) => ({
      author,
      bookCount: count,
      mainGenre: Object.entries(genres).sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, topN);
}
