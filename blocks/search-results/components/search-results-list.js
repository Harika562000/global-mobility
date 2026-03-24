function createCard(doc) {
  const li = document.createElement('li');
  li.className = 'search-result-card';

  const link = document.createElement('a');
  link.href = doc.url || '#';
  link.className = 'search-result-link';

  const content = document.createElement('div');
  content.className = 'search-result-content';

  const title = document.createElement('h4');
  title.className = 'search-result-title';
  title.textContent = doc.title || 'Untitled result';
  content.append(title);

  const desc = document.createElement('p');
  desc.className = 'search-result-description';
  desc.textContent = doc.description || '';
  content.append(desc);

  const icon = document.createElement('span');
  icon.className = 'search-result-arrow';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '\u203A';

  link.append(content, icon);
  li.append(link);
  return li;
}

export default function createSearchResultsList({ docs }) {
  const list = document.createElement('ul');
  list.className = 'search-results';

  if (!docs.length) {
    list.classList.add('no-results');
    const item = document.createElement('li');
    item.textContent = 'No results found. Try updating your filters or query.';
    list.append(item);
    return list;
  }

  docs.forEach((doc) => list.append(createCard(doc)));
  return list;
}
