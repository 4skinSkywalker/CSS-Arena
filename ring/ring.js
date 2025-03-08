let lastEditorContent = "";
let editor = null;
let peer = null;
let conn = null;
let playerId = null;
let tryToConnect = false;

async function delay(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function resetIframe(iframeBody) {
    iframeBody.style.margin = "0";
    iframeBody.style.width = "400px";
    iframeBody.style.height = "300px";
    iframeBody.style.overflow = "hidden";
}

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
    return doc.body.innerHTML;
}

function writeIntoIframe(id, _content) {
    const content = `<html><head></head><body>${sanitizeHtml(_content)}</body></html>`;
    const iframe = document.getElementById(id);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();
    resetIframe(iframe.contentWindow.document.body);
}

function saveLastEditorContent() {
    window.localStorage.setItem(`editor-content_${getPageUid()}`, lastEditorContent);
}

function loadLastEditorContent() {
    const content = window.localStorage.getItem(`editor-content_${getPageUid()}`);
    if (content) {
        editor.setValue(content, -1);
        return true;
    }
    return false;
}

function editorChangeHandler() {
    lastEditorContent = sanitizeHtml(editor.getSession().getValue());
    saveLastEditorContent();
    writeIntoIframe("output-iframe", lastEditorContent);
    sendMessage("lastEditorContent", lastEditorContent);
    refreshOutputDiff();
}

function toggleVimMode() {
    const vimMode = document.getElementById("vim-mode").checked;
    if (!vimMode) {
        editor.setKeyboardHandler(null);
    } else {
        editor.setKeyboardHandler("ace/keyboard/vim");
    }
}

function initializeEditor() {
    editor = ace.edit("ace-editor");
    editor.getSession().setUseWorker(false);
    editor.setTheme("ace/theme/monokai");
    editor.getSession().setMode("ace/mode/html");
    editor.getSession().on("change", editorChangeHandler);
    if (!loadLastEditorContent()) {
        editor.setValue(`<div></div>
<style>
    div {
        width: 100px;
        height: 100px;
        background: #dd6b4d;
    }
</style>`);
    }
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
    const opts = { amount: 10, format: "hex", sample: 1 };
    const colors = await colorjs.prominent(imgEl, opts);

    for (const color of colors) {
        const newEl = document.createElement("DIV");
        newEl.innerHTML = getColorHtml(color);
        const child = newEl.firstChild;
        addCopyToClipboard(child);
        document.getElementById("target-colors").appendChild(child);
    }
}

function setProgress(percentage, isOpponent) {
    document.querySelector(`#progressbar${isOpponent ? "-opponent" : ""} .bar`).style.width = percentage;
    document.getElementById(`progress${isOpponent ? "-opponent" : ""}`).innerText = percentage;
}

function addChatMessage(message, isOpponent) {
    const chatMessage = document.createElement("DIV");
    chatMessage.classList.add(isOpponent ? "chat__message-opponent" : "chat__message");
    chatMessage.innerText = message;
    document.querySelector(".chat__messages").prepend(chatMessage);
}

function chatMessageSend() {
    const message = document.getElementById("chat-message-send").value;
    document.getElementById("chat-message-send").value = "";
    sendMessage("chat", message);
    addChatMessage(message, false);
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

    window.history.replaceState({ path: url }, "", url);
}

function getUrlAttr(name) {
    return (window.location.search.match(new RegExp(`${name}=([^&]+)`)) || [])[1];
}

function getBattleId() {
    return getUrlAttr("battle");
}

function getPageUid() {
    return getUrlAttr("uid");
}

function getOpponentId(playerId) {
    const [uid, playerNumber] = [playerId.slice(0, -1), playerId.slice(-1)];
    return `${uid}${playerNumber === "1" ? "2" : "1"}`;
}

function setShareLink(opponentId) {
    const shareLink = document.getElementById("share-link");
    shareLink.style.display = "block";
    shareLink.innerHTML = `<a href="?battle=${getBattleId()}&uid=${opponentId}" target="_blank">Invite link</a>`;
}

function setConnectionStatus(status) {
    const connectionStatus = document.getElementById("connection-status");
    connectionStatus.innerText = status;
}

