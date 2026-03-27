import createSearchResultsApp from './components/search-results-app.js';
import { readBlockConfig } from '../../scripts/aem.js';

export default function decorate(block) {
  const config = readBlockConfig(block);
  block.innerHTML = '';
  block.append(createSearchResultsApp({ config }));
}
