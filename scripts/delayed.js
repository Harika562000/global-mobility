import { loadGoogleTagManagerAndAnalytics, pushAnalyticsPageView } from './google-tag-manager.js';
import { initAnalyticsInteractionTracking } from './analytics-interactions.js';

(async () => {
  try {
    await loadGoogleTagManagerAndAnalytics();
    pushAnalyticsPageView();
    initAnalyticsInteractionTracking();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Google Tag Manager / Analytics failed to load:', err);
  }
})();
