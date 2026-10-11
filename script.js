
/* =========================================
   MONCHAT — CONFIGURATION SUPABASE
   ========================================= */

const SUPABASE_URL = "https://gyjonweumwmlvfvcksjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VbxuB8dM6XPJgK8xR3N2dA_S3b60VCk";

if (!window.supabase) {
    throw new Error("Supabase n'est pas chargé. Vérifie le script CDN dans index.html.");
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =========================================
   ELEMENTS HTML
   ========================================= */

const $ = (id) => document.getElementById(id);

const authScreen = $("authScreen");
const chatApp = $("chatApp");
const authForm = $("authForm");
const usernameInput = $("usernameInput");
const passwordInput = $("passwordInput");
const authButton = $("authButton");
const authMessage = $("authMessage");
const switchAuth = $("switchAuth");
const switchText = $("switchText");
const authTitle = $("authTitle");
const usernameDisplay = $("usernameDisplay");
const userAvatar = $("userAvatar");
const userSearch = $("userSearch");
const searchResults = $("searchResults");
const conversations = $("conversations");
const logoutButton = $("logoutButton");
const chatTitle = $("chatTitle");
const chatStatus = $("chatStatus");
const messagesContainer = $("messages");
const emptyChat = $("emptyChat");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const sendButton = document.querySelector(".send");

const requiredElements = {
    authScreen, chatApp, authForm, usernameInput,
    passwordInput, authButton, authMessage, switchAuth,
    switchText, authTitle, usernameDisplay, userAvatar,
    userSearch, searchResults, conversations, logoutButton,
    chatTitle, chatStatus, messagesContainer, messageForm,
    messageInput, sendButton
};

for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
        console.error(`Élément HTML introuvable : ${name}`);
    }
}

/* =========================================
   ETAT DE L'APPLICATION
   ========================================= */

let isSignup = false;
let currentUser = null;
let currentProfile = null;
let selectedUser = null;
let realtimeChannel = null;
let searchTimeout = null;
let conversationRequest = 0;
let loadingMessages = false;
let authRequestInProgress = false;

const displayedMessageIds = new Set();

function setAuthMessage(message) {
    authMessage.textContent = message;
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function scrollMessages() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showEmptyMessage(title, description, icon = "💬") {
    messagesContainer.replaceChildren();

    const box = document.createElement("div");
    box.className = "empty-chat";

    const emoji = document.createElement("div");
    emoji.className = "empty-icon";
    emoji.textContent = icon;

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    box.append(emoji, heading, paragraph);
    messagesContainer.appendChild(box);
}

function showError(error, context) {
    console.error(`[MonChat] ${context}`, error);

    return error?.message || "Une erreur est survenue. Réessaie.";
}

/* =========================================
   INSCRIPTION / CONNEXION
   ========================================= */

switchAuth.addEventListener("click", () => {
    isSignup = !isSignup;
    setAuthMessage("");

    authTitle.textContent = isSignup
        ? "Crée ton compte MonChat"
        : "Connecte-toi à ton espace";

    authButton.textContent = isSignup
        ? "Créer mon compte"
        : "Se connecter";

    switchText.textContent = isSignup
        ? "Déjà un compte ?"
        : "Pas encore de compte ?";

    switchAuth.textContent = isSignup
        ? "Se connecter"
        : "Créer un compte";
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (authRequestInProgress) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    setAuthMessage("");

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        setAuthMessage("Pseudo invalide : lettres, chiffres, _ . et - uniquement.");
        return;
    }

    if (username.length < 3 || username.length > 20) {
        setAuthMessage("Le pseudo doit contenir entre 3 et 20 caractères.");
        return;
    }

    if (password.length < 6) {
        setAuthMessage("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    authRequestInProgress = true;
    authButton.disabled = true;
    authButton.textContent = isSignup ? "CRÉATION..." : "CONNEXION...";

    // Conserve la méthode de connexion utilisée par ton code actuel.
    // Pour un vrai site public, préfère une adresse e-mail vérifiable.
    const email = `${username.toLowerCase()}@monchat.local`;

    try {
        if (isSignup) {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });

            if (error) throw error;
            if (!data.user) throw new Error("Impossible de créer le compte.");

            // Avec la confirmation par e-mail activée, la session
            // peut être absente jusqu'à la confirmation.
            if (!data.session) {
                setAuthMessage(
                    "Compte créé. Si la confirmation par e-mail est activée, " +
                    "configure une adresse e-mail valide avant de continuer."
                );
                return;
            }

            const { error: profileError } = await supabaseClient
                .from("profiles")
                .upsert(
                    {
                        id: data.user.id,
                        username
                    },
                    { onConflict: "id" }
                );

            if (profileError) throw profileError;

            await showChat();
        } else {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            await showChat();
        }
    } catch (error) {
        setAuthMessage(showError(error, "Authentification"));
    } finally {
        authRequestInProgress = false;
        authButton.disabled = false;
        authButton.textContent = isSignup
            ? "Créer mon compte"
            : "Se connecter";
    }
});

/* =========================================
   SESSION
   ========================================= */

async function checkSession() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data.session) {
            await showChat();
        } else {
            authScreen.style.display = "flex";
            chatApp.style.display = "none";
        }
    } catch (error) {
        showError(error, "Vérification de session");
        authScreen.style.display = "flex";
        chatApp.style.display = "none";
        setAuthMessage("Impossible de vérifier la session. Recharge la page.");
    }
}

/* =========================================
   AFFICHER L'APPLICATION
   ========================================= */

async function showChat() {
    try {
        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError) throw userError;
        if (!userData.user) throw new Error("Aucun utilisateur connecté.");

        currentUser = userData.user;

        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("id, username")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) throw error;

        // Crée le profil s'il n'existe pas encore.
        if (!profile) {
            const username =
                currentUser.user_metadata?.username ||
                currentUser.email?.split("@")[0] ||
                "Utilisateur";

            const { data: newProfile, error: insertError } =
                await supabaseClient
                    .from("profiles")
                    .insert({
                        id: currentUser.id,
                        username
                    })
                    .select("id, username")
                    .single();

            if (insertError) throw insertError;
            currentProfile = newProfile;
        } else {
            currentProfile = profile;
        }

        usernameDisplay.textContent = currentProfile.username;
        userAvatar.textContent =
            currentProfile.username.charAt(0).toUpperCase();

        authScreen.style.display = "none";
        chatApp.style.display = "flex";

        setupCallUI();
        setupCallSignaling();

        await loadConversations();
    } catch (error) {
        setAuthMessage(showError(error, "Chargement du profil"));
        authScreen.style.display = "flex";
        chatApp.style.display = "none";
    }
}

/* =========================================
   DÉCONNEXION
   ========================================= */

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        conversationRequest++;

        if (realtimeChannel) {
            await supabaseClient.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        if (callState.status !== "idle") await finishCall(false);
        if (callSignalChannel) {
            await supabaseClient.removeChannel(callSignalChannel);
            callSignalChannel = null;
        }

        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        currentUser = null;
        currentProfile = null;
        selectedUser = null;
        displayedMessageIds.clear();

        chatApp.style.display = "none";
        authScreen.style.display = "flex";

        usernameInput.value = "";
        passwordInput.value = "";
        userSearch.value = "";
        messageInput.value = "";
        messageInput.disabled = true;
        sendButton.disabled = true;

        searchResults.replaceChildren();
        conversations.replaceChildren();

        chatTitle.textContent = "Sélectionne une conversation";
        chatStatus.textContent = "";

        showEmptyMessage(
            "Tes conversations",
            "Recherche un utilisateur pour commencer à discuter."
        );

        setAuthMessage("");
    } catch (error) {
        setAuthMessage(showError(error, "Déconnexion"));
    } finally {
        logoutButton.disabled = false;
    }
});

/* =========================================
   RECHERCHE D'UTILISATEURS
   ========================================= */

userSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    const query = userSearch.value.trim();

    if (!query) {
        searchResults.replaceChildren();
        return;
    }

    searchTimeout = setTimeout(() => searchUsers(query), 300);
});

async function searchUsers(query) {
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, username")
            .ilike("username", `%${query}%`)
            .neq("id", currentUser.id)
            .limit(20);

        if (error) throw error;

        // Évite qu'une ancienne recherche remplace les résultats récents.
        if (userSearch.value.trim() !== query) return;

        searchResults.replaceChildren();

        if (!data || data.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:10px;color:#888;font-size:12px;";
            empty.textContent = "Aucun utilisateur trouvé.";
            searchResults.appendChild(empty);
            return;
        }

        data.forEach((user) => {
            const item = document.createElement("div");
            item.className = "user-result";

            const avatar = document.createElement("div");
            avatar.className = "avatar";
            avatar.textContent = user.username.charAt(0).toUpperCase();

            const details = document.createElement("div");

            const name = document.createElement("div");
            name.className = "user-result-name";
            name.textContent = user.username;

            const status = document.createElement("span");
            status.className = "user-result-status";
            status.textContent = "Utilisateur MonChat";

            details.append(name, status);
            item.append(avatar, details);

            item.addEventListener("click", () => openConversation(user));

            searchResults.appendChild(item);
        });
    } catch (error) {
        showError(error, "Recherche d'utilisateurs");
    }
}

/* =========================================
   OUVRIR UNE CONVERSATION
   ========================================= */

async function openConversation(user) {
    if (!currentUser || !user || user.id === currentUser.id) return;

    const requestId = ++conversationRequest;

    selectedUser = user;
    displayedMessageIds.clear();

    chatTitle.textContent = user.username;
    chatStatus.textContent = "🟢 Conversation privée";
    setupCallUI();
    refreshCallButtons();

    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.placeholder = `Écris à ${user.username}...`;

    searchResults.replaceChildren();
    userSearch.value = "";

    showEmptyMessage("Chargement...", "Récupération des messages.");

    // Retire l'ancien abonnement avant d'en créer un nouveau.
    if (realtimeChannel) {
        const oldChannel = realtimeChannel;
        realtimeChannel = null;
        await supabaseClient.removeChannel(oldChannel);
    }

    if (requestId !== conversationRequest || !selectedUser) return;

    subscribeToPrivateMessages(requestId);
    await loadPrivateMessages(requestId);
    await loadConversations();
}

/* =========================================
   CHARGER LES MESSAGES PRIVÉS
   ========================================= */

async function loadPrivateMessages(requestId = conversationRequest) {
    if (!currentUser || !selectedUser) return;

    loadingMessages = true;

    const userAtStart = selectedUser.id;

    try {
        const { data, error } = await supabaseClient
            .from("private_messages")
            .select("id, sender_id, receiver_id, content, created_at")
            .or(
                `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userAtStart}),` +
                `and(sender_id.eq.${userAtStart},receiver_id.eq.${currentUser.id})`
            )
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (
            requestId !== conversationRequest ||
            selectedUser?.id !== userAtStart
        ) return;

        messagesContainer.replaceChildren();
        displayedMessageIds.clear();

        if (!data || data.length === 0) {
            showEmptyMessage(
                "Nouvelle conversation",
                `Envoie ton premier message à ${selectedUser.username}.`,
                "👋"
            );
        } else {
            data.forEach(displayPrivateMessage);
            scrollMessages();
        }
    } catch (error) {
        showError(error, "Chargement des messages");
        if (requestId === conversationRequest) {
            showEmptyMessage("Erreur", "Impossible de charger les messages.");
        }
    } finally {
        loadingMessages = false;
    }
}

/* =========================================
   AFFICHER UN MESSAGE
   ========================================= */

