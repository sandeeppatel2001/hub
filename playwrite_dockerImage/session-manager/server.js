const express = require('express');
const Docker = require('dockerode');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const BASE_NOVNC_PORT = parseInt(process.env.BASE_NOVNC_PORT || '8100');
const BASE_CDP_PORT = parseInt(process.env.BASE_CDP_PORT || '9300');
const BROWSER_IMAGE = process.env.BROWSER_IMAGE || 'browser-interceptor:latest';
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '7200'); // 2 hours

let portCounter = 0;

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Create new session
app.post('/api/session/create', async (req, res) => {
    const { targetUrl, userId } = req.body;

    if (!targetUrl) {
        return res.status(400).json({ error: 'targetUrl is required' });
    }

    const sessionId = uuidv4();
    const novncPort = BASE_NOVNC_PORT + portCounter;
    const cdpPort = BASE_CDP_PORT + portCounter;
    portCounter++;

    console.log(`[${sessionId}] Creating session for user: ${userId || 'anonymous'}`);
    console.log(`[${sessionId}] Target URL: ${targetUrl}`);
    console.log(`[${sessionId}] Ports: noVNC=${novncPort}, CDP=${cdpPort}`);

    try {
        // Create container
        const container = await docker.createContainer({
            Image: BROWSER_IMAGE,
            name: `session-${sessionId}`,
            Env: [
                `SESSION_ID=${sessionId}`,
                `TARGET_URL=${targetUrl}`,
                `S3_BUCKET=${process.env.S3_BUCKET || ''}`,
                `S3_KEY=logs/${sessionId}.json`,
                `S3_ENDPOINT=${process.env.S3_ENDPOINT || ''}`,
                `AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID || ''}`,
                `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY || ''}`
            ],
            HostConfig: {
                PortBindings: {
                    '8080/tcp': [{ HostPort: novncPort.toString() }],
                    '9222/tcp': [{ HostPort: cdpPort.toString() }]
                },
                Memory: 1024 * 1024 * 1024, // 1GB RAM limit
                MemorySwap: 1024 * 1024 * 1024, // No swap
                CpuShares: 512, // CPU priority
                AutoRemove: true, // Auto-delete when stopped
                ShmSize: 512 * 1024 * 1024 // 512MB shared memory for Chromium
            }
        });

        // Start container
        await container.start();
        console.log(`[${sessionId}] Container started: ${container.id}`);
        console.log(`[${sessionId}] Access via: http://localhost:${novncPort} (direct) or http://localhost/session/${sessionId} (nginx)`);

        // Store session info in Redis
        const sessionData = {
            sessionId,
            userId: userId || 'anonymous',
            containerId: container.id,
            containerName: `session-${sessionId}`,
            novncPort,
            cdpPort,
            targetUrl,
            createdAt: Date.now(),
            expiresAt: Date.now() + (SESSION_TIMEOUT * 1000)
        };

        await redis.setex(
            `session:${sessionId}`,
            SESSION_TIMEOUT,
            JSON.stringify(sessionData)
        );

        // Also store port mapping for Nginx
        await redis.setex(
            `port:${sessionId}`,
            SESSION_TIMEOUT,
            novncPort.toString()
        );

        console.log(`[${sessionId}] Session stored in Redis (expires in ${SESSION_TIMEOUT}s)`);

        // Generate unique URL
        const baseUrl = process.env.BASE_URL || 'http://localhost';
        const novncUrl = `${baseUrl}/session/${sessionId}`;

        res.json({
            success: true,
            sessionId,
            novncUrl,
            directUrl: `http://localhost:${novncPort}`, // For testing
            targetUrl,
            expiresIn: SESSION_TIMEOUT,
            expiresAt: new Date(sessionData.expiresAt).toISOString()
        });

    } catch (error) {
        console.error(`[${sessionId}] Error creating session:`, error);
        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
});

// Get session info
app.get('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const sessionData = await redis.get(`session:${sessionId}`);

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        const session = JSON.parse(sessionData);

        // Check if container is still running
        try {
            const container = docker.getContainer(session.containerId);
            const info = await container.inspect();
            session.containerStatus = info.State.Status;
            session.containerRunning = info.State.Running;
        } catch (e) {
            session.containerStatus = 'not_found';
            session.containerRunning = false;
        }

        // Set port header for Nginx auth_request
        res.set('X-Novnc-Port', session.novncPort.toString());
        res.json(session);

    } catch (error) {
        console.error(`[${sessionId}] Error getting session:`, error);
        res.status(500).json({ error: error.message });
    }
});

// List all active sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const keys = await redis.keys('session:*');
        const sessions = [];

        for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
                sessions.push(JSON.parse(data));
            }
        }

        res.json({
            count: sessions.length,
            sessions: sessions.sort((a, b) => b.createdAt - a.createdAt)
        });

    } catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete session
app.delete('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const sessionData = await redis.get(`session:${sessionId}`);

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = JSON.parse(sessionData);
        console.log(`[${sessionId}] Terminating session...`);

        // Stop container
        try {
            const container = docker.getContainer(session.containerId);
            await container.stop({ t: 5 }); // 5 second grace period
            console.log(`[${sessionId}] Container stopped`);
        } catch (e) {
            console.warn(`[${sessionId}] Container already stopped or not found`);
        }

        // Delete from Redis
        await redis.del(`session:${sessionId}`);
        await redis.del(`port:${sessionId}`);

        console.log(`[${sessionId}] Session deleted from Redis`);

        res.json({
            success: true,
            message: 'Session terminated',
            sessionId
        });

    } catch (error) {
        console.error(`[${sessionId}] Error deleting session:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Cleanup expired sessions (runs every 5 minutes)
async function cleanupExpiredSessions() {
    console.log('[CLEANUP] Starting cleanup of expired sessions...');

    try {
        const keys = await redis.keys('session:*');
        let cleaned = 0;

        for (const key of keys) {
            const ttl = await redis.ttl(key);

            // If TTL is negative or very low, clean up
            if (ttl < 60) {
                const sessionData = await redis.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);

                    try {
                        const container = docker.getContainer(session.containerId);
                        await container.stop({ t: 5 });
                        console.log(`[CLEANUP] Stopped container: ${session.containerName}`);
                        cleaned++;
                    } catch (e) {
                        // Container already stopped
                    }

                    await redis.del(key);
                    await redis.del(`port:${session.sessionId}`);
                }
            }
        }

        console.log(`[CLEANUP] Cleaned up ${cleaned} expired sessions`);

    } catch (error) {
        console.error('[CLEANUP] Error during cleanup:', error);
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, cleaning up...');
    await cleanupExpiredSessions();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, cleaning up...');
    await cleanupExpiredSessions();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Session Manager running on port ${PORT}`);
    console.log(`Browser image: ${BROWSER_IMAGE}`);
    console.log(`Session timeout: ${SESSION_TIMEOUT}s`);
    console.log(`Port range: ${BASE_NOVNC_PORT}+ (noVNC), ${BASE_CDP_PORT}+ (CDP)`);
});
