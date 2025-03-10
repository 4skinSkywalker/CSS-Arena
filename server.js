const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

const clients = {};

function handleMessage(parsed){
    try {
        if (!parsed.topic || !parsed.message) {
            throw new Error("Invalid message");
        }
        
        const to = parsed.from.split("").reverse().join("");
        if (!clients[to]) {
            throw new Error("Cannot find peer");
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

server.on("connection", ws => {
    ws.once("message", message => {
        console.log("First message received");

        try {
            message = Buffer.from(message).toString("utf-8");
            
            const parsed = JSON.parse(message);
            if (!parsed.from || parsed.from.length > 13) {
                throw new Error("Invalid message");
            }

            if (clients[parsed.from]) {
                clients[parsed.from].close();
            }

            clients[parsed.from] = ws;
            ws.clientId = parsed.from;

            handleMessage(parsed);

            ws.on("message", () => handleMessage(parsed));

            ws.on("close", () => {
                console.log("Connection closed");
                delete clients[ws.clientId];
            });
        } catch(e) {
            console.error(e);
        }
    });
});

console.log(`WebSocket server running on port ${PORT}`);

// const ws = new WebSocket("ws://localhost:3000");

// ws.onopen = () => {
//     console.log("Connected to WebSocket server");
// };

// ws.onmessage = event => {
//     console.log("Message from server:", event.data);
// };

// ws.onclose = () => {
//     console.log("Disconnected from WebSocket server");
// };
