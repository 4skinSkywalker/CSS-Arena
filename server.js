const WebSocketServer = require("ws").Server;
const http = require("http");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;

const clients = {};

const availableTopic = new Set([
    "handshake",
    "lastEditorContent",
    "progress",
    "chat"
]);

app.use(express.static(__dirname + "/"));

const server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

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

const wss = new WebSocketServer({server: server});
console.log("websocket server created");

wss.on("connection", ws => {
    ws.once("message", message => {
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
        } catch(e) {
            console.error(e);
        }
    });
});
