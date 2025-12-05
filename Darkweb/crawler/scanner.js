const cheerio = require('cheerio');

// Regex Patterns
const PATTERNS = {
    // Cryptocurrency
    BTC: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    ETH: /\b0x[a-fA-F0-9]{40}\b/g,
    XMR: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,

    // PII & Leaks
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    PHONE: /(\+|00)[1-9][0-9 \-\(\)\.]{7,32}/g, // International format roughly
    API_KEY: /(?:\b|['"])(?:sk_live_|AKIA|AIza|ghp_)[a-zA-Z0-9]{20,}(?:\b|['"])/g, // Basic API Key detection

    // Social & Handles
    TELEGRAM: /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,})/g,
    TWITTER: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})/g,
    DISCORD: /(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9]{1,})/g,

    // Dark Web Specific
    ONION_V3: /[a-z2-7]{56}\.onion/g,
};

// Configurable Keywords for Monitoring
const DEFAULT_KEYWORDS = [
    'database leak',
    'credentials',
    'dump',
    'ssn',
    'fullz',
    'carding',
    'access',
    'admin',
    'root',
    'confidential'
];

/**
 * Scans HTML content for intelligence.
 * @param {string} html - The raw HTML content.
 * @param {string[]} customKeywords - Optional list of keywords to search for.
 * @returns {object} - Extracted data.
 */
function scanContent(html, customKeywords = []) {
    const $ = cheerio.load(html);
    const text = $('body').text(); // Extract visible text

    const results = {
        crypto: {
            btc: [],
            eth: [],
            xmr: []
        },
        pii: {
            emails: [],
            phones: [],
            api_keys: []
        },
        social: {
            telegram: [],
            twitter: [],
            discord: []
        },
        keywords: [],
        onions: []
    };

    // 1. Extract Crypto Addresses
    results.crypto.btc = [...new Set(text.match(PATTERNS.BTC) || [])];
    results.crypto.eth = [...new Set(text.match(PATTERNS.ETH) || [])];
    results.crypto.xmr = [...new Set(text.match(PATTERNS.XMR) || [])];

    // 2. Extract PII & Leaks
    results.pii.emails = [...new Set(text.match(PATTERNS.EMAIL) || [])];
    results.pii.phones = [...new Set(text.match(PATTERNS.PHONE) || [])];
    results.pii.api_keys = [...new Set(text.match(PATTERNS.API_KEY) || [])];

    // 3. Extract Social
    results.social.telegram = [...new Set(text.match(PATTERNS.TELEGRAM) || [])];
    results.social.twitter = [...new Set(text.match(PATTERNS.TWITTER) || [])];
    results.social.discord = [...new Set(text.match(PATTERNS.DISCORD) || [])];

    // 4. Extract Onion Links (Mirror detection)
    results.onions = [...new Set(html.match(PATTERNS.ONION_V3) || [])];

    // 5. Keyword Monitoring
    const keywordsToCheck = [...DEFAULT_KEYWORDS, ...customKeywords];
    keywordsToCheck.forEach(keyword => {
        const regex = new RegExp(keyword, 'i'); // Case-insensitive
        if (regex.test(text)) {
            results.keywords.push(keyword);
        }
    });

    return results;
}

module.exports = { scanContent, PATTERNS };
