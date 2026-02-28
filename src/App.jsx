import { useState } from 'react';
import Navigation from './components/Navigation';
import { useBooks } from './hooks/useBooks';

export default function App() {
  const { books, loading, error } = useBooks();
  const [activePage, setActivePage] = useState('list');
  const [selectedBook, setSelectedBook] = useState(null);

  // Callbacks for cross-page filter operations (S-3 → S-1)
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);

  function handleFilterByGenre(genre) {
    setSelectedGenre(genre);
    setSelectedSubgenre(null);
    setActivePage('list');
  }

  function handleFilterByAuthor(author) {
    setSelectedAuthor(author);
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
          <p className="text-gray-400 text-sm">書籍一覧（Phase B で実装）</p>
        )}
        {activePage === 'stats' && (
          <p className="text-gray-400 text-sm">統計ダッシュボード（Phase D で実装）</p>
        )}
      </main>
    </div>
  );
}
