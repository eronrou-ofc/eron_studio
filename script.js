// ===============================
// CONFIGURATION SUPABASE
// ===============================

const SUPABASE_URL = "https://gyjonweumwmlvfvcksjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VbxuB8dM6XPJgK8xR3N2dA_S3b60VCk";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ===============================
// ÉLÉMENTS DU SITE
// ===============================

const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");


// ===============================
// PSEUDO
// ===============================

let username = localStorage.getItem("monchat_username");

if (!username) {
    username = prompt("Choisis ton pseudo :");

    if (!username || username.trim() === "") {
        username = "Invité";
    }

    username = username.trim();

    localStorage.setItem("monchat_username", username);
}


// ===============================
// AFFICHER UN MESSAGE
// ===============================

function displayMessage(message) {

    const div = document.createElement("div");

    const isMe = message.username === username;

    div.className = isMe
        ? "message me"
        : "message other";

    const date = new Date(message.created_at);

    const time = date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });

    div.innerHTML = `
        <div>
            ${!isMe ? `<div class="message-name">${escapeHTML(message.username)}</div>` : ""}

            <div class="bubble">
                ${escapeHTML(message.content)}
            </div>

            <small class="time">${time}</small>
        </div>
    `;

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;
}


// ===============================
// CHARGER LES MESSAGES
// ===============================

async function loadMessages() {

    const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {
        console.error("Erreur :", error);
        return;
    }

    messages.innerHTML = "";

    data.forEach(displayMessage);
}

loadMessages();


// ===============================
// ENVOYER UN MESSAGE
// ===============================

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const text = input.value.trim();

    if (!text) {
        return;
    }

    const { error } = await supabaseClient
        .from("messages")
        .insert({
            username: username,
            content: text
        });

    if (error) {
        console.error("Erreur d'envoi :", error);
        alert("Impossible d'envoyer le message.");
        return;
    }

    input.value = "";
});


// ===============================
// MESSAGES EN TEMPS RÉEL
// ===============================

supabaseClient
    .channel("messages-realtime")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages"
        },
        function(payload) {

            displayMessage(payload.new);
        }
    )
    .subscribe();


// ===============================
// PROTECTION HTML
// ===============================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}