let lastEditorContent = "";
let peer = null;
let conn = null;
let playerId = null;

function copyToClipboard(text) {
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const scriptElements = doc.getElementsByTagName("script");
    [...scriptElements].forEach((s) => s.remove());
    return doc.documentElement.outerHTML;
}

function writeIntoIframe(id, _content) {
    const content = `<html><head></head><body>${sanitizeHtml(_content)}</body></html>`;
    const iframe = document.getElementById(id);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close()
}

function initializeEditor() {
    const editor = ace.edit("ace-editor");
    editor.getSession().setUseWorker(false);
    editor.setTheme("ace/theme/monokai");
    editor.getSession().setMode("ace/mode/html");
    editor.getSession().on("change", function () {
        lastEditorContent = sanitizeHtml(editor.getSession().getValue());
        writeIntoIframe("output-iframe", lastEditorContent);
        sendEditorContent();
    });
    editor.setValue(`<div></div>
<style>
    div {
        width: 100px;
        height: 100px;
        background: #dd6b4d;
    }
</style>`);
}

function getColorHtml(bg) {
    return `<div class="color">
  <div class="color__circle" style="background: ${bg};"></div>
  <div class="color__code">${bg}</div>
</div>`;
}

function addCopyToClipboard(child) {
    child.addEventListener("click", () => {
        const colorCode = child.querySelector(".color__code");
        const prevText = colorCode.innerText;
        if (prevText === "Copied!") {
            return;
        }
        copyToClipboard(prevText);
        colorCode.innerText = "Copied!"
        setTimeout(() => colorCode.innerText = prevText, 2000);
    });
}

async function sampleColors() {
    const imgEl = document.getElementById("target-img");
    const opts = { amount: 10, format: 'hex', sample: 1 };
    const colors = await colorjs.prominent(imgEl, opts);

    for (const color of colors) {
        const newEl = document.createElement("DIV");
        newEl.innerHTML = getColorHtml(color);
        const child = newEl.firstChild;
        addCopyToClipboard(child);
        document.getElementById("target-colors").appendChild(child);
    }
}

function initPeerConnection() {
    peer = new Peer(getPageUid());
    peer.on("connection", gotConnection);
    establishConnection();
}

function getUid() {
    return Math.random().toString(36).substring(2, 15);
}

function upsertUid(uid) {
    let url = window.location.href;
    const newParam = "uid=" + encodeURIComponent(uid);
    if (url.indexOf("?") === -1) {
        url += "?" + newParam;
    } else {
        if (url.indexOf("uid=") === -1) {
            url += "&" + newParam;
        } else {
            url = url.replace(/(uid=)[^&]+/, "$1" + encodeURIComponent(uid));
        }
    }
    
    window.history.pushState({ path: url }, "", url);
}

function getPageUid() {
    return (window.location.search.match(/uid=([^&]+)/) || [])[1];
}

function getOpponentId(playerId) {
    const [uid, playerNumber] = [playerId.slice(0, -1), playerId.slice(-1)];
    return `${uid}${playerNumber === "1" ? "2" : "1"}`;
}

function setShareLink(opponentId) {
    const shareLink = document.getElementById("share-link");
    shareLink.innerHTML = `<a href="?uid=${opponentId}" target="_blank">Invite link</a>`;
}

function sendEditorContent() {
    if (conn) {
        conn.send(lastEditorContent);
    }
}

function gotConnection(conn) {
    conn.on("data", function (data) {
        console.log("Received: " + data);
        writeIntoIframe("output-iframe-opponent", data);
    });

    conn.on("close", () => {
        console.log("Connection closed.");
        console.log("Re-establishing connection...");
        establishConnection();
    });

    conn.send(lastEditorContent);
}

function establishConnection() {
    let connected = false;
    const timer = setInterval(() => {
        if (connected) {
            return clearInterval(timer);
        }

        const opponentId = getOpponentId(getPageUid());
        conn = peer.connect(opponentId);

        conn.on("open", () => {
            console.log(`Connection to ${opponentId} established!`);
            gotConnection(conn);
            connected = true;
        });
    }, 3000);
}

(function init() {
    initializeEditor();
    sampleColors();
    if (!getPageUid()) {
        upsertUid(`${getUid()}1`);
    }
    if (getPageUid().slice(-1) === "1") {
        setShareLink(getOpponentId(getPageUid()));
    }
    initPeerConnection();
})();