function getBattleHtml(battleId, imagePath, belowFold = false) {
    return `<div class="battle">
    <a href="/ring/ring.html?battle=${battleId}"></a>
    <img src="${imagePath}" ${belowFold ? 'loading="lazy"' : ""} alt="Target image">
</div>`;
}

(async function init() {
    const battles = await (await fetch("../battles.json")).json();
    const battlesEl = document.querySelector(".battles");
    let i = 0;
    for (const [battleId, imagePath] of Object.entries(battles)) {
        i++;
        battlesEl.innerHTML += getBattleHtml(battleId, imagePath, i > 20);
    }
})();