function sendMessage(topic, message) {
    if (conn) {
        conn.send(JSON.stringify({ topic, message }));
    }
}

function gotConnection(conn) {
    conn.on("data", function (data) {
        data = JSON.parse(data);
        switch (data.topic) {
            case "lastEditorContent": {
                writeIntoIframe("output-iframe-opponent", data.message);
                break;
            }
            case "progress": {
                setProgress(data.message, true);
                break;
            }
            case "chat": {
                document.getElementById("chat-toggle").checked = true;
                addChatMessage(data.message, true);
                break;
            }
            default: {
                console.warn("Unknown topic", data.topic);
            }
        }
    });

    conn.on("close", async () => {
        setConnectionStatus("Disconnected");
        await delay(2);
        establishConnection();
    });

    sendMessage("lastEditorContent", lastEditorContent);
    refreshOutputDiff();
}

async function establishConnection() {
    setConnectionStatus("Connecting...");

    tryToConnect = true;
    const timer = setInterval(() => {
        if (!tryToConnect) {
            return clearInterval(timer);
        }

        if (conn) {
            conn.removeAllListeners();
        }

        setConnectionStatus("Looking for opponent...");
        conn = peer.connect(getOpponentId(getPageUid()));

        conn.on("open", () => {
            setConnectionStatus("Connection to opponent established!");
            gotConnection(conn);
            tryToConnect = false;
        });
    }, 2000);
}

function computePixelDifference(data1, data2, threshold = 10) {
    if (data1.width !== data2.width || data1.height !== data2.height) {
        throw new Error("Dimensions do not match");
    }

    let diffData = new Uint8ClampedArray(data1.data.length);
    let equalPixels = 0;
    for (let i = 0; i < data1.data.length; i += 4) {
        const dr = Math.abs(data1.data[i] - data2.data[i]);
        const dg = Math.abs(data1.data[i + 1] - data2.data[i + 1]);
        const db = Math.abs(data1.data[i + 2] - data2.data[i + 2]);

        diffData[i + 3] = 255; // Set alpha to full opacity

        diffData[i] = (dr < threshold) ? 0 : dr;
        diffData[i + 1] = (dg < threshold) ? 0 : dg;
        diffData[i + 2] = (db < threshold) ? 0 : db;

        if (diffData[i] + diffData[i + 1] + diffData[i + 2] === 0) {
            equalPixels++
        }
    }

    return {
        imageData: new ImageData(diffData, data1.width, data1.height),
        equalPixels,
        similarity: equalPixels / (data1.width * data1.height),
    };
}

async function getImageData(div) {
    try {
        const canvas = await html2canvas(div, {
            logging: false,
            useCORS: true,
            width: 400,
            height: 300,
            scale: 1,
        });
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, 400, 300);
        return imageData;
    } catch (e) {
        return null;
    }
}

function getCanvasFromImageData(imageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function refreshOutputDiff() {
    await delay(0.15);

    const targetImg = document.getElementById("target-img");
    const outputDiff = document.getElementById("output-diff");
    const outputIframe = document.querySelector('#output-iframe');
    const outputIframeBody = outputIframe.contentWindow.document.body;

    const outputIframeImageData = await getImageData(outputIframeBody);
    const targetImageData = await getImageData(targetImg);

    if (!outputIframeImageData || !targetImageData) {
        return;
    }

    const { imageData, similarity } = computePixelDifference(
        outputIframeImageData,
        targetImageData
    );

    const percentage = Math.round(similarity * 100) + "%";
    setProgress(percentage);
    sendMessage("progress", percentage);

    outputDiff.innerHTML = "";
    outputDiff.appendChild(getCanvasFromImageData(imageData));
}

function initializeTargetImage() {
    return new Promise(async resolve => {
        const targetImg = document.getElementById("target-img");
        const battleId = getUrlAttr("battle");
        targetImg.src = `../img/${battleId}.png`;
        targetImg.onload = () => resolve();
    });
}

(async function init() {
    initializeEditor();
    await initializeTargetImage();
    sampleColors();
    if (!getPageUid()) {
        upsertUid(`${getUid()}1`);
    }
    if (getPageUid().slice(-1) === "1") {
        setShareLink(getOpponentId(getPageUid()));
    }
    initPeerConnection();
})();
