import BookCard from './BookCard';

export default function BookGrid({ books, onSelectBook, onSelectAuthor }) {
  if (books.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        該当する書籍が見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {books.map(book => (
        <BookCard
          key={book.id}
          book={book}
          onSelect={onSelectBook}
          onSelectAuthor={onSelectAuthor}
        />
      ))}
    </div>
  );
}
