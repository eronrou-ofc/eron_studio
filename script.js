
// ===============================
// SUPABASE
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
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");

const authButton = document.getElementById("authButton");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");

const switchAuth = document.getElementById("switchAuth");
const switchText = document.getElementById("switchText");

const usernameDisplay = document.getElementById("usernameDisplay");
const userAvatar = document.getElementById("userAvatar");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");


// ===============================
// MODE
// ===============================

let signupMode = false;


// ===============================
// CHANGER CONNEXION / INSCRIPTION
// ===============================

switchAuth.addEventListener("click", () => {

    signupMode = !signupMode;

    authMessage.textContent = "";

    passwordInput.value = "";

    if (signupMode) {

        authTitle.textContent =
            "Crée ton compte";

        authButton.textContent =
            "Créer mon compte";

        switchText.textContent =
            "Déjà un compte ?";

        switchAuth.textContent =
            "Se connecter";

    } else {

        authTitle.textContent =
            "Connecte-toi à ton espace";

        authButton.textContent =
            "Se connecter";

        switchText.textContent =
            "Pas encore de compte ?";

        switchAuth.textContent =
            "Créer un compte";
    }
});


// ===============================
// CONNEXION / INSCRIPTION
// ===============================

authForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username =
        usernameInput.value.trim().toLowerCase();

    const password =
        passwordInput.value;

    if (username.length < 3) {

        authMessage.textContent =
            "❌ Le pseudo doit avoir au moins 3 caractères.";

        return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {

        authMessage.textContent =
            "❌ Utilise seulement lettres, chiffres, . _ ou -";

        return;
    }

    if (password.length < 6) {

        authMessage.textContent =
            "❌ Le mot de passe doit avoir au moins 6 caractères.";

        return;
    }


    authButton.disabled = true;

    authButton.textContent =
        signupMode
            ? "Création..."
            : "Connexion...";


    const email =
        username + "@monchat.local";


    // ===============================
    // INSCRIPTION
    // ===============================

    if (signupMode) {

        const {
            data,
            error
        } = await supabaseClient.auth.signUp({

            email: email,

            password: password

        });


        if (error) {

            authMessage.textContent =
                "❌ " + error.message;

            resetButton();

            return;
        }


        if (!data.user) {

            authMessage.textContent =
                "❌ Impossible de créer le compte.";

            resetButton();

            return;
        }


        // Créer le profil

        const {
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .insert({

                id: data.user.id,

                username: username

            });


        if (profileError) {

            console.error(profileError);

            authMessage.textContent =
                "❌ Compte créé mais profil impossible à créer.";

            resetButton();

            return;
        }


        authMessage.textContent =
            "✅ Compte créé !";


        await showChat();

        return;
    }


    // ===============================
    // CONNEXION
    // ===============================

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

    });


    if (error) {

        authMessage.textContent =
            "❌ Pseudo ou mot de passe incorrect.";

        resetButton();

        return;
    }


    if (data.user) {

        await showChat();
    }

});


// ===============================
// BOUTON
// ===============================

function resetButton() {

    authButton.disabled = false;

    authButton.textContent =
        signupMode
            ? "Créer mon compte"
            : "Se connecter";
}


// ===============================
// AFFICHER LE CHAT
// ===============================

async function showChat() {

    authScreen.style.display =
        "none";

    chatApp.style.display =
        "flex";


    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    if (!user) {
        return;
    }


    const {
        data: profile
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();


    let username =
        profile?.username;


    if (!username) {

        username =
            user.email.split("@")[0];
    }


    usernameDisplay.textContent =
        username;

    userAvatar.textContent =
        username.charAt(0).toUpperCase();


    await loadMessages();
}


// ===============================
// SESSION
// ===============================

async function checkSession() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();


    if (session) {

        await showChat();

    } else {

        authScreen.style.display =
            "flex";

        chatApp.style.display =
            "none";
    }
}


checkSession();


// ===============================
// CHARGER MESSAGES
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
            "Erreur messages :",
            error
        );

        return;
    }


    messages.innerHTML = "";

    data.forEach(displayMessage);
}


// ===============================
// AFFICHER MESSAGE
// ===============================

async function displayMessage(message) {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    let currentUsername = "";


    if (user) {

        const {
            data: profile
        } = await supabaseClient
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();


        currentUsername =
            profile?.username || "";
    }


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
                    ? `
                        <div class="message-name">
                            ${escapeHTML(message.username)}
                        </div>
                    `
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
// ENVOYER MESSAGE
// ===============================

messageForm.addEventListener(
    "submit",
    async (event) => {

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

            alert(
                "Tu dois être connecté."
            );

            return;
        }


        const {
            data: profile
        } = await supabaseClient
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();


        const username =
            profile?.username;


        if (!username) {

            alert(
                "Profil introuvable."
            );

            return;
        }


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

        (payload) => {

            displayMessage(
                payload.new
            );
        }
    )
    .subscribe();


// ===============================
// PROTECTION HTML
// ===============================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;
}
