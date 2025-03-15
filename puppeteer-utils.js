const { Cluster } = require("puppeteer-cluster");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(window);

const verbose = true;
const maxConcurrency = 4;
const headless = true;
let cluster;

function log(...args) {
    if (verbose) {
        console.log(...args);
    }
}

async function getImageFromHtml(html) {
    if (!html || typeof html !== "string" || html.length > 5000) {
        throw new Error("Validation failed");
    }

    return new Promise((resolve, reject) => {
        cluster.queue({ html: DOMPurify.sanitize(html), resolve, reject });
    });
};

(async function () {
    cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency,
        puppeteerOptions: {
            headless,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        }
    });

    cluster.on("taskerror", (err, data) => {
        log(`Error ${data}: ${err.message}`);
    });

    await cluster.task(async ({ page, data }) => {
        try {
            const { html, resolve, reject } = data;

            log("Setting page vieport and content");
            await page.setViewport({ width: 400, height: 300 });
            await page.setContent(html);

            log("Setting page default styles");
            await page.evaluate(() => {
                document.body.style.margin = "0";
                document.body.style.width = "400px";
                document.body.style.height = "300px";
                document.body.style.overflow = "hidden";
            });

            log("Taking screenshot");
            const imageBuffer = await Promise.race([
                page.screenshot({
                    clip: { x: 0, y: 0, width: 400, height: 300 },
                    type: "png",
                }),
                new Promise((_, reject) => setTimeout(() => reject("Screenshot timeout"), 3000))
            ]);

            log("Image buffer resolved");
            resolve(Buffer.from(imageBuffer).toString("base64"));
        } catch (e) {
            console.error("Error taking screenshot:", e);
            reject(e);
        }
    });
})();

module.exports = {
    getImageFromHtml
};
