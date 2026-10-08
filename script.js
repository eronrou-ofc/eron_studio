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
// ÉLÉMENTS
// ===============================

const authScreen = document.getElementById("authScreen");
const chatApp = document.getElementById("chatApp");

const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

const authButton = document.getElementById("authButton");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");
const switchAuth = document.getElementById("switchAuth");

const usernameDisplay = document.getElementById("usernameDisplay");
const userAvatar = document.getElementById("userAvatar");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");


// ===============================
// MODE CONNEXION / INSCRIPTION
// ===============================

let signupMode = false;

switchAuth.addEventListener("click", function () {

    signupMode = !signupMode;

    authMessage.textContent = "";

    if (signupMode) {

        authTitle.textContent = "Créer un compte";

        authButton.textContent = "Créer mon compte";

        switchAuth.textContent = "J'ai déjà un compte";

    } else {

        authTitle.textContent = "Connexion";

        authButton.textContent = "Se connecter";

        switchAuth.textContent = "Créer un compte";
    }
});


// ===============================
// INSCRIPTION / CONNEXION
// ===============================

authForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    authMessage.textContent = "Chargement...";

    // INSCRIPTION
    if (signupMode) {

        const { data, error } =
            await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

        if (error) {

            authMessage.textContent =
                "❌ " + error.message;

            return;
        }

        if (data.session) {

            authMessage.textContent =
                "✅ Compte créé !";

            showChat();

        } else {

            authMessage.textContent =
                "✅ Compte créé ! Vérifie ton email pour confirmer ton compte.";

        }

        return;
    }


    // CONNEXION
    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {

        authMessage.textContent =
            "❌ " + error.message;

        return;
    }

    if (data.user) {

        showChat();
    }

});


// ===============================
// AFFICHER LE CHAT
// ===============================

async function showChat() {

    authScreen.style.display = "none";

    chatApp.style.display = "flex";

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        return;
    }

    const username =
        user.email.split("@")[0];

    usernameDisplay.textContent = username;

    userAvatar.textContent =
        username.charAt(0).toUpperCase();

    await loadMessages();
}


// ===============================
// VÉRIFIER LA SESSION
// ===============================

async function checkSession() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

    if (session) {

        showChat();

    } else {

        authScreen.style.display = "flex";

        chatApp.style.display = "none";
    }
}

checkSession();


// ===============================
// CHARGER LES MESSAGES
// ===============================

async function loadMessages() {

    const {
        data,
        error
    } = await supabaseClient
        .from("messages")
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Erreur chargement messages :",
            error
        );

        return;
    }

    messages.innerHTML = "";

    data.forEach(displayMessage);
}


// ===============================
// AFFICHER UN MESSAGE
// ===============================

async function displayMessage(message) {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    const currentUsername =
        user
            ? user.email.split("@")[0]
            : "";

    const div =
        document.createElement("div");

    const isMe =
        message.username === currentUsername;

    div.className =
        isMe
            ? "message me"
            : "message other";

    const date =
        new Date(message.created_at);

    const time =
        date.toLocaleTimeString(
            "fr-FR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    div.innerHTML = `

        <div>

            ${
                !isMe
                    ? `<div class="message-name">
                        ${escapeHTML(message.username)}
                       </div>`
                    : ""
            }

            <div class="bubble">
                ${escapeHTML(message.content)}
            </div>

            <small class="time">
                ${time}
            </small>

        </div>
    `;

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;
}


// ===============================
// ENVOYER UN MESSAGE
// ===============================

messageForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const text =
            messageInput.value.trim();

        if (!text) {
            return;
        }

        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            return;
        }

        const username =
            user.email.split("@")[0];

        const {
            error
        } = await supabaseClient
            .from("messages")
            .insert({
                username: username,
                content: text
            });

        if (error) {

            console.error(
                "Erreur envoi :",
                error
            );

            alert(
                "Impossible d'envoyer le message."
            );

            return;
        }

        messageInput.value = "";
    }
);


// ===============================
// TEMPS RÉEL
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
        function (payload) {

            displayMessage(payload.new);
        }
    )
    .subscribe();


// ===============================
// PROTECTION HTML
// ===============================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}
