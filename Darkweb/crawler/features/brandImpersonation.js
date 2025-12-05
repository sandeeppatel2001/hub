/**
 * Enhanced Brand Monitoring
 * Analyzes search results from multi-engine search (no redundant crawling)
 */

const dataExtractor = require('../utils/dataExtractor');
const domainSimilarity = require('../utils/domainSimilarity');
const htmlSimilarity = require('../utils/htmlSimilarity');
const httpFetcher = require('../utils/httpFetcher');

/**
 * Analyze search results for brand impersonation
 * @param {array} searchResults - Results from multiEngineSearch
 * @param {object} companyProfile - Company profile configuration
 * @param {object} options - Analysis options
 * @returns {object} - Analysis results
 */
async function analyzeSearchResults(searchResults, companyProfile, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  BRAND MONITORING - ANALYZING SEARCH RESULTS`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`  Results to analyze: ${searchResults.length}`);
    console.log(`${'='.repeat(60)}\n`);

    const {
        checkSimilarity = true,
        downloadRealSite = true,
        crawlHighSimilarity = true,  // Only crawl sites with high domain similarity
        similarityThreshold = 70
    } = options;

    const results = {
        companyName: companyProfile.companyName,
        analyzedAt: new Date().toISOString(),
        totalAnalyzed: searchResults.length,
        totalFindings: 0,
        findings: [],
        severityCounts: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        }
    };

    // Download real site once for comparison
    let realSiteHtml = null;
    if (downloadRealSite && companyProfile.realLoginUrl) {
        realSiteHtml = await fetchRealSite(companyProfile.realLoginUrl);
    }

    // Analyze each search result
    for (const searchResult of searchResults) {
        try {
            const finding = await analyzeSearchResult(
                searchResult,
                companyProfile,
                realSiteHtml,
                {
                    checkSimilarity,
                    crawlHighSimilarity,
                    similarityThreshold
                }
            );

            if (finding) {
                results.findings.push(finding);
                results.severityCounts[finding.severity]++;
            }
        } catch (error) {
            console.log(`[-] Error analyzing ${searchResult.url}: ${error.message}`);
        }
    }

    results.totalFindings = results.findings.length;

    // Sort findings by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    results.findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    console.log(`\n[+] Analysis complete: ${results.totalFindings} findings`);
    console.log(`    Critical: ${results.severityCounts.critical}`);
    console.log(`    High: ${results.severityCounts.high}`);
    console.log(`    Medium: ${results.severityCounts.medium}`);
    console.log(`    Low: ${results.severityCounts.low}`);

    return results;
}

/**
 * Analyze a single search result
 */
async function analyzeSearchResult(searchResult, companyProfile, realSiteHtml, options) {
    const finding = {
        url: searchResult.url,
        title: searchResult.title,
        description: searchResult.description,
        source_engine: searchResult.source_engine,  // Include which engine found it
        found_at: searchResult.found_at,
        analyzed_at: new Date().toISOString(),
        indicators: [],
        severity: 'low',
        severity_score: 0
    };

    // Step 1: Check domain similarity (no crawling needed)
    const domainCheck = domainSimilarity.checkBrandSimilarity(
        searchResult.url,
        companyProfile.keywords
    );

    if (domainCheck.match) {
        finding.indicators.push({
            type: 'domain_similarity',
            confidence: domainCheck.confidence,
            matched_keyword: domainCheck.keyword,
            similarity_type: domainCheck.type
        });
        finding.severity_score += domainCheck.confidence / 10;
    }

    // Step 2: Check title and description for keywords (no crawling needed)
    const textToCheck = `${searchResult.title} ${searchResult.description}`.toLowerCase();
    const keywordMatches = companyProfile.keywords.filter(keyword =>
        textToCheck.includes(keyword.toLowerCase())
    );

    if (keywordMatches.length > 0) {
        finding.indicators.push({
            type: 'keyword_in_metadata',
            keywords: keywordMatches,
            location: 'title_or_description'
        });
        finding.severity_score += 1;
    }

    // Step 3: Decide if we should crawl this site
    // Only crawl if: high domain similarity OR user wants to check HTML similarity
    const shouldCrawl = (
        (domainCheck.match && domainCheck.confidence >= options.similarityThreshold) ||
        (options.checkSimilarity && realSiteHtml)
    );

    if (shouldCrawl) {
        try {
            console.log(`[+] Crawling high-similarity site: ${searchResult.url}`);
            const html = await httpFetcher.fetchUrl(searchResult.url);

            if (html) {
                // Extract data
                const extracted = dataExtractor.extractAllData(
                    html,
                    searchResult.url,
                    companyProfile.keywords
                );

                finding.extracted_data = extracted;

                // Check for keywords in content
                if (extracted.keywords_found.length > 0) {
                    finding.indicators.push({
                        type: 'keyword_match',
                        keywords: extracted.keywords_found.map(k => k.keyword),
                        total_matches: extracted.keywords_found.reduce((sum, k) => sum + k.count, 0)
                    });
                    finding.severity_score += 2;
                }

                // Check for login form
                if (htmlSimilarity.hasLoginForm(html)) {
                    finding.indicators.push({
                        type: 'login_form_detected',
                        confidence: 90
                    });
                    finding.severity_score += 3;
                }

                // Check HTML similarity with real site
                if (options.checkSimilarity && realSiteHtml && htmlSimilarity.hasLoginForm(html)) {
                    const similarity = htmlSimilarity.compareHtmlStructure(html, realSiteHtml);

                    if (similarity.overall > 60) {
                        finding.indicators.push({
                            type: 'html_similarity',
                            similarity_score: similarity.overall,
                            details: similarity
                        });
                        finding.severity_score += similarity.overall / 10;
                    }
                }

                // Check for credentials/data leaks
                if (extracted.credentials.length > 0) {
                    finding.indicators.push({
                        type: 'credentials_found',
                        count: extracted.credentials.length
                    });
                    finding.severity_score += 5;
                }

                // Check for company domains in links
                const companyDomainMentions = extracted.clearnet_links.filter(link =>
                    companyProfile.domains.some(domain => link.includes(domain))
                );

                if (companyDomainMentions.length > 0) {
                    finding.indicators.push({
                        type: 'company_domain_mentioned',
                        links: companyDomainMentions
                    });
                    finding.severity_score += 2;
                }

                finding.was_crawled = true;
            }
        } catch (error) {
            finding.crawl_error = error.message;
            finding.was_crawled = false;
        }
    } else {
        finding.was_crawled = false;
        finding.crawl_reason = 'Low similarity - crawling skipped for efficiency';
    }

    // Calculate final severity
    finding.severity = calculateSeverity(finding.severity_score);

    // Only return findings with indicators
    return finding.indicators.length > 0 ? finding : null;
}

/**
 * Fetch real company site for comparison
 */
async function fetchRealSite(url) {
    try {
        console.log(`[+] Downloading real site for comparison: ${url}`);
        const html = await httpFetcher.fetchUrl(url, { timeout: 10000 });
        console.log(`[+] Real site downloaded successfully`);
        return html;
    } catch (error) {
        console.log(`[-] Could not download real site: ${error.message}`);
        return null;
    }
}

/**
 * Calculate severity from score
 */
function calculateSeverity(score) {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
}

module.exports = {
    analyzeSearchResults
};
