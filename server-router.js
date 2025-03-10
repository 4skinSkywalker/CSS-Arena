const puppeteer = require("puppeteer");
const express = require("express");
const router = express.Router();

let browser;
let page;

router.post("/screenshot", async (req, res) => {
    const html = req.body.html;

    if (!html) {
        return res.status(400).send("Bad Request: Please include HTML code in the request body under the 'html' property.");
    }

    try {
        browser = browser || await puppeteer.launch({ headless: false });
        page = page || await browser.newPage();

        await page.setViewport({ width: 400, height: 300 });

        await page.setContent(html);

        const imageBuffer = await page.screenshot({
            clip: { x: 0, y: 0, width: 400, height: 300 },
            type: "png",
        });

        // await browser.close();

        res.header("Content-Type", "image/png");
        res.send(Buffer.from(imageBuffer));
    } catch (error) {
        console.error("Error generating screenshot:", error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;