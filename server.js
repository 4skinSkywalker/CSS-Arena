const WebSocketServer = require("ws").Server;
const http = require("http");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { handleConnection } = require("./websocket-utils");

process.on("unhandledRejection", (reason, p) =>
    console.error(reason, "Unhandled Rejection at Promise", p)
);
process.on("uncaughtException", err =>
    console.error(err, "Uncaught Exception thrown")
);

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(__dirname + "/"));

const server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

const wss = new WebSocketServer({ server: server });
console.log("websocket server created");

wss.on("connection", ws => handleConnection(ws));
