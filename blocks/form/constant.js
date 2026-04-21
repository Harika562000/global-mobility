export const fileAttachmentText = 'Attach';
export const dragDropText = 'Drag and Drop To Upload';

export const DEFAULT_THANK_YOU_MESSAGE = 'Thank you for your submission.';

// Logging Configuration
// Control logging via URL parameter: ?log=<level>
// Valid levels: debug, info, error, off, warn → returns that level
// Invalid/empty values (including 'on') → returns 'warn' (fallback)
// AEM preview/live URLs (*.page, *.live) or localhost → returns 'warn'
const VALID_LOG_LEVELS = ['error', 'debug', 'warn', 'info', 'off'];

export const getLogLevelFromURL = (urlString = null) => {
  // Semantic constants for log level defaults
  const DEFAULT_LOG_LEVEL = 'off'; // Used when no logging is explicitly requested
  const FALLBACK_LOG_LEVEL = 'warn'; // Used for invalid/empty values or AEM preview

  try {
    // Extract URL object from either parameter or current context
    let url;
    if (urlString) {
      // Explicit URL string provided (for workers - they need page URL passed from main thread)
      url = new URL(urlString);
    } else if (typeof window !== 'undefined' && window.location) {
      // Main thread context - use page URL
      url = new URL(window.location.href);
    } else {
      return DEFAULT_LOG_LEVEL; // No URL available
    }

    const { searchParams, hostname } = url;

    // Check if logging should be enabled (explicit param or AEM preview)
    const logParam = searchParams.get('log');
    if (logParam !== null || hostname.match(/\.(page|live)$|^localhost$/)) {
      // Return valid log level or fallback to warn for invalid/empty values
      if (VALID_LOG_LEVELS.includes(logParam)) return logParam;
      return FALLBACK_LOG_LEVEL;
    }

    // Default - no logging
    return DEFAULT_LOG_LEVEL;
  } catch (error) {
    // Fallback to default if URL parsing fails
    return DEFAULT_LOG_LEVEL;
  }
};
// Logging Configuration
// To set log level, modify this constant:
// Available options: 'off', 'debug', 'info', 'warn', 'error'
export const LOG_LEVEL = getLogLevelFromURL();

export const defaultErrorMessages = {
  accept: 'The specified file type not supported.',
  maxFileSize: 'File too large. Reduce size and try again.',
  maxItems: 'Specify a number of items equal to or less than $0.',
  minItems: 'Specify a number of items equal to or greater than $0.',
  pattern: 'Specify the value in allowed format : $0.',
  minLength: 'Please lengthen this text to $0 characters or more.',
  maxLength: 'Please shorten this text to $0 characters or less.',
  maximum: 'Value must be less than or equal to $0.',
  minimum: 'Value must be greater than or equal to $0.',
  required: 'Please fill in this field.',
};

// eslint-disable-next-line no-useless-escape
export const emailPattern = '([A-Za-z0-9][._]?)+[A-Za-z0-9]@[A-Za-z0-9]+(\.?[A-Za-z0-9]){2}\.([A-Za-z0-9]{2,4})?';

let submitBaseUrl = '';

export const SUBMISSION_SERVICE = 'https://forms.adobe.com/adobe/forms/af/submit/';

export function setSubmitBaseUrl(url) {
  submitBaseUrl = url;
}

export function getSubmitBaseUrl() {
  return submitBaseUrl;
}

