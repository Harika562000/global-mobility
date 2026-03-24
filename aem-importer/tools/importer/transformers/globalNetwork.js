import { createBlock, addSection } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createGlobalNetwork = async (main) => {
  const globalNetwork = main.querySelector('#global_locations');
  if (!globalNetwork) return;

  const globalNetworkContainer = document.createElement('div');

  // Handle Title
  const title = globalNetwork.querySelector('h2');
  globalNetworkContainer.append(title);

  // Handle Description
  const description = globalNetwork.querySelector('p');
  globalNetworkContainer.append(description);

  // Handle Links
  const regionAllLinks = globalNetwork.querySelectorAll('.regions a');
  regionAllLinks.forEach((link) => {
    const p = document.createElement('p');
    const em = document.createElement('em');
    em.appendChild(link);
    p.appendChild(em);
    globalNetworkContainer.append(p);
  });

  // Handle Image
  const image = globalNetwork.querySelector('img');
  if (image) {
    const div = document.createElement('div');
    const p = document.createElement('p');
    const img = document.createElement('img');
    img.src = image?.src ? await fetchDeliveryUrl(image?.src.split('/').pop(), image?.src) : '';
    img.alt = image.alt;
    p.append(img);
    div.append(p);
    globalNetworkContainer.append(div);
    image.remove();
  }

  // Handle CTA
  const regionCTA = globalNetwork.querySelector('a.ups-cta');
  const buttonP = document.createElement('p');
  const buttonA = document.createElement('a');
  buttonA.href = regionCTA.href;
  buttonA.textContent = regionCTA.textContent;
  buttonP.append(buttonA);
  globalNetworkContainer.append(buttonP);
  regionCTA.remove();

  const block = createBlock('Global Network', [[globalNetworkContainer]]);
  globalNetwork.append(block);
  addSection(globalNetwork);
};

export default createGlobalNetwork;
