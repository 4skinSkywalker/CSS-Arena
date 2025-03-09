export const peerManager = {
    on,
    init,
    sendMessage,
    statusUpdates: [],
    _peer: null,
    _inConn: null,
    _outConn: null,
    _tryConn: null,
};

const pMan = peerManager;
window.pMan = pMan;

const listeners = {};
function on(evt, cb) {
    if (!["statusUpdate", "connected", "messageReceived"].includes(evt)) {
        console.warn("Unknown event", evt);
        return;
    }
    listeners[evt] = listeners[evt] || [];
    listeners[evt].push(cb);
}
function emit(evt, data) {
    if (!listeners[evt]) {
        console.warn("Unknown event", evt);
        return;
    }
    listeners[evt].forEach(cb => cb(data));
}

function sendStatusUpdate(status) {
    pMan.statusUpdates.push(status);
    emit("statusUpdate", status);
}

function init(myId, opponentId) {
    pMan._peer = new Peer(myId);
    pMan._peer.on("connection", handleInConn);
    createOutConn(opponentId);
}

async function createOutConn(opponentId) {
    sendStatusUpdate(`Creating outgoing connection to ${opponentId}`);

    pMan._tryConn = true;
    const timer = setInterval(() => {
        if (!pMan._tryConn) {
            return clearInterval(timer);
        }

        if (pMan._outConn) {
            pMan._outConn.removeAllListeners();
        }

        sendStatusUpdate(`Pinging ${opponentId}`);
        pMan._outConn = pMan._peer.connect(opponentId);

        pMan._outConn.on("open", () => {
            pMan._tryConn = false;
            sendStatusUpdate(`Established outgoing connection to ${opponentId}`);
            emit("connected");
        });

        pMan._outConn.on("close", async () => {
            sendStatusUpdate(`Disconnected from ${opponentId}`);
            pMan._outConn = null;
            createOutConn(opponentId);
        });
    }, 2000);
}

async function handleInConn(conn) {
    if (pMan._inConn) {
        sendStatusUpdate(`Already connected to ${conn.peer}`);
    }

    pMan._inConn = conn;
    sendStatusUpdate(`Incoming connection with ${conn.peer}`);

    if (!pMan._tryConn && !pMan._outConn) {
        sendStatusUpdate(`No outgoing connection to ${conn.peer}`);
        createOutConn(conn.peer);
    }

    conn.on("open", () => {
        sendStatusUpdate(`Established incoming connection with ${conn.peer}`);
        emit("connected");
    });

    conn.on("data", data => {
        emit("messageReceived", JSON.parse(data));
    });

    conn.on("close", async () => {
        sendStatusUpdate(`Disconnected from ${conn.peer}`);
        pMan._inConn = null;
        createOutConn(conn.peer);
    });
}

function sendMessage(topic, message) {
    if (!pMan._outConn) {
        setTimeout(() => sendMessage(topic, message), 2000);
        return;
    }
    pMan._outConn.send(JSON.stringify({ topic, message }));
}