export const COUNTRIES = {
  enum: [
    'algeria', 'angola', 'argentina', 'australia', 'austria',
    'bahamas', 'bahrain', 'barbados', 'belarus', 'belgium',
    'belize', 'benin', 'bermuda', 'bolivia', 'bosnia-herzegovina',
    'botswana', 'brazil', 'bulgaria', 'burkina-faso', 'burundi',
    'cambodia', 'cameroon', 'canada', 'cape-verde', 'central-african-republic',
    'chad', 'chile', 'colombia', 'comoros', 'costa-rica',
    'croatia', 'cuba', 'cyprus', 'czech-republic', 'democratic-republic-of-congo',
    'denmark', 'djibouti', 'dominican-republic', 'ecuador', 'egypt',
    'el-salvador', 'equatorial-guinea', 'eritrea', 'estonia', 'ethiopia',
    'finland', 'france', 'gabon', 'gambia', 'georgia',
    'germany', 'ghana', 'greece', 'guatemala', 'guinea',
    'guinea-bissau', 'haiti', 'honduras', 'hong-kong', 'hungary',
    'iceland', 'india', 'indonesia', 'iran', 'ireland',
    'israel', 'italy', 'ivory-coast', 'jamaica', 'japan',
    'jordan', 'kazakhstan', 'kenya', 'kuwait', 'latvia',
    'lebanon', 'liberia', 'libya', 'liechtenstein', 'lithuania',
    'luxembourg', 'madagascar', 'mainland-china', 'malawi', 'malaysia',
    'mali', 'malta', 'mauritania', 'mauritius', 'mexico',
    'moldova', 'morocco', 'mozambique', 'namibia', 'netherlands',
    'netherlands-antilles', 'new-caledonia', 'new-zealand', 'nicaragua', 'niger',
    'nigeria', 'north-macedonia', 'norway', 'oman', 'other-caribbean',
    'pakistan', 'panama', 'papua-new-guinea', 'paraguay', 'peru',
    'philippines', 'poland', 'portugal', 'puerto-rico', 'qatar',
    'republic-of-congo', 'rest-of-world', 'reunion', 'romania', 'russia',
    'rwanda', 'sao-tome-and-principe', 'saudi-arabia', 'senegal', 'serbia',
    'seychelles', 'sierra-leone', 'singapore', 'slovakia', 'slovenia',
    'somalia', 'south-africa', 'south-korea', 'spain', 'sudan',
    'sweden', 'switzerland', 'taiwan', 'tanzania', 'thailand',
    'togo', 'trinidad--tobago', 'tunisia', 'turkey', 'uganda',
    'ukraine', 'united-arab-emirates', 'united-kingdom', 'united-states', 'uruguay',
    'uzbekistan', 'venezuela', 'vietnam', 'zambia', 'zimbabwe',
  ],
  enumNames: [
    'Algeria', 'Angola', 'Argentina', 'Australia', 'Austria',
    'Bahamas', 'Bahrain', 'Barbados', 'Belarus', 'Belgium',
    'Belize', 'Benin', 'Bermuda', 'Bolivia', 'Bosnia-Herzegovina',
    'Botswana', 'Brazil', 'Bulgaria', 'Burkina Faso', 'Burundi',
    'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic',
    'Chad', 'Chile', 'Colombia', 'Comoros', 'Costa Rica',
    'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of Congo',
    'Denmark', 'Djibouti', 'Dominican Republic', 'Ecuador', 'Egypt',
    'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia',
    'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
    'Germany', 'Ghana', 'Greece', 'Guatemala', 'Guinea',
    'Guinea-Bissau', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary',
    'Iceland', 'India', 'Indonesia', 'Iran', 'Ireland',
    'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
    'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Latvia',
    'Lebanon', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
    'Luxembourg', 'Madagascar', 'Mainland China', 'Malawi', 'Malaysia',
    'Mali', 'Malta', 'Mauritania', 'Mauritius', 'Mexico',
    'Moldova', 'Morocco', 'Mozambique', 'Namibia', 'Netherlands',
    'Netherlands Antilles', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger',
    'Nigeria', 'North Macedonia', 'Norway', 'Oman', 'Other Caribbean',
    'Pakistan', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar',
    'Republic of Congo', 'Rest of World', 'Reunion', 'Romania', 'Russia',
    'Rwanda', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Somalia', 'South Africa', 'South Korea', 'Spain', 'Sudan',
    'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand',
    'Togo', 'Trinidad & Tobago', 'Tunisia', 'Turkey', 'Uganda',
    'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
    'Uzbekistan', 'Venezuela', 'Vietnam', 'Zambia', 'Zimbabwe',
  ],
};
