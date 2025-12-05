/**
 * Common HTTP Fetcher - Optimized for speed and reliability
 * Reduced timeout to 10s, better headers, SSL handling
 */

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');

// User agents pool
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
    'Mozilla/5.0 (Android 10; Mobile; rv:91.0) Gecko/91.0 Firefox/91.0',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/602.2.14 (KHTML, like Gecko) Version/10.0.1 Safari/602.2.14',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:50.0) Gecko/20100101 Firefox/50.0'
];

// Tor SOCKS5 proxy
const torProxy = 'socks5h://127.0.0.1:9050';
const torAgent = new SocksProxyAgent(torProxy);

// HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

/**
 * Get random user agent
 */
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch URL with optimized settings
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<string>} - HTML content
 */
async function fetchUrl(url, options = {}) {
    const {
        timeout = 10000,  // Reduced from 30s to 10s
        userAgent = null,
        retries = 1  // Reduced from 2 to 1
    } = options;

    const isOnion = url.includes('.onion');
    const isHttps = url.startsWith('https://');
    const selectedUserAgent = userAgent || getRandomUserAgent();

    const config = {
        timeout: timeout,
        headers: {
            'User-Agent': selectedUserAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5,
        validateStatus: function (status) {
            return status >= 200 && status < 500; // Accept 4xx to handle them gracefully
        }
    };

    // Use Tor proxy for .onion sites
    if (isOnion) {
        config.httpAgent = torAgent;
        config.httpsAgent = torAgent;
    } else if (isHttps) {
        // For clearnet HTTPS, accept self-signed certs
        config.httpsAgent = httpsAgent;
    }

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, config);

            // Handle 4xx errors
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.data;
        } catch (error) {
            if (attempt === retries) {
                // Simplify error messages
                let errorMsg = error.message;
                if (error.code === 'ECONNREFUSED') errorMsg = 'Connection refused';
                else if (error.code === 'ETIMEDOUT') errorMsg = 'Timeout';
                else if (error.code === 'ENOTFOUND') errorMsg = 'Host not found';
                else if (errorMsg.includes('403')) errorMsg = 'Access forbidden (403)';
                else if (errorMsg.includes('self-signed')) errorMsg = 'SSL error';

                throw new Error(errorMsg);
            }
            // Quick retry (500ms)
            await sleep(500);
        }
    }
}

/**
 * Fetch multiple URLs in parallel with concurrency limit
 */
async function fetchMultiple(urls, options = {}) {
    const {
        concurrency = 10,  // Increased from 5 to 10
        timeout = 10000,   // Reduced from 30s to 10s
        onProgress = null
    } = options;

    const results = [];
    const queue = [...urls];
    let completed = 0;

    while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);

        const batchPromises = batch.map(async (url) => {
            try {
                const html = await fetchUrl(url, { timeout });
                completed++;
                if (onProgress) onProgress(completed, urls.length);
                return { url, html, error: null };
            } catch (error) {
                completed++;
                if (onProgress) onProgress(completed, urls.length);
                return { url, html: null, error: error.message };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    fetchUrl,
    fetchMultiple,
    getRandomUserAgent,
    USER_AGENTS
};
