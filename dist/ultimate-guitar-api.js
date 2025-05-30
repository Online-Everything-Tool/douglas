"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// scraper-server.js
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra")); // Import Browser type
const puppeteer_extra_plugin_adblocker_1 = __importDefault(require("puppeteer-extra-plugin-adblocker"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_adblocker_1.default)()).use((0, puppeteer_extra_plugin_stealth_1.default)());
const PORT = 3001;
let pageInstance = null;
function removeLastWordRegex(str) {
    if (!str) {
        return ''; // Handle null, undefined, or empty string
    }
    const trimmedStr = str.trim();
    if (trimmedStr === '') {
        return ''; // Handle whitespace-only strings
    }
    // Matches a space (or multiple spaces) followed by non-space characters at the end.
    // Replaces this match with an empty string.
    // If no such pattern (e.g., single word), no replacement happens.
    return trimmedStr.replace(/\s+\S*$/, '');
}
async function initializePage() {
    if (pageInstance) {
        try {
            console.log('Reusing existing Puppeteer browser instance.');
            return pageInstance;
        }
        catch (e) {
            console.log('Existing Puppeteer browser instance seems disconnected or unresponsive. Closing and launching a new one.', e);
            try {
                await pageInstance.close();
            }
            catch (closeError) {
                console.warn('Error closing disconnected browser instance:', closeError);
            }
            pageInstance = null;
        }
    }
    console.log('Launching Puppeteer browser...');
    const browserInstance = await puppeteer_extra_1.default.launch({
        headless: true,
        defaultViewport: null,
        args: ['--no-sandbox', '--start-maximized'],
    });
    pageInstance = await browserInstance.newPage();
    pageInstance.setDefaultNavigationTimeout(60000);
    console.log('got here');
    await pageInstance.goto('https://tabs.ultimate-guitar.com');
    console.log('Puppeteer browser launched.');
    return pageInstance;
}
async function scrapeUltimateGuitar(page, ugUrl) {
    console.log(`Scraping URL: ${ugUrl}`);
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36');
        console.log(`Navigating to ${ugUrl}...`);
        await page.goto(ugUrl, { waitUntil: 'networkidle2', timeout: 10000 });
        console.log('Navigation complete.');
        const artistSelector = 'main div > span > span > a';
        try {
            await page.waitForSelector(artistSelector, { timeout: 30000 });
        }
        catch (e) {
            console.error(`Timeout or error waiting for selector on ${ugUrl}: ${e}`);
            throw new Error(`Artist selector not found on page: ${ugUrl}`);
        }
        const artistContent = await page.evaluate((selector) => {
            const preElement = document.querySelector(selector);
            if (preElement) {
                return preElement.textContent;
            }
            return null;
        }, artistSelector);
        const songSelector = 'main div > span > h1';
        try {
            await page.waitForSelector(songSelector, { timeout: 30000 });
        }
        catch (e) {
            console.error(`Timeout or error waiting for selector on ${ugUrl}: ${e}`);
            throw new Error(`Artist selector not found on page: ${ugUrl}`);
        }
        const songContent = await page.evaluate((selector) => {
            const preElement = document.querySelector(selector);
            if (preElement) {
                return preElement.textContent;
            }
            return null;
        }, songSelector);
        const contentSelector = 'section > code > pre';
        console.log(`Waiting for selector: ${contentSelector}`);
        try {
            await page.waitForSelector(contentSelector, { timeout: 30000 });
        }
        catch (e) {
            console.error(`Timeout or error waiting for selector on ${ugUrl}: ${e}`);
            throw new Error(`Content selector not found on page: ${ugUrl}`);
        }
        const textContent = await page.evaluate((selector) => {
            const preElement = document.querySelector(selector);
            if (preElement) {
                return preElement.textContent;
            }
            return null;
        }, contentSelector);
        if (textContent === null) {
            console.log(`Content not found with selector ${contentSelector} on ${ugUrl}`);
            throw new Error('Could not extract song content.');
        }
        return { artistContent, textContent, songContent: removeLastWordRegex(songContent || '') };
    }
    catch (error) {
        console.error(`Error scraping ${ugUrl}:`, error);
        throw error;
    }
}
// Create the HTTP server
const server = http_1.default.createServer(async (req, res) => {
    const currentReqUrl = req.url || ''; // Provide a fallback for undefined
    const reqUrl = new url_1.URL(currentReqUrl, `http://${req.headers.host}`);
    console.log(`Received request: ${req.method} ${reqUrl.pathname}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.method === 'POST' && reqUrl.pathname === '/scrape') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let requestedUrlForErrorContext;
            try {
                const parsedBody = JSON.parse(body);
                requestedUrlForErrorContext = parsedBody.url; // Get it early for error reporting
                if (!parsedBody.url || typeof parsedBody.url !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request body: "url" string is required.' }));
                    return;
                }
                const ultimateGuitarUrl = parsedBody.url;
                console.log(`Processing POST /scrape for URL: ${ultimateGuitarUrl}`);
                const browser = await initializePage();
                const scrape = await scrapeUltimateGuitar(browser, ultimateGuitarUrl);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    requestedUrl: ultimateGuitarUrl,
                    chords: scrape.textContent,
                    song: scrape.songContent,
                    artist: scrape.artistContent
                }));
            }
            catch (error) {
                const err = error;
                console.error('Error in POST /scrape handler:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Failed to scrape the page.',
                    details: err.message,
                    requestedUrl: requestedUrlForErrorContext
                }));
            }
        });
    }
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found. Use POST /scrape' }));
    }
});
(async () => {
    try {
        await initializePage();
        server.listen(PORT, () => {
            console.log(`Scraper HTTP server running on http://localhost:${PORT}`);
            console.log(`Send POST requests to http://localhost:${PORT}/scrape with JSON body: { "url": "your_ug_url_here" }`);
        });
    }
    catch (error) {
        console.error('Failed to initialize Puppeteer or start server:', error);
        process.exit(1);
    }
})();
async function gracefulShutdown(signal) {
    console.log(`${signal} received. Closing Puppeteer browser...`);
    if (pageInstance) {
        try {
            await pageInstance.close();
            console.log('Puppeteer browser closed.');
        }
        catch (e) {
            console.error('Error closing Puppeteer browser during shutdown:', e);
        }
    }
    process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
