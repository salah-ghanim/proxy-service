import express from 'express';
import fetch from 'node-fetch';
import http from 'http';
import https from 'https';
import url from 'url';
import { Readable } from 'stream';

const app = express();
const API_KEY = process.env.API_KEY || "d53e4e28-8b9e-4c5d-9a8b-5c2e3a3b4a57";
const PORT = process.env.PORT || 3000;

// Logging utility
const logger = {
    info: (message, meta = {}) => {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message, ...meta }));
    },
    error: (message, error = null, meta = {}) => {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message, error: error?.message || error, ...meta }));
    }
};

// Middleware for JSON and URL-encoded data
app.use(express.urlencoded({extended: true}));

// Status endpoint
app.get('/status', (req, res) => {
    logger.info("received request /status");
    res.json({
        status: 'ok',
        uptime: process.uptime(), // Uptime in seconds
        timestamp: new Date().toISOString()
    });
});

// Lightweight Proxy Endpoint
app.use('/proxy', async (req, res) => {
    logger.info("received request /proxy");
    const { targetURL, getawayAPIKey } = req.query;

    if (getawayAPIKey !== API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }

    if (!targetURL) {
        return res.status(400).json({ error: 'targetUrl parameter is required.' });
    }

    const { method, headers } = req;

    // Clean headers
    delete headers['host'];
    delete headers['content-length']; // Let fetch calculate the new length

    try {
        // Stream the request body directly.
        // This fixes issues where express.json() corrupted the payload.
        const fetchOptions = {
            method,
            headers,
            redirect: 'follow',
        };

        if (method !== 'GET' && method !== 'HEAD') {
            // Pass the incoming request stream directly to node-fetch
            fetchOptions.body = req;
        }

        const response = await fetch(targetURL, fetchOptions);

        // --- DEBUGGING THE JAVA ERROR ---
        // Check if the upstream returned JSON. If not, log it.
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // Clone the response so we can read text without consuming the stream for the client
            const textBody = await response.clone().text();
            logger.error(`Upstream returned NON-JSON response (Likely cause of Java Error)`, {
                status: response.status,
                contentType: contentType,
                bodyPreview: textBody.substring(0, 200) // Log first 200 chars
            });
        }
        // --------------------------------

        // Forward status
        res.status(response.status);

        // Forward headers
        response.headers.forEach((value, name) => res.setHeader(name, value));

        // Pipe response stream directly to Express response
        // This is more efficient than await response.text()
        Readable.from(response.body).pipe(res);

    } catch (error) {
        logger.error('Error in lightweight proxy', error);
        // Ensure we send a JSON error so Java GSON handles it gracefully
        if (!res.headersSent) {
            res.status(500).json({ error: `Internal Server Error: ${error.message}` });
        }
    }
});


// Streaming Proxy Endpoint for Files
app.use('/files', (req, res) => {
    logger.info("received request /files");
    const {targetURL, getawayAPIKey} = req.query;

    if (getawayAPIKey !== API_KEY) {
        return res.status(403).json({error: 'Forbidden: Invalid API Key'});
    }

    if (!targetURL) {
        return res.status(400).json({error: 'targetUrl parameter is required.'});
    }

    const {headers} = req;


    delete headers['host'];
    delete headers['content-length'];

    try {
        const parsedUrl = url.parse(targetURL);
        const isHttps = parsedUrl.protocol === 'https:';
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.path,
            method: req.method,
            headers: headers,
        };

        delete requestOptions.headers['host'];

        const proxyRequest = (isHttps ? https : http).request(requestOptions, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        req.pipe(proxyRequest);

        proxyRequest.on('error', (error) => {
            logger.error('Error in streaming proxy', error);
            res.status(500).json({error: `Internal Server Error: ${error.message}`});
        });
    } catch (error) {
        logger.error('Error setting up streaming proxy', error);
        res.status(500).json({error: `Internal Server Error: ${error.message}`});
    }
});

app.listen(PORT, () => {
    logger.info('Proxy service started', {
        port: PORT, environment: process.env.NODE_ENV || 'development'
    });
});