function displayPrivateMessage(message) {
    if (!message || !currentUser) return;

    // Supabase fournit normalement un ID à chaque ligne.
    // On l'utilise pour empêcher les doublons Realtime.
    if (message.id && displayedMessageIds.has(message.id)) return;

    if (message.id) displayedMessageIds.add(message.id);

    const div = document.createElement("div");
    div.className = "private-message";

    if (message.sender_id === currentUser.id) {
        div.classList.add("me");
    }

    const bubble = document.createElement("div");
    bubble.className = "private-bubble";
    bubble.textContent = message.content ?? "";

    div.appendChild(bubble);
    messagesContainer.appendChild(div);
}

/* =========================================
   ENVOYER UN MESSAGE PRIVÉ
   ========================================= */

messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !selectedUser || sendButton.disabled) return;

    const content = messageInput.value.trim();
    if (!content) return;

    const receiverId = selectedUser.id;

    sendButton.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("private_messages")
            .insert({
                sender_id: currentUser.id,
                receiver_id: receiverId,
                content
            });

        if (error) throw error;

        // Efface le champ seulement si l'envoi a réussi.
        if (selectedUser?.id === receiverId) {
            messageInput.value = "";
            messageInput.focus();
        }
    } catch (error) {
        showError(error, "Envoi du message");
        alert("Le message n'a pas pu être envoyé. Vérifie ta connexion.");
    } finally {
        sendButton.disabled = !selectedUser || !currentUser;
    }
});

/* =========================================
   MESSAGES EN TEMPS RÉEL
   ========================================= */

function subscribeToPrivateMessages(requestId) {
    if (!currentUser || !selectedUser) return;

    const myId = currentUser.id;

    realtimeChannel = supabaseClient
        .channel(`private-chat-${myId}-${selectedUser.id}-${requestId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "private_messages"
            },
            (payload) => {
                // Ignore les événements d'un ancien canal.
                if (
                    requestId !== conversationRequest ||
                    !selectedUser ||
                    currentUser?.id !== myId
                ) return;

                const message = payload.new;

                const belongsToConversation =
                    (
                        message.sender_id === myId &&
                        message.receiver_id === selectedUser.id
                    ) ||
                    (
                        message.sender_id === selectedUser.id &&
                        message.receiver_id === myId
                    );

                if (belongsToConversation) {
                    const empty = messagesContainer.querySelector(".empty-chat");
                    if (empty) empty.remove();

                    displayPrivateMessage(message);
                    scrollMessages();
                }

                loadConversations();
            }
        )
        .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                console.error("Abonnement Realtime :", status);
            }
        });
}

/* =========================================
   LISTE DES CONVERSATIONS
   ========================================= */

async function loadConversations() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from("private_messages")
            .select("sender_id, receiver_id, created_at")
            .or(
                `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
            )
            .order("created_at", { ascending: false });

        if (error) throw error;

        const userIds = [];
        const seen = new Set();

        (data || []).forEach((message) => {
            const otherId = message.sender_id === currentUser.id
                ? message.receiver_id
                : message.sender_id;

            if (otherId && !seen.has(otherId)) {
                seen.add(otherId);
                userIds.push(otherId);
            }
        });

        conversations.replaceChildren();

        if (userIds.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:10px;color:#888;font-size:12px;";
            empty.textContent = "Aucune conversation.";
            conversations.appendChild(empty);
            return;
        }

        const { data: profiles, error: profilesError } = await supabaseClient
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesById = new Map(
            (profiles || []).map((profile) => [profile.id, profile])
        );

        userIds.forEach((id) => {
            const profile = profilesById.get(id);
            if (!profile) return;

            const item = document.createElement("div");
            item.className = "conversation";

            if (selectedUser?.id === profile.id) {
                item.classList.add("active");
            }

            const avatar = document.createElement("div");
            avatar.className = "avatar";
            avatar.textContent = profile.username.charAt(0).toUpperCase();

            const name = document.createElement("div");
            name.className = "conversation-name";
            name.textContent = profile.username;

            item.append(avatar, name);
            item.addEventListener("click", () => openConversation(profile));

            conversations.appendChild(item);
        });
    } catch (error) {
        showError(error, "Chargement des conversations");
    }
}

/* =========================================
   AUTHENTIFICATION : CHANGEMENTS DE SESSION
   ========================================= */

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        currentUser = null;
        currentProfile = null;
        selectedUser = null;

        authScreen.style.display = "flex";
        chatApp.style.display = "none";
    }
});

/* =========================================
   PARTICULES CYBERPUNK
   ========================================= */

const canvas = $("particles");

if (canvas) {
    const ctx = canvas.getContext("2d");

    if (ctx) {
        let particles = [];
        let animationFrame = null;

        function resizeParticles() {
            const parent = canvas.parentElement;
            if (!parent) return;

            const rect = parent.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = Math.max(1, Math.round(rect.width * dpr));
            canvas.height = Math.max(1, Math.round(rect.height * dpr));

            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            createParticles();
        }

        function createParticles() {
            const width = canvas.parentElement?.clientWidth || 0;
            const height = canvas.parentElement?.clientHeight || 0;

            const count = Math.min(
                100,
                Math.max(45, Math.floor(width / 15))
            );

            particles = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.7 + 0.6,
                speedX: (Math.random() - 0.5) * 0.35,
                speedY: (Math.random() - 0.5) * 0.35
            }));
        }

        function animateParticles() {
            const width = canvas.parentElement?.clientWidth || 0;
            const height = canvas.parentElement?.clientHeight || 0;

            ctx.clearRect(0, 0, width, height);

            particles.forEach((p) => {
                p.x += p.speedX;
                p.y += p.speedY;

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.75)";
                ctx.fill();
            });

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p1 = particles[i];
                    const p2 = particles[j];

                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 120) {
                        const opacity = (1 - distance / 120) * 0.18;

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }

            animationFrame = requestAnimationFrame(animateParticles);
        }

        resizeParticles();
        animateParticles();

        window.addEventListener("resize", resizeParticles);

        // Réduit l'activité lorsque l'onglet est masqué.
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                cancelAnimationFrame(animationFrame);
            } else {
                cancelAnimationFrame(animationFrame);
                animateParticles();
            }
        });
    }
}



/* =========================================
   MONCHAT — APPELS AUDIO / VIDÉO (WebRTC)
   Nécessite la table call_signals décrite dans le SQL fourni.
   ========================================= */

let callUIReady = false;
let callSignalChannel = null;
let callState = {
    status: "idle", // idle | outgoing | incoming | connecting | active
    callId: null,
    peer: null,
    type: "audio",
    pc: null,
    localStream: null,
    remoteStream: null,
    pendingIce: [],
    micEnabled: true,
    cameraEnabled: true
};

function setupCallUI() {
    const header = document.querySelector(".chat-header");
    if (!header) return;

    if (!callUIReady) {
        const style = document.createElement("style");
        style.id = "monchat-call-styles";
        style.textContent = `
          .monchat-call-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
          .monchat-call-button{width:40px;height:40px;border:1px solid #303030;border-radius:12px;background:#171717;color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
          .monchat-call-button:hover{background:#292929}
          .monchat-call-button:disabled{opacity:.35;cursor:not-allowed}
          .monchat-call-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:16px}
          .monchat-call-panel{width:min(620px,100%);background:#111;border:1px solid #303030;border-radius:22px;padding:20px;color:#fff;box-shadow:0 20px 80px #0009;font-family:inherit}
          .monchat-call-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
          .monchat-call-title{font-size:20px;font-weight:700}.monchat-call-status{font-size:13px;color:#aaa;margin-top:5px}
          .monchat-call-videos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
          .monchat-call-videos video{width:100%;aspect-ratio:4/3;background:#050505;object-fit:cover;border-radius:14px}
          .monchat-call-videos.audio-mode{display:none}
          .monchat-call-avatar{display:flex;align-items:center;justify-content:center;min-height:190px;background:#1c1c1c;border-radius:14px;font-size:58px;margin-bottom:12px}
          .monchat-call-controls{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:16px}
          .monchat-call-control{border:0;border-radius:999px;padding:12px 17px;background:#292929;color:#fff;cursor:pointer;font-size:14px}
          .monchat-call-control:disabled{opacity:.4;cursor:not-allowed}
          .monchat-call-control.accept{background:#16834a}.monchat-call-control.hangup{background:#c83232}
          @media(max-width:520px){.monchat-call-videos{grid-template-columns:1fr}.monchat-call-videos video{aspect-ratio:16/9}.monchat-call-panel{padding:14px}}
        `;
        document.head.appendChild(style);

        const actions = document.createElement("div");
        actions.className = "monchat-call-actions";
        actions.innerHTML = `
          <button type="button" class="monchat-call-button" id="startAudioCall" title="Appel audio" aria-label="Appel audio">📞</button>
          <button type="button" class="monchat-call-button" id="startVideoCall" title="Appel vidéo" aria-label="Appel vidéo">📹</button>`;
        const menu = header.querySelector(".menu-button");
        if (menu) header.insertBefore(actions, menu);
        else header.appendChild(actions);

        const overlay = document.createElement("div");
        overlay.id = "monchatCallOverlay";
        overlay.className = "monchat-call-overlay";
        overlay.style.display = "none";
        overlay.innerHTML = `
          <section class="monchat-call-panel" role="dialog" aria-modal="true" aria-labelledby="monchatCallTitle">
            <div class="monchat-call-top">
              <div>
                <div class="monchat-call-title" id="monchatCallTitle">Appel MonChat</div>
                <div class="monchat-call-status" id="monchatCallStatus">En attente…</div>
              </div>
              <button type="button" class="monchat-call-button" id="closeCallPanel" aria-label="Fermer">✕</button>
            </div>
            <div class="monchat-call-avatar" id="monchatCallAvatar">👤</div>
            <div class="monchat-call-videos" id="monchatCallVideos">
              <video id="monchatLocalVideo" autoplay playsinline muted></video>
              <video id="monchatRemoteVideo" autoplay playsinline></video>
            </div>
            <div class="monchat-call-controls" id="monchatCallControls">
              <button type="button" class="monchat-call-control accept" id="acceptCallButton">Accepter</button>
              <button type="button" class="monchat-call-control hangup" id="declineCallButton">Refuser</button>
              <button type="button" class="monchat-call-control" id="toggleMicButton" hidden>🎙️ Micro</button>
              <button type="button" class="monchat-call-control" id="toggleCameraButton" hidden>📷 Caméra</button>
              <button type="button" class="monchat-call-control hangup" id="hangupCallButton" hidden>Raccrocher</button>
            </div>
          </section>`;
        document.body.appendChild(overlay);

        $("startAudioCall").addEventListener("click", () => beginOutgoingCall("audio"));
        $("startVideoCall").addEventListener("click", () => beginOutgoingCall("video"));
        $("acceptCallButton").addEventListener("click", acceptIncomingCall);
        $("declineCallButton").addEventListener("click", () => finishCall(true, "Appel refusé."));
        $("hangupCallButton").addEventListener("click", () => finishCall(true, "Appel terminé."));
        $("closeCallPanel").addEventListener("click", () => {
            if (callState.status !== "idle") finishCall(true, "Appel terminé.");
            else hideCallPanel();
        });
        $("toggleMicButton").addEventListener("click", toggleCallMicrophone);
        $("toggleCameraButton").addEventListener("click", toggleCallCamera);
        callUIReady = true;
    }

    const enabled = Boolean(currentUser && selectedUser && selectedUser.id !== currentUser.id && callState.status === "idle");
    $("startAudioCall").disabled = !enabled;
    $("startVideoCall").disabled = !enabled;
}

