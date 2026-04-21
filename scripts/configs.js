/* eslint-disable no-console */
import { getSessionStorageItem, setSessionStorageItem } from './s-and-p-global/utils.js';

/** sessionStorage key for flattened config JSON */

export const LOCAL_SITE_CONFIG_KEY = 'configs';

const CONFIG_KEY = LOCAL_SITE_CONFIG_KEY;

function getConfigUrl() {
  const base = typeof window !== 'undefined' ? (window.hlx?.codeBasePath || '') : '';
  return `${base}/configs.json`;
}

let configFetchPromise = null;

/**
 * @param {string} key
 * @returns {string|undefined}
 */
function readConfigKeyFromSession(key) {
  if (typeof window === 'undefined') return undefined;
  const raw = getSessionStorageItem(CONFIG_KEY);
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return undefined;
    const v = obj[key];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches and caches configuration from configs.json (flattened key-value object).
 * @returns {Promise<void>}
 */
const fetchAndStoreConfig = async () => {
  if (typeof window === 'undefined') return;
  try {
    const response = await fetch(getConfigUrl());
    if (!response.ok) throw new Error(`Failed to fetch config: ${response.status}`);
    const config = await response.json();

    const flatConfig = {};
    if (Array.isArray(config.data)) {
      config.data.forEach((item) => {
        if (item && item.key) flatConfig[item.key] = item.value;
      });
    }
    /* Flat object shape: { "google-tag-manager": "GTM-…", … } */
    Object.keys(config).forEach((k) => {
      if (k === 'data') return;
      const v = config[k];
      if (v !== undefined && v !== null && typeof v !== 'object') {
        flatConfig[k] = v;
      }
    });

    setSessionStorageItem(CONFIG_KEY, JSON.stringify(flatConfig));
  } catch (e) {
    console.error('Error fetching config:', e);
  }
};

/**
 * Retrieves a configuration value by key using session storage, then configs.json.
 * @param {string} key Configuration key (e.g. google-tag-manager, google-tag-analytics)
 * @returns {Promise<string|undefined>}
 */
export async function getConfigValue(key) {
  let value = readConfigKeyFromSession(key);

  if (!value) {
    if (!configFetchPromise) {
      configFetchPromise = fetchAndStoreConfig().finally(() => {
        configFetchPromise = null;
      });
    }
    await configFetchPromise;
    value = readConfigKeyFromSession(key);
  }

  return value || undefined;
}
