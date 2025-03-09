import { delay } from "/util.js";

export const peerManager = {
    on,
    init,
    sendMessage,
    _hostId: null,
    _guestId: null,
    _conn: null,
    _peer: null,
    _tryToConnect: false,
};

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

function init(hostId, guestId) {
    peerManager._hostId = hostId;
    peerManager._guestId = guestId;
    peerManager._peer = new Peer(peerManager._hostId);
    peerManager._peer.on("connection", handleConnection);
    connect();
}

async function connect() {
    emit("statusUpdate", "Connecting...");

    peerManager._tryToConnect = true;
    const timer = setInterval(() => {
        if (!peerManager._tryToConnect) {
            return clearInterval(timer);
        }

        if (peerManager._conn) {
            peerManager._conn.removeAllListeners();
        }

        emit("statusUpdate", "Looking for the other participant...");
        peerManager._conn = peerManager._peer.connect(peerManager._guestId);

        peerManager._conn.on("open", () => {
            emit("statusUpdate", "Connection to the other participant established!");
            handleConnection(peerManager._conn);
            peerManager._tryToConnect = false;
        });
    }, 2000);
}

function handleConnection(conn) {
    conn.on("data", function (data) {
        const { topic, message } = JSON.parse(data);
        emit("messageReceived", { topic, message });
    });

    conn.on("close", async () => {
        emit("statusUpdate", "Disconnected.");
        await delay(2);
        connect();
    });

    emit("connected");
}

function sendMessage(topic, message) {
    if (peerManager._conn) {
        peerManager._conn.send(JSON.stringify({ topic, message }));
    }
}
