import { addSection, createBlock } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createGlobalBanner = async (main) => {
  const globalBanner = main.querySelector('.ups-component.hero.hero-default[data-utg-content-block-id="map_comp"]');
  if (!globalBanner) return;

  const mapImg = globalBanner.querySelector('.ups-map_image_container img');
  mapImg.src = await fetchDeliveryUrl(mapImg.src.split('/').pop(), mapImg.src);
  const heading = globalBanner.querySelector('.ups-container .card .card-body h1');
  const subheading = globalBanner.querySelector('.ups-container .card .card-body h2');
  const topCountryList = globalBanner.querySelector('.ups-container .card .card-body ul');
  topCountryList.prepend(subheading);
  const block = createBlock('Global Banner', [[mapImg], [[heading, topCountryList]]]);
  globalBanner.append(block);
  addSection(block);
};

export default createGlobalBanner;
