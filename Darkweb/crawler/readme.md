# Dark Web Intelligence Scanner - Refactored & Optimized

Comprehensive dark web monitoring platform with **zero redundant crawling** and **efficient resource usage**.

## 🚀 Quick Start

```bash
# 1. Generate sources configuration
node crawler/utils/sourceManager.js

# 2. Run full scan (searches once, analyzes efficiently)
node crawler/monitor.js

# 3. Check results
cat reports/darkweb_scan_*.json
```

## ✨ Key Improvements

### 1. **No Redundant Crawling**
- ✅ Searches 20 engines **once**
- ✅ Passes results to all features
- ✅ Only crawls high-similarity sites (>70%)
- ✅ Deduplicates URLs **before** crawling

### 2. **Common HTTP Fetcher**
- ✅ Single fetch function for all modules
- ✅ User agent rotation (12 agents)
- ✅ Automatic proxy for .onion sites
- ✅ Retry logic with exponential backoff

### 3. **Hardcoded Top 20 Engines**
- ✅ No JSON dependency
- ✅ Best engines only (Ahmia, Haystak, Torch, etc.)
- ✅ Configurable engine selection
- ✅ Tracks which engine found each result

## 📊 Architecture

```
1. Multi-Engine Search (once)
   ↓
2. Deduplicate URLs (Set-based)
   ↓
3. Pass to Features:
   ├─ Brand Monitoring (analyzes results, crawls high-similarity only)
   ├─ Ransomware Monitoring (separate crawl - different sources)
   ├─ Telegram Monitoring (separate crawl)
   ├─ Twitter Monitoring (separate crawl)
   └─ Forum Monitoring (separate crawl)
```

## 🔍 Available Search Engines (Top 20)

1. **ahmia** - Most popular dark web search
2. **darksearchio** - Clearnet dark web search
3. **onionland** - Comprehensive onion search
4. **darksearchengine** - Alternative dark search
5. **phobos** - Fast onion indexer
6. **onionsearchserver** - Dedicated onion search
7. **torgle** - Submarine search engine
8. **tor66** - Classic onion search
9. **haystak** - Largest onion index
10. **torch** - Oldest and biggest (included for historical data)
11. **ahmia_clearnet** - Ahmia clearnet mirror
12. **bobby** - Modern onion search
13. **sentor** - Secure onion search
14. **gdark** - Dark web search
15. **kraken** - Deep web search
16. **deepsearch** - Advanced search
17. **demon** - Demon search engine
18. **visitor** - VisiTOR search
19. **venus** - Venus search engine
20. **danex** - DANEX search

## 📋 Usage

### Basic Scan
```bash
# All features, all 20 engines
node crawler/monitor.js
```

### Specific Engines
```bash
# Use only specific engines
node crawler/monitor.js --engines ahmia,haystak,torch
```

### Specific Features
```bash
# Brand monitoring only
node crawler/monitor.js --feature brandMonitoring

# Ransomware monitoring only
node crawler/monitor.js --feature ransomwareMonitoring
```

### Custom Profile
```bash
node crawler/monitor.js --profile config/mycompany.json
```

## 📁 Output Structure

```json
{
  "companyName": "facebook",
  "scanDate": "2025-12-04T06:00:00.000Z",
  "searchResults": {
    "total_results": 45,
    "results": [
      {
        "url": "http://example.onion",
        "title": "Example Site",
        "description": "...",
        "source_engine": "ahmia",  // Which engine found it
        "found_at": "2025-12-04T06:00:00.000Z"
      }
    ]
  },
  "features": {
    "brandMonitoring": {
      "totalAnalyzed": 45,
      "totalFindings": 5,
      "findings": [
        {
          "url": "http://example.onion",
          "source_engine": "ahmia",  // Tracked from search
          "was_crawled": true,  // Only if high similarity
          "severity": "critical",
          "indicators": [...]
        }
      ]
    },
    "ransomwareMonitoring": {...}
  },
  "summary": {
    "totalFindings": 10,
    "criticalAlerts": 2,
    "highAlerts": 3,
    "mediumAlerts": 3,
    "lowAlerts": 2
  }
}
```

## 🎯 Features

