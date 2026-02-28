const TABS = [
  { id: 'list', label: '書籍一覧' },
  { id: 'stats', label: '統計' },
];

export default function Navigation({ activePage, onPageChange }) {
  return (
    <nav className="border-b border-gray-200 mb-6">
      <div className="flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onPageChange(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activePage === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
