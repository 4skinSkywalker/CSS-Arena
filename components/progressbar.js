export class Progressbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `
<link rel="stylesheet" href="/common.css">
<style>
    #progressbar {
        height: 1.25rem;
        border: 1px solid #323f4a;
    }
    
    #progressbar .bar {
        width: 0%;
        height: 100%;
        background: linear-gradient(gold, #c85, gold);
        background-repeat: repeat;
        box-shadow: 0 0 10px 0px orange;
        animation:
            shine 4s ease-in infinite,
            end 1s ease-out 1;
        transition: width 3s ease;
    }
    
    @keyframes shine {
        0% {
            background-position: 0 0;
        }

        100% {
            background-position: 0 50px;
        }
    }

    @keyframes end {
        0%,
        100% {
            box-shadow: 0 0 10px 0px orange;
        }

        50% {
            box-shadow: 0 0 15px 5px orange;
        }
    }
</style>
<div id="progressbar">
    <div class="bar"></div>
</div>`;
    }

    setProgress(progress) {
        this.shadowRoot.querySelector("#progressbar .bar").style.width = progress;
    }
}

customElements.define("app-progressbar", Progressbar);