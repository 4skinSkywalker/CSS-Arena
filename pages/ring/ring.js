import { Chat } from "../../components/chat.js";
import { Progressbar } from "../../components/progressbar.js";
import { delay, copyToClipboard, sanitizeHtml, writeIntoIframe, getUid, getUrlAttr, upsertUrlAttr, getPixelDiff, getImageDataFromDiv, getCanvasFromImageData, saveIntoLS, loadFromLS } from "/util.js";

let ws;
let wsReady = false;
let editor;
let lastEditorContent = "";

function getMyId() {
    return getUrlAttr("uid");
}

function getOpponentId() {
    return getUrlAttr("uid").split("").reverse().join("");
}

function isHost() {
    const uid = getMyId();
    return uid[0] === "d" && uid[uid.length - 1] === "b";
}

function setConnectionStatus(status) {
    document.getElementById("connection-status").innerText = status;
}

function setProgress(percentage, isOpponent) {
    const suffix = isOpponent ? "-opponent" : "";
    document.getElementById(`progressbar${suffix}`).setProgress(percentage);
    document.getElementById(`progress${suffix}`).innerText = percentage;
}

function sendMessage(topic, message) {
    if (!ws || !wsReady) {
        console.error("Either ws doesn't exists or is not connected");
        return;
    }
    ws.send(JSON.stringify({ from: getMyId(), topic, message }));
}

function initConnection() {
    ws = new WebSocket("wss://css-arena-13a0033b74e5.herokuapp.com:39169");
    // ws = new WebSocket("ws://localhost:3000");

    ws.onopen = () => {
        setConnectionStatus("Waiting for a peer to connect...");
        console.log("ws.open");
        wsReady = true;
        sendMessage("handshake", getMyId());
        sendMessage("lastEditorContent", lastEditorContent);
    };

    ws.onmessage = ({ data }) => {
        const { topic, message } = JSON.parse(data);
        switch (topic) {
            case "handshake": {
                console.log("ws.handshake");
                setConnectionStatus("Connected to peer!");
                sendMessage("lastEditorContent", lastEditorContent);
                break;
            }
            case "lastEditorContent": {
                console.log("ws.lastEditorContent");
                writeIntoIframe("output-iframe-opponent", message);
                break;
            }
            case "progress": {
                console.log("ws.progress");
                setProgress(message, true);
                break;
            }
            case "chat": {
                console.log("ws.chat");
                document.getElementById("chat").addChatMessage(message, true);
                break;
            }
            default: {
                console.warn("Unknown topic", topic);
            }
        }
    };

    ws.onclose = () => {
        wsReady = false;
    };
}

function genShareLink() {
    const linkEl = document.getElementById("share-link");
    linkEl.style.display = "inline-block";
    linkEl.href = `?battle=${getUrlAttr("battle")}&uid=${getOpponentId()}`;
}

function getLastContentKey() {
    return `editor-content_${getMyId()}`;
}

async function refreshOutputDiff() {
    const targetImg = document.getElementById("target-img");
    const outputDiff = document.getElementById("output-diff");
    const outputIframe = document.querySelector('#output-iframe');
    const outputIframeBody = outputIframe.contentWindow.document.body;

    const outputIframeImageData = await getImageDataFromDiv(outputIframeBody);
    const targetImageDataFromDiv = await getImageDataFromDiv(targetImg);

    if (!outputIframeImageData || !targetImageDataFromDiv) {
        return;
    }

    const { imageData, similarity } = getPixelDiff(
        outputIframeImageData,
        targetImageDataFromDiv
    );

    const percentage = Math.round(similarity * 100) + "%";
    setProgress(percentage);
    sendMessage("progress", percentage);

    outputDiff.innerHTML = "";
    outputDiff.appendChild(getCanvasFromImageData(imageData));
}

async function editorChangeHandler() {
    lastEditorContent = sanitizeHtml(editor.getSession().getValue());
    saveIntoLS(getLastContentKey(), lastEditorContent);
    sendMessage("lastEditorContent", lastEditorContent);
    writeIntoIframe("output-iframe", lastEditorContent);
    await delay(0.15);
    refreshOutputDiff();
}

function initEditor() {
    editor = ace.edit("ace-editor");
    editor.setTheme("ace/theme/monokai");

    ace.require("ace/ext/emmet").setCore("ext/emmet_core");
    ace.config.loadModule("ace/snippets/html", () => console.log("HTML snippets loaded."));
    ace.config.loadModule("ace/snippets/css", () => console.log("CSS snippets loaded."));

    editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        enableEmmet: true,
    });

    editor.getSession().setUseWorker(false);
    editor.getSession().setMode("ace/mode/html");
    editor.getSession().on("change", editorChangeHandler);

    lastEditorContent = loadFromLS(getLastContentKey()) || "";
    if (lastEditorContent) {
        editor.setValue(lastEditorContent);
    } else {
        editor.setValue(`<div></div>\n<style>\n\tdiv {\n\t\twidth: 100px;\n\t\theight: 100px;\n\t\tbackground: #dd6b4d;\n\t}\n</style>`);
    }
}

function getColorEl(bg) {
    const newEl = document.createElement("DIV");
    newEl.innerHTML = `
        <div class="color">
            <div class="color__circle" style="background: ${bg};"></div>
            <div class="color__code">${bg}</div>
        </div>
    `;
    const colorEl = newEl.querySelector(".color");

    colorEl.addEventListener("click", () => {
        const colorCode = colorEl.querySelector(".color__code");
        const prevText = colorCode.innerText;
        if (prevText === "Copied!") {
            return;
        }
        copyToClipboard(prevText);
        colorCode.innerText = "Copied!"
        setTimeout(() => colorCode.innerText = prevText, 2000);
    });

    return colorEl;
}

async function sampleColors() {
    const colorsEl = document.getElementById("target-colors");
    const imgEl = document.getElementById("target-img");
    const colors = await colorjs.prominent(imgEl, { amount: 10, format: "hex", sample: 1 });
    for (const color of colors) {
        colorsEl.appendChild(getColorEl(color));
    }
}

async function initTargetImage() {
    const targetImg = document.getElementById("target-img");
    const battleId = getUrlAttr("battle");
    await new Promise(res => targetImg.onload = res, targetImg.src = `/assets/img/${battleId}.png`);
}

function bindVimMode() {
    const el = document.getElementById("vim-mode");
    el.addEventListener("click", () => {
        if (!el.checked) {
            editor.setKeyboardHandler(null);
        } else {
            editor.setKeyboardHandler("ace/keyboard/vim");
        }
    });
}

function bindChat() {
    const chatEl = document.getElementById("chat");
    chatEl.addEventListener("chatMessageSend", evt => {
        sendMessage("chat", evt.detail.message);
    });
}

function bindEvents() {
    bindVimMode();
    bindChat();
}

(async function () {
    if (!getMyId()) {
        upsertUrlAttr("uid", `d${getUid()}b`);
    }
    if (isHost()) {
        genShareLink();
    }
    initConnection();
    initEditor();
    await initTargetImage();
    sampleColors();
    bindEvents();
})();