function showCallPanel(title, status, mode = "audio") {
    setupCallUI();
    $("monchatCallOverlay").style.display = "flex";
    $("monchatCallTitle").textContent = title;
    $("monchatCallStatus").textContent = status;
    $("monchatCallVideos").style.display = mode === "video" ? "grid" : "none";
    $("monchatCallAvatar").style.display = mode === "video" ? "none" : "flex";
    $("acceptCallButton").hidden = callState.status !== "incoming";
    $("declineCallButton").hidden = !["incoming", "outgoing"].includes(callState.status);
    $("hangupCallButton").hidden = !["connecting", "active"].includes(callState.status);
    $("toggleMicButton").hidden = !["connecting", "active"].includes(callState.status);
    $("toggleCameraButton").hidden = mode !== "video" || !["connecting", "active"].includes(callState.status);
    setupCallUI();
}

function hideCallPanel() {
    const overlay = $("monchatCallOverlay");
    if (overlay) overlay.style.display = "none";
}

function refreshCallButtons() {
    if ($("startAudioCall")) {
        const enabled = Boolean(currentUser && selectedUser && callState.status === "idle");
        $("startAudioCall").disabled = !enabled;
        $("startVideoCall").disabled = !enabled;
    }
}

async function setupCallSignaling() {
    if (!currentUser || !window.supabase) return;
    if (callSignalChannel) {
        await supabaseClient.removeChannel(callSignalChannel);
        callSignalChannel = null;
    }

    const myId = currentUser.id;
    callSignalChannel = supabaseClient
        .channel(`monchat-call-signals-${myId}`)
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: `receiver_id=eq.${myId}`
        }, async (payload) => {
            if (currentUser?.id !== myId) return;
            await handleCallSignal(payload.new);
        })
        .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                console.error("[MonChat] Signalisation des appels :", status);
            }
        });
}

async function sendCallSignal(receiverId, callId, type, data = {}) {
    if (!currentUser || !receiverId) throw new Error("Utilisateur non connecté.");
    const { error } = await supabaseClient.from("call_signals").insert({
        call_id: callId,
        sender_id: currentUser.id,
        receiver_id: receiverId,
        type,
        payload: data
    });
    if (error) throw error;
}

async function beginOutgoingCall(type) {
    if (!currentUser || !selectedUser || callState.status !== "idle") return;
    const peer = { id: selectedUser.id, username: selectedUser.username };
    callState = {
        status: "outgoing",
        callId: crypto.randomUUID(),
        peer,
        type,
        pc: null,
        localStream: null,
        remoteStream: null,
        pendingIce: [],
        micEnabled: true,
        cameraEnabled: true
    };
    refreshCallButtons();
    showCallPanel(`Appel ${type === "video" ? "vidéo" : "audio"} vers ${peer.username}`,
        "Appel en cours…", type);
    try {
        await sendCallSignal(peer.id, callState.callId, "invite", {
            callType: type,
            callerName: currentProfile?.username || "Utilisateur"
        });
        $("monchatCallStatus").textContent = `Appel envoyé à ${peer.username}…`;
    } catch (error) {
        alert("Impossible de lancer l'appel. Vérifie la configuration SQL des appels dans Supabase.");
        console.error("[MonChat] Appel sortant :", error);
        await finishCall(false);
    }
}

async function handleCallSignal(signal) {
    if (!signal || !currentUser || signal.sender_id === currentUser.id) return;

    const activeId = callState.callId;
    if (signal.type === "invite") {
        if (callState.status !== "idle") {
            try {
                await sendCallSignal(signal.sender_id, signal.call_id, "busy", {});
            } catch (error) { console.warn(error); }
            return;
        }
        const { data: profile } = await supabaseClient
            .from("profiles").select("id, username").eq("id", signal.sender_id).maybeSingle();
        callState = {
            status: "incoming",
            callId: signal.call_id,
            peer: { id: signal.sender_id, username: profile?.username || signal.payload?.callerName || "Utilisateur" },
            type: signal.payload?.callType === "video" ? "video" : "audio",
            pc: null, localStream: null, remoteStream: null, pendingIce: [],
            micEnabled: true, cameraEnabled: true
        };
        refreshCallButtons();
        showCallPanel(`Appel entrant de ${callState.peer.username}`,
            `${callState.type === "video" ? "Appel vidéo" : "Appel audio"} entrant`, callState.type);
        return;
    }

    if (!activeId || signal.call_id !== activeId || !callState.peer || signal.sender_id !== callState.peer.id) return;

    try {
        if (signal.type === "accept" && callState.status === "outgoing") {
            callState.status = "connecting";
            await prepareLocalMedia();
            createCallPeerConnection();
            const offer = await callState.pc.createOffer();
            await callState.pc.setLocalDescription(offer);
            await sendCallSignal(callState.peer.id, callState.callId, "offer", { description: callState.pc.localDescription });
            showCallPanel(`Appel avec ${callState.peer.username}`, "Connexion…", callState.type);
        } else if (signal.type === "reject" || signal.type === "busy") {
            const peerName = callState.peer?.username || "L'utilisateur";
            await finishCall(false);
            alert(signal.type === "busy" ? `${peerName} est déjà en appel.` : "L'appel a été refusé.");
        } else if (signal.type === "offer" && callState.status === "connecting" && callState.pc) {
            await callState.pc.setRemoteDescription(new RTCSessionDescription(signal.payload.description));
            for (const candidate of callState.pendingIce.splice(0)) {
                await callState.pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            const answer = await callState.pc.createAnswer();
            await callState.pc.setLocalDescription(answer);
            await sendCallSignal(callState.peer.id, callState.callId, "answer", { description: callState.pc.localDescription });
        } else if (signal.type === "answer" && callState.pc) {
            await callState.pc.setRemoteDescription(new RTCSessionDescription(signal.payload.description));
            for (const candidate of callState.pendingIce.splice(0)) {
                await callState.pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } else if (signal.type === "ice" && callState.pc && signal.payload?.candidate) {
            if (callState.pc.remoteDescription) {
                await callState.pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
            } else {
                callState.pendingIce.push(signal.payload.candidate);
            }
        } else if (signal.type === "end") {
            await finishCall(false);
        }
    } catch (error) {
        console.error("[MonChat] Erreur de connexion WebRTC :", error);
        alert("La connexion d'appel a échoué. Vérifie les autorisations du micro/caméra et la configuration TURN si nécessaire.");
        await finishCall(true, "Connexion échouée.");
    }
}

async function acceptIncomingCall() {
    if (callState.status !== "incoming" || !callState.peer) return;
    try {
        callState.status = "connecting";
        await prepareLocalMedia();
        createCallPeerConnection();
        showCallPanel(`Appel avec ${callState.peer.username}`, "Connexion…", callState.type);
        await sendCallSignal(callState.peer.id, callState.callId, "accept", {});
    } catch (error) {
        console.error("[MonChat] Autorisation média :", error);
        alert("Impossible d'accéder au micro ou à la caméra. Autorise l'accès dans ton navigateur puis réessaie.");
        await finishCall(true, "Accès au micro/caméra impossible.");
    }
}

async function prepareLocalMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Les appels nécessitent HTTPS ou localhost et un navigateur compatible.");
    }
    callState.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callState.type === "video"
    });
    const localVideo = $("monchatLocalVideo");
    localVideo.srcObject = callState.localStream;
}

function createCallPeerConnection() {
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    });
    callState.pc = pc;
    callState.remoteStream = new MediaStream();

    callState.localStream.getTracks().forEach(track => pc.addTrack(track, callState.localStream));
    $("monchatRemoteVideo").srcObject = callState.remoteStream;

    pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach(track => callState.remoteStream.addTrack(track));
        $("monchatRemoteVideo").srcObject = callState.remoteStream;
        $("monchatCallStatus").textContent = "Appel connecté";
        callState.status = "active";
        showCallPanel(`Appel avec ${callState.peer.username}`, "Appel connecté", callState.type);
    };

    pc.onicecandidate = async (event) => {
        if (!event.candidate || !callState.peer || !callState.callId) return;
        try {
            await sendCallSignal(callState.peer.id, callState.callId, "ice", {
                candidate: event.candidate.toJSON()
            });
        } catch (error) {
            console.warn("[MonChat] Impossible d'envoyer ICE :", error);
        }
    };

    pc.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(pc.connectionState)) {
            $("monchatCallStatus").textContent = "Connexion interrompue…";
        }
    };
}

async function toggleCallMicrophone() {
    const track = callState.localStream?.getAudioTracks()[0];
    if (!track) return;
    callState.micEnabled = !track.enabled;
    track.enabled = callState.micEnabled;
    $("toggleMicButton").textContent = callState.micEnabled ? "🎙️ Micro" : "🔇 Micro coupé";
}

async function toggleCallCamera() {
    const track = callState.localStream?.getVideoTracks()[0];
    if (!track) return;
    callState.cameraEnabled = !track.enabled;
    track.enabled = callState.cameraEnabled;
    $("toggleCameraButton").textContent = callState.cameraEnabled ? "📷 Caméra" : "🚫 Caméra coupée";
}

async function finishCall(notifyPeer = false, message = "") {
    const previous = callState;
    callState = {
        status: "idle", callId: null, peer: null, type: "audio",
        pc: null, localStream: null, remoteStream: null, pendingIce: [],
        micEnabled: true, cameraEnabled: true
    };

    if (notifyPeer && previous.peer && previous.callId && currentUser) {
        const signalType = previous.status === "incoming" ? "reject" : "end";
        try {
            await sendCallSignal(previous.peer.id, previous.callId, signalType, {});
        } catch (error) { console.warn("[MonChat] Fin d'appel :", error); }
    }
    try { previous.pc?.close(); } catch (_) {}
    previous.localStream?.getTracks().forEach(track => track.stop());
    if ($("monchatLocalVideo")) $("monchatLocalVideo").srcObject = null;
    if ($("monchatRemoteVideo")) $("monchatRemoteVideo").srcObject = null;
    hideCallPanel();
    refreshCallButtons();
    if (message) $("chatStatus").textContent = message;
}


/* =========================================
   DÉMARRAGE
   ========================================= */

checkSession();


/* =========================================
   MONCHAT — NAVIGATION MOBILE
   ========================================= */


/* MONCHAT — GARANTIR UN SEUL BOUTON */
function removeDuplicateNewChatButtons() {
    const buttons = document.querySelectorAll("#newDiscussionButton");

    buttons.forEach((button, index) => {
        if (index > 0) button.remove();
    });
}

removeDuplicateNewChatButtons();

const duplicateButtonObserver = new MutationObserver(() => {
    removeDuplicateNewChatButtons();
});

