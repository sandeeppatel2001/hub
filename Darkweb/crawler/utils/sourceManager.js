/**
 * Source Manager - Parse deepdarkCTI and Generate Sources Configuration
 * Extracts ONLINE/VALID sources from deepdarkCTI markdown files
 */

const fs = require('fs');
const path = require('path');

const DEEPDARK_CTI_PATH = path.join(__dirname, '../../deepdarkCTI');

/**
 * Parse markdown table to extract sources
 * @param {string} content - Markdown file content
 * @param {string} type - Source type (search_engines, forums, telegram, etc.)
 * @returns {array} - Array of parsed sources
 */
function parseMarkdownTable(content, type) {
    const sources = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip header and separator lines
        if (line.startsWith('|Name|') || line.startsWith('|---') || line.startsWith('|Telegram|')) {
            continue;
        }

        // Parse table rows
        if (line.startsWith('|') && line.endsWith('|')) {
            const columns = line.split('|').map(col => col.trim()).filter(col => col);

            if (columns.length >= 2) {
                const source = parseSourceRow(columns, type);
                if (source) {
                    sources.push(source);
                }
            }
        }
    }

    return sources;
}

/**
 * Parse individual source row based on type
 * @param {array} columns - Table columns
 * @param {string} type - Source type
 * @returns {object|null} - Parsed source or null
 */
function parseSourceRow(columns, type) {
    let source = null;

    switch (type) {
        case 'search_engines':
            // Format: |[Name](url)|Status|
            source = parseSearchEngine(columns);
            break;

        case 'forums':
            // Format: |[Name](url)|Status|Description|
            source = parseForum(columns);
            break;

        case 'telegram':
            // Format: |Telegram|Status|Threat Actor Name|Type|
            source = parseTelegram(columns);
            break;

        case 'twitter':
            // Format: |Twitter|Threat Actor|Type|Status|
            source = parseTwitter(columns);
            break;

        case 'ransomware':
            // Format: |Name|Status|User:Password|Tox ID|RSS Feed|
            source = parseRansomware(columns);
            break;
    }

    return source;
}

/**
 * Parse search engine row
 */
function parseSearchEngine(columns) {
    const nameAndUrl = columns[0];
    const status = columns[1];

    // Only include ONLINE sources
    if (!status || !status.toUpperCase().includes('ONLINE')) {
        return null;
    }

    // Extract name and URL from markdown link
    const match = nameAndUrl.match(/\[(.+?)\]\((.+?)\)/);
    if (!match) return null;

    return {
        name: match[1],
        url: match[2],
        status: 'ONLINE',
        type: 'search_engine'
    };
}

/**
 * Parse forum row
 */
function parseForum(columns) {
    const nameAndUrl = columns[0];
    const status = columns[1];
    const description = columns[2] || '';

    // Only include ONLINE sources
    if (!status || !status.toUpperCase().includes('ONLINE')) {
        return null;
    }

    const match = nameAndUrl.match(/\[(.+?)\]\((.+?)\)/);
    if (!match) return null;

    return {
        name: match[1],
        url: match[2],
        status: 'ONLINE',
        type: 'forum',
        description: description
    };
}

/**
 * Parse Telegram channel row
 */
function parseTelegram(columns) {
    const url = columns[0];
    const status = columns[1];
    const name = columns[2] || '';
    const attackType = columns[3] || '';

    // Only include ONLINE/VALID sources
    if (!status || !(status.toUpperCase().includes('ONLINE') || status.toUpperCase().includes('VALID'))) {
        return null;
    }

    // Skip expired channels
    if (status.toUpperCase().includes('EXPIRED') || status.toUpperCase().includes('OFFLINE')) {
        return null;
    }

    return {
        name: name || url,
        url: url,
        status: status.toUpperCase(),
        type: 'telegram',
        attack_type: attackType
    };
}

/**
 * Parse Twitter account row
 */
function parseTwitter(columns) {
    const url = columns[0];
    const name = columns[1] || '';
    const attackType = columns[2] || '';
    const status = columns[3] || 'ONLINE';

    // Skip offline accounts
    if (status && status.toUpperCase().includes('OFFLINE')) {
        return null;
    }

    return {
        name: name || url,
        url: url,
        status: 'ONLINE',
        type: 'twitter',
        attack_type: attackType
    };
}

/**
 * Parse ransomware gang row
 */
