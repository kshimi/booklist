import { useEffect } from 'react';
import BookBasicInfo from '../components/BookBasicInfo';
import BookVersionLinks from '../components/BookVersionLinks';
import BookExternalInfo from '../components/BookExternalInfo';

export default function BookDetailPage({ book, bookMetadata, onClose, onSelectAuthor }) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleAuthorSelect(author) {
    onSelectAuthor(author);
    onClose();
  }

  const preloaded = book.isbn ? bookMetadata?.[book.isbn] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">書籍詳細</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* F-10: Basic info */}
          <BookBasicInfo book={book} onSelectAuthor={handleAuthorSelect} />

          {/* Google Drive links */}
          <BookVersionLinks versions={book.versions} versionFiles={book.version_files} />

          {/* F-11: External book data */}
          <BookExternalInfo isbn={book.isbn} preloaded={preloaded} />
        </div>
      </div>
    </div>
  );
}
