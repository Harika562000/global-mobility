import { addSection, createBlock } from './util.js';

const createSearchResults = (main) => {
  const searchResults = main.querySelector('.ups-component.ups-search-result.ups-search_bar.ups-search_wrap');
  if (!searchResults) return;

  const searchInputs = searchResults.querySelector('.ups-search_inputs');
  const searchForm = searchInputs.querySelector('form');
  if (!searchForm || !searchInputs) return;

  const title = searchResults.querySelector('.ups-search_inputs h1')?.textContent.trim();
  const label = searchForm.querySelector('.ups-form_input')?.placeholder;
  const searchBtn = searchForm.querySelector('.search_btn')?.textContent.trim();
  const searchNoResults = searchResults.getAttribute('data-noresults');
  const originalSearchTerm = searchResults.getAttribute('data-dym-text');
  const suggestionHeading = searchResults.getAttribute('data-didyoumean');
  const nextButtonText = searchResults.getAttribute('data-next');
  const prevButtonText = searchResults.getAttribute('data-prev');
  const paginationcountOfText = searchResults.querySelector('.total-result-count')?.textContent?.split(' ')[0];
  const resultsPerPage = searchResults.querySelector('.result-per-page > label')?.textContent?.trim();
  const dataResultsString = searchResults.getAttribute('data-results-string')?.trim();
  const dataResultsStringMutated = dataResultsString?.replace(/@@ - ##/g, '{0}').replace(/\$\$/g, '{1}');
  searchInputs?.remove();

  const itemCells = [];
  if (title) itemCells.push(['title', title]);
  itemCells.push(['recommendations', 'true']);
  if (label) itemCells.push(['label', label]);
  if (searchBtn) itemCells.push(['ctatext', searchBtn]);
  if (searchNoResults) itemCells.push(['noresultstxt', searchNoResults]);
  if (dataResultsString) itemCells.push(['resultsheading', dataResultsStringMutated]);
  if (originalSearchTerm) itemCells.push(['originalsearchtermheading', originalSearchTerm]);
  if (suggestionHeading) itemCells.push(['suggestionheading', suggestionHeading]);
  if (nextButtonText) itemCells.push(['nextbuttontext', nextButtonText]);
  if (prevButtonText) itemCells.push(['previousbuttontext', prevButtonText]);
  if (paginationcountOfText) itemCells.push(['paginationcountoftext', paginationcountOfText]);
  if (resultsPerPage) itemCells.push(['resultperpage', resultsPerPage]);
  const searchResultsBlock = createBlock('Search Results', itemCells);
  searchResults.append(searchResultsBlock);
  addSection(searchResultsBlock);
};

export default createSearchResults;
