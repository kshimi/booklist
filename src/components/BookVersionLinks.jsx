import { VERSION_LABELS } from '../constants';

export default function BookVersionLinks({ versions, fileUrl }) {
  if (!versions || versions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {versions.map(version => (
        <a
          key={version}
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium px-3 py-1.5 rounded border border-blue-200 transition-colors"
        >
          {VERSION_LABELS[version] ?? version}で開く
        </a>
      ))}
    </div>
  );
}
