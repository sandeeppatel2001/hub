/**
 * ROBUST Feature 1: Credential & Data Intelligence
 * Uses existing crawler to scan found sites for company-related data
 */

const fs = require('fs');
const path = require('path');
const { fetchOnion } = require('../crawler');
const { searchAhmia } = require('../search');
const { scanContent, PATTERNS } = require('../scanner');
const { generateReport, deduplicateFindings } = require('../utils/alerting');

/**
 * Enhanced credential extraction with company domain filtering
 * @param {object} scanResult - Result from existing scanner
 * @param {array} companyDomains - Company email domains
 * @returns {object} - Filtered credentials
 */
function filterCompanyData(scanResult, companyDomains) {
    if (!scanResult || !scanResult.intelligence) {
        return null;
    }

    const intel = scanResult.intelligence;
    const companyData = {
        emails: [],
        apiKeys: [],
        hasData: false
    };

    // Filter emails by company domain
    if (intel.pii && intel.pii.emails) {
        companyData.emails = intel.pii.emails.filter(email => {
            return companyDomains.some(domain =>
                email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
            );
        });
    }

    // Include all API keys (they might be company's)
    if (intel.pii && intel.pii.api_keys) {
        companyData.apiKeys = intel.pii.api_keys;
    }

    companyData.hasData = companyData.emails.length > 0 || companyData.apiKeys.length > 0;

    return companyData;
}

/**
 * Main scan function - uses existing working crawler
 * @param {object} companyProfile - Company profile configuration
 * @returns {object} - Scan report
 */
async function scan(companyProfile) {
    console.log(`\n=== Feature 1: Credential & Data Intelligence (ROBUST) ===`);
    console.log(`[*] Scanning for: ${companyProfile.companyName}`);
    console.log(`[*] Monitoring domains: ${companyProfile.domains.join(', ')}\n`);

    const findings = [];

    try {
        // Use existing Ahmia search
        console.log(`[*] Searching dark web for "${companyProfile.companyName}"...`);
        const urls = await searchAhmia(companyProfile.companyName);

        if (urls.length === 0) {
            console.log(`[-] No sites found mentioning ${companyProfile.companyName}`);
        } else {
            console.log(`[+] Found ${urls.length} sites to scan\n`);

            // Scan each URL using existing crawler
            for (const url of urls) {
                try {
                    const result = await fetchOnion(url, companyProfile.keywords);

                    if (result && result.status === 200) {
                        // Check for company-specific data
                        const companyData = filterCompanyData(result, companyProfile.domains);

                        if (companyData && companyData.hasData) {
                            findings.push({
                                id: `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                type: 'credential_leak',
                                source: url,
                                title: `Company data found on dark web`,
                                description: `Found ${companyData.emails.length} company emails, ${companyData.apiKeys.length} API keys`,
                                evidence: {
                                    emails: companyData.emails,
                                    apiKeys: companyData.apiKeys.map(() => '***REDACTED***'),
                                    pageTitle: result.title
                                },
                                timestamp: result.timestamp,
                                recommendedAction: 'Investigate and rotate compromised credentials'
                            });

                            console.log(`[!] ALERT: Company data found at ${url}`);
                            console.log(`    Emails: ${companyData.emails.length}, API Keys: ${companyData.apiKeys.length}`);
                        }

                        // Also check for keyword mentions
                        if (result.intelligence && result.intelligence.keywords &&
                            result.intelligence.keywords.length > 0) {
                            console.log(`[*] Keywords found at ${url}: ${result.intelligence.keywords.join(', ')}`);
                        }
                    }

                } catch (error) {
                    console.error(`[-] Error scanning ${url}: ${error.message}`);
                }
            }
        }

    } catch (error) {
        console.error(`[-] Search error: ${error.message}`);
    }

    // Deduplicate
    const uniqueFindings = deduplicateFindings(findings);

    // Generate report
    const report = generateReport(uniqueFindings, 'credential_leaks', companyProfile.companyName);

    // Save report
    const reportPath = path.join(__dirname, '../../reports/credential_leaks',
        `report_${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n[+] Scan complete!`);
    console.log(`[+] Total findings: ${report.totalFindings}`);
    console.log(`[+] Critical alerts: ${report.severityCounts.critical}`);
    console.log(`[+] Report saved: ${reportPath}\n`);

    return report;
}

// CLI execution
if (require.main === module) {
    const companyProfilePath = process.argv[2] || path.join(__dirname, '../../config/company_profile.json');

    if (!fs.existsSync(companyProfilePath)) {
        console.error('[-] Company profile not found. Please create config/company_profile.json');
        process.exit(1);
    }

    const companyProfile = JSON.parse(fs.readFileSync(companyProfilePath, 'utf8'));
    scan(companyProfile);
}

module.exports = { scan, filterCompanyData };
