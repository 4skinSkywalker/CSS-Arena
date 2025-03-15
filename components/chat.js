export class Chat extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `
<link rel="stylesheet" href="/common.css">
<style>
    .chat {
        position: fixed;
        bottom: 0;
        right: 0;
        z-index: 10;
        width: 400px;
        display: grid;
        grid-template-rows: auto 0;
        overflow: hidden;
        background: #272822;
        border: 1px solid #323f4a;
        border-top-left-radius: 0.5rem;
        box-shadow: -10px -10px 10px 0 #0003;
        transition: grid-template-rows 0.2s ease-in-out;
    }

    .chat:has(#chat-toggle:checked) {
        grid-template-rows: auto 250px;
    }

    .chat__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        background: #2a313a;
        border-bottom: 1px solid #323f4a;
    }

    .chat__title {
        font-weight: 700;
        padding: 0.25rem 0.5rem;
    }

    .chat__messages-wrap {
        display: flex;
        flex-direction: column;
    }

    .chat__messages {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        gap: 0.5rem;
        padding: 0.5rem;
        overflow-y: auto;
    }

    .chat__message,
    .chat__message-opponent {
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        background: #2a313a;
        max-width: 320px;
    }

    .chat__message {
        align-self: end;
        box-shadow: -10px 10px 10px 0 #0001;
    }

    .chat__message-opponent {
        align-self: start;
        box-shadow: 10px 10px 10px 0 #0001;
    }

    .chat__text {
        display: flex;
        gap: 0.5rem;
        border-top: 1px solid #323f4a;
    }

    .chat__text input {
        flex-grow: 1;
        all: unset;
        padding: 0.5rem;
        width: 100%;
    }
</style>
<div class="chat">
    <input type="checkbox" id="chat-toggle" hidden>
    <label class="chat__header" for="chat-toggle">
        <div class="chat__title">Chat</div>
        <div class="btn">
            <i class="bi bi-chat-fill"></i>
        </div>
    </label>
    <div class="chat__messages-wrap">
        <div class="chat__messages"></div>
        <div class="chat__text">
            <input id="chat-message-send" type="text" placeholder="Type your message...">
            <button class="btn">
                <i class="bi bi-send-fill"></i>
            </button>
        </div>
    </div>
</div>`;
    }

    connectedCallback() {
        this.shadowRoot.getElementById("chat-message-send").addEventListener("keydown", evt => {
            if (evt.key === "Enter") {
                this.chatMessageSend();
            } else if (evt.key === "Escape") {
                this.shadowRoot.getElementById("chat-toggle").checked = false;
            }
        });
        this.shadowRoot.querySelector("#chat-message-send + button").addEventListener("click", this.chatMessageSend);
    }

    dispatchSendEvent = (message) => {
        console.warn("Dispatching chatMessageSend event", message);
        this.dispatchEvent(
            new CustomEvent("chatMessageSend", {
                detail: { message, timestamp: Date.now() },
                bubbles: true,
                composed: true
            })
        );
    }

    addChatMessage = (message, clientName) => {
        if (clientName) {
            this.shadowRoot.getElementById("chat-toggle").checked = true;
        }

        const chatMessageName = document.createElement("DIV");
        chatMessageName.style.fontSize = "0.777rem";
        chatMessageName.style.opacity = "0.8";
        chatMessageName.innerText = clientName ? clientName : "My message";

        const chatMessageContent = document.createElement("DIV");
        chatMessageContent.innerText = message;

        const chatMessage = document.createElement("DIV");
        chatMessage.classList.add(clientName ? "chat__message-opponent" : "chat__message");
        chatMessage.appendChild(chatMessageName);
        chatMessage.appendChild(chatMessageContent);

        const chatMessages = this.shadowRoot.querySelector(".chat__messages");
        chatMessages.appendChild(chatMessage);
        chatMessages.scrollTo(0, chatMessages.scrollHeight);
    }

    chatMessageSend = () => {
        const message = this.shadowRoot.getElementById("chat-message-send").value;
        this.dispatchSendEvent(message);
        this.addChatMessage(message, false);
        this.shadowRoot.getElementById("chat-message-send").value = "";
    }
}

customElements.define("app-chat", Chat);
