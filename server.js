const WebSocketServer = require("ws").Server;
const http = require("http");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const router = require("./server-router");
const { handleConnection } = require("./server-ws-utils");

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(__dirname + "/"));
// app.use("/api", router);

const server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

const wss = new WebSocketServer({server: server});
console.log("websocket server created");

wss.on("connection", ws => {
    ws.once("message", handleConnection);
});
