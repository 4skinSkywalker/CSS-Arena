import { Chat } from "../../components/chat.js";
import { Progressbar } from "../../components/progressbar.js";
import { debounce, copyToClipboard, writeIntoIframe, getUid, getUrlAttr, upsertUrlAttr, getPixelDiff, getImageDataFromImg, getCanvasFromImageData, saveIntoLS, loadFromLS } from "/utils.js";

let clientId;
let ws;
let wsReady = false;
let editor;
let lastEditorContent = "";
let progressPercentage = "0%";

function setConnectionStatus(status) {
    document.getElementById("connection-status").innerText = status;
}

function setProgress(percentage, clientId) {
    progressPercentage = percentage;
    const suffix = clientId ? `-${clientId}` : "";
    const progressbarEl = document.getElementById(`progressbar${suffix}`);
    const progressEl = document.getElementById(`progress${suffix}`);
    if (!progressbarEl || !progressEl) {
        console.error("Cannot find progressbar or progress element");
        return;
    }
    progressbarEl.setProgress(percentage);
    progressEl.innerText = percentage;
}

function initConnection() {
    const online = true;
    ws = new WebSocket(online ? "wss://css-arena-13a0033b74e5.herokuapp.com" : "ws://localhost:5000");

    ws.sendMsg = (topic, message) => {
        if (!ws || !wsReady) {
            console.error("WebSocket connection is not initialized or not ready");
            return;
        }
        ws.send(JSON.stringify({ topic, message }))
    };

    ws.onopen = () => {
        console.log("ws.open");
        wsReady = true;
    };

    ws.onmessage = ({ data }) => {
        console.log("ws.message");
        const { topic, message } = JSON.parse(data);
        console.log(topic, message);
        
        switch (topic) {
            case "clientIntroduced": {
                const { clientId, clientName } = message;
                addOpponent(clientId, clientName);
                break;
            }
            case "clientLeft": {
                removeOpponent(message);
                break;
            }
            case "clientsAlreadyIn": {
                const clientsAlreadyIn = message;
                for (const { clientId, clientName } of clientsAlreadyIn) {
                    addOpponent(clientId, clientName);
                }
                break;
            }
            case "roomIdRequest": {
                ws.sendMsg("roomIdResponse", getUrlAttr("uid"));
                break;
            }
            case "nameRequest": {
                clientId = message;
                console.log("This client has been assigned the id", clientId);

                const askUntilProvided = function() {
                    const msg = "Choose you name.\nBut choose carefully, you wont be able to change it later.";
                    const name = window.prompt(msg).trim();
                    if (!name) {
                        return askUntilProvided();
                    }
                    return name;
                }

                let clientName = window.localStorage.getItem("clientName");
                if (!clientName) {
                    clientName = askUntilProvided();
                    window.localStorage.setItem("clientName", clientName);
                }

                ws.sendMsg("nameResponse", clientName);
                break;
            }
            case "initialDataRequest": {
                ws.sendMsg("lastEditorContent", { lastEditorContent });
                ws.sendMsg("progress", { percentage: progressPercentage });
                ws.sendMsg("opponentDataRequest", clientId);
                break;
            }
            case "opponentDataRequest": {
                clientId = message;
                ws.sendMsg("lastEditorContent", { clientId, lastEditorContent });
                ws.sendMsg("progress", { clientId, percentage: progressPercentage });
                break;
            }
            case "lastEditorContent": {
                console.log("ws.lastEditorContent");
                const { lastEditorContent, clientId, clientName } = message;
                setConnectionStatus(`Received update from ${clientName}`);
                writeIntoIframe(`output-iframe-${clientId}`, DOMPurify.sanitize(lastEditorContent));
                break;
            }
            case "progress": {
                console.log("ws.progress");
                const { percentage, clientId } = message;
                setProgress(percentage, clientId);
                break;
            }
            case "chat": {
                console.log("ws.chat");
                const { message: msg, name } = message;
                document.getElementById("chat").addChatMessage(msg, name);
                break;
            }
            case "imageForDiff": {
                console.log("ws.imageForDiff");
                document.getElementById("output-img").src = `data:image/png;base64, ${message}`;
                document.getElementById("output-img").onload = refreshDiff;
                break;
            }
            default: {
                console.warn("Unknown topic", topic);
            }
        }
    };

    ws.onclose = () => {
        console.log("ws.close");
        wsReady = false;
    };
}

function setOriginalTargetLink() {
    const linkEl = document.getElementById("original-target-link");
    linkEl.href = `https://cssbattle.dev/play/${getUrlAttr("battle")}`;
}

