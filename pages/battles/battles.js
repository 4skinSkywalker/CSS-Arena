function getBattleEl(battleId, imagePath, belowFold = false) {
    const newEl = document.createElement("DIV");
    newEl.innerHTML = `
        <div class="battle">
            <a href="/pages/ring/ring.html?battle=${battleId}"></a>
            <img src="${imagePath}" ${belowFold ? 'loading="lazy"' : ""} alt="Target image">
        </div>
    `;
    return newEl.querySelector(".battle");
}

(async function () {
    const battlesEl = document.querySelector(".battles");
    for (let i = 1; i < 227; i++) {
        battlesEl.appendChild(getBattleEl(i, `/assets/img/${i}.png`, i > 20));
    }
})();