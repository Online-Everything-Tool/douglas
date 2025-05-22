"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// check-tool.ts
const puppeteer_1 = __importDefault(require("puppeteer"));
const promises_1 = __importDefault(require("fs/promises"));
const url_1 = require("url"); // Node.js URL module
function parseCliArgs() {
    const args = process.argv.slice(2);
    // targetUrl (1) + --outputSummaryFile (1) + path (1) + --screenshotPath (1) + path (1) = 5 minimum arguments
    if (args.length < 5) { // Corrected minimum argument count
        console.error('Usage: node dist/check-tool.js <targetUrl> --outputSummaryFile <path> --screenshotPath <path> [--allowedOrigins <origins>]');
        // (If using ts-node: ts-node check-tool.ts <targetUrl> ...)
        process.exit(2);
    }
    const options = { targetUrl: args[0] };
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--outputSummaryFile' && args[i + 1]) {
            options.outputSummaryFile = args[++i];
        }
        else if (args[i] === '--screenshotPath' && args[i + 1]) {
            options.screenshotPath = args[++i];
        }
        else if (args[i] === '--allowedOrigins' && args[i + 1]) {
            options.allowedOrigins = args[++i].split(',');
        }
    }
    if (!options.targetUrl || !options.outputSummaryFile || !options.screenshotPath) {
        console.error('Missing required arguments: targetUrl, outputSummaryFile, or screenshotPath.');
        console.error('Parsed options:', JSON.stringify(options)); // Debugging line
        process.exit(2);
    }
    if (!options.screenshotPath.endsWith('.png') && !options.screenshotPath.endsWith('.jpeg') && !options.screenshotPath.endsWith('.webp')) {
        console.error(`Error: screenshotPath "${options.screenshotPath}" must end with .png, .jpeg, or .webp for Puppeteer.`);
        process.exit(2);
    }
    return options;
}
async function runCheck() {
    const { targetUrl, outputSummaryFile, screenshotPath, // This is 'string' from CliOptions, will be asserted below
    allowedOrigins: cliAllowedOrigins = [], } = parseCliArgs();
    const targetOrigin = new url_1.URL(targetUrl).origin;
    const allowedOriginsSet = new Set([targetOrigin, ...cliAllowedOrigins]);
    const violations = [];
    let browser;
    console.log(`[Douglas] Starting check for: ${targetUrl}`);
    console.log(`[Douglas] Allowed Origins: ${Array.from(allowedOriginsSet).join(', ')}`);
    try {
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const reqUrl = request.url();
            try {
                // Skip data URLs for origin check as they don't have a traditional origin
                if (reqUrl.startsWith('data:')) {
                    request.continue().catch(err => console.warn(`[Douglas] Error continuing data: URL request: ${err.message}`));
                    return;
                }
                const reqOrigin = new url_1.URL(reqUrl).origin;
                if (allowedOriginsSet.has(reqOrigin)) {
                    request.continue().catch(err => console.warn(`[Douglas] Error continuing request to ${reqUrl}: ${err.message}`));
                }
                else {
                    violations.push(reqUrl);
                    console.log(`[Douglas] VIOLATION: External call to ${reqUrl} (Origin: ${reqOrigin})`);
                    request.abort('aborted').catch(err => console.warn(`[Douglas] Error aborting request to ${reqUrl}: ${err.message}`));
                }
            }
            catch (e) {
                console.warn(`[Douglas] Could not parse request URL origin or other error for: ${reqUrl}. Allowing. Error: ${e.message}`);
                request.continue().catch(err => console.warn(`[Douglas] Error continuing unparsable request to ${reqUrl}: ${err.message}`));
            }
        });
        console.log(`[Douglas] Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 45000 });
        console.log(`[Douglas] Page loaded (networkidle0).`);
        console.log(`[Douglas] Taking screenshot: ${screenshotPath}`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[Douglas] Screenshot saved.`);
    }
    catch (error) {
        const err = error;
        console.error('[Douglas] Puppeteer execution error:', err.message);
        violations.push(`Puppeteer execution error: ${err.message}`);
        if (browser && screenshotPath) {
            try {
                const pages = await browser.pages();
                if (pages[0]) {
                    console.log(`[Douglas] Attempting error screenshot: ${screenshotPath}`);
                    await pages[0].screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`[Douglas] Error screenshot saved.`);
                }
            }
            catch (ssError) {
                console.error("[Douglas] Failed to take error screenshot:", ssError.message);
            }
        }
    }
    finally {
        if (browser) {
            console.log('[Douglas] Closing browser.');
            await browser.close();
        }
    }
    let summary = '## 🌲 Douglas - Ethos Guardian Report 🕵️‍♂️\n\n';
    let screenshotTaken = false;
    try {
        await promises_1.default.access(screenshotPath);
        screenshotTaken = true;
    }
    catch {
        console.warn(`[Douglas] Screenshot file not found at: ${screenshotPath}`);
    }
    if (violations.length > 0) {
        summary += '❌ **Unauthorized external network calls DETECTED!**\n';
        violations.forEach(v => { summary += `  - \`${v}\`\n`; });
        if (screenshotTaken) {
            summary += `\n A screenshot showing the page state when issues were detected (or at error) has been captured.`;
        }
        else {
            summary += `\n Screenshot was not captured.`;
        }
        await promises_1.default.writeFile(outputSummaryFile, summary);
        console.log(`[Douglas] Check FAILED. Summary written to ${outputSummaryFile}.`);
        process.exit(1);
    }
    else {
        summary += '✅ No unauthorized external calls detected. The client-side ethos is strong with this one! ✨\n';
        if (screenshotTaken) {
            summary += `\n A screenshot of the tool page has been captured.`;
        }
        else {
            summary += `\n Screenshot was not captured, but no violations were found.`;
        }
        await promises_1.default.writeFile(outputSummaryFile, summary);
        console.log(`[Douglas] Check PASSED. Summary written to ${outputSummaryFile}.`);
        process.exit(0);
    }
}
runCheck().catch(err => {
    console.error("[Douglas] Unhandled error in runCheck:", err.message);
    process.exit(3);
});
