// eslint-disable-next-line import/no-unresolved
import token from './token.js';
import config from './config.js';
import { assets, fetchedAssets } from './assets.js';
let prevURL = '';

async function getApprovedAssetsByName(assetName) {
  const headersList = {
    Accept: '*/*',
    'X-Api-Key': 'asset_search_service',
    'Content-Type': 'application/json',
    'X-Adobe-Accept-Experimental': '1',
    Authorization: `Bearer ${token.bearerToken}`,
  };

  const bodyContent = JSON.stringify({
    query: [
      {
        term: {
          'metadata.repositoryMetadata.repo:name': [assetName],
        },
      },
    ],
    orderBy: 'metadata.repositoryMetadata.repo:name asc',
    limit: 50,
  });

  try {
    const response = await fetch(config.baseSearchUrl, {
      method: 'POST',
      body: bodyContent,
      headers: headersList,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.hits.results.length === 0) {
      window.failedAssets.push(assetName);
      if(prevURL === window.url) {
        console.log(`Failed to find asset: ${assetName}`);
      } else {
        console.log(`Failed to find asset: spacerman`);
        console.log(`Failed to find asset: ${window.url}`);
        console.log(`Failed to find asset: ${assetName}`);
      }
      
      prevURL = window.url;
    }
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching approved assets:', error, assetName);
    return { hits: { results: [] }, search_metadata: { count: 0 } };
  }
}

function constructDeliveryUrl(hits, searchMetadata, src, assetName) {
  if (searchMetadata.count >= 1 || hits.results.length >= 1) {
    const { assetId } = hits.results[0];
    const seoName = hits.results[0].repositoryMetadata['repo:name'];
    if (!assetId || !seoName || seoName !== assetName) {
      return config.placeholderImg || src;
    }

    const type = hits.results[0].repositoryMetadata['dc:format'];
    const isImage = type.includes('image');
    if (!isImage) {
      return `${config.baseUrl}/${assetId}/original/as/${seoName}`;
    }

    return `${config.baseUrl}/${assetId}`;
  }

  // check if assetName is an image only then return the placeholder image else return the src
  if (
    assetName.includes('.jpg')
    || assetName.includes('.png')
    || assetName.includes('.jpeg')
    || assetName.includes('.webp')
  ) {
    return config.placeholderImg || src;
  }

  return src;
}

function checkAssetName(obj, assetName) {
  if (Object.prototype.hasOwnProperty.call(obj, assetName)) {
    return obj[assetName];
  }
  return assetName;
}

export default async function fetchDeliveryUrl(assetName, src) {
  if (!assetName) return src;
  /**
   * Only proceed with API call if the image name is not in the fetchedAssets object
   * This is to prevent multiple calls to the API for the same image
   */
  if (fetchedAssets[assetName]) {
    return fetchedAssets[assetName];
  }
  const transformedAssetName = checkAssetName(assets, decodeURIComponent(assetName));
  const {
    hits,
    search_metadata: searchMetadata,
  } = await getApprovedAssetsByName(transformedAssetName);
  return constructDeliveryUrl(hits, searchMetadata, src, transformedAssetName);
}

/**
 * Some example metadata that I can use
 * metadata.repositoryMetadata.repo:size desc,
 * metadata.repositoryMetadata.repo:createDate asc
 * metadata.repositoryMetadata.repo:name
 * metadata.repositoryMetadata.dc:format
 * metadata.repositoryMetadata.repo:size
 * "repo:createDate": "2023-05-29T12:54:36.410Z",
 * "repo:modifyDate": "2023-05-11T14:12:09.304Z",
 * "repo:repositoryId": "urn:rid:aem:65214-138691"
 */
