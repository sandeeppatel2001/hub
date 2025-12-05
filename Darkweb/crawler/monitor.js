/**
 * Enhanced Dark Web Scanner - Master Orchestrator
 * All features integrated with configurable selection
 */

const fs = require('fs');
const path = require('path');

// Import modules
const multiEngineSearch = require('./search/multiEngineSearch');
const brandImpersonation = require('./features/brandImpersonation');
const ransomwareMonitor = require('./features/ransomwareMonitor');
const telegramScraper = require('./integrations/telegramScraper');
const twitterMonitor = require('./integrations/twitterMonitor');
const forumCrawler = require('./integrations/forumCrawler');
const formatter = require('./utils/formatter');

/**
 * Run comprehensive dark web scan
 * @param {object} companyProfile - Company profile configuration
 * @param {object} options - Scan options
 * @returns {object} - Consolidated results
 */
async function runFullScan(companyProfile, options = {}) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  DARK WEB INTELLIGENCE PLATFORM - COMPREHENSIVE SCAN`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(70)}\n`);

    const {
        features = ['all'],  // Default to all features
        searchEngines = null, // null = use all 20
        maxResultsPerEngine = 10,//20,
        maxRansomwareSites = 50,//100,
        maxTelegramChannels = 50,
        maxTwitterAccounts = 30,
        maxForums = 50
    } = options;

    // Expand 'all' to all available features
    const enabledFeatures = features.includes('all') ?
        ['brandMonitoring', 'ransomwareMonitoring', 'telegramMonitoring', 'twitterMonitoring', 'forumMonitoring'] :
        features;

    const results = {
        companyName: companyProfile.companyName,
        scanDate: new Date().toISOString(),
        scanOptions: {
            features: enabledFeatures,
            searchEngines: searchEngines || 'all_20_engines',
            maxResultsPerEngine: maxResultsPerEngine
        },
        searchResults: null,
        features: {},
        summary: {
            totalFindings: 0,
            criticalAlerts: 0,
            highAlerts: 0,
            mediumAlerts: 0,
            lowAlerts: 0
        },
        metadata: {
            scanDuration: null,
            sourcesScanned: {}
        }
    };

    const startTime = Date.now();

    // STEP 1: Multi-Engine Search (for brand monitoring)
    if (enabledFeatures.includes('brandMonitoring')) {
        console.log('\n' + '='.repeat(70));
        console.log('STEP 1: MULTI-ENGINE SEARCH');
        console.log('='.repeat(70));

        const allSearchResults = [];

        for (const keyword of companyProfile.keywords) {
            console.log(`\n[+] Searching for keyword: "${keyword}"`);

            try {
                const searchResults = await multiEngineSearch.multiEngineSearch(
                    keyword,
                    searchEngines,
                    { maxResultsPerEngine: maxResultsPerEngine }
                );

                allSearchResults.push(...searchResults.results);

            } catch (error) {
                console.error(`[-] Error searching for ${keyword}: ${error.message}`);
            }
        }

        // Remove duplicates
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of allSearchResults) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }

        results.searchResults = {
            total_results: uniqueResults.length,
            results: uniqueResults
        };

        console.log(`\n[+] Total unique search results: ${uniqueResults.length}`);
        results.metadata.sourcesScanned.searchEngines = searchEngines || 20;

        // Analyze search results for brand monitoring
        try {
            console.log('\n' + '='.repeat(70));
            console.log('STEP 2: BRAND MONITORING (analyzing search results)');
            console.log('='.repeat(70));

            const brandReport = await brandImpersonation.analyzeSearchResults(
                uniqueResults,
                companyProfile,
                {
                    checkSimilarity: true,
                    downloadRealSite: true,
                    crawlHighSimilarity: true,
                    similarityThreshold: 70
                }
            );

            results.features.brandMonitoring = brandReport;
            updateSummary(results, brandReport);

        } catch (error) {
            console.error(`[-] Error in brand monitoring: ${error.message}`);
            results.features.brandMonitoring = { error: error.message };
        }
    }

    // STEP 2/3: Ransomware Monitoring
    if (enabledFeatures.includes('ransomwareMonitoring')) {
        try {
            console.log('\n' + '='.repeat(70));
            console.log('RANSOMWARE MONITORING');
            console.log('='.repeat(70));

            const ransomwareReport = await ransomwareMonitor.scanRansomwareSites(
                companyProfile,
                { maxSitesToCheck: maxRansomwareSites }
            );

            results.features.ransomwareMonitoring = ransomwareReport;
            updateSummary(results, ransomwareReport);
            results.metadata.sourcesScanned.ransomwareSites = ransomwareReport.sitesChecked;

        } catch (error) {
            console.error(`[-] Error in ransomware monitoring: ${error.message}`);
            results.features.ransomwareMonitoring = { error: error.message };
        }
    }

    // STEP 3/4: Telegram Monitoring
    if (enabledFeatures.includes('telegramMonitoring')) {
        try {
            console.log('\n' + '='.repeat(70));
            console.log('TELEGRAM MONITORING');
            console.log('='.repeat(70));

            const telegramReport = await telegramScraper.scanTelegramChannels(
                companyProfile,
                { maxChannelsToCheck: maxTelegramChannels }
            );

            results.features.telegramMonitoring = telegramReport;
            updateSummary(results, telegramReport);
            results.metadata.sourcesScanned.telegramChannels = telegramReport.channelsChecked;

        } catch (error) {
            console.error(`[-] Error in Telegram monitoring: ${error.message}`);
            results.features.telegramMonitoring = { error: error.message };
        }
    }

    // STEP 4/5: Twitter Monitoring
    if (enabledFeatures.includes('twitterMonitoring')) {
        try {
            console.log('\n' + '='.repeat(70));
            console.log('TWITTER MONITORING');
            console.log('='.repeat(70));

            const twitterReport = await twitterMonitor.scanTwitterAccounts(
                companyProfile,
                { maxAccountsToCheck: maxTwitterAccounts }
            );

            results.features.twitterMonitoring = twitterReport;
            updateSummary(results, twitterReport);
            results.metadata.sourcesScanned.twitterAccounts = twitterReport.accountsChecked;

        } catch (error) {
            console.error(`[-] Error in Twitter monitoring: ${error.message}`);
            results.features.twitterMonitoring = { error: error.message };
        }
    }

    // STEP 5/6: Forum Monitoring
    if (enabledFeatures.includes('forumMonitoring')) {
        try {
            console.log('\n' + '='.repeat(70));
            console.log('FORUM MONITORING');
            console.log('='.repeat(70));

            const forumReport = await forumCrawler.scanForums(
                companyProfile,
                { maxForumsToCheck: maxForums }
            );

            results.features.forumMonitoring = forumReport;
            updateSummary(results, forumReport);
            results.metadata.sourcesScanned.forums = forumReport.forumsChecked;

        } catch (error) {
            console.error(`[-] Error in forum monitoring: ${error.message}`);
            results.features.forumMonitoring = { error: error.message };
        }
    }

    // Calculate scan duration
    const endTime = Date.now();
    results.metadata.scanDuration = `${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`;

    // Generate reports
    const reportPath = generateReport(results);

    // Generate formatted report
    const formattedPath = generateFormattedReport(results, reportPath);

    // Print summary
    printSummary(results, reportPath, formattedPath);

    return results;
}

