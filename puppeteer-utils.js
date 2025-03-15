const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(window);

const verbose = false;
const concurrentBrowsers = 4;
const maxQueueSize = 25;
const showBrowsers = true;
let browserIdx = 0;
const browsers = [];

function log(...args) {
    if (verbose) {
        console.log(...args);
    }
}

async function genBrowser() {
    const browser = await puppeteer.launch({
        headless: showBrowsers,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 450, height: 350 });

    if (showBrowsers) {
        const session = await page.target().createCDPSession();
        await session.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    }

    browser._busy = false;
    browser._page = page;
    browser._queue = new Map();

    return browser;
}

function snapshot(browser, html) {
    return new Promise(async res => {
        log("Locking browser");
        browser._busy = true;

        log("Snapshotting...");
        await browser._page.setContent(DOMPurify.sanitize(html));
        await browser._page.evaluate(() => {
            document.body.style.margin = "0";
            document.body.style.width = "400px";
            document.body.style.height = "300px";
            document.body.style.overflow = "hidden";
        });
        const imageBuffer = await browser._page.screenshot({
            clip: { x: 0, y: 0, width: 400, height: 300 },
            type: "png",
        });
        log("Snapshotted successfully");
        res(Buffer.from(imageBuffer).toString("base64"));

        log("Unlocking browser");
        browser._busy = false;

        log("Queue size", browser._queue.size);

        const nextTask = browser._queue.entries().next();
        if (nextTask.value) {
            log("Next task found, starting snapshot");
            const [clientId, { html, res }] = nextTask.value;
            browser._queue.delete(clientId);
            res(await snapshot(browser, html));
        }
    });
}

function getBrowser() {
    if (browserIdx >= browsers.length) {
        browserIdx = 0;
    }
    const browser = browsers[browserIdx];
    browserIdx++;
    return browser;
}

async function getImageFromHtml(html, clientId) {
    if (!html || typeof html !== "string" || html.length > 5000 || !clientId) {
        throw new Error("Validation error");
    }

    const browser = getBrowser();
    if (!browser) {
        throw new Error("No browser available");
    }

    if (!browser._busy) {
        log("Browser is not busy, starting snapshot");
        return await snapshot(browser, html);
    }

    return new Promise((res, rej) => {
        log("Browser is busy, adding to queue");
        if (browser._queue.size >= maxQueueSize) {
            rej("Queue is full");
            return;
        }
        browser._queue.set(clientId, { html, res });
    });
};

(async function () {
    for (let i = 0; i < concurrentBrowsers; i++) {
        browsers.push(await genBrowser());
    }
})();

module.exports = {
    getImageFromHtml
};