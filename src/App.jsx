import { useState } from 'react';
import Navigation from './components/Navigation';
import { useBooks } from './hooks/useBooks';
import BookListPage from './pages/BookListPage';
import BookDetailPage from './pages/BookDetailPage';
import StatsDashboardPage from './pages/StatsDashboardPage';

export default function App() {
  const { books, bookMetadata, loading, error } = useBooks();
  const [activePage, setActivePage] = useState('list');
  const [selectedBook, setSelectedBook] = useState(null);

  // Cross-page filter override: set by S-3, consumed by BookListPage
  const [filterOverride, setFilterOverride] = useState(null);

  function handleFilterByGenre(genre) {
    setFilterOverride({ genre, subgenre: null });
    setActivePage('list');
  }

  function handleFilterByAuthor(author) {
    setFilterOverride({ author });
    setActivePage('list');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">データの読み込みに失敗しました: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-gray-800">Booklist</h1>
          <p className="text-xs text-gray-400">{books.length}冊</p>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-4">
        <Navigation activePage={activePage} onPageChange={setActivePage} />
        {activePage === 'list' && (
          <BookListPage
            books={books}
            onSelectBook={setSelectedBook}
            filterOverride={filterOverride}
          />
        )}
        {activePage === 'stats' && (
          <StatsDashboardPage
            books={books}
            onFilterByGenre={handleFilterByGenre}
            onFilterByAuthor={handleFilterByAuthor}
          />
        )}
      </main>

      {/* S-2: Book detail modal */}
      {selectedBook && (
        <BookDetailPage
          book={selectedBook}
          bookMetadata={bookMetadata}
          onClose={() => setSelectedBook(null)}
          onSelectAuthor={author => {
            setFilterOverride({ author });
            setActivePage('list');
            setSelectedBook(null);
          }}
        />
      )}
    </div>
  );
}