/**
 * Update summary with feature results
 */
function updateSummary(results, featureReport) {
    if (featureReport.totalFindings) {
        results.summary.totalFindings += featureReport.totalFindings;
    }
    if (featureReport.severityCounts) {
        results.summary.criticalAlerts += featureReport.severityCounts.critical || 0;
        results.summary.highAlerts += featureReport.severityCounts.high || 0;
        results.summary.mediumAlerts += featureReport.severityCounts.medium || 0;
        results.summary.lowAlerts += featureReport.severityCounts.low || 0;
    }
}

/**
 * Generate JSON report
 */
function generateReport(results) {
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `darkweb_scan_${results.companyName}_${timestamp}.json`;
    const reportPath = path.join(reportsDir, filename);

    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    return reportPath;
}

/**
 * Generate formatted report using YAML templates
 */
function generateFormattedReport(results, originalReportPath) {
    try {
        const formattedFindings = formatter.formatScanResults(results);

        const formattedPath = originalReportPath.replace('.json', '_formatted.json');
        formatter.saveFormattedResults(formattedFindings, formattedPath);

        return formattedPath;
    } catch (error) {
        console.error(`[-] Error generating formatted report: ${error.message}`);
        return null;
    }
}

/**
 * Print scan summary
 */
function printSummary(results, reportPath, formattedPath) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  SCAN COMPLETE - SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Company: ${results.companyName}`);
    console.log(`  Scan Duration: ${results.metadata.scanDuration}`);
    if (results.searchResults) {
        console.log(`  Search Results: ${results.searchResults.total_results}`);
    }
    console.log(`  Total Findings: ${results.summary.totalFindings}`);
    console.log(`  `);
    console.log(`  Severity Breakdown:`);
    console.log(`    🔴 Critical: ${results.summary.criticalAlerts}`);
    console.log(`    🟠 High: ${results.summary.highAlerts}`);
    console.log(`    🟡 Medium: ${results.summary.mediumAlerts}`);
    console.log(`    🟢 Low: ${results.summary.lowAlerts}`);
    console.log(`  `);

    // Print feature-specific stats
    Object.entries(results.features).forEach(([featureName, featureData]) => {
        if (featureData && !featureData.error) {
            const displayName = featureName.replace(/([A-Z])/g, ' $1').trim();
            console.log(`  ${displayName}:`);
            if (featureData.totalAnalyzed) {
                console.log(`    Analyzed: ${featureData.totalAnalyzed}`);
            }
            if (featureData.sitesChecked) {
                console.log(`    Sites Checked: ${featureData.sitesChecked}`);
            }
            if (featureData.channelsChecked) {
                console.log(`    Channels Checked: ${featureData.channelsChecked}`);
            }
            if (featureData.accountsChecked) {
                console.log(`    Accounts Checked: ${featureData.accountsChecked}`);
            }
            if (featureData.forumsChecked) {
                console.log(`    Forums Checked: ${featureData.forumsChecked}`);
            }
            console.log(`    Findings: ${featureData.totalFindings || 0}`);
        }
    });

    console.log(`${'='.repeat(70)}`);
    console.log(`  📄 Raw report saved: ${reportPath}`);
    if (formattedPath) {
        console.log(`  📊 Formatted report saved: ${formattedPath}`);
    }
    console.log(`  📊 S3-ready JSON format with all details`);
    console.log(`${'='.repeat(70)}\n`);
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);

    // Parse arguments
    let companyProfilePath = path.join(__dirname, '../config/company_profile.json');
    let features = ['all'];
    let searchEngines = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--profile' && args[i + 1]) {
            companyProfilePath = args[i + 1];
            i++;
        } else if (args[i] === '--features' && args[i + 1]) {
            features = args[i + 1].split(',');
            i++;
        } else if (args[i] === '--engines' && args[i + 1]) {
            searchEngines = args[i + 1].split(',');
            i++;
        } else if (!args[i].startsWith('--')) {
            companyProfilePath = args[i];
        }
    }

    if (!fs.existsSync(companyProfilePath)) {
        console.error('[-] Company profile not found. Please create config/company_profile.json');
        console.error('\nUsage: node crawler/monitor.js [options]');
        console.error('\nOptions:');
        console.error('  --profile <path>         Path to company profile JSON');
        console.error('  --features <list>        Comma-separated features to run');
        console.error('                           Options: all, brandMonitoring, ransomwareMonitoring,');
        console.error('                                    telegramMonitoring, twitterMonitoring, forumMonitoring');
        console.error('                           Default: all');
        console.error('  --engines <list>         Comma-separated list of search engines to use');
        console.error('\nExamples:');
        console.error('  node crawler/monitor.js');
        console.error('  node crawler/monitor.js --features brandMonitoring,ransomwareMonitoring');
        console.error('  node crawler/monitor.js --features telegramMonitoring');
        console.error('  node crawler/monitor.js --engines ahmia,haystak,torch');
        console.error('\nAvailable engines:');
        const engines = multiEngineSearch.getAvailableEngines();
        engines.forEach(e => console.error(`  - ${e.name}`));
        process.exit(1);
    }

    const companyProfile = JSON.parse(fs.readFileSync(companyProfilePath, 'utf8'));

    const options = { features };
    if (searchEngines) {
        options.searchEngines = searchEngines;
        console.log(`[+] Using search engines: ${searchEngines.join(', ')}`);
    }

    console.log(`[+] Running features: ${features.join(', ')}`);
    runFullScan(companyProfile, options);
}

module.exports = {
    runFullScan
};
