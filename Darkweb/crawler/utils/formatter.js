/**
 * Report Formatter - Convert scan results to standardized format
 * Uses YAML-based rules for different scanner types
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load YAML templates
const templatesPath = path.join(__dirname, '../../config/finding_templates.yaml');
const templates = yaml.load(fs.readFileSync(templatesPath, 'utf8'));

/**
 * Format scan results into standardized format
 * @param {object} scanResults - Raw scan results from monitor.js
 * @returns {array} - Formatted findings array
 */
function formatScanResults(scanResults) {
    const formattedFindings = [];

    // Process each feature
    if (scanResults.features) {
        // Brand Monitoring
        if (scanResults.features.brandMonitoring) {
            const findings = formatBrandMonitoring(
                scanResults.features.brandMonitoring,
                scanResults.companyName,
                scanResults.scanDate
            );
            formattedFindings.push(...findings);
        }

        // Ransomware Monitoring
        if (scanResults.features.ransomwareMonitoring) {
            const findings = formatRansomwareMonitoring(
                scanResults.features.ransomwareMonitoring,
                scanResults.companyName,
                scanResults.scanDate
            );
            formattedFindings.push(...findings);
        }

        // Telegram Monitoring
        if (scanResults.features.telegramMonitoring) {
            const findings = formatTelegramMonitoring(
                scanResults.features.telegramMonitoring,
                scanResults.companyName,
                scanResults.scanDate
            );
            formattedFindings.push(...findings);
        }

        // Twitter Monitoring
        if (scanResults.features.twitterMonitoring) {
            const findings = formatTwitterMonitoring(
                scanResults.features.twitterMonitoring,
                scanResults.companyName,
                scanResults.scanDate
            );
            formattedFindings.push(...findings);
        }

        // Forum Monitoring
        if (scanResults.features.forumMonitoring) {
            const findings = formatForumMonitoring(
                scanResults.features.forumMonitoring,
                scanResults.companyName,
                scanResults.scanDate
            );
            formattedFindings.push(...findings);
        }
    }

    return formattedFindings;
}

/**
 * Format Brand Monitoring findings
 */
function formatBrandMonitoring(data, companyName, scanDate) {
    const findings = [];
    const template = templates.brandMonitoring;

    if (data.findings && data.findings.length > 0) {
        for (const finding of data.findings) {
            // Generate dynamic description from actual data
            const description = generateBrandDescription(finding, companyName);

            const formatted = {
                name: template.name,
                description: description,  // Use actual data
                mitigation: template.mitigation,
                threat: mapSeverityToThreat(finding.severity),  // Use actual severity
                impact: template.impact,
                severity: mapSeverityToNumber(finding.severity),  // Use actual severity
                cvss_score: null,
                cvss: null,
                target: companyName,
                output: {
                    url: finding.url,
                    title: finding.title || 'No title',
                    description: finding.description || '',
                    source_engine: finding.source_engine,
                    domain_similarity: finding.indicators?.find(i => i.type === 'domain_similarity')?.confidence || null,
                    has_login_form: finding.indicators?.some(i => i.type === 'login_form_detected') || false,
                    was_crawled: finding.was_crawled || false,
                    crawl_error: finding.crawl_error || null
                },
                meta: {
                    type: "scanner",
                    source_type: "brand_monitoring",
                    tags: [...template.tags, "onion"],
                    category: "brand_protection"
                },
                scanner: "darkweb",
                meta2: {
                    severity_score: finding.severity_score || 0,
                    indicators_count: finding.indicators?.length || 0,
                    indicators: finding.indicators || [],
                    extracted_data: finding.extracted_data ? {
                        emails_found: finding.extracted_data.emails?.length || 0,
                        credentials_found: finding.extracted_data.credentials?.length || 0,
                        crypto_addresses: Object.values(finding.extracted_data.crypto_addresses || {}).flat().length,
                        keywords_matched: finding.extracted_data.keywords_found?.length || 0
                    } : null
                },
                reported_on: finding.found_at || scanDate
            };

            findings.push(formatted);
        }
    }

    return findings;
}

