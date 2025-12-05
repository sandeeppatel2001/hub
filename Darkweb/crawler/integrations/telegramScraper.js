/**
 * Telegram Channel Scraper
 * Monitor Telegram channels for brand mentions (uses common analysisUtils)
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
 * Scan Telegram channels for company mentions
 */
async function scanTelegramChannels(companyProfile, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  TELEGRAM MONITORING SCAN`);
    console.log(`  Company: ${companyProfile.companyName}`);
    console.log(`${'='.repeat(60)}\n`);

    const config = loadSourcesConfig();
    if (!config) {
        throw new Error('Sources configuration not found');
    }

    const { maxChannelsToCheck = 50 } = options;

    const results = {
        companyName: companyProfile.companyName,
        scanDate: new Date().toISOString(),
        totalFindings: 0,
        findings: [],
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        channelsChecked: 0,
        channelsOffline: 0
    };

    const telegramChannels = config.sources.telegram.slice(0, maxChannelsToCheck);
    console.log(`[+] Checking ${telegramChannels.length} Telegram channels...`);

    for (const channel of telegramChannels) {
        try {
            console.log(`[+] Checking: ${channel.name}`);
            const finding = await checkTelegramChannel(channel, companyProfile);

            if (finding) {
                results.findings.push(finding);
                results.severityCounts[finding.severity]++;
                console.log(`    [!] MATCH FOUND - Severity: ${finding.severity}`);
            }

            results.channelsChecked++;
            await analysisUtils.sleep(1000);  // Reduced from 1500ms

        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
                results.channelsOffline++;
            }
            console.log(`    [-] Error: ${error.message}`);
        }
    }

    results.totalFindings = results.findings.length;

    console.log(`\n[+] Scan complete:`);
    console.log(`    Channels checked: ${results.channelsChecked}`);
    console.log(`    Channels offline: ${results.channelsOffline}`);
    console.log(`    Findings: ${results.totalFindings}`);

    return results;
}

/**
 * Check a single Telegram channel
 */
async function checkTelegramChannel(channel, companyProfile) {
    try {
        const html = await httpFetcher.fetchUrl(channel.url, { timeout: 10000 });
        if (!html) return null;

        const matches = analysisUtils.findCompanyMentions(html, companyProfile, {
            keywordThreshold: 2  // Lower threshold for Telegram
        });

        if (matches.found) {
            const $ = cheerio.load(html);
            const messages = extractMessages($, companyProfile);

            return {
                channel_name: channel.name,
                channel_url: channel.url,
                attack_type: channel.attack_type || 'Unknown',
                found_at: new Date().toISOString(),
                matches: matches.details,
                severity: analysisUtils.calculateSeverity(matches.details),
                indicators: [{
                    type: 'telegram_mention',
                    channel: channel.name,
                    confidence: 85
                }],
                extracted_content: messages
            };
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Extract messages from Telegram channel
 */
function extractMessages($, companyProfile) {
    const selectors = ['.tgme_widget_message', '.message', '.post'];
    const messages = analysisUtils.extractContent($, companyProfile, selectors, 5);

    // Add date extraction
    return messages.map(msg => ({
        ...msg,
        date: $(msg.html).find('.datetime, .date').text().trim()
    }));
}

module.exports = {
    scanTelegramChannels
};
