/** @typedef {Record<string, string>} UtmRecord */

const STORAGE_KEY = 'utm_attribution';
const MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

/** GA / dataLayer UTM keys (order stable for tooling). */
export const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

/**
 * @returns {UtmRecord}
 */
function readStoredUtm() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { expiresAt } = parsed;
    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    const { utm } = parsed;
    if (!utm || typeof utm !== 'object') return {};
    return utm;
  } catch {
    return {};
  }
}

/**
 * @param {UtmRecord} payload
 */
function writeStoredUtm(payload) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const keys = Object.keys(payload).filter((k) => payload[k]);
  if (!keys.length) return;
  try {
    /** @type {UtmRecord} */
    const utm = {};
    keys.forEach((k) => {
      utm[k] = payload[k];
    });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        utm,
        expiresAt: Date.now() + MAX_AGE_MS,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Reads UTMs from the URL, merges with localStorage (URL wins per key).
 * Persists (and resets 15-day `expiresAt`) only when URL includes
 * at least one non-empty UTM param; visits without UTMs do not extend TTL.
 * @returns {UtmRecord} Effective UTM fields for this page (non-empty values only).
 */
export function syncUtmPersistence() {
  if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') {
    return {};
  }
  const urlParams = new URLSearchParams(window.location.search);
  const stored = readStoredUtm();
  /** @type {UtmRecord} */
  const merged = { ...stored };
  let urlHasUtm = false;

  UTM_PARAM_KEYS.forEach((key) => {
    if (urlParams.has(key)) {
      const v = urlParams.get(key);
      if (v != null && String(v).length) {
        merged[key] = String(v);
        urlHasUtm = true;
      }
    }
  });

  /** @type {UtmRecord} */
  const toStore = {};
  UTM_PARAM_KEYS.forEach((k) => {
    if (merged[k]) toStore[k] = merged[k];
  });

  if (urlHasUtm && Object.keys(toStore).length) {
    writeStoredUtm(toStore);
  }

  return toStore;
}

/**
 * All five UTM fields for dataLayer / gtag (empty string when unset).
 * @returns {UtmRecord}
 */
export function getUtmDataLayerFields() {
  const u = readStoredUtm();
  /** @type {UtmRecord} */
  const o = {};
  UTM_PARAM_KEYS.forEach((k) => {
    o[k] = u[k] || '';
  });
  return o;
}

/**
 * Merges persisted UTMs into a hit object (non-empty keys only). Use for custom events after sync.
 * @param {Record<string, unknown>} base
 * @returns {Record<string, unknown>}
 */
export function mergePersistedUtm(base = {}) {
  const u = readStoredUtm();
  const out = { ...base };
  UTM_PARAM_KEYS.forEach((k) => {
    if (u[k]) out[k] = u[k];
  });
  return out;
}