function parseRansomware(columns) {
    const nameAndUrl = columns[0];
    const status = columns[1];
    const rss = columns[4] || '';

    // Only include ONLINE sources
    if (!status || !status.toUpperCase().includes('ONLINE')) {
        return null;
    }

    const match = nameAndUrl.match(/\[(.+?)\]\((.+?)\)/);
    if (!match) return null;

    return {
        name: match[1],
        url: match[2],
        status: 'ONLINE',
        type: 'ransomware',
        rss_feed: rss
    };
}

/**
 * Parse all deepdarkCTI files and generate sources config
 * @returns {object} - Sources configuration
 */
function generateSourcesConfig() {
    console.log('[+] Parsing deepdarkCTI repository...');

    const config = {
        generated_at: new Date().toISOString(),
        sources: {
            search_engines: [],
            forums: [],
            telegram: [],
            twitter: [],
            ransomware: []
        },
        stats: {
            total_sources: 0,
            by_type: {}
        }
    };

    // Parse search engines
    const searchEnginesPath = path.join(DEEPDARK_CTI_PATH, 'search_engines.md');
    if (fs.existsSync(searchEnginesPath)) {
        const content = fs.readFileSync(searchEnginesPath, 'utf8');
        config.sources.search_engines = parseMarkdownTable(content, 'search_engines');
        console.log(`[+] Found ${config.sources.search_engines.length} ONLINE search engines`);
    }

    // Parse forums
    const forumsPath = path.join(DEEPDARK_CTI_PATH, 'forum.md');
    if (fs.existsSync(forumsPath)) {
        const content = fs.readFileSync(forumsPath, 'utf8');
        config.sources.forums = parseMarkdownTable(content, 'forums');
        console.log(`[+] Found ${config.sources.forums.length} ONLINE forums`);
    }

    // Parse Telegram channels
    const telegramPath = path.join(DEEPDARK_CTI_PATH, 'telegram_threat_actors.md');
    if (fs.existsSync(telegramPath)) {
        const content = fs.readFileSync(telegramPath, 'utf8');
        config.sources.telegram = parseMarkdownTable(content, 'telegram');
        console.log(`[+] Found ${config.sources.telegram.length} ONLINE/VALID Telegram channels`);
    }

    // Parse Twitter accounts
    const twitterPath = path.join(DEEPDARK_CTI_PATH, 'twitter_threat_actors.md');
    if (fs.existsSync(twitterPath)) {
        const content = fs.readFileSync(twitterPath, 'utf8');
        config.sources.twitter = parseMarkdownTable(content, 'twitter');
        console.log(`[+] Found ${config.sources.twitter.length} Twitter accounts`);
    }

    // Parse ransomware gangs
    const ransomwarePath = path.join(DEEPDARK_CTI_PATH, 'ransomware_gang.md');
    if (fs.existsSync(ransomwarePath)) {
        const content = fs.readFileSync(ransomwarePath, 'utf8');
        config.sources.ransomware = parseMarkdownTable(content, 'ransomware');
        console.log(`[+] Found ${config.sources.ransomware.length} ONLINE ransomware sites`);
    }

    // Calculate stats
    config.stats.by_type = {
        search_engines: config.sources.search_engines.length,
        forums: config.sources.forums.length,
        telegram: config.sources.telegram.length,
        twitter: config.sources.twitter.length,
        ransomware: config.sources.ransomware.length
    };
    config.stats.total_sources = Object.values(config.stats.by_type).reduce((a, b) => a + b, 0);

    console.log(`[+] Total sources: ${config.stats.total_sources}`);

    return config;
}

/**
 * Save sources configuration to file
 * @param {object} config - Sources configuration
 * @param {string} outputPath - Output file path
 */
function saveSourcesConfig(config, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
    console.log(`[+] Sources configuration saved to: ${outputPath}`);
}

/**
 * Update sources configuration
 * @param {string} outputPath - Output file path (default: config/sources_config.json)
 */
function updateSources(outputPath = null) {
    const defaultPath = path.join(__dirname, '../../config/sources_config.json');
    const savePath = outputPath || defaultPath;

    const config = generateSourcesConfig();
    saveSourcesConfig(config, savePath);

    return config;
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const outputPath = args[0];

    console.log('='.repeat(60));
    console.log('  DeepDarkCTI Source Manager');
    console.log('='.repeat(60));
    console.log('');

    updateSources(outputPath);

    console.log('');
    console.log('='.repeat(60));
    console.log('  Configuration generated successfully!');
    console.log('='.repeat(60));
}

module.exports = {
    generateSourcesConfig,
    updateSources,
    parseMarkdownTable
};
