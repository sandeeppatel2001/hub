/**
 * Multi-Engine Dark Web Search - Fixed with proper Ahmia search token handling
 * Uses SocksProxyAgent like working code
 */

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const cheerio = require('cheerio');
const httpFetcher = require('../utils/httpFetcher');

// Tor SOCKS5 proxy
const torProxy = 'socks5h://127.0.0.1:9050';
const torAgent = new SocksProxyAgent(torProxy);

// Top 20 best dark web search engines (hardcoded)
const TOP_SEARCH_ENGINES = {
    "ahmia": "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion",
    "darksearchio": "http://darksearch.io",
    "onionland": "http://3bbad7fauom4d6sgppalyqddsqbf5u5p56b5k5uk2zxsy3d6ey2jobad.onion",
    "darksearchengine": "http://l4rsciqnpzdndt2llgjx3luvnxip7vbyj6k6nmdy4xs77tx6gkd24ead.onion",
    "phobos": "http://phobosxilamwcg75xt22id7aywkzol6q6rfl2flipcqoc4e4ahima5id.onion",
    "onionsearchserver": "http://3fzh7yuupdfyjhwt3ugzqqof6ulbcl27ecev33knxe3u7goi3vfn2qqd.onion",
    "torgle": "http://no6m4wzdexe3auiupv2zwif7rm6qwxcyhslkcnzisxgeiw6pvjsgafad.onion",
    "tor66": "http://tor66sewebgixwhcqfnp5inzp5x5uohhdy3kvtnyfxc2e5mxiuh34iid.onion",
    "haystak": "http://haystak5njsmn2hqkewecpaxetahtwhsbsa64jom2k22z5afxhnpxfid.onion",
    "torch": "http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rplyvk3noyd.onion",
    "ahmia_clearnet": "https://ahmia.fi",
    "bobby": "http://bobby64o755x3gsuznts6hf6agxqjcz5bop6hs7ejorekbm7omes34ad.onion",
    "sentor": "http://e27slbec2ykiyo26gfuovaehuzsydffbit5nlxid53kigw3pvz6uosqd.onion",
    "gdark": "http://zb2jtkhnbvhkya3d46twv3g7lkobi4s62tjffqmafjibixk6pmq75did.onion",
    "kraken": "http://krakenai2gmgwwqyo7bcklv2lzcvhe7cxzzva2xpygyax5f33oqnxpad.onion",
    "deepsearch": "http://search7tdrcvri22rieiwgi5g46qnwsesvnubqav2xakhezv4hjzkkad.onion",
    "demon": "http://srcdemonm74icqjvejew6fprssuolyoc2usjdwflevbdpqoetw4x3ead.onion",
    "visitor": "http://uzowkytjk4da724giztttfly4rugfnbqkexecotfp5wjc2uhpykrpryd.onion",
    "venus": "http://venusoseaqnafjvzfmrcpcq6g47rhd7sa6nmzvaa4bj5rp6nm5jl7gad.onion",
    "danex": "http://danexio627wiswvlpt6ejyhpxl5gla5nt2tgvgm2apj2ofrgxtyxrhokfqd.onion"
};

/**
 * Search across multiple dark web search engines
 */
