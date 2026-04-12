let configPromise = null;

export const LOCAL_SITE_CONFIG_KEY = 'configs';

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readLocalSiteConfigValue(key) {
  if (typeof window === 'undefined' || !key) return undefined;
  try {
    const raw = window.localStorage.getItem(LOCAL_SITE_CONFIG_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) return undefined;
    const value = parsed[key];
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
  } catch {
    return undefined;
  }
}

function persistLocalSiteConfigValue(key, value) {
  if (typeof window === 'undefined' || !key || !value) return;
  try {
    const raw = window.localStorage.getItem(LOCAL_SITE_CONFIG_KEY);
    let next = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isPlainObject(parsed)) {
        next = { ...parsed };
      }
    }
    next[key] = value;
    window.localStorage.setItem(LOCAL_SITE_CONFIG_KEY, JSON.stringify(next));
  } catch {
    /* Quota, private mode, or invalid JSON in storage */
  }
}

function getConfigUrl() {
  const base = typeof window !== 'undefined' ? (window.hlx?.codeBasePath || '') : '';
  return `${base}/configs.json`;
}

/**
 * Loads site configuration from the network.
 * Supports `{ data: [{ key, value }] }` (spreadsheet/CMS rows) or a flat JSON object.
 * @returns {Promise<Object>} Configuration object
 */
const loadConfig = async () => {
  if (typeof window === 'undefined') {
    return { data: [] };
  }

  try {
    const response = await fetch(getConfigUrl());
    if (!response.ok) {
      throw new Error(`Failed to load configuration: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    // eslint-disable-next-line no-console -- surface config fetch failures in devtools
    console.error('Error loading configuration:', error);
    return { data: [] };
  }
};

/**
 * @param {Object} config
 * @param {string} key
 * @returns {string|undefined}
 */
function readConfigKey(config, key) {
  if (!config || typeof config !== 'object') return undefined;

  const rows = config.data;
  if (Array.isArray(rows)) {
    const item = rows.find((row) => row && row.key === key);
    if (item != null && item.value !== undefined && item.value !== null) {
      const value = String(item.value).trim();
      return value || undefined;
    }
  }

  if (Object.prototype.hasOwnProperty.call(config, key)) {
    const direct = config[key];
    if (direct !== undefined && direct !== null && typeof direct !== 'object') {
      const value = String(direct).trim();
      return value || undefined;
    }
  }

  return undefined;
}

/**
 * Returns a configuration value by key (after config is loaded once per page).
 * @param {string} key Configuration key (e.g. google-tag-manager, google-tag-analytics)
 * @returns {Promise<string|undefined>}
 */
export async function getConfigValue(key) {
  const fromLocal = readLocalSiteConfigValue(key);
  if (fromLocal !== undefined) return fromLocal;

  if (!configPromise) {
    configPromise = loadConfig();
  }
  const config = await configPromise;
  const fromRemote = readConfigKey(config, key);
  if (fromRemote !== undefined) {
    persistLocalSiteConfigValue(key, fromRemote);
  }
  return fromRemote;
}

/**
 * Clears the in-memory config promise so the next getConfigValue refetches.
 * @returns {void}
 */
export function resetConfigCache() {
  configPromise = null;
}
