/**
 * Ransomware Gang Monitoring
 * Monitor ransomware leak sites for company mentions (uses common httpFetcher)
 */

const cheerio = require('cheerio');
const httpFetcher = require('../utils/httpFetcher');
const analysisUtils = require('../utils/analysisUtils');
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
 * Scan ransomware leak sites for company mentions
 * @param {object} companyProfile - Company profile
 * @param {object} options - Scan options
 * @returns {object} - Scan results
 */
async function scanRansomwareSites(companyProfile, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  RANSOMWARE MONITORING SCAN`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`${'='.repeat(60)}\n`);

    const config = loadSourcesConfig();
    if (!config) {
        throw new Error('Sources configuration not found');
    }

    const {
        maxSitesToCheck = 100
    } = options;

    const results = {
        companyName: companyProfile.companyName,
        scanDate: new Date().toISOString(),
        totalFindings: 0,
        findings: [],
        severityCounts: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        },
        sitesChecked: 0,
        sitesOffline: 0
    };

    // Get ransomware sites to check
    const ransomwareSites = config.sources.ransomware.slice(0, maxSitesToCheck);
    console.log(`[+] Checking ${ransomwareSites.length} ransomware leak sites...`);

    // Check each site
    for (const site of ransomwareSites) {
        try {
            console.log(`[+] Checking: ${site.name}`);
            const finding = await checkRansomwareSite(site, companyProfile);

            if (finding) {
                results.findings.push(finding);
                results.severityCounts[finding.severity]++;
                console.log(`    [!] MATCH FOUND - Severity: ${finding.severity}`);
            }

            results.sitesChecked++;

            // Rate limiting (reduced for speed)
            await analysisUtils.sleep(500);

        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
                results.sitesOffline++;
            }
            console.log(`    [-] Error: ${error.message}`);
        }
    }

    results.totalFindings = results.findings.length;

    console.log(`\n[+] Scan complete:`);
    console.log(`    Sites checked: ${results.sitesChecked}`);
    console.log(`    Sites offline: ${results.sitesOffline}`);
    console.log(`    Findings: ${results.totalFindings}`);
    console.log(`    Critical: ${results.severityCounts.critical}`);
    console.log(`    High: ${results.severityCounts.high}`);

    return results;
}

/**
 * Check a single ransomware site (uses common httpFetcher)
 */
async function checkRansomwareSite(site, companyProfile) {
    try {
        // Use common fetch function
        const html = await httpFetcher.fetchUrl(site.url, { timeout: 10000 });

        if (!html) return null;

        // Search for company mentions
        const matches = analysisUtils.findCompanyMentions(html, companyProfile, {
            keywordThreshold: 3
        });

        if (matches.found) {
            return {
                ransomware_gang: site.name,
                site_url: site.url,
                found_at: new Date().toISOString(),
                matches: matches.details,
                severity: 'critical', // All ransomware findings are critical
                indicators: [
                    {
                        type: 'ransomware_victim_list',
                        gang: site.name,
                        confidence: 100
                    }
                ],
                extracted_content: matches.content
            };
        }

        return null;

    } catch (error) {
        throw error;
    }
}

/**
 * Extract victim information from page
 */
function extractVictimInfo($, companyProfile) {
    const selectors = [
        '.victim', '.post', '.leak', '.company',
        'article', '.entry', '.item'
    ];
    return analysisUtils.extractContent($, companyProfile, selectors, 5);
}

module.exports = {
    scanRansomwareSites
};