/**
 * Format Ransomware Monitoring findings
 */
function formatRansomwareMonitoring(data, companyName, scanDate) {
    const findings = [];
    const template = templates.ransomwareMonitoring;

    if (data.findings && data.findings.length > 0) {
        for (const finding of data.findings) {
            // Generate dynamic description from actual data
            const description = generateRansomwareDescription(finding, companyName);

            const formatted = {
                name: template.name,
                description: description,  // Use actual data
                mitigation: template.mitigation,
                threat: "Critical",  // Always critical for ransomware
                impact: template.impact,
                severity: 10,  // Always max severity
                cvss_score: null,
                cvss: null,
                target: companyName,
                output: {
                    ransomware_gang: finding.ransomware_gang,
                    site_url: finding.site_url,
                    match_types: finding.matches?.map(m => m.type) || [],
                    contexts: finding.matches?.flatMap(m => m.contexts || []) || []
                },
                meta: {
                    type: "scanner",
                    source_type: "ransomware_leak_site",
                    tags: [...template.tags, finding.ransomware_gang.toLowerCase().replace(/\s+/g, '_')],
                    category: "ransomware"
                },
                scanner: "darkweb",
                meta2: {
                    gang_name: finding.ransomware_gang,
                    indicators: finding.indicators || [],
                    match_details: finding.matches || [],
                    extracted_content_count: finding.extracted_content?.length || 0
                },
                reported_on: finding.found_at || scanDate
            };

            findings.push(formatted);
        }
    }

    return findings;
}

/**
 * Format Telegram Monitoring findings
 */
function formatTelegramMonitoring(data, companyName, scanDate) {
    const findings = [];
    const template = templates.telegramMonitoring;

    if (data.findings && data.findings.length > 0) {
        for (const finding of data.findings) {
            const description = generateTelegramDescription(finding, companyName);

            const formatted = {
                name: template.name,
                description: description,
                mitigation: template.mitigation,
                threat: mapSeverityToThreat(finding.severity),
                impact: template.impact,
                severity: mapSeverityToNumber(finding.severity),
                cvss_score: null,
                cvss: null,
                target: companyName,
                output: {
                    channel_name: finding.channel_name,
                    channel_url: finding.channel_url,
                    attack_type: finding.attack_type || 'Unknown',
                    match_types: finding.matches?.map(m => m.type) || [],
                    contexts: finding.matches?.flatMap(m => m.contexts || []) || []
                },
                meta: {
                    type: "scanner",
                    source_type: "telegram",
                    tags: [...template.tags, "messaging"],
                    category: "threat_intelligence"
                },
                scanner: "darkweb",
                meta2: {
                    channel_name: finding.channel_name,
                    attack_type: finding.attack_type,
                    indicators: finding.indicators || [],
                    match_details: finding.matches || [],
                    messages_extracted: finding.extracted_content?.length || 0
                },
                reported_on: finding.found_at || scanDate
            };

            findings.push(formatted);
        }
    }

    return findings;
}

/**
 * Format Twitter Monitoring findings
 */
