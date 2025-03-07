let lastEditorContent = "";
let editor = null;
let peer = null;
let conn = null;
let playerId = null;
const editorChangeHandlerDebounced = debounce(editorChangeHandler, 250);

async function delay(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function debounce(fn, wait) {
    let ts = Date.now();
    return function () {
        ts = Date.now();
        setTimeout(() => {
            if (Date.now() > ts + wait) {
                fn();
            }
        }, wait);
    }
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
    iframe.contentWindow.document.close()
}

function saveLastEditorContent() {
    localStorage.setItem(`editor-content_${getPageUid()}`, lastEditorContent);
}

function loadLastEditorContent() {
    const content = localStorage.getItem(`editor-content_${getPageUid()}`);
    if (content) {
        editor.setValue(content);
        return true;
    }
    return false;
}

function editorChangeHandler() {
    lastEditorContent = sanitizeHtml(editor.getSession().getValue());
    saveLastEditorContent();
    writeIntoIframe("output-iframe", lastEditorContent);
    sendEditorContent();
    refreshOutputDiff();
}

function initializeEditor() {
    editor = ace.edit("ace-editor");
    editor.getSession().setUseWorker(false);
    editor.setTheme("ace/theme/monokai");
    editor.getSession().setMode("ace/mode/html");
    editor.getSession().on("change", editorChangeHandlerDebounced);
    if(!loadLastEditorContent()) {
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

        diffData[i]   = (dr < threshold) ? 0 : dr;
        diffData[i+1] = (dg < threshold) ? 0 : dg;
        diffData[i+2] = (db < threshold) ? 0 : db;

        if (diffData[i] + diffData[i + 1] + diffData[i + 2] === 0) {
            equalPixels++
        }
    }

    console.warn({ equalPixels });

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
    const targetImg = document.getElementById("target-img");
    const outputDiff = document.getElementById("output-diff");
    const outputIframeBody = document.querySelector('#output-iframe').contentWindow.document.body;

    const outputIframeImageData = await getImageData(outputIframeBody);
    const targetImageData =await getImageData(targetImg);

    if (!outputIframeImageData || !targetImageData) {
        return;
    }

    const { imageData, similarity } = computePixelDifference(
        outputIframeImageData,
        targetImageData
    );

    console.warn({ similarity });

    outputDiff.innerHTML = "";
    outputDiff.appendChild(getCanvasFromImageData(imageData));
}

(async function init() {
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

/**
 * TODO
 * 1. Connection gets re-established too many times
 * 3. Sanitize bad attributes
 */