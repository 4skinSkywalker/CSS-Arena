function getBattleHtml(battleId, imagePath) {
    return `<div class="battle">
    <a href="/ring/ring.html?battle=${battleId}"></a>
    <img src="${imagePath}"
        alt="Target image">
</div>`;
}

(async function init() {
    const battles = await (await fetch("../battles.json")).json();
    const battlesEl = document.querySelector(".battles");
    for (const [battleId, imagePath] of Object.entries(battles)) {
        battlesEl.innerHTML += getBattleHtml(battleId, imagePath);
    }
})();