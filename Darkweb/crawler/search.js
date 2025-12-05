const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const cheerio = require('cheerio');
const fs = require('fs');
const { fetchOnion } = require('./crawler');

// Tor SOCKS5 proxy
const torProxy = 'socks5h://127.0.0.1:9050';
const agent = new SocksProxyAgent(torProxy);

const axiosInstance = axios.create({
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0'
    }
});

/**
 * Searches Ahmia.fi for the given query and returns onion URLs.
 * @param {string} query - The brand or keyword to search for.
 * @returns {Promise<string[]>} - List of onion URLs.
 */
async function searchAhmia(query) {
    const baseUrl = 'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';
    console.log(`[*] Connecting to Ahmia (Onion)...`);

    try {
        // Step 1: Fetch Homepage to get the search token
        const homeResponse = await axiosInstance.get(baseUrl + '/');
        const $home = cheerio.load(homeResponse.data);

        // Extract hidden input from search form
        const hiddenInput = $home('#searchForm input[type="hidden"]');
        const paramName = hiddenInput.attr('name');
        const paramValue = hiddenInput.attr('value');

        if (!paramName || !paramValue) {
            console.error('[-] Could not find search token on Ahmia homepage.');
            return [];
        }

        console.log(`[+] Got search token: ${paramName}=${paramValue}`);

        // Step 2: Perform Search
        const searchUrl = `${baseUrl}/search/?q=${encodeURIComponent(query)}&${paramName}=${paramValue}`;
        console.log(`[*] Searching for "${query}"...`);

        const searchResponse = await axiosInstance.get(searchUrl);
        const $ = cheerio.load(searchResponse.data);

        const urls = [];
        $('li.result a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                // Check for Ahmia redirect format
                if (href.includes('redirect_url=')) {
                    const match = href.match(/redirect_url=(http[^&]+)/);
                    if (match && match[1]) {
                        urls.push(decodeURIComponent(match[1]));
                    }
                } else if (href.includes('/address/')) {
                    // Ahmia redirect format: /address/onionaddress
                    const match = href.match(/\/address\/([a-z0-9]+\.onion)/);
                    if (match) urls.push(`http://${match[1]}`);
                } else if (href.includes('.onion')) {
                    urls.push(href);
                }
            }
        });

        // Deduplicate
        const uniqueUrls = [...new Set(urls)];
        console.log(`[+] Found ${uniqueUrls.length} results on Ahmia.`);
        return uniqueUrls.slice(0, 5); // Return top 5

    } catch (error) {
        console.error(`[-] Error searching Ahmia: ${error.message}`);
        return [];
    }
}

async function runBrandSearch(brandName) {
    const urls = await searchAhmia(brandName);

    if (urls.length === 0) {
        console.log("[-] No results found. Try a different keyword.");
        return;
    }

    console.log(`[*] Starting deep scan of ${urls.length} sites...`);
    const report = [];

    for (const url of urls) {
        // Pass the brand name as a custom keyword to highlight it
        const result = await fetchOnion(url, [brandName]);
        report.push(result);
    }

    // Save Report
    const filename = `brand_report_${brandName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`[+] Brand Report saved to ${filename}`);
}

// Main execution
if (require.main === module) {
    const brand = process.argv[2];
    if (!brand) {
        console.log("Usage: node crawler/search.js <brand_name>");
        process.exit(1);
    }
    runBrandSearch(brand);
}

module.exports = { searchAhmia, runBrandSearch };