### 1. Brand Monitoring
- Analyzes search results (no re-crawling)
- Domain similarity detection
- HTML structure comparison
- Only crawls sites with >70% similarity
- Tracks source engine for each finding

### 2. Ransomware Monitoring
- Checks 352 gang leak sites
- Company name/domain matching
- Victim list extraction
- Separate crawl (different sources)

### 3. Telegram Monitoring
- Monitors 341 threat actor channels
- Message extraction
- Brand mention detection

### 4. Twitter Monitoring
- Tracks 34 threat actor accounts
- Tweet extraction
- Keyword matching

### 5. Forum Monitoring
- Crawls 199 dark web forums
- Thread/post extraction
- Discussion tracking

## 🔧 Modules

### Core
- `crawler/utils/httpFetcher.js` - Common HTTP fetcher with user agent rotation
- `crawler/search/multiEngineSearch.js` - Top 20 engines, deduplication before crawl
- `crawler/utils/dataExtractor.js` - Comprehensive data extraction
- `crawler/monitor.js` - Main orchestrator (search once, pass results)

### Features
- `crawler/features/brandImpersonation.js` - Analyzes search results
- `crawler/features/ransomwareMonitor.js` - Separate ransomware crawl

### Integrations
- `crawler/integrations/telegramScraper.js` - Telegram monitoring
- `crawler/integrations/twitterMonitor.js` - Twitter monitoring
- `crawler/integrations/forumCrawler.js` - Forum monitoring

### Utilities
- `crawler/utils/domainSimilarity.js` - Domain typosquatting detection
- `crawler/utils/htmlSimilarity.js` - HTML structure comparison
- `crawler/utils/sourceManager.js` - Source configuration generator

## 🚦 Efficiency Features

### Deduplication
- URLs deduplicated **before** crawling (Set-based)
- No duplicate crawls across features
- Search results shared between features

### Smart Crawling
- Only crawls high-similarity sites (>70%)
- Low-similarity sites analyzed from metadata only
- Tracks `was_crawled` flag in results

### Rate Limiting
- 2s delay between ransomware sites
- 1.5s delay between Telegram channels
- 2s delay between Twitter/Forum checks

### Resource Usage
- Common HTTP fetcher (no duplicate code)
- User agent rotation (12 agents)
- Automatic retry with exponential backoff
- Concurrent request limiting

## 📦 Integration

### BullMQ
```javascript
const { runFullScan } = require('./crawler/monitor');

async function processJob(job) {
  const results = await runFullScan(
    job.data.companyProfile,
    { searchEngines: job.data.engines || null }
  );
  return results;
}
```

### S3 Upload
```javascript
const results = await runFullScan(companyProfile);
await s3.putObject({
  Bucket: 'darkweb-scans',
  Key: `${results.companyName}/${results.scanDate}.json`,
  Body: JSON.stringify(results)
}).promise();
```

## 🧪 Testing

```bash
# Component tests
./test.sh

# List available engines
node -e "const s = require('./crawler/search/multiEngineSearch'); s.getAvailableEngines().forEach(e => console.log(e.name));"

# Test search
node crawler/search/multiEngineSearch.js "test query"
```

## 📚 Configuration

### Company Profile (`config/company_profile.json`)
```json
{
  "companyName": "YourCompany",
  "domains": ["yourcompany.com"],
  "keywords": ["YourCompany", "YourBrand"],
  "realLoginUrl": "https://yourcompany.com/login"
}
```

## 🎯 Benefits

| Feature | Before | After |
|---------|--------|-------|
| Search crawls | Multiple per feature | **Once** |
| Duplicate URLs | Crawled multiple times | **Deduplicated before crawl** |
| HTTP fetcher | Custom in each file | **Common utility** |
| Engine config | JSON dependency | **Hardcoded top 20** |
| Similarity crawls | All sites | **Only >70% similarity** |
| Source tracking | Not tracked | **Tracked per result** |

## ✅ System Status

- ✅ 20 top search engines hardcoded
- ✅ Common HTTP fetcher with user agent rotation
- ✅ Zero redundant crawling
- ✅ Deduplication before crawl
- ✅ Smart similarity-based crawling
- ✅ Source engine tracking
- ✅ Telegram/Twitter/Forum scrapers
- ✅ JSON-only output (S3-ready)

**System is production-ready and optimized!** 🚀
