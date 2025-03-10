const { getImageFromHtml } = require("./puppeteer-utils");

const clients = {};

const availableTopic = new Set([
    "handshake",
    "lastEditorContent",
    "progress",
    "chat"
]);

function parseMessage(message) {
    return JSON.parse(Buffer.from(message).toString("utf-8"));
}

function handleMessage(message) {
    try {
        const parsed = parseMessage(message);

        if (
            !parsed.topic ||
            typeof parsed.topic !== "string" ||
            !availableTopic.has(parsed.topic)
        ) {
            throw new Error("Missing or invalid topic");
        }

        if (
            !parsed.message ||
            typeof parsed.message !== "string" ||
            parsed.message.length > 5000
        ) {
            throw new Error("Missing or invalid message");
        }

        if (parsed.topic === "lastEditorContent") {
            getImageFromHtml(parsed.message).then(b64 => {
                clients[parsed.from].send(JSON.stringify({
                    from: parsed.from,
                    topic: "imageForDiff",
                    message: b64
                }));
            });
        }

        const to = parsed.from.split("").reverse().join("");
        if (!clients[to]) {
            throw new Error(`Cannot send message to ${to}`);
        }

        clients[to].send(JSON.stringify({
            from: parsed.from,
            topic: parsed.topic,
            message: parsed.message
        }));
    } catch (e) {
        console.error(e);
    }
}

function handleConnection(ws, message) {
    try {
        const parsed = parseMessage(message);

        if (
            !parsed.from ||
            typeof parsed.from !== "string" ||
            parsed.from.length > 14
        ) {
            throw new Error("Missing or invalid from field");
        }

        if (
            clients[parsed.from] &&
            clients[parsed.from].readyState === WebSocket.OPEN
        ) {
            console.log(`Client ${parsed.from} already connected`);
            return;
        }

        clients[parsed.from] = ws;
        ws.clientId = parsed.from;

        handleMessage(message, parsed.from);

        ws.on("message", message => handleMessage(message, parsed.from));

        ws.on("close", () => {
            console.log(`Connection of ${parsed.from} closed`);
            delete clients[ws.clientId];
        });
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    handleConnection
};