export async function delay(s) {
    return new Promise(res => setTimeout(res, s * 1000));
}

export function saveIntoLS(key, val) {
    window.localStorage.setItem(key, val);
}

export function loadFromLS(key) {
    return window.localStorage.getItem(key);
}

export function copyToClipboard(text) {
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

export function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const scriptElements = doc.getElementsByTagName("script");
    [...scriptElements].forEach((s) => s.remove());
    return doc.body.innerHTML;
}

export function writeIntoIframe(id, _content) {
    const content = `<html><head></head><body>${sanitizeHtml(_content)}</body></html>`;
    const iframe = document.getElementById(id);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();

    const iframeBody = iframe.contentWindow.document.body;
    iframeBody.style.margin = "0";
    iframeBody.style.width = "400px";
    iframeBody.style.height = "300px";
    iframeBody.style.overflow = "hidden";
}

export function getUid() {
    const uid = Math.random().toString(36).substring(2, 15);
    if (uid[0] === "d" && uid[uid.length - 1] === "b") {
        return getUid();
    }
    return uid;
}

export function getUrlAttr(name) {
    return (window.location.search.match(new RegExp(`${name}=([^&]+)`)) || [])[1];
}

export function upsertUrlAttr(name, value) {
    let url = window.location.href;
    const newParam = `${name}=` + encodeURIComponent(value);
    if (url.indexOf("?") === -1) {
        url += "?" + newParam;
    } else {
        if (url.indexOf(`${name}=`) === -1) {
            url += "&" + newParam;
        } else {
            url = url.replace(new RegExp(`(${name}=)[^&]+`), "$1" + encodeURIComponent(value));
        }
    }
    window.history.replaceState({ path: url }, "", url);
}

export function getPixelDiff(data1, data2, threshold = 10) {
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

export async function getImageDataFromDiv(div) {
    try {
        const dataUrl = await domtoimage.toPng(div);
        const img = new Image();
        const canvas = document.createElement("CANVAS");
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        await new Promise(res => img.onload = res, img.src = dataUrl);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, 400, 300);
        return imageData;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export function getCanvasFromImageData(imageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}