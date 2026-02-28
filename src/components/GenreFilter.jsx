export default function GenreFilter({
  genres,
  subgenres,
  selectedGenre,
  selectedSubgenre,
  onSelectGenre,
  onSelectSubgenre,
}) {
  return (
    <div className="space-y-2">
      {/* Primary genre buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelectGenre(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedGenre === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        {genres.map(genre => (
          <button
            key={genre}
            onClick={() => onSelectGenre(genre)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedGenre === genre
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Subgenre buttons (shown only when a primary genre is selected) */}
      {selectedGenre && subgenres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-2 border-l-2 border-blue-200">
          <button
            onClick={() => onSelectSubgenre(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedSubgenre === null
                ? 'bg-blue-400 text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            すべて
          </button>
          {subgenres.map(subgenre => (
            <button
              key={subgenre}
              onClick={() => onSelectSubgenre(subgenre)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedSubgenre === subgenre
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {subgenre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
