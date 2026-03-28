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

/**
 * Merge facet buckets across requests. After applying Solr `fq`, the API often
 * returns only the selected bucket(s) for that field — other checkboxes would
 * disappear. Union with the previous snapshot and keep selected values visible.
 * @param {Record<string, { value: string, count: number }[]>} prev
 * @param {Record<string, { value: string, count: number }[]>} next
 * @param {Record<string, string[]|string|undefined>} selectedFilters
 */
export function mergeFacetOptions(prev, next, selectedFilters = {}) {
  const prevMap = prev && typeof prev === 'object' ? prev : {};
  const nextMap = next && typeof next === 'object' ? next : {};
  const fields = new Set([...Object.keys(prevMap), ...Object.keys(nextMap)]);
  const out = {};

  fields.forEach((field) => {
    const byValue = new Map();
    (prevMap[field] || []).forEach((o) => {
      if (o && o.value != null) byValue.set(o.value, { value: o.value, count: o.count ?? 0 });
    });
    (nextMap[field] || []).forEach((o) => {
      if (!o || o.value == null) return;
      const existing = byValue.get(o.value);
      byValue.set(o.value, {
        value: o.value,
        count: o.count ?? existing?.count ?? 0,
      });
    });
    const sel = selectedFilters[field];
    const selArr = Array.isArray(sel) ? sel : (sel ? [sel] : []);
    selArr.forEach((val) => {
      if (val != null && val !== '' && !byValue.has(val)) {
        byValue.set(val, { value: val, count: 0 });
      }
    });
    out[field] = [...byValue.values()].sort((a, b) => (b.count || 0) - (a.count || 0));
  });
  return out;
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
