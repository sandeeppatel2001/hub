/**
 * Enhanced Data Extractor - Improved regex patterns and crypto detection
 * Fixed false positives and added comprehensive cryptocurrency support
 */

const cheerio = require('cheerio');

/**
 * Enhanced regex patterns
 */
const PATTERNS = {
    // Crypto addresses (improved)
    bitcoin: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b|bc1[a-z0-9]{39,59}\b/g,
    ethereum: /\b0x[a-fA-F0-9]{40}\b/g,
    monero: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
    litecoin: /\b[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}\b/g,
    ripple: /\br[a-zA-Z0-9]{24,34}\b/g,
    dogecoin: /\bD{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}\b/g,
    bitcoincash: /\b(bitcoincash:)?[qp][a-z0-9]{41}\b/gi,
    cardano: /\baddr1[a-z0-9]{58}\b/g,
    tron: /\bT[A-Za-z1-9]{33}\b/g,

    // Blockchain transaction hashes
    txHash: /\b0x[a-fA-F0-9]{64}\b/g,
    blockHash: /\b[a-fA-F0-9]{64}\b/g,

    // Wallet-related
    walletAddress: /wallet[:\s]+([a-zA-Z0-9]{26,44})/gi,
    paymentHash: /payment[_\s]hash[:\s]+([a-fA-F0-9]{64})/gi,

    // Email (improved - no false positives)
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Credentials (fixed - no URLs)
    credentials: /^(?!https?:\/\/)([a-zA-Z0-9._-]{3,30}):([^\s:]{4,50})$/gm,

    // Phone numbers (strict - avoid false positives)
    // Matches: +1234567890, 123-456-7890, (123) 456-7890, +44 20 1234 5678
    phone: /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+\d{10,15}\b/g,

    // IP addresses
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

    // Onion links
    onion: /https?:\/\/[a-z2-7]{16,56}\.onion[^\s]*/gi,

    // Clearnet links
    clearnet: /https?:\/\/(?!.*\.onion)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*/gi,

    // Social handles
    telegram: /@[a-zA-Z0-9_]{5,32}|t\.me\/[a-zA-Z0-9_]{5,32}/gi,
    twitter: /@[a-zA-Z0-9_]{1,15}(?=\s|$)|twitter\.com\/[a-zA-Z0-9_]{1,15}/gi,

    // PII
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

    // File hashes
    md5: /\b[a-fA-F0-9]{32}\b/g,
    sha1: /\b[a-fA-F0-9]{40}\b/g,
    sha256: /\b[a-fA-F0-9]{64}\b/g
};

/**
 * Extract all data from HTML
 */
function extractAllData(html, url, keywords = []) {
    const $ = cheerio.load(html);
    const text = $('body').text();

    const data = {
        url: url,
        extracted_at: new Date().toISOString(),

        // Cryptocurrency addresses
        crypto_addresses: {
            bitcoin: extractUnique(text, PATTERNS.bitcoin),
            ethereum: extractUnique(text, PATTERNS.ethereum),
            monero: extractUnique(text, PATTERNS.monero),
            litecoin: extractUnique(text, PATTERNS.litecoin),
            ripple: extractUnique(text, PATTERNS.ripple),
            dogecoin: extractUnique(text, PATTERNS.dogecoin),
            bitcoincash: extractUnique(text, PATTERNS.bitcoincash),
            cardano: extractUnique(text, PATTERNS.cardano),
            tron: extractUnique(text, PATTERNS.tron)
        },

        // Blockchain data
        blockchain: {
            transaction_hashes: extractUnique(text, PATTERNS.txHash),
            block_hashes: extractUnique(text, PATTERNS.blockHash),
            wallet_addresses: extractMatches(text, PATTERNS.walletAddress),
            payment_hashes: extractMatches(text, PATTERNS.paymentHash)
        },

        // Contact info
        emails: extractUnique(text, PATTERNS.email),
        phone_numbers: extractUnique(text, PATTERNS.phone),

        // Credentials (fixed)
        credentials: extractCredentials(text),

        // Network
        ip_addresses: extractUnique(text, PATTERNS.ipv4),
        onion_links: extractUnique(html, PATTERNS.onion),
        clearnet_links: extractUnique(html, PATTERNS.clearnet).slice(0, 20),

        // Social
        social_handles: {
            telegram: extractUnique(text, PATTERNS.telegram),
            twitter: extractUnique(text, PATTERNS.twitter)
        },

        // PII
        pii: {
            ssn: extractUnique(text, PATTERNS.ssn),
            credit_cards: extractUnique(text, PATTERNS.creditCard)
        },

        // File hashes
        file_hashes: {
            md5: extractUnique(text, PATTERNS.md5).slice(0, 10),
            sha1: extractUnique(text, PATTERNS.sha1).slice(0, 10),
            sha256: extractUnique(text, PATTERNS.sha256).slice(0, 10)
        },

        // Keywords
        keywords_found: findKeywords(text, keywords),

        // Metadata
        metadata: {
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || ''
        }
    };

    return data;
}

/**
 * Extract unique matches
 */
function extractUnique(text, pattern) {
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
}

/**
 * Extract matches with capture groups
 */
function extractMatches(text, pattern) {
    const results = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1]) results.push(match[1]);
    }
    return [...new Set(results)];
}

/**
 * Extract credentials (fixed - no URLs)
 */
function extractCredentials(text) {
    const credentials = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip if it looks like a URL
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            continue;
        }

        // Match username:password format
        const match = trimmed.match(/^([a-zA-Z0-9._-]{3,30}):([^\s:]{4,50})$/);
        if (match) {
            credentials.push({
                username: match[1],
                password: match[2],
                full: trimmed
            });
        }
    }

    return credentials.slice(0, 50); // Limit to 50
}

/**
 * Find keywords with context
 */
function findKeywords(text, keywords) {
    const found = [];
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase();
        const regex = new RegExp(lowerKeyword, 'gi');
        const matches = lowerText.match(regex);

        if (matches && matches.length > 0) {
            // Extract context
            const contextRegex = new RegExp(`.{0,50}${lowerKeyword}.{0,50}`, 'gi');
            const contexts = [];
            let match;
            let count = 0;

            while ((match = contextRegex.exec(text)) !== null && count < 3) {
                contexts.push(match[0].trim());
                count++;
            }

            found.push({
                keyword: keyword,
                count: matches.length,
                contexts: contexts
            });
        }
    }

    return found;
}

module.exports = {
    extractAllData
};
