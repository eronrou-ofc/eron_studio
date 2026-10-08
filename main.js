const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");

form.addEventListener("submit", function (event) {

    event.preventDefault();

    const text = input.value.trim();

    if (text === "") {
        return;
    }

    const now = new Date();

    const time = now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });

    const message = document.createElement("div");

    message.className = "message me";

    message.innerHTML = `
        <div>
            <div class="bubble">
                ${escapeHTML(text)}
            </div>
            <small class="time">${time}</small>
        </div>
    `;

    messages.appendChild(message);

    input.value = "";

    messages.scrollTop = messages.scrollHeight;
});


function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}