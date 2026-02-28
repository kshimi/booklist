/** Returns a comparator function based on sortKey and sortOrder */
export function compareBooks(sortKey, sortOrder) {
  return (a, b) => {
    let result = 0;
    if (sortKey === 'pages') {
      result = (a.pages ?? 0) - (b.pages ?? 0);
    } else {
      result = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'ja');
    }
    return sortOrder === 'desc' ? -result : result;
  };
}
