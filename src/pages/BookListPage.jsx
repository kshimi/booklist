import { useState, useMemo, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import GenreFilter from '../components/GenreFilter';
import AuthorFilter from '../components/AuthorFilter';
import SortControl from '../components/SortControl';
import ResultSummary from '../components/ResultSummary';
import BookGrid from '../components/BookGrid';
import Pagination from '../components/Pagination';
import { matchKeyword } from '../utils/filter';
import { compareBooks } from '../utils/sort';
import { PAGE_SIZE } from '../constants';

/**
 * S-1 書籍一覧ページ
 * filterOverride: { genre?, subgenre?, author? } — set by App when S-3 triggers navigation
 */
export default function BookListPage({ books, onSelectBook, filterOverride }) {
  const [keyword, setKeyword] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [sortKey, setSortKey] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Apply external filter overrides (from S-3 chart/ranking clicks).
  // Reset all filters first so unrelated state (keyword, author, genre) doesn't
  // silently narrow results alongside the incoming override.
  useEffect(() => {
    if (!filterOverride) return;
    setKeyword('');
    setSelectedGenre(filterOverride.genre ?? null);
    setSelectedSubgenre(filterOverride.subgenre ?? null);
    setSelectedAuthor(filterOverride.author ?? null);
    setCurrentPage(1);
  }, [filterOverride]);

  // Derive unique sorted genres from books
  const genres = useMemo(
    () => [...new Set(books.map(b => b.genre))].sort((a, b) => a.localeCompare(b, 'ja')),
    [books]
  );

  // Derive subgenres for the selected genre
  const subgenres = useMemo(() => {
    if (!selectedGenre) return [];
    const subs = new Set(
      books.filter(b => b.genre === selectedGenre).map(b => b.subgenre ?? 'その他')
    );
    return [...subs].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [books, selectedGenre]);

  // Derive unique sorted authors from books
  const authors = useMemo(
    () =>
      [...new Set(books.map(b => b.author).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ja')
      ),
    [books]
  );

  // Filter
  const filteredBooks = useMemo(
    () =>
      books
        .filter(book => matchKeyword(book, keyword))
        .filter(book => !selectedGenre || book.genre === selectedGenre)
        .filter(
          book => !selectedSubgenre || (book.subgenre ?? 'その他') === selectedSubgenre
        )
        .filter(book => !selectedAuthor || book.author === selectedAuthor),
    [books, keyword, selectedGenre, selectedSubgenre, selectedAuthor]
  );

  // Sort
  const sortedBooks = useMemo(
    () => [...filteredBooks].sort(compareBooks(sortKey, sortOrder)),
    [filteredBooks, sortKey, sortOrder]
  );

  // Paginate
  const pagedBooks = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedBooks.slice(start, start + PAGE_SIZE);
  }, [sortedBooks, currentPage]);

  function handleGenreSelect(genre) {
    setSelectedGenre(genre);
    setSelectedSubgenre(null);
    setCurrentPage(1);
  }

  function handleSubgenreSelect(subgenre) {
    setSelectedSubgenre(subgenre);
    setCurrentPage(1);
  }

  function handleAuthorSelect(author) {
    setSelectedAuthor(author);
    setCurrentPage(1);
  }

  function handleKeywordChange(value) {
    setKeyword(value);
    setCurrentPage(1);
  }

  function handleSortChange(key, order) {
    setSortKey(key);
    setSortOrder(order);
    setCurrentPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <SearchBar value={keyword} onChange={handleKeywordChange} />

      {/* Genre filter (2-level) */}
      <GenreFilter
        genres={genres}
        subgenres={subgenres}
        selectedGenre={selectedGenre}
        selectedSubgenre={selectedSubgenre}
        onSelectGenre={handleGenreSelect}
        onSelectSubgenre={handleSubgenreSelect}
      />

      {/* Controls row: author filter, sort, result count */}
      <div className="flex flex-wrap items-center gap-3">
        <AuthorFilter
          authors={authors}
          selectedAuthor={selectedAuthor}
          onSelect={handleAuthorSelect}
        />
        <SortControl sortKey={sortKey} sortOrder={sortOrder} onChange={handleSortChange} />
        <div className="ml-auto">
          <ResultSummary
            totalCount={filteredBooks.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>

      {/* Book grid */}
      <BookGrid
        books={pagedBooks}
        onSelectBook={onSelectBook}
        onSelectAuthor={handleAuthorSelect}
      />

      {/* Pagination */}
      <Pagination
        totalCount={filteredBooks.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
