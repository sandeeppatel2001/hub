/**
 * Forum Crawler
 * Crawl dark web forums (uses common analysisUtils)
 */

const httpFetcher = require('../utils/httpFetcher');
const analysisUtils = require('../utils/analysisUtils');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Load sources configuration
const sourcesConfigPath = path.join(__dirname, '../../config/sources_config.json');

function loadSourcesConfig() {
    if (fs.existsSync(sourcesConfigPath)) {
        return JSON.parse(fs.readFileSync(sourcesConfigPath, 'utf8'));
    }
    return null;
}

/**
 * Scan forums for company mentions
 */
async function scanForums(companyProfile, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  FORUM MONITORING SCAN`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`${'='.repeat(60)}\n`);

    const config = loadSourcesConfig();
    if (!config) {
        throw new Error('Sources configuration not found');
    }

    const { maxForumsToCheck = 50 } = options;

    const results = {
        companyName: companyProfile.companyName,
        scanDate: new Date().toISOString(),
        totalFindings: 0,
        findings: [],
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        forumsChecked: 0,
        forumsOffline: 0
    };

    const forums = config.sources.forums.slice(0, maxForumsToCheck);
    console.log(`[+] Checking ${forums.length} forums...`);

    for (const forum of forums) {
        try {
            console.log(`[+] Checking: ${forum.name}`);
            const finding = await checkForum(forum, companyProfile);

            if (finding) {
                results.findings.push(finding);
                results.severityCounts[finding.severity]++;
                console.log(`    [!] MATCH FOUND - Severity: ${finding.severity}`);
            }

            results.forumsChecked++;
            await analysisUtils.sleep(1000);  // Reduced from 2000ms

        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
                results.forumsOffline++;
            }
            console.log(`    [-] Error: ${error.message}`);
        }
    }

    results.totalFindings = results.findings.length;

    console.log(`\n[+] Scan complete:`);
    console.log(`    Forums checked: ${results.forumsChecked}`);
    console.log(`    Forums offline: ${results.forumsOffline}`);
    console.log(`    Findings: ${results.totalFindings}`);

    return results;
}

/**
 * Check a single forum
 */
async function checkForum(forum, companyProfile) {
    try {
        const html = await httpFetcher.fetchUrl(forum.url, { timeout: 10000 });
        if (!html) return null;

        const matches = analysisUtils.findCompanyMentions(html, companyProfile, {
            keywordThreshold: 3
        });

        if (matches.found) {
            const $ = cheerio.load(html);
            const posts = extractPosts($, companyProfile);

            return {
                forum_name: forum.name,
                forum_url: forum.url,
                description: forum.description || '',
                found_at: new Date().toISOString(),
                matches: matches.details,
                severity: analysisUtils.calculateSeverity(matches.details),
                indicators: [{
                    type: 'forum_mention',
                    forum: forum.name,
                    confidence: 75
                }],
                extracted_content: posts
            };
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Extract posts/threads from forum
 */
function extractPosts($, companyProfile) {
    const selectors = ['.post', '.thread', '.topic', 'article', '.message'];
    const posts = analysisUtils.extractContent($, companyProfile, selectors, 5);

    // Add title and author extraction
    return posts.map(post => ({
        ...post,
        title: $(post.html).find('.title, h1, h2, h3').first().text().trim(),
        author: $(post.html).find('.author, .username').first().text().trim()
    }));
}

module.exports = {
    scanForums
};
