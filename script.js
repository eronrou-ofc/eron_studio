
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
        await setupCallSignaling();

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

        if (typeof callState !== "undefined" && callState.status !== "idle") {
            await finishCall(true, "Appel terminé.");
        }
        if (typeof callSignalChannel !== "undefined" && callSignalChannel) {
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