function formatTwitterMonitoring(data, companyName, scanDate) {
    const findings = [];
    const template = templates.twitterMonitoring;

    if (data.findings && data.findings.length > 0) {
        for (const finding of data.findings) {
            const description = generateTelegramDescription(finding, companyName);

            const formatted = {
                name: template.name,
                description: description,
                mitigation: template.mitigation,
                threat: mapSeverityToThreat(finding.severity),
                impact: template.impact,
                severity: mapSeverityToNumber(finding.severity),
                cvss_score: null,
                cvss: null,
                target: companyName,
                output: {
                    account_name: finding.account_name,
                    account_url: finding.account_url,
                    attack_type: finding.attack_type || 'Unknown',
                    match_types: finding.matches?.map(m => m.type) || [],
                    contexts: finding.matches?.flatMap(m => m.contexts || []) || []
                },
                meta: {
                    type: "scanner",
                    source_type: "twitter",
                    tags: [...template.tags, "x", "social_media"],
                    category: "threat_intelligence"
                },
                scanner: "darkweb",
                meta2: {
                    account_name: finding.account_name,
                    attack_type: finding.attack_type,
                    indicators: finding.indicators || [],
                    match_details: finding.matches || [],
                    tweets_extracted: finding.extracted_content?.length || 0
                },
                reported_on: finding.found_at || scanDate
            };

            findings.push(formatted);
        }
    }

    return findings;
}

/**
 * Format Forum Monitoring findings
 */
function formatForumMonitoring(data, companyName, scanDate) {
    const findings = [];
    const template = templates.forumMonitoring;

    if (data.findings && data.findings.length > 0) {
        for (const finding of data.findings) {
            const description = generateTelegramDescription(finding, companyName);

            const formatted = {
                name: template.name,
                description: description,
                mitigation: template.mitigation,
                threat: mapSeverityToThreat(finding.severity),
                impact: template.impact,
                severity: mapSeverityToNumber(finding.severity),
                cvss_score: null,
                cvss: null,
                target: companyName,
                output: {
                    forum_name: finding.forum_name,
                    forum_url: finding.forum_url,
                    forum_description: finding.description || '',
                    match_types: finding.matches?.map(m => m.type) || [],
                    contexts: finding.matches?.flatMap(m => m.contexts || []) || []
                },
                meta: {
                    type: "scanner",
                    source_type: "dark_web_forum",
                    tags: [...template.tags, "community"],
                    category: "threat_intelligence"
                },
                scanner: "darkweb",
                meta2: {
                    forum_name: finding.forum_name,
                    indicators: finding.indicators || [],
                    match_details: finding.matches || [],
                    posts_extracted: finding.extracted_content?.length || 0
                },
                reported_on: finding.found_at || scanDate
            };

            findings.push(formatted);
        }
    }

    return findings;
}

/**
 * Generate dynamic description for brand monitoring findings
 */
function generateBrandDescription(finding, companyName) {
    const parts = [];

    parts.push(`A potential brand impersonation site was discovered on the dark web at ${finding.url}.`);

    if (finding.title) {
        parts.push(`The site title is "${finding.title}".`);
    }

    const domainSim = finding.indicators?.find(i => i.type === 'domain_similarity');
    if (domainSim) {
        parts.push(`Domain similarity to ${companyName}: ${domainSim.confidence}%.`);
    }

    if (finding.indicators?.some(i => i.type === 'login_form_detected')) {
        parts.push(`The site contains a login form, indicating potential credential harvesting.`);
    }

    if (finding.was_crawled && finding.extracted_data) {
        const data = finding.extracted_data;
        if (data.emails?.length > 0) {
            parts.push(`Found ${data.emails.length} email addresses.`);
        }
        if (data.credentials?.length > 0) {
            parts.push(`Found ${data.credentials.length} potential credentials.`);
        }
    } else if (finding.crawl_error) {
        parts.push(`Site could not be crawled: ${finding.crawl_error}`);
    }

    return parts.join(' ');
}

/**
 * Generate dynamic description for ransomware findings
 */
function generateRansomwareDescription(finding, companyName) {
    const parts = [];

    parts.push(`${companyName} was mentioned on the ${finding.ransomware_gang} ransomware leak site.`);

    const matches = finding.matches || [];
    const matchTypes = matches.map(m => m.type);

    if (matchTypes.includes('company_name')) {
        parts.push(`Company name was explicitly mentioned.`);
    }
    if (matchTypes.includes('domain')) {
        parts.push(`Company domain was found.`);
    }
    if (matchTypes.includes('keyword')) {
        const keywordMatches = matches.filter(m => m.type === 'keyword');
        const totalCount = keywordMatches.reduce((sum, m) => sum + (m.count || 0), 0);
        parts.push(`Related keywords appeared ${totalCount} times.`);
    }

    if (matches.length > 0 && matches[0].contexts && matches[0].contexts.length > 0) {
        parts.push(`Context: "${matches[0].contexts[0].substring(0, 100)}..."`);
    }

    return parts.join(' ');
}

