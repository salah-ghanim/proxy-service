import express from 'express';
import fetch from 'node-fetch';
import http from 'http';
import https from 'https';
import url from 'url';
import fs from 'fs/promises';

const app = express();
const API_KEY = process.env.API_KEY || "d53e4e28-8b9e-4c5d-9a8b-5c2e3a3b4a57";
const PORT = process.env.PORT || 3000;

// Logging utility
const logger = {
    info: (message, meta = {}) => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            message,
            ...meta
        }));
    },
    error: (message, error = null, meta = {}) => {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            message,
            error: error?.message || error,
            stack: error?.stack,
            ...meta
        }));
    }
};

let appVersion = 'unknown';
try {
    const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
    appVersion = packageJson.version;
} catch (error) {
    logger.error('Failed to read package.json for version', error);
}

// Middleware for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Error handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
        logger.error('Bad Request: Malformed JSON', err);
        return res.status(400).send({ status: 400, message: 'Malformed JSON in request body' });
    }
    next();
});

// Lightweight Proxy Endpoint
app.use('/proxy', async (req, res) => {
    const { targetURL, getawayAPIKey} = req.query;

    if (getawayAPIKey !== API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }

    if (!targetURL) {
        return res.status(400).json({ error: 'targetUrl parameter is required.' });
    }

    const { method, headers, body } = req;

    // Clean headers
    delete headers['host'];
    delete headers['content-length'];

    try {
        const response = await fetch(targetURL, {
            method,
            headers,
            body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
            redirect: 'follow',
        });

        const data = await response.text(); // Moved up to be available for logging

        // Log non-2xx responses from target URL
        if (response.status < 200 || response.status >= 300) {
            logger.info('Non-2xx response from target URL', {
                targetURL,
                method,
                statusCode: response.status,
                statusText: response.statusText,
                requestHeaders: headers,
                requestBody: req.body, // Added request body
                responseHeaders: Array.from(response.headers.entries()).reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
                responseBody: data, // Added response body
            });
        }

        // Forward response
        res.status(response.status);
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.send(data);
    } catch (error) {
        logger.error('Error in lightweight proxy', error);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});

app.get('/status', (req, res) => {
    logger.info("received request /status");
    res.json({
        status: 'ok',
        uptime: process.uptime(), // Uptime in seconds
        timestamp: new Date().toISOString(),
        version: appVersion
    });
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