function setShareLink() {
    const linkEl = document.getElementById("share-link");
    linkEl.style.display = "inline-block";
    linkEl.href = `?battle=${getUrlAttr("battle")}&uid=${getUrlAttr("uid")}`;

    linkEl.addEventListener("click", evt => {
        evt.preventDefault();
        
        const prevText = linkEl.innerText;
        if (prevText === "Copied!") {
            return;
        }
        copyToClipboard(linkEl.href);
        linkEl.innerText = "Copied!"
        setTimeout(() => linkEl.innerText = prevText, 2000);
    });
}

function getLastContentKey() {
    return `editor-content_${getUrlAttr("uid")}`;
}

async function refreshDiff() {
    const outputImg = document.getElementById("output-img");
    const targetImg = document.getElementById("target-img");
    const outputDiff = document.getElementById("output-diff");

    const outputImgData = await getImageDataFromImg(outputImg);
    const targetImgData = await getImageDataFromImg(targetImg);

    if (!outputImgData || !targetImgData) {
        return;
    }

    const { imageData, similarity } = getPixelDiff(outputImgData, targetImgData);

    const percentage = Math.round(similarity * 100) + "%";
    setProgress(percentage);
    ws.sendMsg("progress", { percentage });

    outputDiff.src = getCanvasFromImageData(imageData).toDataURL("image/png");
}

async function editorChangeHandler() {
    lastEditorContent = DOMPurify.sanitize(editor.getSession().getValue());
    saveIntoLS(getLastContentKey(), lastEditorContent);
    ws.sendMsg("lastEditorContent", { lastEditorContent });
    writeIntoIframe("output-iframe", lastEditorContent);
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
    const debouncedEditorChangeHandler = debounce(editorChangeHandler, 300);
    editor.getSession().on("change", debouncedEditorChangeHandler);

    lastEditorContent = loadFromLS(getLastContentKey()) || "";
    if (lastEditorContent) {
        editor.setValue(lastEditorContent);
    } else {
        editor.setValue(`<div></div>\n<style>\n\tbody {\n\t\tbackground: #C0FFEE;\n\t}\n\tdiv {\n\t\twidth: 100px;\n\t\theight: 100px;\n\t\tbackground: #BADA55;\n\t}\n</style>`);
    }
}

function addOpponent(clientId, clientName) {
    const opponentHtml = `
<div class="ring__label">
    <span>${clientName} output</span>
    <app-progressbar id="progressbar-${clientId}"></app-progressbar>
    <span id="progress-${clientId}">0%</span>
</div>

<iframe id="output-iframe-${clientId}" frameborder="0"></iframe>`;
    const opponentEl = document.createElement("DIV");
    opponentEl.id = `opponent-${clientId}`;
    opponentEl.innerHTML = opponentHtml;
    document.getElementById("opponents-container").appendChild(opponentEl);
}

function removeOpponent(clientId) {
    const opponentEl = document.getElementById(`opponent-${clientId}`);
    if (!opponentEl) {
        return;
    }
    opponentEl.remove();
}

function getColorEl(bg) {
    const newEl = document.createElement("DIV");
    newEl.innerHTML = `
<div class="color">
    <div class="color__circle" style="background: ${bg};"></div>
    <div class="color__code">${bg}</div>
</div>`;
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
    const battleId = getUrlAttr("battle");
    
    const referenceBg = document.getElementById("reference-bg");
    referenceBg.style.backgroundImage = `url(/assets/img/${battleId}.png)`;

    const targetImg = document.getElementById("target-img");
    await new Promise(res => targetImg.onload = res, targetImg.src = `/assets/img/${battleId}.png`);

    // Setup slide over to compare feature
    const comparisonEl = document.getElementById("output-compare");
    comparisonEl.addEventListener("mousemove", mouseEvt => {
        const { x, width } = comparisonEl.getBoundingClientRect();
        const mx = mouseEvt.clientX;
        const perc = (mx - x) / width;
        referenceBg.style.width = (perc * 100) + "%";
    });
    comparisonEl.addEventListener("mouseleave", () => {
        referenceBg.style.width = "0%";
    });
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
        ws.sendMsg("chat", evt.detail.message);
    });
}

function bindEvents() {
    bindVimMode();
    bindChat();
}

(async function () {
    if (!getUrlAttr("uid")) {
        upsertUrlAttr("uid", getUid());
    }
    setShareLink();
    setOriginalTargetLink();
    initConnection();
    initEditor();
    await initTargetImage();
    sampleColors();
    bindEvents();
})();
