import { SORT_OPTIONS } from '../constants';

export default function SortControl({ sortKey, sortOrder, onChange }) {
  const currentValue = `${sortKey}:${sortOrder}`;

  function handleChange(e) {
    const [key, order] = e.target.value.split(':');
    onChange(key, order);
  }

  return (
    <select
      value={currentValue}
      onChange={handleChange}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
    >
      {SORT_OPTIONS.map(opt => (
        <option key={`${opt.key}:${opt.order}`} value={`${opt.key}:${opt.order}`}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
