/**
 * Twitter Monitor
 * Monitor threat actor Twitter accounts (uses common analysisUtils)
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
 * Scan Twitter accounts for company mentions
 */
async function scanTwitterAccounts(companyProfile, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  TWITTER MONITORING SCAN`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`${'='.repeat(60)}\n`);

    const config = loadSourcesConfig();
    if (!config) {
        throw new Error('Sources configuration not found');
    }

    const { maxAccountsToCheck = 30 } = options;

    const results = {
        companyName: companyProfile.companyName,
        scanDate: new Date().toISOString(),
        totalFindings: 0,
        findings: [],
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        accountsChecked: 0,
        accountsOffline: 0
    };

    const twitterAccounts = config.sources.twitter.slice(0, maxAccountsToCheck);
    console.log(`[+] Checking ${twitterAccounts.length} Twitter accounts...`);

    for (const account of twitterAccounts) {
        try {
            console.log(`[+] Checking: ${account.name}`);
            const finding = await checkTwitterAccount(account, companyProfile);

            if (finding) {
                results.findings.push(finding);
                results.severityCounts[finding.severity]++;
                console.log(`    [!] MATCH FOUND - Severity: ${finding.severity}`);
            }

            results.accountsChecked++;
            await analysisUtils.sleep(1000);  // Reduced from 2000ms

        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
                results.accountsOffline++;
            }
            console.log(`    [-] Error: ${error.message}`);
        }
    }

    results.totalFindings = results.findings.length;

    console.log(`\n[+] Scan complete:`);
    console.log(`    Accounts checked: ${results.accountsChecked}`);
    console.log(`    Accounts offline: ${results.accountsOffline}`);
    console.log(`    Findings: ${results.totalFindings}`);

    return results;
}

/**
 * Check a single Twitter account
 */
async function checkTwitterAccount(account, companyProfile) {
    try {
        const html = await httpFetcher.fetchUrl(account.url, { timeout: 10000 });
        if (!html) return null;

        const matches = analysisUtils.findCompanyMentions(html, companyProfile, {
            keywordThreshold: 2
        });

        if (matches.found) {
            const $ = cheerio.load(html);
            const tweets = extractTweets($, companyProfile);

            return {
                account_name: account.name,
                account_url: account.url,
                attack_type: account.attack_type || 'Unknown',
                found_at: new Date().toISOString(),
                matches: matches.details,
                severity: analysisUtils.calculateSeverity(matches.details),
                indicators: [{
                    type: 'twitter_mention',
                    account: account.name,
                    confidence: 80
                }],
                extracted_content: tweets
            };
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Extract tweets from page
 */
function extractTweets($, companyProfile) {
    const selectors = ['article', '.tweet', '[data-testid="tweet"]'];
    return analysisUtils.extractContent($, companyProfile, selectors, 5);
}

module.exports = {
    scanTwitterAccounts
};
