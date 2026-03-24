export default function createSearchLoading() {
  const div = document.createElement('div');
  div.className = 'search-results-loading';

  const spinner = document.createElement('span');
  spinner.className = 'search-results-loading-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'search-results-loading-text';
  text.textContent = 'Loading results...';

  div.append(spinner, text);
  return div;
}
