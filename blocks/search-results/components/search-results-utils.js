export function parseFacetFields(facetFields) {
  if (!facetFields || typeof facetFields !== 'object') return {};
  const result = {};
  Object.entries(facetFields).forEach(([key, arr]) => {
    if (!Array.isArray(arr)) return;
    const items = [];
    for (let i = 0; i < arr.length; i += 2) {
      if (typeof arr[i] === 'string' && typeof arr[i + 1] === 'number') {
        items.push({ value: arr[i], count: arr[i + 1] });
      }
    }
    if (items.length) result[key] = items;
  });
  return result;
}

export function sortDocs(docs, sortBy) {
  const result = [...docs];
  if (sortBy === 'relevance') return result;

  result.sort((a, b) => {
    switch (sortBy) {
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'price-asc':
        return (a.price ?? 0) - (b.price ?? 0);
      case 'price-desc':
        return (b.price ?? 0) - (a.price ?? 0);
      case 'rating-desc':
        return (b.rating ?? 0) - (a.rating ?? 0);
      case 'date-desc':
        return new Date(b.date_modified || 0) - new Date(a.date_modified || 0);
      default:
        return 0;
    }
  });

  return result;
}

export function applyFilters(docs, filters, activeTab) {
  let result = [...docs];

  if (activeTab && activeTab !== 'All') {
    result = result.filter((doc) => String(doc.category || '') === activeTab);
  }

  Object.entries(filters).forEach(([field, value]) => {
    if (!value) return;
    result = result.filter((doc) => {
      const docVal = doc[field];
      if (Array.isArray(docVal)) return docVal.includes(value);
      return String(docVal || '').toLowerCase() === String(value).toLowerCase();
    });
  });

  return result;
}