duplicateButtonObserver.observe(document.body, {
    childList: true,
    subtree: true
});
(function setupMobileNavigation() {
    const app = document.getElementById("chatApp");
    const newDiscussionButton =
        document.getElementById("newDiscussionButton");
    const backButton =
        document.getElementById("backToConversations");
    const searchInput =
        document.getElementById("userSearch");
    const searchResults =
        document.getElementById("searchResults");
    const conversationList =
        document.getElementById("conversations");
    const messages =
        document.getElementById("messages");

    if (
        !app ||
        !newDiscussionButton ||
        !backButton ||
        !searchInput ||
        !searchResults ||
        !conversationList ||
        !messages
    ) {
        console.error(
            "MonChat : un élément nécessaire à la navigation est introuvable."
        );
        return;
    }

    const isMobile = () =>
        window.matchMedia("(max-width: 700px)").matches;

    // Repérer les panneaux existants sans en créer de nouveaux.
    const sidebar = conversationList.closest(
        ".sidebar, .chat-sidebar, .conversations-sidebar"
    );

    const chatPanel = messages.closest(
        ".chat-main, .chat-panel, .chat-area, .chat-window"
    );

    sidebar?.classList.add("mobile-sidebar");
    chatPanel?.classList.add("mobile-chat-panel");

    // Le bouton déjà présent dans index.html ouvre la recherche.
    newDiscussionButton.addEventListener("click", () => {
        app.classList.remove("mobile-chat-open");
        searchInput.classList.add("mobile-search-visible");
        searchInput.focus();

        if (isMobile()) {
            searchInput.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    });

    // Retour à la liste des discussions.
    backButton.addEventListener("click", () => {
        app.classList.remove("mobile-chat-open");
    });

    // Ouvrir le panneau de discussion après avoir choisi un utilisateur.
    searchResults.addEventListener("click", (event) => {
        if (event.target.closest(".user-result") && isMobile()) {
            app.classList.add("mobile-chat-open");
        }
    });

    conversationList.addEventListener("click", (event) => {
        if (event.target.closest(".conversation") && isMobile()) {
            app.classList.add("mobile-chat-open");
        }
    });

    // Réinitialiser l'affichage mobile quand on repasse sur ordinateur.
    window.addEventListener("resize", () => {
        if (!isMobile()) {
            app.classList.remove("mobile-chat-open");
        }
    });
})();
/* =========================================================
   MONCHAT PLUS — fonctionnalités supplémentaires
   Ajouté au script existant : aucun changement du HTML requis.
   Requiert la migration SQL monchat_plus.sql.
   ========================================================= */
(() => {
  "use strict";
  const mcPlus = {
    group: null, typingChannel: null, groupChannel: null,
    presenceTimer: null, typingTimer: null, recording: false,
    recorder: null, chunks: [], reactionsChannel: null
  };
  const mcEl = id => document.getElementById(id);
  const mcStyle = `
    .mcplus-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #292929;background:#101010}
    .mcplus-btn{background:#202020;color:#eee;border:1px solid #383838;border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;font-size:13px}
    .mcplus-btn:hover{background:#303030}.mcplus-meta{font-size:11px;color:#999;margin-top:5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .mcplus-tools{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.mcplus-tools button,.mcplus-reactions button{font-size:11px;padding:3px 7px;border-radius:7px;background:#171717;color:#bbb;border:1px solid #333;cursor:pointer}
    .mcplus-reactions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.mcplus-reactions button{border-radius:14px}
    .mcplus-modal-bg{position:fixed;inset:0;background:#000b;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px}
    .mcplus-modal{box-sizing:border-box;width:min(440px,100%);max-height:85vh;overflow:auto;background:#151515;color:#eee;border:1px solid #333;border-radius:16px;padding:20px;box-shadow:0 20px 80px #0008}
    .mcplus-modal h3{margin-top:0}.mcplus-modal input,.mcplus-modal textarea{box-sizing:border-box;width:100%;padding:10px;margin:6px 0 12px;background:#090909;color:#eee;border:1px solid #444;border-radius:8px}
    .mcplus-modal label{font-size:12px;color:#bbb}.mcplus-modal-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
    .mcplus-section-label{font-size:10px;color:#9b9b9b;text-transform:uppercase;margin:12px 0 4px}.mcplus-typing{font-size:12px;color:#aaa;padding:3px 14px;min-height:16px}
    .mcplus-audio{max-width:min(280px,70vw);height:36px}.mcplus-file-img{max-width:min(280px,65vw);max-height:260px;border-radius:10px;display:block}
    body.mcplus-light{background:#f5f5f5;color:#151515}body.mcplus-light .app,body.mcplus-light .chat-area,body.mcplus-light .sidebar{background:#f7f7f7;color:#161616}
    body.mcplus-light .chat-header,body.mcplus-light .input-area,body.mcplus-light .mcplus-toolbar{background:#eee;color:#161616;border-color:#ddd}
    body.mcplus-light .private-bubble{background:#e4e4e4;color:#151515}body.mcplus-light .private-message.me .private-bubble{background:#ccebd7;color:#151515}
    @media(max-width:650px){.mcplus-toolbar{gap:5px;padding:7px}.mcplus-btn{padding:7px 8px;font-size:12px}}
  `;
  function mcToast(message) {
    let box = mcEl("mcplus-toast");
    if (!box) { box=document.createElement("div");box.id="mcplus-toast";box.style.cssText="position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:10001;background:#252525;color:#fff;padding:11px 16px;border:1px solid #444;border-radius:12px;box-shadow:0 8px 30px #0008;max-width:90vw;font-size:13px";document.body.appendChild(box); }
    box.textContent=message;box.style.display="block";clearTimeout(box._timer);box._timer=setTimeout(()=>box.style.display="none",3500);
  }
  function mcButton(label, handler, title="") { const b=document.createElement("button");b.type="button";b.className="mcplus-btn";b.textContent=label;b.title=title;b.addEventListener("click",handler);return b; }
  function mcModal(title, fields, saveHandler) {
    const bg=document.createElement("div");bg.className="mcplus-modal-bg";
    const form=document.createElement("form");form.className="mcplus-modal";
    const h=document.createElement("h3");h.textContent=title;form.appendChild(h);const controls={};
    fields.forEach(f=>{const l=document.createElement("label");l.textContent=f.label;form.appendChild(l);let el;
      if(f.type==="textarea")el=document.createElement("textarea");else{el=document.createElement("input");el.type=f.type||"text";}
      el.name=f.name;el.placeholder=f.placeholder||"";el.value=f.value||"";if(f.maxLength)el.maxLength=f.maxLength;if(f.required)el.required=true;form.appendChild(el);controls[f.name]=el;});
    const actions=document.createElement("div");actions.className="mcplus-modal-actions";const cancel=mcButton("Annuler",()=>bg.remove());const save=document.createElement("button");save.type="submit";save.className="mcplus-btn";save.textContent="Enregistrer";actions.append(cancel,save);form.appendChild(actions);bg.appendChild(form);document.body.appendChild(bg);
    form.addEventListener("submit",async e=>{e.preventDefault();save.disabled=true;try{await saveHandler(Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value.trim()])));bg.remove();}catch(err){console.error(err);mcToast(err?.message||"Une erreur est survenue.");}finally{save.disabled=false;}});
    bg.addEventListener("click",e=>{if(e.target===bg)bg.remove();});
  }
  function mcInject() {
    if(!mcEl("chatApp")||mcEl("mcplus-ui-ready"))return;
    const st=document.createElement("style");st.textContent=mcStyle+`
      .mcplus-menu{position:fixed;z-index:10000;min-width:210px;padding:6px;background:#171717;color:#f5f5f5;border:1px solid #383838;border-radius:13px;box-shadow:0 12px 35px #0008;display:flex;flex-direction:column;gap:3px}
      .mcplus-menu button{background:transparent;color:inherit;border:0;border-radius:8px;text-align:left;padding:11px 12px;font:inherit;font-size:14px;cursor:pointer}
      .mcplus-menu button:hover{background:#303030}
      .mcplus-menu .mcplus-menu-title{padding:7px 12px 5px;color:#999;font-size:11px;text-transform:uppercase}
      .mcplus-profile-click{cursor:pointer}
      body.mcplus-light .mcplus-menu{background:#fff;color:#181818;border-color:#ddd}
      body.mcplus-light .mcplus-menu button:hover{background:#eee}
    `;document.head.appendChild(st);
    const marker=document.createElement("span");marker.id="mcplus-ui-ready";marker.hidden=true;document.body.appendChild(marker);
    const file=document.createElement("input");file.type="file";file.id="mcplus-file";file.accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx";file.hidden=true;file.addEventListener("change",mcUploadFile);document.body.appendChild(file);
    const groupBox=document.createElement("div");groupBox.id="mcplus-groups";const label=document.createElement("div");label.className="mcplus-section-label";label.textContent="GROUPES";const list=document.createElement("div");list.id="mcplus-group-list";groupBox.append(label,list);if(conversations)conversations.insertAdjacentElement("beforebegin",groupBox);
    const myStatus=document.querySelector(".profile-info small");if(myStatus)myStatus.id="mcplus-my-status";
    const typing=document.createElement("div");typing.id="mcplus-typing";typing.className="mcplus-typing";if(messagesContainer)messagesContainer.insertAdjacentElement("beforebegin",typing);
    let openMenu=null;
    function closeMenu(){if(openMenu){openMenu.remove();openMenu=null;}}
    function showMenu(anchor,items,title){closeMenu();const menu=document.createElement("div");menu.className="mcplus-menu";if(title){const t=document.createElement("div");t.className="mcplus-menu-title";t.textContent=title;menu.appendChild(t);}items.forEach(item=>{const b=document.createElement("button");b.type="button";b.textContent=item.label;b.addEventListener("click",()=>{closeMenu();item.action();});menu.appendChild(b);});document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,window.innerWidth-230))+"px";menu.style.top=Math.max(8,Math.min(r.bottom+6,window.innerHeight-menu.offsetHeight-8))+"px";openMenu=menu;const outsideMenu=e=>{if(!menu.contains(e.target)&&!anchor.contains(e.target)){closeMenu();document.removeEventListener("pointerdown",outsideMenu,true);}};setTimeout(()=>document.addEventListener("pointerdown",outsideMenu,true),0);}
    const attach=document.querySelector(".input-area .attach");if(attach){attach.title="Ajouter un fichier ou un message vocal";attach.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();showMenu(attach,[{label:"🖼️ Photo, vidéo ou fichier",action:mcChooseFile},{label:"🎙️ Enregistrer un message vocal",action:mcToggleRecording}],"Ajouter à la discussion");},true);}
    const profile=document.querySelector(".sidebar .profile");if(profile){profile.classList.add("mcplus-profile-click");profile.title="Profil et paramètres";profile.setAttribute("role","button");profile.setAttribute("tabindex","0");const openProfile=()=>showMenu(profile,[{label:"👤 Modifier mon profil",action:mcEditProfile},{label:"🔔 Activer les notifications",action:mcNotifications},{label:document.body.classList.contains("mcplus-light")?"🌙 Thème sombre":"☀️ Thème clair",action:mcTheme}],"Mon compte");profile.addEventListener("click",openProfile);profile.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProfile();}});}
    const newBtn=mcEl("newDiscussionButton");if(newBtn)newBtn.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();showMenu(newBtn,[{label:"💬 Nouvelle discussion privée",action:()=>{mcEl("chatApp")?.classList.remove("mobile-chat-open");const search=mcEl("userSearch");if(search){search.classList.add("mobile-search-visible");search.focus();search.scrollIntoView({behavior:"smooth",block:"center"});}}},{label:"👥 Créer un groupe",action:mcCreateGroup}],"Nouvelle discussion");},true);
  }
  async function mcEditProfile() {
    if(!currentUser)return mcToast("Connecte-toi d'abord.");const p=currentProfile||{};
    mcModal("Personnaliser mon profil",[
      {name:"username",label:"Pseudo (3 à 20 caractères)",value:p.username||usernameDisplay.textContent,required:true,maxLength:20},
      {name:"avatar_url",label:"URL HTTPS de la photo (facultatif)",value:p.avatar_url||"",placeholder:"https://..."},
      {name:"bio",label:"Description",value:p.bio||"",placeholder:"Quelques mots sur toi",maxLength:160},
      {name:"status_text",label:"Statut",value:p.status_text||"En ligne",placeholder:"Disponible, occupé…",maxLength:40}
    ],async v=>{
      if(!/^[a-zA-Z0-9_.-]{3,20}$/.test(v.username))throw Error("Pseudo invalide : 3–20 caractères, lettres, chiffres, _, . ou -.");
      if(v.avatar_url&&!/^https:\/\//i.test(v.avatar_url))throw Error("L'URL de la photo doit commencer par https://");
      const {data,error}=await supabaseClient.from("profiles").update({username:v.username,avatar_url:v.avatar_url||null,bio:v.bio||null,status_text:v.status_text||"En ligne"}).eq("id",currentUser.id).select("*").single();if(error)throw error;
      currentProfile=data;usernameDisplay.textContent=data.username;userAvatar.textContent=data.username[0].toUpperCase();userAvatar.style.backgroundImage=data.avatar_url?`url("${data.avatar_url.replace(/["\\]/g,"")}")`:"none";userAvatar.style.backgroundSize="cover";mcToast("Profil mis à jour.");await loadConversations();
    });
  }
  async function mcPresence() {
    if(!currentUser)return;const tick=()=>{if(currentUser)supabaseClient.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",currentUser.id).then(({error})=>{if(error)console.warn("Présence MonChat:",error.message);});};tick();clearInterval(mcPlus.presenceTimer);mcPlus.presenceTimer=setInterval(tick,30000);
  }
  async function mcStatus(userId) {
    if(!userId)return;const {data,error}=await supabaseClient.from("profiles").select("last_seen,status_text").eq("id",userId).maybeSingle();if(error||!data)return;
    const online=data.last_seen&&(Date.now()-new Date(data.last_seen).getTime()<75000);if(selectedUser?.id===userId)chatStatus.textContent=(online?"🟢 En ligne":"⚪ Hors ligne")+(data.status_text?" · "+data.status_text:"");
  }
  async function mcSetupTyping() {
    if(!currentUser)return;if(mcPlus.typingChannel)await supabaseClient.removeChannel(mcPlus.typingChannel);
    const pair=selectedUser?[currentUser.id,selectedUser.id].sort().join("-"):currentUser.id;
    mcPlus.typingChannel=supabaseClient.channel("mcplus-typing-"+pair,{config:{broadcast:{self:false}}});
    mcPlus.typingChannel.on("broadcast",{event:"typing"},({payload})=>{if(!selectedUser||mcPlus.group||payload?.from!==selectedUser.id)return;const el=mcEl("mcplus-typing");if(el)el.textContent=payload.typing?`${selectedUser.username} écrit un message…`:"";});await mcPlus.typingChannel.subscribe();
  }
  function mcTyping(typing) {if(currentUser&&selectedUser&&!mcPlus.group&&mcPlus.typingChannel)mcPlus.typingChannel.send({type:"broadcast",event:"typing",payload:{from:currentUser.id,to:selectedUser.id,typing}});}
  async function mcMarkRead() {if(!currentUser||!selectedUser||mcPlus.group)return;const {error}=await supabaseClient.from("private_messages").update({is_read:true,read_at:new Date().toISOString()}).eq("sender_id",selectedUser.id).eq("receiver_id",currentUser.id).eq("is_read",false);if(error)console.warn("Marquage lu:",error.message);}
  async function mcLoadReactions(messageId,row) {
    const {data,error}=await supabaseClient.from("message_reactions").select("emoji,user_id").eq("message_id",messageId);if(error)return;
    let box=row.querySelector(".mcplus-reactions");if(!box){box=document.createElement("div");box.className="mcplus-reactions";row.appendChild(box);}box.replaceChildren();const counts=new Map();(data||[]).forEach(r=>counts.set(r.emoji,(counts.get(r.emoji)||0)+1));
    for(const [emoji,count] of counts){const b=document.createElement("button");b.textContent=`${emoji} ${count}`;b.title="Ajouter ou remplacer ta réaction";b.onclick=()=>mcReact(messageId);box.appendChild(b);}
  }
  async function mcReact(messageId) {
    const emoji=prompt("Choisis une réaction : ❤️ 😂 👍 😮 😢 🔥 🎉 😍","❤️");if(!emoji)return;if(!["❤️","😂","👍","😮","😢","🔥","🎉","😍"].includes(emoji.trim()))return mcToast("Emoji non pris en charge.");
    const {error}=await supabaseClient.from("message_reactions").upsert({message_id:String(messageId),user_id:currentUser.id,emoji:emoji.trim()},{onConflict:"message_id,user_id"});if(error)mcToast(error.message);else mcToast("Réaction ajoutée.");
  }
  async function mcEditMessage(m) {const content=prompt("Modifier ton message :",m.content||"");if(content===null||!content.trim())return;const {error}=await supabaseClient.from("private_messages").update({content:content.trim(),edited_at:new Date().toISOString()}).eq("id",m.id).eq("sender_id",currentUser.id);if(error)mcToast(error.message);else{mcToast("Message modifié.");await loadPrivateMessages();}}
  async function mcDeleteMessage(m) {if(!confirm("Supprimer ce message pour tout le monde ?"))return;const {error}=await supabaseClient.from("private_messages").delete().eq("id",m.id).eq("sender_id",currentUser.id);if(error)mcToast(error.message);else{mcToast("Message supprimé.");await loadPrivateMessages();}}
  async function mcDecorate(m) {
    if(!m?.id)return;const row=[...messagesContainer.querySelectorAll(".private-message")].find(x=>x.dataset.mcplusId===String(m.id));if(!row||row.dataset.mcplusDone)return;row.dataset.mcplusId=String(m.id);row.dataset.mcplusDone="1";
    const bubble=row.querySelector(".private-bubble");if(bubble&&m.media_url){bubble.replaceChildren();if(m.message_type==="image"){const img=document.createElement("img");img.src=m.media_url;img.alt="Image partagée";img.loading="lazy";img.className="mcplus-file-img";bubble.appendChild(img);}else if(m.message_type==="audio"){const a=document.createElement("audio");a.controls=true;a.src=m.media_url;a.className="mcplus-audio";bubble.appendChild(a);}else{const a=document.createElement("a");a.href=m.media_url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=m.content||"Ouvrir le fichier";a.style.color="inherit";bubble.appendChild(a);}}
    const meta=document.createElement("div");meta.className="mcplus-meta";if(m.created_at){const t=document.createElement("span");t.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});meta.appendChild(t);}if(m.sender_id===currentUser?.id){const r=document.createElement("span");r.textContent=m.is_read?"✓✓ Lu":"✓ Envoyé";meta.appendChild(r);}if(m.edited_at){const e=document.createElement("span");e.textContent="modifié";meta.appendChild(e);}row.appendChild(meta);
    const tools=document.createElement("div");tools.className="mcplus-tools";const react=document.createElement("button");react.textContent="❤️ Réagir";react.onclick=()=>mcReact(m.id);tools.appendChild(react);
    if(m.sender_id===currentUser?.id&&!m.media_url){const edit=document.createElement("button");edit.textContent="✏️ Modifier";edit.onclick=()=>mcEditMessage(m);const del=document.createElement("button");del.textContent="🗑 Supprimer";del.onclick=()=>mcDeleteMessage(m);tools.append(edit,del);}
    const reply=document.createElement("button");reply.textContent="↩ Répondre";reply.onclick=()=>{messageInput.value=`↪ ${m.content||"pièce jointe"}: `+messageInput.value;messageInput.focus();};tools.appendChild(reply);row.appendChild(tools);await mcLoadReactions(m.id,row);
  }
  async function mcChooseFile(){if(!currentUser||!selectedUser||mcPlus.group)return mcToast("Ouvre une conversation privée d'abord.");mcEl("mcplus-file")?.click();}
  async function mcUploadFile(){const input=mcEl("mcplus-file"),file=input?.files?.[0];if(!file)return;if(!currentUser||!selectedUser||mcPlus.group){input.value="";return mcToast("Ouvre une conversation privée d'abord.");}if(file.size>15*1024*1024){input.value="";return mcToast("Fichier trop volumineux : limite de 15 Mo.");}
    try{const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${currentUser.id}/${Date.now()}-${safe}`;const {error:upErr}=await supabaseClient.storage.from("monchat-media").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});if(upErr)throw upErr;const {data}=supabaseClient.storage.from("monchat-media").getPublicUrl(path);const type=file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":"file";const {error}=await supabaseClient.from("private_messages").insert({sender_id:currentUser.id,receiver_id:selectedUser.id,content:file.name,media_url:data.publicUrl,message_type:type});if(error)throw error;mcToast("Fichier envoyé.");}catch(e){console.error(e);mcToast(e.message||"Envoi impossible.");}finally{input.value="";}}
  async function mcToggleRecording(){if(mcPlus.recording){mcPlus.recorder?.stop();return;}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return mcToast("Enregistrement vocal indisponible dans ce navigateur.");if(!currentUser||!selectedUser||mcPlus.group)return mcToast("Ouvre une conversation privée d'abord.");
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});mcPlus.chunks=[];mcPlus.recorder=new MediaRecorder(stream);mcPlus.recorder.ondataavailable=e=>{if(e.data.size)mcPlus.chunks.push(e.data);};mcPlus.recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(mcPlus.chunks,{type:mcPlus.recorder.mimeType||"audio/webm"});if(!blob.size)return;try{const path=`${currentUser.id}/${Date.now()}-vocal.webm`;const {error:upErr}=await supabaseClient.storage.from("monchat-media").upload(path,blob,{contentType:blob.type});if(upErr)throw upErr;const {data}=supabaseClient.storage.from("monchat-media").getPublicUrl(path);const {error}=await supabaseClient.from("private_messages").insert({sender_id:currentUser.id,receiver_id:selectedUser.id,content:"Message vocal",media_url:data.publicUrl,message_type:"audio"});if(error)throw error;mcToast("Message vocal envoyé.");}catch(e){mcToast(e.message||"Envoi du vocal impossible.");}};mcPlus.recorder.start();mcPlus.recording=true;const btn=[...document.querySelectorAll(".mcplus-btn")].find(b=>b.textContent.includes("Vocal")||b.textContent.includes("Stop"));if(btn)btn.textContent="⏹️ Stop vocal";mcToast("Enregistrement en cours. Clique sur Stop vocal pour envoyer.");mcPlus.recorder.addEventListener("stop",()=>{mcPlus.recording=false;if(btn)btn.textContent="🎙️ Vocal";},{once:true});}catch(e){mcToast("Micro refusé ou indisponible.");}}
  async function mcNotifications(){if(!("Notification"in window))return mcToast("Notifications non prises en charge.");const p=await Notification.requestPermission();mcToast(p==="granted"?"Notifications activées.":"Autorisation refusée.");}
  function mcNotify(m){if(!m||m.sender_id===currentUser?.id||document.visibilityState==="visible")return;if("Notification"in window&&Notification.permission==="granted")new Notification("MonChat — nouveau message",{body:m.content||"Pièce jointe reçue"});}
  function mcTheme(){document.body.classList.toggle("mcplus-light");try{localStorage.setItem("monchat-theme",document.body.classList.contains("mcplus-light")?"light":"dark");}catch(e){}}
  async function mcCreateGroup(){if(!currentUser)return mcToast("Connecte-toi d'abord.");mcModal("Créer un groupe",[{name:"name",label:"Nom du groupe",required:true,maxLength:60},{name:"members",label:"Pseudos des membres, séparés par des virgules",placeholder:"alice, bob"}],async v=>{if(!v.name)throw Error("Donne un nom au groupe.");const {data:g,error}=await supabaseClient.from("chat_groups").insert({name:v.name,created_by:currentUser.id}).select("*").single();if(error)throw error;const ids=[currentUser.id];if(v.members){const names=v.members.split(",").map(x=>x.trim()).filter(Boolean);const {data:users,error:uerr}=await supabaseClient.from("profiles").select("id,username").in("username",names);if(uerr)throw uerr;ids.push(...(users||[]).map(x=>x.id));const found=new Set((users||[]).map(x=>x.username.toLowerCase()));const missing=names.filter(n=>!found.has(n.toLowerCase()));if(missing.length)mcToast("Pseudos introuvables : "+missing.join(", "));}const {error:merr}=await supabaseClient.from("chat_group_members").insert([...new Set(ids)].map(user_id=>({group_id:g.id,user_id})));if(merr)throw merr;await mcLoadGroups();await mcOpenGroup(g);mcToast("Groupe créé.");});}
  async function mcLoadGroups(){if(!currentUser||!mcEl("mcplus-group-list"))return;const {data,error}=await supabaseClient.from("chat_group_members").select("group_id,chat_groups(id,name,created_by)").eq("user_id",currentUser.id);if(error){console.warn("Groupes:",error.message);return;}const list=mcEl("mcplus-group-list");list.replaceChildren();(data||[]).forEach(r=>{const g=r.chat_groups;if(!g)return;const b=document.createElement("button");b.type="button";b.className="conversation";b.style.cssText="width:100%;text-align:left;display:flex;align-items:center;gap:10px;background:transparent;color:inherit;border:0;padding:9px;cursor:pointer";const a=document.createElement("div");a.className="avatar";a.textContent="👥";const n=document.createElement("div");n.className="conversation-name";n.textContent=g.name;b.append(a,n);b.onclick=()=>mcOpenGroup(g);list.appendChild(b);});}
  async function mcOpenGroup(g){if(!g||!currentUser)return;if(realtimeChannel){await supabaseClient.removeChannel(realtimeChannel);realtimeChannel=null;}if(mcPlus.groupChannel){await supabaseClient.removeChannel(mcPlus.groupChannel);mcPlus.groupChannel=null;}mcPlus.group=g;selectedUser=null;conversationRequest++;chatTitle.textContent="👥 "+g.name;chatStatus.textContent="Discussion de groupe";messageInput.disabled=false;sendButton.disabled=false;messageInput.placeholder=`Écris dans ${g.name}…`;messagesContainer.replaceChildren();const {data,error}=await supabaseClient.from("group_messages").select("*").eq("group_id",g.id).order("created_at",{ascending:true}).limit(300);if(error){mcToast(error.message);return;}for(const m of data||[])await mcDisplayGroupMessage(m);mcPlus.groupChannel=supabaseClient.channel("mcplus-group-"+g.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"group_messages",filter:`group_id=eq.${g.id}`},p=>mcDisplayGroupMessage(p.new)).subscribe();}
  async function mcDisplayGroupMessage(m){if(!m||messagesContainer.querySelector(`[data-mcplus-group="${m.id}"]`))return;const row=document.createElement("div");row.className="private-message"+(m.sender_id===currentUser.id?" me":"");row.dataset.mcplusGroup=m.id;const bubble=document.createElement("div");bubble.className="private-bubble";bubble.textContent=m.content||"";row.appendChild(bubble);const meta=document.createElement("div");meta.className="mcplus-meta";const who=document.createElement("span");who.textContent=m.sender_id===currentUser.id?"Toi":(m.username||"Membre");meta.appendChild(who);if(m.created_at){const t=document.createElement("span");t.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});meta.appendChild(t);}row.appendChild(meta);messagesContainer.appendChild(row);messagesContainer.scrollTop=messagesContainer.scrollHeight;}
  async function mcSendGroup(content){if(!mcPlus.group||!currentUser)return false;const {error}=await supabaseClient.from("group_messages").insert({group_id:mcPlus.group.id,sender_id:currentUser.id,content});if(error)mcToast(error.message);else messageInput.value="";return true;}
  function mcInit(){mcInject();try{if(localStorage.getItem("monchat-theme")==="light")document.body.classList.add("mcplus-light");}catch(e){}
    // La capture permet de gérer les groupes avant le gestionnaire privé existant.
    if(messageForm)messageForm.addEventListener("submit",async e=>{if(!mcPlus.group)return;e.preventDefault();e.stopImmediatePropagation();const content=messageInput.value.trim();if(content)await mcSendGroup(content);},true);
    if(messageInput)messageInput.addEventListener("input",()=>{if(!selectedUser||mcPlus.group)return;mcTyping(true);clearTimeout(mcPlus.typingTimer);mcPlus.typingTimer=setTimeout(()=>mcTyping(false),1200);});
    const originalDisplay=displayPrivateMessage;
    displayPrivateMessage=function(m){
      originalDisplay(m);
      if(m?.id){const rows=[...messagesContainer.querySelectorAll(".private-message")];const row=[...rows].reverse().find(x=>!x.dataset.mcplusId);if(row)row.dataset.mcplusId=String(m.id);}
      if(m && (m.media_url!==undefined || m.message_type!==undefined || m.is_read!==undefined || m.edited_at!==undefined))setTimeout(()=>mcDecorate(m),0);
      mcNotify(m);
    };
    const originalOpen=openConversation;
    openConversation=async function(user){mcPlus.group=null;if(mcPlus.groupChannel){await supabaseClient.removeChannel(mcPlus.groupChannel);mcPlus.groupChannel=null;}await originalOpen(user);await mcStatus(user.id);await mcMarkRead();await mcSetupTyping();};
    const originalLoad=loadPrivateMessages;
    loadPrivateMessages=async function(requestId){await originalLoad(requestId);if(!mcPlus.group&&selectedUser){const {data,error}=await supabaseClient.from("private_messages").select("id,sender_id,receiver_id,content,created_at,is_read,read_at,edited_at,media_url,message_type").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`).order("created_at",{ascending:true});if(!error){for(const m of data||[])await mcDecorate(m);await mcMarkRead();}}};
    const originalShow=showChat;showChat=async function(){await originalShow();mcInject();await mcPresence();await mcLoadGroups();await mcSetupTyping();};
    if(currentUser){mcPresence();mcLoadGroups();mcSetupTyping();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mcInit,{once:true});else mcInit();
})();