async function multiEngineSearch(query, engines = null, options = {}) {
    const {
        maxResultsPerEngine = 20,
        timeout = 30000
    } = options;

    const enginesToUse = engines ?
        engines.filter(e => TOP_SEARCH_ENGINES[e.toLowerCase()]) :
        Object.keys(TOP_SEARCH_ENGINES);

    console.log(`[+] Searching "${query}" across ${enginesToUse.length} search engines...`);

    const results = {
        query: query,
        searched_at: new Date().toISOString(),
        engines_used: enginesToUse,
        total_engines: enginesToUse.length,
        results: [],
        errors: []
    };

    const seenUrls = new Set();

    const searchPromises = enginesToUse.map(engineName =>
        searchEngine(engineName, query, maxResultsPerEngine, timeout, seenUrls)
    );

    const engineResults = await Promise.allSettled(searchPromises);

    for (let i = 0; i < engineResults.length; i++) {
        const result = engineResults[i];
        const engineName = enginesToUse[i];

        if (result.status === 'fulfilled' && result.value.results) {
            results.results.push(...result.value.results);
            console.log(`[+] ${engineName}: Found ${result.value.results.length} unique results`);
        } else {
            const error = result.reason || result.value?.error || 'Unknown error';
            results.errors.push({
                engine: engineName,
                error: error.toString()
            });
            console.log(`[-] ${engineName}: ${error}`);
        }
    }

    results.total_results = results.results.length;
    console.log(`[+] Total unique results: ${results.total_results}`);

    return results;
}

/**
 * Search a single engine (using working code's approach for Ahmia)
 */
async function searchEngine(engineName, query, maxResults, timeout, seenUrls) {
    try {
        const engineUrl = TOP_SEARCH_ENGINES[engineName];

        // Special handling for Ahmia (like working code)
        if (engineName === 'ahmia') {
            return await searchAhmia(engineUrl, query, maxResults, timeout, seenUrls);
        }

        // For other engines, use standard approach
        const searchUrl = buildSearchUrl(engineName, engineUrl, query);
        const html = await httpFetcher.fetchUrl(searchUrl, { timeout });
        const results = parseSearchResults(engineName, html, maxResults, seenUrls);

        return {
            engine: engineName,
            results: results
        };

    } catch (error) {
        return {
            engine: engineName,
            error: error.message,
            results: []
        };
    }
}

/**
 * Search Ahmia with token (like working code)
 */
async function searchAhmia(baseUrl, query, maxResults, timeout, seenUrls) {
    try {
        // Create axios instance with Tor proxy
        const axiosInstance = axios.create({
            httpAgent: torAgent,
            httpsAgent: torAgent,
            timeout: timeout,
            headers: {
                'User-Agent': httpFetcher.getRandomUserAgent()
            }
        });

        // Step 1: Fetch homepage to get search token
        const homeResponse = await axiosInstance.get(baseUrl + '/');
        const $home = cheerio.load(homeResponse.data);

        const hiddenInput = $home('#searchForm input[type="hidden"]');
        const paramName = hiddenInput.attr('name');
        const paramValue = hiddenInput.attr('value');

        if (!paramName || !paramValue) {
            throw new Error('Could not find search token');
        }

        // Step 2: Perform search with token
        const searchUrl = `${baseUrl}/search/?q=${encodeURIComponent(query)}&${paramName}=${paramValue}`;
        const searchResponse = await axiosInstance.get(searchUrl);
        const $ = cheerio.load(searchResponse.data);

        const results = [];
        $('li.result a').each((i, elem) => {
            if (results.length >= maxResults) return false;

            const $elem = $(elem);
            const href = $elem.attr('href');

            if (href) {
                let url = null;

                // Handle different Ahmia URL formats
                if (href.includes('redirect_url=')) {
                    const match = href.match(/redirect_url=(http[^&]+)/);
                    if (match && match[1]) {
                        url = decodeURIComponent(match[1]);
                    }
                } else if (href.includes('/address/')) {
                    const match = href.match(/\/address\/([a-z0-9]+\.onion)/);
                    if (match) url = `http://${match[1]}`;
                } else if (href.includes('.onion')) {
                    url = href;
                }

                if (url && url.includes('.onion')) {
                    const normalizedUrl = normalizeOnionUrl(url);

                    if (!seenUrls.has(normalizedUrl)) {
                        seenUrls.add(normalizedUrl);

                        const title = $elem.text().trim();
                        const description = $elem.closest('li.result')
                            .find('p')
                            .first()
                            .text()
                            .trim();

                        results.push({
                            title: title || normalizedUrl,
                            url: normalizedUrl,
                            description: description,
                            source_engine: 'ahmia',
                            found_at: new Date().toISOString()
                        });
                    }
                }
            }
        });

        return {
            engine: 'ahmia',
            results: results
        };

    } catch (error) {
        return {
            engine: 'ahmia',
            error: error.message,
            results: []
        };
    }
}

