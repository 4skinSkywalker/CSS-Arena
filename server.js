const { WebSocketServer } = require("ws");

const port = Number(process.env.PORT || 3000);
const wss = new WebSocketServer({ port });

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

function handleMessage(message){
    try {
        const parsed = parseMessage(message);

        if (
            !parsed.topic ||
            !availableTopic.has(parsed.topic) ||
            !parsed.message ||
            typeof parsed.message !== "string"
        ) {
            throw new Error("Missing or invalid topic or message");
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
    } catch(e) {
        console.error(e);
    }
}

wss.on("connection", ws => {
    ws.once("message", message => {
        try {
            const parsed = parseMessage(message);

            if (
                !parsed.from ||
                typeof parsed.from !== "string" ||
                parsed.from.length > 13
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
        } catch(e) {
            console.error(e);
        }
    });
});

console.log(`WebSocket server running on port ${port}`);