/**
 * Generate dynamic description for Telegram findings
 */
function generateTelegramDescription(finding, companyName) {
    const parts = [];

    parts.push(`${companyName} was mentioned in the Telegram channel "${finding.channel_name}".`);

    if (finding.attack_type && finding.attack_type !== 'Unknown') {
        parts.push(`This channel is associated with ${finding.attack_type} attacks.`);
    }

    const matches = finding.matches || [];
    if (matches.length > 0 && matches[0].contexts && matches[0].contexts.length > 0) {
        parts.push(`Context: "${matches[0].contexts[0].substring(0, 100)}..."`);
    }

    return parts.join(' ');
}

/**
 * Generate dynamic description for Twitter findings
 */
function generateTwitterDescription(finding, companyName) {
    const parts = [];

    parts.push(`${companyName} was mentioned by threat actor "${finding.account_name}" on Twitter/X.`);

    if (finding.attack_type && finding.attack_type !== 'Unknown') {
        parts.push(`This account is known for ${finding.attack_type} activities.`);
    }

    const matches = finding.matches || [];
    if (matches.length > 0 && matches[0].contexts && matches[0].contexts.length > 0) {
        parts.push(`Context: "${matches[0].contexts[0].substring(0, 100)}..."`);
    }

    return parts.join(' ');
}

/**
 * Generate dynamic description for forum findings
 */
function generateForumDescription(finding, companyName) {
    const parts = [];

    parts.push(`${companyName} was discussed in the dark web forum "${finding.forum_name}".`);

    if (finding.description) {
        parts.push(`Forum description: ${finding.description}`);
    }

    const matches = finding.matches || [];
    if (matches.length > 0 && matches[0].contexts && matches[0].contexts.length > 0) {
        parts.push(`Context: "${matches[0].contexts[0].substring(0, 100)}..."`);
    }

    return parts.join(' ');
}

/**
 * Map severity string to threat level
 */
function mapSeverityToThreat(severity) {
    const mapping = {
        'critical': 'Critical',
        'high': 'High',
        'medium': 'Medium',
        'low': 'Low'
    };
    return mapping[severity] || 'Medium';
}

/**
 * Map severity string to number (1-10)
 */
function mapSeverityToNumber(severity) {
    const mapping = {
        'critical': 10,
        'high': 8,
        'medium': 5,
        'low': 3
    };
    return mapping[severity] || 5;
}

/**
 * Save formatted results to file
 */
function saveFormattedResults(formattedFindings, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(formattedFindings, null, 2));
    console.log(`[+] Formatted results saved to: ${outputPath}`);
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node crawler/utils/formatter.js <input_file.json> [output_file.json]');
        console.log('\nExample:');
        console.log('  node crawler/utils/formatter.js reports/darkweb_scan_facebook_2025-12-04.json');
        console.log('  node crawler/utils/formatter.js reports/scan.json formatted_report.json');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace('.json', '_formatted.json');

    if (!fs.existsSync(inputFile)) {
        console.error(`[-] Input file not found: ${inputFile}`);
        process.exit(1);
    }

    console.log(`[+] Loading scan results from: ${inputFile}`);
    const scanResults = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    console.log(`[+] Formatting results...`);
    const formattedFindings = formatScanResults(scanResults);

    console.log(`[+] Total findings formatted: ${formattedFindings.length}`);
    saveFormattedResults(formattedFindings, outputFile);
}

module.exports = {
    formatScanResults,
    saveFormattedResults
};
