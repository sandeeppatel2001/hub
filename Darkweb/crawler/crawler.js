const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const cheerio = require('cheerio');
const fs = require('fs');
const readline = require('readline');

const { scanContent } = require('./scanner');

// Tor SOCKS5 proxy (default port 9050)
const torProxy = 'socks5h://127.0.0.1:9050';
const agent = new SocksProxyAgent(torProxy);

const axiosInstance = axios.create({
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 30000, // 30 seconds timeout
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0'
    }
});

async function fetchOnion(url, customKeywords = []) {
    console.log(`[*] Fetching ${url}...`);

    try {
        const response = await axiosInstance.get(url);
        console.log(`[+] Status: ${response.status}`);

        const $ = cheerio.load(response.data);
        const title = $('title').text().trim();

        // Run the Scanner
        const intelligence = scanContent(response.data, customKeywords);

        // Log Findings
        if (intelligence.crypto.btc.length > 0) console.log(`[!] Found BTC: ${intelligence.crypto.btc.length}`);
        if (intelligence.pii.emails.length > 0) console.log(`[!] Found Emails: ${intelligence.pii.emails.length}`);
        if (intelligence.keywords.length > 0) console.log(`[!] ALERT: Found Keywords: ${intelligence.keywords.join(', ')}`);

        return {
            url: url,
            timestamp: new Date().toISOString(),
            status: response.status,
            title: title,
            intelligence: intelligence
        };

    } catch (error) {
        console.error(`[-] Error fetching ${url}: ${error.message}`);
        return {
            url: url,
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message
        };
    }
}

async function processFile(filePath, customKeywords = []) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const results = [];
    console.log(`[*] Starting bulk scan from ${filePath}...`);

    for await (const line of rl) {
        const url = line.trim();
        if (!url || url.startsWith('#')) continue;

        const result = await fetchOnion(url, customKeywords);
        results.push(result);

        // Append to results.json immediately
        fs.appendFileSync('results.json', JSON.stringify(result) + '\n');
    }

    console.log(`[*] Scan complete. Results saved to results.json`);
}

// Main execution
if (require.main === module) {
    const input = process.argv[2];

    if (!input) {
        console.log("Usage: node crawler/crawler.js <url_or_file>");
        process.exit(1);
    }

    if (fs.existsSync(input)) {
        // Input is a file
        processFile(input);
    } else {
        // Input is a URL
        fetchOnion(input).then(result => {
            console.log(JSON.stringify(result, null, 2));
        });
    }
}

module.exports = { fetchOnion };
