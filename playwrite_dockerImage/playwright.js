const { chromium } = require('playwright');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const SESSION_ID = process.env.SESSION_ID || 'default';
const TARGET_URL = process.env.TARGET_URL || 'https://www.google.com';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_KEY = process.env.S3_KEY || `logs/${SESSION_ID}.json`;
const S3_ENDPOINT = process.env.S3_ENDPOINT;

// Configure S3 client (works with MinIO too)
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (S3_ENDPOINT) {
  s3Config.endpoint = S3_ENDPOINT;
  s3Config.forcePathStyle = true; // Required for MinIO
}

const s3 = new S3Client(s3Config);

(async () => {
  try {
    console.log(`[${SESSION_ID}] ========================================`);
    console.log(`[${SESSION_ID}] Playwright Interceptor Starting`);
    console.log(`[${SESSION_ID}] ========================================`);
    console.log(`[${SESSION_ID}] Session ID: ${SESSION_ID}`);
    console.log(`[${SESSION_ID}] Target URL: ${TARGET_URL}`);
    console.log(`[${SESSION_ID}] S3 Bucket: ${S3_BUCKET || 'Not configured'}`);
    console.log(`[${SESSION_ID}] ========================================`);

    // Connect to remote Chromium
    console.log(`[${SESSION_ID}] Connecting to Chromium...`);
    const browser = await chromium.connectOverCDP('http://localhost:9222');

    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.error(`[${SESSION_ID}] No browser contexts found`);
      return;
    }

    const context = contexts[0];
    const pages = await context.pages();
    const page = pages[0] || await context.newPage();

    console.log(`[${SESSION_ID}] Connected to browser successfully`);

    const logs = [];
    let requestCount = 0;
    let responseCount = 0;

    // Capture requests
    page.on('request', req => {
      const log = {
        type: 'request',
        timestamp: Date.now(),
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData()
      };
      logs.push(log);
      requestCount++;

      // Log only non-static resources for cleaner output
      if (!req.url().match(/\.(png|jpg|jpeg|gif|css|woff|woff2)$/i)) {
        console.log(`[${SESSION_ID}] REQ #${requestCount}: ${req.method()} ${req.url()}`);
      }
    });

    // Capture responses
    page.on('response', async resp => {
      const contentType = resp.headers()['content-type'] || '';
      let body;

      try {
        if (contentType.includes('application/json')) {
          body = await resp.json();
        } else if (contentType.includes('text/')) {
          const text = await resp.text();
          // Truncate large text responses
          body = text.length > 10000 ? text.substring(0, 10000) + '...[truncated]' : text;
        }
      } catch (e) {
        body = 'UNREADABLE';
      }

      const log = {
        type: 'response',
        timestamp: Date.now(),
        url: resp.url(),
        status: resp.status(),
        headers: resp.headers(),
        body
      };
      logs.push(log);
      responseCount++;

      // Log only important responses
      if (!resp.url().match(/\.(png|jpg|jpeg|gif|css|woff|woff2)$/i)) {
        console.log(`[${SESSION_ID}] RES #${responseCount}: ${resp.status()} ${resp.url()}`);
      }
    });

    // Save logs to S3 every 30 seconds
    const uploadInterval = setInterval(async () => {
      if (logs.length > 0 && S3_BUCKET) {
        try {
          const logsJson = JSON.stringify(logs, null, 2);

          await s3.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY,
            Body: logsJson,
            ContentType: 'application/json',
            Metadata: {
              sessionId: SESSION_ID,
              requestCount: requestCount.toString(),
              responseCount: responseCount.toString()
            }
          }));

          console.log(`[${SESSION_ID}] ✓ Uploaded ${logs.length} logs to S3 (${S3_KEY})`);
        } catch (e) {
          console.error(`[${SESSION_ID}] ✗ S3 upload error:`, e.message);
        }
      } else if (logs.length > 0) {
        // Fallback: save to local file if S3 not configured
        const localFile = `/tmp/logs-${SESSION_ID}.json`;
        fs.writeFileSync(localFile, JSON.stringify(logs, null, 2));
        console.log(`[${SESSION_ID}] ✓ Saved ${logs.length} logs locally (${localFile})`);
      }
    }, 30000);

    // Final upload on exit
    process.on('SIGTERM', async () => {
      console.log(`[${SESSION_ID}] Received SIGTERM, performing final upload...`);
      clearInterval(uploadInterval);

      if (logs.length > 0 && S3_BUCKET) {
        try {
          await s3.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY,
            Body: JSON.stringify(logs, null, 2),
            ContentType: 'application/json'
          }));
          console.log(`[${SESSION_ID}] ✓ Final upload complete`);
        } catch (e) {
          console.error(`[${SESSION_ID}] ✗ Final upload failed:`, e.message);
        }
      }

      process.exit(0);
    });

    console.log(`[${SESSION_ID}] ========================================`);
    console.log(`[${SESSION_ID}] Interceptor active. Recording traffic...`);
    console.log(`[${SESSION_ID}] ========================================`);

  } catch (err) {
    console.error(`[${SESSION_ID}] Error:`, err);
    process.exit(1);
  }
})();