/* =========================================================
   MONCHAT PLUS — fonctionnalités supplémentaires
   Ajouté au script existant : aucun changement du HTML requis.
   Requiert la migration SQL monchat_plus.sql.
   ========================================================= */
(() => {
  "use strict";
  const mcPlus = {
    group: null, typingChannel: null, groupChannel: null,
    presenceTimer: null, typingTimer: null, recording: false,
    recorder: null, chunks: [], reactionsChannel: null
  };
  const mcEl = id => document.getElementById(id);
  const mcStyle = `
    .mcplus-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #292929;background:#101010}
    .mcplus-btn{background:#202020;color:#eee;border:1px solid #383838;border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;font-size:13px}
    .mcplus-btn:hover{background:#303030}.mcplus-meta{font-size:11px;color:#999;margin-top:5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .mcplus-tools{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.mcplus-tools button,.mcplus-reactions button{font-size:11px;padding:3px 7px;border-radius:7px;background:#171717;color:#bbb;border:1px solid #333;cursor:pointer}
    .mcplus-reactions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.mcplus-reactions button{border-radius:14px}
    .mcplus-modal-bg{position:fixed;inset:0;background:#000b;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px}
    .mcplus-modal{box-sizing:border-box;width:min(440px,100%);max-height:85vh;overflow:auto;background:#151515;color:#eee;border:1px solid #333;border-radius:16px;padding:20px;box-shadow:0 20px 80px #0008}
    .mcplus-modal h3{margin-top:0}.mcplus-modal input,.mcplus-modal textarea{box-sizing:border-box;width:100%;padding:10px;margin:6px 0 12px;background:#090909;color:#eee;border:1px solid #444;border-radius:8px}
    .mcplus-modal label{font-size:12px;color:#bbb}.mcplus-modal-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
    .mcplus-section-label{font-size:10px;color:#9b9b9b;text-transform:uppercase;margin:12px 0 4px}.mcplus-typing{font-size:12px;color:#aaa;padding:3px 14px;min-height:16px}
    .mcplus-audio{max-width:min(280px,70vw);height:36px}.mcplus-file-img{max-width:min(280px,65vw);max-height:260px;border-radius:10px;display:block}
    body.mcplus-light{background:#f5f5f5;color:#151515}body.mcplus-light .app,body.mcplus-light .chat-area,body.mcplus-light .sidebar{background:#f7f7f7;color:#161616}
    body.mcplus-light .chat-header,body.mcplus-light .input-area,body.mcplus-light .mcplus-toolbar{background:#eee;color:#161616;border-color:#ddd}
    body.mcplus-light .private-bubble{background:#e4e4e4;color:#151515}body.mcplus-light .private-message.me .private-bubble{background:#ccebd7;color:#151515}
    @media(max-width:650px){.mcplus-toolbar{gap:5px;padding:7px}.mcplus-btn{padding:7px 8px;font-size:12px}}
  `;
  function mcToast(message) {
    let box = mcEl("mcplus-toast");
    if (!box) { box=document.createElement("div");box.id="mcplus-toast";box.style.cssText="position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:10001;background:#252525;color:#fff;padding:11px 16px;border:1px solid #444;border-radius:12px;box-shadow:0 8px 30px #0008;max-width:90vw;font-size:13px";document.body.appendChild(box); }
    box.textContent=message;box.style.display="block";clearTimeout(box._timer);box._timer=setTimeout(()=>box.style.display="none",3500);
  }
  function mcButton(label, handler, title="") { const b=document.createElement("button");b.type="button";b.className="mcplus-btn";b.textContent=label;b.title=title;b.addEventListener("click",handler);return b; }
  function mcModal(title, fields, saveHandler) {
    const bg=document.createElement("div");bg.className="mcplus-modal-bg";
    const form=document.createElement("form");form.className="mcplus-modal";
    const h=document.createElement("h3");h.textContent=title;form.appendChild(h);const controls={};
    fields.forEach(f=>{const l=document.createElement("label");l.textContent=f.label;form.appendChild(l);let el;
      if(f.type==="textarea")el=document.createElement("textarea");else{el=document.createElement("input");el.type=f.type||"text";}
      el.name=f.name;el.placeholder=f.placeholder||"";el.value=f.value||"";if(f.maxLength)el.maxLength=f.maxLength;if(f.required)el.required=true;form.appendChild(el);controls[f.name]=el;});
    const actions=document.createElement("div");actions.className="mcplus-modal-actions";const cancel=mcButton("Annuler",()=>bg.remove());const save=document.createElement("button");save.type="submit";save.className="mcplus-btn";save.textContent="Enregistrer";actions.append(cancel,save);form.appendChild(actions);bg.appendChild(form);document.body.appendChild(bg);
    form.addEventListener("submit",async e=>{e.preventDefault();save.disabled=true;try{await saveHandler(Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value.trim()])));bg.remove();}catch(err){console.error(err);mcToast(err?.message||"Une erreur est survenue.");}finally{save.disabled=false;}});
    bg.addEventListener("click",e=>{if(e.target===bg)bg.remove();});
  }
  function mcInject() {
    if(!mcEl("chatApp")||mcEl("mcplus-ui-ready"))return;
    const st=document.createElement("style");st.textContent=mcStyle+`
      .mcplus-menu{position:fixed;z-index:10000;min-width:210px;padding:6px;background:#171717;color:#f5f5f5;border:1px solid #383838;border-radius:13px;box-shadow:0 12px 35px #0008;display:flex;flex-direction:column;gap:3px}
      .mcplus-menu button{background:transparent;color:inherit;border:0;border-radius:8px;text-align:left;padding:11px 12px;font:inherit;font-size:14px;cursor:pointer}
      .mcplus-menu button:hover{background:#303030}
      .mcplus-menu .mcplus-menu-title{padding:7px 12px 5px;color:#999;font-size:11px;text-transform:uppercase}
      .mcplus-profile-click{cursor:pointer}
      body.mcplus-light .mcplus-menu{background:#fff;color:#181818;border-color:#ddd}
      body.mcplus-light .mcplus-menu button:hover{background:#eee}
    `;document.head.appendChild(st);
    const marker=document.createElement("span");marker.id="mcplus-ui-ready";marker.hidden=true;document.body.appendChild(marker);
    const file=document.createElement("input");file.type="file";file.id="mcplus-file";file.accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx";file.hidden=true;file.addEventListener("change",mcUploadFile);document.body.appendChild(file);
    const groupBox=document.createElement("div");groupBox.id="mcplus-groups";const label=document.createElement("div");label.className="mcplus-section-label";label.textContent="GROUPES";const list=document.createElement("div");list.id="mcplus-group-list";groupBox.append(label,list);if(conversations)conversations.insertAdjacentElement("beforebegin",groupBox);
    const myStatus=document.querySelector(".profile-info small");if(myStatus)myStatus.id="mcplus-my-status";
    const typing=document.createElement("div");typing.id="mcplus-typing";typing.className="mcplus-typing";if(messagesContainer)messagesContainer.insertAdjacentElement("beforebegin",typing);
    let openMenu=null;
    function closeMenu(){if(openMenu){openMenu.remove();openMenu=null;}}
    function showMenu(anchor,items,title){closeMenu();const menu=document.createElement("div");menu.className="mcplus-menu";if(title){const t=document.createElement("div");t.className="mcplus-menu-title";t.textContent=title;menu.appendChild(t);}items.forEach(item=>{const b=document.createElement("button");b.type="button";b.textContent=item.label;b.addEventListener("click",()=>{closeMenu();item.action();});menu.appendChild(b);});document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,window.innerWidth-230))+"px";menu.style.top=Math.max(8,Math.min(r.bottom+6,window.innerHeight-menu.offsetHeight-8))+"px";openMenu=menu;const outsideMenu=e=>{if(!menu.contains(e.target)&&!anchor.contains(e.target)){closeMenu();document.removeEventListener("pointerdown",outsideMenu,true);}};setTimeout(()=>document.addEventListener("pointerdown",outsideMenu,true),0);}
    const attach=document.querySelector(".input-area .attach");if(attach){attach.title="Ajouter un fichier ou un message vocal";attach.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();showMenu(attach,[{label:"🖼️ Photo, vidéo ou fichier",action:mcChooseFile},{label:"🎙️ Enregistrer un message vocal",action:mcToggleRecording}],"Ajouter à la discussion");},true);}
    const profile=document.querySelector(".sidebar .profile");if(profile){profile.classList.add("mcplus-profile-click");profile.title="Profil et paramètres";profile.setAttribute("role","button");profile.setAttribute("tabindex","0");const openProfile=()=>showMenu(profile,[{label:"👤 Modifier mon profil",action:mcEditProfile},{label:"🔔 Activer les notifications",action:mcNotifications},{label:document.body.classList.contains("mcplus-light")?"🌙 Thème sombre":"☀️ Thème clair",action:mcTheme}],"Mon compte");profile.addEventListener("click",openProfile);profile.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProfile();}});}
    const newBtn=mcEl("newDiscussionButton");if(newBtn)newBtn.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();showMenu(newBtn,[{label:"💬 Nouvelle discussion privée",action:()=>{mcEl("chatApp")?.classList.remove("mobile-chat-open");const search=mcEl("userSearch");if(search){search.classList.add("mobile-search-visible");search.focus();search.scrollIntoView({behavior:"smooth",block:"center"});}}},{label:"👥 Créer un groupe",action:mcCreateGroup}],"Nouvelle discussion");},true);
  }
  async function mcEditProfile() {
    if(!currentUser)return mcToast("Connecte-toi d'abord.");const p=currentProfile||{};
    mcModal("Personnaliser mon profil",[
      {name:"username",label:"Pseudo (3 à 20 caractères)",value:p.username||usernameDisplay.textContent,required:true,maxLength:20},
      {name:"avatar_url",label:"URL HTTPS de la photo (facultatif)",value:p.avatar_url||"",placeholder:"https://..."},
      {name:"bio",label:"Description",value:p.bio||"",placeholder:"Quelques mots sur toi",maxLength:160},
      {name:"status_text",label:"Statut",value:p.status_text||"En ligne",placeholder:"Disponible, occupé…",maxLength:40}
    ],async v=>{
      if(!/^[a-zA-Z0-9_.-]{3,20}$/.test(v.username))throw Error("Pseudo invalide : 3–20 caractères, lettres, chiffres, _, . ou -.");
      if(v.avatar_url&&!/^https:\/\//i.test(v.avatar_url))throw Error("L'URL de la photo doit commencer par https://");
      const {data,error}=await supabaseClient.from("profiles").update({username:v.username,avatar_url:v.avatar_url||null,bio:v.bio||null,status_text:v.status_text||"En ligne"}).eq("id",currentUser.id).select("*").single();if(error)throw error;
      currentProfile=data;usernameDisplay.textContent=data.username;userAvatar.textContent=data.username[0].toUpperCase();userAvatar.style.backgroundImage=data.avatar_url?`url("${data.avatar_url.replace(/["\\]/g,"")}")`:"none";userAvatar.style.backgroundSize="cover";mcToast("Profil mis à jour.");await loadConversations();
    });
  }
  async function mcPresence() {
    if(!currentUser)return;const tick=()=>{if(currentUser)supabaseClient.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",currentUser.id).then(({error})=>{if(error)console.warn("Présence MonChat:",error.message);});};tick();clearInterval(mcPlus.presenceTimer);mcPlus.presenceTimer=setInterval(tick,30000);
  }
  async function mcStatus(userId) {
    if(!userId)return;const {data,error}=await supabaseClient.from("profiles").select("last_seen,status_text").eq("id",userId).maybeSingle();if(error||!data)return;
    const online=data.last_seen&&(Date.now()-new Date(data.last_seen).getTime()<75000);if(selectedUser?.id===userId)chatStatus.textContent=(online?"🟢 En ligne":"⚪ Hors ligne")+(data.status_text?" · "+data.status_text:"");
  }
  async function mcSetupTyping() {
    if(!currentUser)return;if(mcPlus.typingChannel)await supabaseClient.removeChannel(mcPlus.typingChannel);
    const pair=selectedUser?[currentUser.id,selectedUser.id].sort().join("-"):currentUser.id;
    mcPlus.typingChannel=supabaseClient.channel("mcplus-typing-"+pair,{config:{broadcast:{self:false}}});
    mcPlus.typingChannel.on("broadcast",{event:"typing"},({payload})=>{if(!selectedUser||mcPlus.group||payload?.from!==selectedUser.id)return;const el=mcEl("mcplus-typing");if(el)el.textContent=payload.typing?`${selectedUser.username} écrit un message…`:"";});await mcPlus.typingChannel.subscribe();
  }
  function mcTyping(typing) {if(currentUser&&selectedUser&&!mcPlus.group&&mcPlus.typingChannel)mcPlus.typingChannel.send({type:"broadcast",event:"typing",payload:{from:currentUser.id,to:selectedUser.id,typing}});}
  async function mcMarkRead() {if(!currentUser||!selectedUser||mcPlus.group)return;const {error}=await supabaseClient.from("private_messages").update({is_read:true,read_at:new Date().toISOString()}).eq("sender_id",selectedUser.id).eq("receiver_id",currentUser.id).eq("is_read",false);if(error)console.warn("Marquage lu:",error.message);}
  async function mcLoadReactions(messageId,row) {
    const {data,error}=await supabaseClient.from("message_reactions").select("emoji,user_id").eq("message_id",messageId);if(error)return;
    let box=row.querySelector(".mcplus-reactions");if(!box){box=document.createElement("div");box.className="mcplus-reactions";row.appendChild(box);}box.replaceChildren();const counts=new Map();(data||[]).forEach(r=>counts.set(r.emoji,(counts.get(r.emoji)||0)+1));
    for(const [emoji,count] of counts){const b=document.createElement("button");b.textContent=`${emoji} ${count}`;b.title="Ajouter ou remplacer ta réaction";b.onclick=()=>mcReact(messageId);box.appendChild(b);}
  }
  async function mcReact(messageId) {
    const emoji=prompt("Choisis une réaction : ❤️ 😂 👍 😮 😢 🔥 🎉 😍","❤️");if(!emoji)return;if(!["❤️","😂","👍","😮","😢","🔥","🎉","😍"].includes(emoji.trim()))return mcToast("Emoji non pris en charge.");
    const {error}=await supabaseClient.from("message_reactions").upsert({message_id:String(messageId),user_id:currentUser.id,emoji:emoji.trim()},{onConflict:"message_id,user_id"});if(error)mcToast(error.message);else mcToast("Réaction ajoutée.");
  }
  async function mcEditMessage(m) {const content=prompt("Modifier ton message :",m.content||"");if(content===null||!content.trim())return;const {error}=await supabaseClient.from("private_messages").update({content:content.trim(),edited_at:new Date().toISOString()}).eq("id",m.id).eq("sender_id",currentUser.id);if(error)mcToast(error.message);else{mcToast("Message modifié.");await loadPrivateMessages();}}
  async function mcDeleteMessage(m) {if(!confirm("Supprimer ce message pour tout le monde ?"))return;const {error}=await supabaseClient.from("private_messages").delete().eq("id",m.id).eq("sender_id",currentUser.id);if(error)mcToast(error.message);else{mcToast("Message supprimé.");await loadPrivateMessages();}}
  async function mcDecorate(m) {
    if(!m?.id)return;const row=[...messagesContainer.querySelectorAll(".private-message")].find(x=>x.dataset.mcplusId===String(m.id));if(!row||row.dataset.mcplusDone)return;row.dataset.mcplusId=String(m.id);row.dataset.mcplusDone="1";
    const bubble=row.querySelector(".private-bubble");if(bubble&&m.media_url){bubble.replaceChildren();if(m.message_type==="image"){const img=document.createElement("img");img.src=m.media_url;img.alt="Image partagée";img.loading="lazy";img.className="mcplus-file-img";bubble.appendChild(img);}else if(m.message_type==="audio"){const a=document.createElement("audio");a.controls=true;a.src=m.media_url;a.className="mcplus-audio";bubble.appendChild(a);}else{const a=document.createElement("a");a.href=m.media_url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=m.content||"Ouvrir le fichier";a.style.color="inherit";bubble.appendChild(a);}}
    const meta=document.createElement("div");meta.className="mcplus-meta";if(m.created_at){const t=document.createElement("span");t.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});meta.appendChild(t);}if(m.sender_id===currentUser?.id){const r=document.createElement("span");r.textContent=m.is_read?"✓✓ Lu":"✓ Envoyé";meta.appendChild(r);}if(m.edited_at){const e=document.createElement("span");e.textContent="modifié";meta.appendChild(e);}row.appendChild(meta);
    const tools=document.createElement("div");tools.className="mcplus-tools";const react=document.createElement("button");react.textContent="❤️ Réagir";react.onclick=()=>mcReact(m.id);tools.appendChild(react);
    if(m.sender_id===currentUser?.id&&!m.media_url){const edit=document.createElement("button");edit.textContent="✏️ Modifier";edit.onclick=()=>mcEditMessage(m);const del=document.createElement("button");del.textContent="🗑 Supprimer";del.onclick=()=>mcDeleteMessage(m);tools.append(edit,del);}
    const reply=document.createElement("button");reply.textContent="↩ Répondre";reply.onclick=()=>{messageInput.value=`↪ ${m.content||"pièce jointe"}: `+messageInput.value;messageInput.focus();};tools.appendChild(reply);row.appendChild(tools);await mcLoadReactions(m.id,row);
  }
  async function mcChooseFile(){if(!currentUser||!selectedUser||mcPlus.group)return mcToast("Ouvre une conversation privée d'abord.");mcEl("mcplus-file")?.click();}
  async function mcUploadFile(){const input=mcEl("mcplus-file"),file=input?.files?.[0];if(!file)return;if(!currentUser||!selectedUser||mcPlus.group){input.value="";return mcToast("Ouvre une conversation privée d'abord.");}if(file.size>15*1024*1024){input.value="";return mcToast("Fichier trop volumineux : limite de 15 Mo.");}
    try{const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${currentUser.id}/${Date.now()}-${safe}`;const {error:upErr}=await supabaseClient.storage.from("monchat-media").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});if(upErr)throw upErr;const {data}=supabaseClient.storage.from("monchat-media").getPublicUrl(path);const type=file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":"file";const {error}=await supabaseClient.from("private_messages").insert({sender_id:currentUser.id,receiver_id:selectedUser.id,content:file.name,media_url:data.publicUrl,message_type:type});if(error)throw error;mcToast("Fichier envoyé.");}catch(e){console.error(e);mcToast(e.message||"Envoi impossible.");}finally{input.value="";}}
  async function mcToggleRecording(){if(mcPlus.recording){mcPlus.recorder?.stop();return;}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return mcToast("Enregistrement vocal indisponible dans ce navigateur.");if(!currentUser||!selectedUser||mcPlus.group)return mcToast("Ouvre une conversation privée d'abord.");
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});mcPlus.chunks=[];mcPlus.recorder=new MediaRecorder(stream);mcPlus.recorder.ondataavailable=e=>{if(e.data.size)mcPlus.chunks.push(e.data);};mcPlus.recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(mcPlus.chunks,{type:mcPlus.recorder.mimeType||"audio/webm"});if(!blob.size)return;try{const path=`${currentUser.id}/${Date.now()}-vocal.webm`;const {error:upErr}=await supabaseClient.storage.from("monchat-media").upload(path,blob,{contentType:blob.type});if(upErr)throw upErr;const {data}=supabaseClient.storage.from("monchat-media").getPublicUrl(path);const {error}=await supabaseClient.from("private_messages").insert({sender_id:currentUser.id,receiver_id:selectedUser.id,content:"Message vocal",media_url:data.publicUrl,message_type:"audio"});if(error)throw error;mcToast("Message vocal envoyé.");}catch(e){mcToast(e.message||"Envoi du vocal impossible.");}};mcPlus.recorder.start();mcPlus.recording=true;const btn=[...document.querySelectorAll(".mcplus-btn")].find(b=>b.textContent.includes("Vocal")||b.textContent.includes("Stop"));if(btn)btn.textContent="⏹️ Stop vocal";mcToast("Enregistrement en cours. Clique sur Stop vocal pour envoyer.");mcPlus.recorder.addEventListener("stop",()=>{mcPlus.recording=false;if(btn)btn.textContent="🎙️ Vocal";},{once:true});}catch(e){mcToast("Micro refusé ou indisponible.");}}
  async function mcNotifications(){if(!("Notification"in window))return mcToast("Notifications non prises en charge.");const p=await Notification.requestPermission();mcToast(p==="granted"?"Notifications activées.":"Autorisation refusée.");}
  function mcNotify(m){if(!m||m.sender_id===currentUser?.id||document.visibilityState==="visible")return;if("Notification"in window&&Notification.permission==="granted")new Notification("MonChat — nouveau message",{body:m.content||"Pièce jointe reçue"});}
  function mcTheme(){document.body.classList.toggle("mcplus-light");try{localStorage.setItem("monchat-theme",document.body.classList.contains("mcplus-light")?"light":"dark");}catch(e){}}
  async function mcCreateGroup(){if(!currentUser)return mcToast("Connecte-toi d'abord.");mcModal("Créer un groupe",[{name:"name",label:"Nom du groupe",required:true,maxLength:60},{name:"members",label:"Pseudos des membres, séparés par des virgules",placeholder:"alice, bob"}],async v=>{if(!v.name)throw Error("Donne un nom au groupe.");const {data:g,error}=await supabaseClient.from("chat_groups").insert({name:v.name,created_by:currentUser.id}).select("*").single();if(error)throw error;const ids=[currentUser.id];if(v.members){const names=v.members.split(",").map(x=>x.trim()).filter(Boolean);const {data:users,error:uerr}=await supabaseClient.from("profiles").select("id,username").in("username",names);if(uerr)throw uerr;ids.push(...(users||[]).map(x=>x.id));const found=new Set((users||[]).map(x=>x.username.toLowerCase()));const missing=names.filter(n=>!found.has(n.toLowerCase()));if(missing.length)mcToast("Pseudos introuvables : "+missing.join(", "));}const {error:merr}=await supabaseClient.from("chat_group_members").insert([...new Set(ids)].map(user_id=>({group_id:g.id,user_id})));if(merr)throw merr;await mcLoadGroups();await mcOpenGroup(g);mcToast("Groupe créé.");});}
  async function mcLoadGroups(){if(!currentUser||!mcEl("mcplus-group-list"))return;const {data,error}=await supabaseClient.from("chat_group_members").select("group_id,chat_groups(id,name,created_by)").eq("user_id",currentUser.id);if(error){console.warn("Groupes:",error.message);return;}const list=mcEl("mcplus-group-list");list.replaceChildren();(data||[]).forEach(r=>{const g=r.chat_groups;if(!g)return;const b=document.createElement("button");b.type="button";b.className="conversation";b.style.cssText="width:100%;text-align:left;display:flex;align-items:center;gap:10px;background:transparent;color:inherit;border:0;padding:9px;cursor:pointer";const a=document.createElement("div");a.className="avatar";a.textContent="👥";const n=document.createElement("div");n.className="conversation-name";n.textContent=g.name;b.append(a,n);b.onclick=()=>mcOpenGroup(g);list.appendChild(b);});}
  async function mcOpenGroup(g){if(!g||!currentUser)return;if(realtimeChannel){await supabaseClient.removeChannel(realtimeChannel);realtimeChannel=null;}if(mcPlus.groupChannel){await supabaseClient.removeChannel(mcPlus.groupChannel);mcPlus.groupChannel=null;}mcPlus.group=g;selectedUser=null;conversationRequest++;chatTitle.textContent="👥 "+g.name;chatStatus.textContent="Discussion de groupe";messageInput.disabled=false;sendButton.disabled=false;messageInput.placeholder=`Écris dans ${g.name}…`;messagesContainer.replaceChildren();const {data,error}=await supabaseClient.from("group_messages").select("*").eq("group_id",g.id).order("created_at",{ascending:true}).limit(300);if(error){mcToast(error.message);return;}for(const m of data||[])await mcDisplayGroupMessage(m);mcPlus.groupChannel=supabaseClient.channel("mcplus-group-"+g.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"group_messages",filter:`group_id=eq.${g.id}`},p=>mcDisplayGroupMessage(p.new)).subscribe();}
  async function mcDisplayGroupMessage(m){if(!m||messagesContainer.querySelector(`[data-mcplus-group="${m.id}"]`))return;const row=document.createElement("div");row.className="private-message"+(m.sender_id===currentUser.id?" me":"");row.dataset.mcplusGroup=m.id;const bubble=document.createElement("div");bubble.className="private-bubble";bubble.textContent=m.content||"";row.appendChild(bubble);const meta=document.createElement("div");meta.className="mcplus-meta";const who=document.createElement("span");who.textContent=m.sender_id===currentUser.id?"Toi":(m.username||"Membre");meta.appendChild(who);if(m.created_at){const t=document.createElement("span");t.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});meta.appendChild(t);}row.appendChild(meta);messagesContainer.appendChild(row);messagesContainer.scrollTop=messagesContainer.scrollHeight;}
  async function mcSendGroup(content){if(!mcPlus.group||!currentUser)return false;const {error}=await supabaseClient.from("group_messages").insert({group_id:mcPlus.group.id,sender_id:currentUser.id,content});if(error)mcToast(error.message);else messageInput.value="";return true;}
  function mcInit(){mcInject();try{if(localStorage.getItem("monchat-theme")==="light")document.body.classList.add("mcplus-light");}catch(e){}
    // La capture permet de gérer les groupes avant le gestionnaire privé existant.
    if(messageForm)messageForm.addEventListener("submit",async e=>{if(!mcPlus.group)return;e.preventDefault();e.stopImmediatePropagation();const content=messageInput.value.trim();if(content)await mcSendGroup(content);},true);
    if(messageInput)messageInput.addEventListener("input",()=>{if(!selectedUser||mcPlus.group)return;mcTyping(true);clearTimeout(mcPlus.typingTimer);mcPlus.typingTimer=setTimeout(()=>mcTyping(false),1200);});
    const originalDisplay=displayPrivateMessage;
    displayPrivateMessage=function(m){
      originalDisplay(m);
      if(m?.id){const rows=[...messagesContainer.querySelectorAll(".private-message")];const row=[...rows].reverse().find(x=>!x.dataset.mcplusId);if(row)row.dataset.mcplusId=String(m.id);}
      if(m && (m.media_url!==undefined || m.message_type!==undefined || m.is_read!==undefined || m.edited_at!==undefined))setTimeout(()=>mcDecorate(m),0);
      mcNotify(m);
    };
    const originalOpen=openConversation;
    openConversation=async function(user){mcPlus.group=null;if(mcPlus.groupChannel){await supabaseClient.removeChannel(mcPlus.groupChannel);mcPlus.groupChannel=null;}await originalOpen(user);await mcStatus(user.id);await mcMarkRead();await mcSetupTyping();};
    const originalLoad=loadPrivateMessages;
    loadPrivateMessages=async function(requestId){await originalLoad(requestId);if(!mcPlus.group&&selectedUser){const {data,error}=await supabaseClient.from("private_messages").select("id,sender_id,receiver_id,content,created_at,is_read,read_at,edited_at,media_url,message_type").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`).order("created_at",{ascending:true});if(!error){for(const m of data||[])await mcDecorate(m);await mcMarkRead();}}};
    const originalShow=showChat;showChat=async function(){await originalShow();mcInject();await mcPresence();await mcLoadGroups();await mcSetupTyping();};
    if(currentUser){mcPresence();mcLoadGroups();mcSetupTyping();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mcInit,{once:true});else mcInit();
})();
