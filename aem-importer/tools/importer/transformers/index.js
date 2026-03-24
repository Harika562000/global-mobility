import banner from './banner.js';
import imgBanner from './bannerImg.js';
import hero from './hero.js';
import accordion from './accordion.js';
import linkList from './linkList.js';
import anchorLink from './anchorLink.js';
import cards from './cards.js';
import pathwayCards from './pathwayCards.js';
import callout from './callout.js';
import tabs from './tabs.js';
import teaser from './teaser.js';
import breadcrumb from './breadcrumb.js';
import table from './table.js';
import featureList from './featureList.js';
import backToTop from './backToTop.js';
import globalBanner from './globalBanner.js';
import textContent from './textContent.js';
import teaserV2 from './promoTeaser.js';
import metadata from './metadata.js';
import regions from './regions.js';
import primaryPromoTeaser from './primaryPromoTeaser.js';
import searchResults from './searchResults.js';
import nestedTabTitle from './tabTitle.js';
import statistics from './statistics.js';
import editorialCards from './editorialCards.js';
import globalNetwork from './globalNetwork.js';
import zoneChart from './zoneChart.js';
import alertSection from './alertSection.js';
import fragmentEmbed from './fragmentEmbed.js';

export const transformers = [
  backToTop,
  breadcrumb,
  anchorLink,
  accordion,
  banner,
  linkList,
  callout,
  nestedTabTitle,
  table,
  regions,
  searchResults,
  statistics,
  zoneChart,
  alertSection,
  fragmentEmbed,
];

export const asyncTransformers = [
  cards,
  editorialCards,
  globalBanner,
  hero,
  pathwayCards,
  primaryPromoTeaser,
  teaserV2,
  teaser,
  featureList,
  textContent,
  globalNetwork,
  imgBanner,
];

export const postTransformers = [
  tabs, // Because other async blocks can get in the way - will revisit
  metadata,
];
