function getBattleHtml(battleId, imagePath, belowFold = false) {
    const el = document.createElement("DIV");
    el.innerHTML = `<div class="battle">
    <a href="/ring/ring.html?battle=${battleId}"></a>
    <img src="${imagePath}" ${belowFold ? 'loading="lazy"' : ""} alt="Target image">
</div>`;
    return el.firstChild;
}

(async function init() {
    const battlesEl = document.querySelector(".battles");
    for (let i = 1; i < 227; i++) {
        battlesEl.appendChild(getBattleHtml(i, `../img/${i}.png`, i > 20));
    }
})();