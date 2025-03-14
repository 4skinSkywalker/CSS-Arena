const { Cluster } = require("puppeteer-cluster");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(window);

let cluster;

(async function () {
    cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_BROWSER,
        maxConcurrency: 4,
        puppeteerOptions: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        }
    });

    cluster.on("taskerror", (err, data) => {
        console.log(`Error crawling ${data}: ${err.message}`);
    });

    await cluster.task(async ({ page, data: html }) => {
        await page.setViewport({ width: 400, height: 300 });
        await page.setContent(html);

        await page.evaluate(() => {
            document.body.style.margin = "0";
            document.body.style.width = "400px";
            document.body.style.height = "300px";
            document.body.style.overflow = "hidden";
        });

        const imageBuffer = await page.screenshot({
            clip: { x: 0, y: 0, width: 400, height: 300 },
            type: "png",
        });
        return imageBuffer;
    });
})();

async function getImageFromHtml(html) {
    if (!html || typeof html !== "string" || html.length > 5000) {
        console.log(html);
        throw new Error("Bad html!");
    }

    try {
        html = DOMPurify.sanitize(html);
        const imageBuffer = await cluster.execute(html);
        return Buffer.from(imageBuffer).toString("base64");
    } catch (error) {
        console.error("Error generating screenshot:", error);
    }
};

module.exports = {
    getImageFromHtml
};