/**
 * Build search URL for specific engine
 */
function buildSearchUrl(engineName, engineUrl, query) {
    const encodedQuery = encodeURIComponent(query);

    const patterns = {
        'darksearchio': `${engineUrl}/api/search?query=${encodedQuery}`,
        'haystak': `${engineUrl}/?q=${encodedQuery}`,
        'torch': `${engineUrl}/search?query=${encodedQuery}&action=search`,
        'onionland': `${engineUrl}/search?q=${encodedQuery}`,
        'phobos': `${engineUrl}/search?query=${encodedQuery}`,
        'bobby': `${engineUrl}?q=${encodedQuery}`,
        'sentor': `${engineUrl}/search?q=${encodedQuery}`,
        'tor66': `${engineUrl}/search?q=${encodedQuery}`,
        'gdark': `${engineUrl}/search.php?query=${encodedQuery}`,
        'kraken': `${engineUrl}/search?q=${encodedQuery}`,
        'demon': `${engineUrl}/search?q=${encodedQuery}`,
        'visitor': `${engineUrl}/?q=${encodedQuery}`,
        'venus': `${engineUrl}/search?q=${encodedQuery}`,
        'danex': `${engineUrl}/search?q=${encodedQuery}`,
        'torgle': `${engineUrl}/search?q=${encodedQuery}`,
        'onionsearchserver': `${engineUrl}/search?q=${encodedQuery}`,
        'darksearchengine': `${engineUrl}/search?q=${encodedQuery}`,
        'deepsearch': `${engineUrl}/search?q=${encodedQuery}`,
        'ahmia_clearnet': `${engineUrl}/search/?q=${encodedQuery}`
    };

    return patterns[engineName] || `${engineUrl}/search?q=${encodedQuery}`;
}

/**
 * Parse search results from HTML
 */
function parseSearchResults(engineName, html, maxResults, seenUrls) {
    const $ = cheerio.load(html);
    const results = [];

    let selector = 'a[href]';

    if (engineName.includes('haystak')) {
        selector = '.result a.title';
    } else if (engineName.includes('torch')) {
        selector = '.result-block a';
    } else if (engineName.includes('onionland')) {
        selector = '.title a';
    }

    $(selector).each((i, elem) => {
        if (results.length >= maxResults) return false;

        const $elem = $(elem);
        const url = $elem.attr('href');
        const title = $elem.text().trim();

        if (url && url.includes('.onion')) {
            const normalizedUrl = normalizeOnionUrl(url);

            if (!seenUrls.has(normalizedUrl)) {
                seenUrls.add(normalizedUrl);

                const description = $elem.closest('.result, .search-result, .item')
                    .find('p, .description, .snippet')
                    .first()
                    .text()
                    .trim();

                results.push({
                    title: title || normalizedUrl,
                    url: normalizedUrl,
                    description: description,
                    source_engine: engineName,
                    found_at: new Date().toISOString()
                });
            }
        }
    });

    return results;
}

/**
 * Normalize .onion URL
 */
function normalizeOnionUrl(url) {
    let normalized = url.replace(/^https?:\/\//, '');
    if (!normalized.startsWith('http')) {
        normalized = 'http://' + normalized;
    }
    return normalized;
}

/**
 * Get list of available search engines
 */
function getAvailableEngines() {
    return Object.keys(TOP_SEARCH_ENGINES).map(name => ({
        name: name,
        url: TOP_SEARCH_ENGINES[name]
    }));
}

module.exports = {
    multiEngineSearch,
    getAvailableEngines,
    TOP_SEARCH_ENGINES
};
