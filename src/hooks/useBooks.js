import { useState, useEffect } from 'react';

export function useBooks() {
  const [books, setBooks] = useState([]);
  const [bookMetadata, setBookMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchBooks = fetch('./data/books.json', { signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    const fetchMetadata = fetch('./data/book-metadata.json', { signal })
      .then(res => {
        if (!res.ok) return {};
        return res.json();
      })
      .catch(() => ({}));

    Promise.all([fetchBooks, fetchMetadata])
      .then(([booksData, metadataData]) => {
        setBooks(booksData);
        setBookMetadata(metadataData);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return { books, bookMetadata, loading, error };
}
