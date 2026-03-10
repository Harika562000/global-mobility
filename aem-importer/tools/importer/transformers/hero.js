import { addSection, createBlock, convertYouTubeURL } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

// Variations: With image, with video, with buttons
const createHero = async (main, document) => {
  const hero = main.querySelector('.ups-component.hero.hero-default');
  const globalBanner = main.querySelector('.ups-component.hero.hero-default[data-utg-content-block-id="map_comp"]');
  if (!hero || globalBanner) return;

  const heroTitle = hero.querySelector('.card-body .card-body-content h1');
  let heroDescription = Array.from(hero.querySelectorAll('.card-body .card-body-content p:not(:has(small)):not(:has(a.ups-cta))'));
  if (!heroDescription.length) {
    heroDescription = Array.from(hero.querySelectorAll('.card-body .card-body-content > div'));
  }
  const heroButtons = hero.querySelectorAll('.card-body .card-body-content a.ups-cta');
  const footNote = hero.querySelector('.card-body .card-body-content p > small')?.parentElement;
  const heroImage = hero.querySelector('.card-img img');
  const heroVideo = hero.querySelector('.card-img .iframe-video-container iframe');
  const heroLogo = undefined;

  if (heroImage) {
    heroImage.src = await fetchDeliveryUrl(heroImage.src.split('/').pop(), heroImage.src);
  }
  const heroContainer = document.createElement('div');
  if (heroTitle) heroContainer.append(heroTitle);
  if (heroImage) {
    const p = document.createElement('p');
    p.append(heroImage);
    heroContainer.append(p);
  }

  if (!heroLogo) {
    const logoWrapper = document.createElement('p');
    const logo = document.createElement('img');
    logo.src = '';
    logoWrapper.append(logo);
    heroContainer.append(logoWrapper);
  }

  const videoWrapper = document.createElement('p');
  const video = document.createElement('video');
  video.src = heroVideo ? convertYouTubeURL(heroVideo.src) : '';
  videoWrapper.append(video);
  heroContainer.append(videoWrapper);

  if (heroDescription.length) {
    heroDescription.forEach((description) => {
      const p = document.createElement('p');
      p.innerHTML = description.innerHTML;
      heroContainer.append(p);
      description.remove();
    });
  }

  heroButtons?.forEach((button) => {
    const p = document.createElement('p');
    p.append(button);
    heroContainer.append(p);
  });

  const heroCells = [[heroContainer]];
  if (footNote) {
    heroCells.push([footNote]);
    footNote.remove();
  }
  const block = createBlock('Hero', heroCells);
  hero.append(block);
  addSection(block);
};

export default createHero;
