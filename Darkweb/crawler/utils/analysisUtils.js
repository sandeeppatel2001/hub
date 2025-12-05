/**
 * Common Analysis Utilities - Improved severity scoring
 * More nuanced scoring based on actual threat indicators
 */

const cheerio = require('cheerio');

/**
 * Find company mentions in HTML
 */
function findCompanyMentions(html, companyProfile, options = {}) {
    const {
        keywordThreshold = 3
    } = options;

    const $ = cheerio.load(html);
    const text = $('body').text().toLowerCase();
    const htmlLower = html.toLowerCase();

    const result = {
        found: false,
        details: [],
        content: []
    };

    // Check company name
    if (text.includes(companyProfile.companyName.toLowerCase())) {
        result.found = true;
        result.details.push({
            type: 'company_name',
            value: companyProfile.companyName,
            contexts: extractContexts(text, companyProfile.companyName.toLowerCase())
        });
    }

    // Check domains
    for (const domain of companyProfile.domains) {
        if (htmlLower.includes(domain.toLowerCase())) {
            result.found = true;
            result.details.push({
                type: 'domain',
                value: domain,
                contexts: extractContexts(text, domain.toLowerCase())
            });
        }
    }

    // Check keywords
    for (const keyword of companyProfile.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (text.includes(keywordLower)) {
            const regex = new RegExp(keywordLower, 'g');
            const count = (text.match(regex) || []).length;

            if (count >= keywordThreshold) {
                result.found = true;
                result.details.push({
                    type: 'keyword',
                    value: keyword,
                    count: count,
                    contexts: extractContexts(text, keywordLower)
                });
            }
        }
    }

    return result;
}

/**
 * Extract context around keyword matches
 */
function extractContexts(text, keyword, maxContexts = 3) {
    const contexts = [];
    const regex = new RegExp(`.{0,100}${escapeRegex(keyword)}.{0,100}`, 'gi');
    let match;
    let count = 0;

    while ((match = regex.exec(text)) !== null && count < maxContexts) {
        contexts.push(match[0].trim());
        count++;
    }

    return contexts;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate severity based on match details - IMPROVED
 * More nuanced scoring to avoid too many "high" ratings
 */
function calculateSeverity(details) {
    const hasCompanyName = details.some(d => d.type === 'company_name');
    const hasDomain = details.some(d => d.type === 'domain');
    const keywordMatches = details.filter(d => d.type === 'keyword');
    const totalKeywordCount = keywordMatches.reduce((sum, d) => sum + (d.count || 0), 0);

    // Calculate score (0-100)
    let score = 0;

    // Company name mention (30 points)
    if (hasCompanyName) score += 30;

    // Domain mention (40 points - higher because more specific)
    if (hasDomain) score += 40;

    // Keyword mentions (scaled)
    if (totalKeywordCount > 0) {
        if (totalKeywordCount >= 20) score += 30;
        else if (totalKeywordCount >= 10) score += 20;
        else if (totalKeywordCount >= 5) score += 10;
        else score += 5;
    }

    // Convert score to severity
    if (score >= 70) return 'critical';  // Company name + domain OR very high keyword count
    if (score >= 50) return 'high';      // Company name OR domain + keywords
    if (score >= 30) return 'medium';    // Company name OR domain OR many keywords
    return 'low';                         // Few keyword mentions only
}

/**
 * Extract generic content from HTML based on selectors
 */
function extractContent($, companyProfile, selectors, maxItems = 5) {
    const content = [];

    for (const selector of selectors) {
        $(selector).each((i, elem) => {
            const $elem = $(elem);
            const text = $elem.text();

            const containsCompany = companyProfile.keywords.some(keyword =>
                text.toLowerCase().includes(keyword.toLowerCase())
            ) || companyProfile.domains.some(domain =>
                text.toLowerCase().includes(domain.toLowerCase())
            );

            if (containsCompany) {
                content.push({
                    html: $elem.html(),
                    text: text.trim().substring(0, 500),
                    links: $elem.find('a').map((i, a) => $(a).attr('href')).get()
                });
            }
        });
    }

    return content.slice(0, maxItems);
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    findCompanyMentions,
    extractContexts,
    calculateSeverity,
    extractContent,
    sleep
};
