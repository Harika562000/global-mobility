import createSearchResultsApp from './components/search-results-app.js';

export default function decorate(block) {
  block.innerHTML = '';
  block.append(createSearchResultsApp());
}
