import { useMemo } from 'react';
import GenreChart from '../components/GenreChart';
import AuthorRanking from '../components/AuthorRanking';
import { calcGenreStats, calcAuthorRanking } from '../utils/stats';

/**
 * S-3 統計ダッシュボード
 * Props:
 *   books           — all books
 *   onFilterByGenre — (genre: string) => void
 *   onFilterByAuthor — (author: string) => void
 */
export default function StatsDashboardPage({ books, onFilterByGenre, onFilterByAuthor }) {
  const genreStats = useMemo(() => calcGenreStats(books), [books]);
  const authorStats = useMemo(() => calcAuthorRanking(books, 20), [books]);

  return (
    <div className="space-y-8">
      <GenreChart genreStats={genreStats} onSelectGenre={onFilterByGenre} />
      <AuthorRanking authorStats={authorStats} onSelectAuthor={onFilterByAuthor} />
    </div>
  );
}
