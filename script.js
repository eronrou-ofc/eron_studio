
// ===============================
// SUPABASE
// ===============================

const SUPABASE_URL = "https://gyjonweumwmlvfvcksjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VbxuB8dM6XPJgK8xR3N2dA_S3b60VCk";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =====================================================
   ELEMENTS
   ===================================================== */

const authScreen =
    document.getElementById("authScreen");

const chatApp =
    document.getElementById("chatApp");

const authForm =
    document.getElementById("authForm");

const usernameInput =
    document.getElementById("usernameInput");

const passwordInput =
    document.getElementById("passwordInput");

const authButton =
    document.getElementById("authButton");

const authMessage =
    document.getElementById("authMessage");

const switchAuth =
    document.getElementById("switchAuth");

const switchText =
    document.getElementById("switchText");

const authTitle =
    document.getElementById("authTitle");

const usernameDisplay =
    document.getElementById("usernameDisplay");

const userAvatar =
    document.getElementById("userAvatar");

const userSearch =
    document.getElementById("userSearch");

const searchResults =
    document.getElementById("searchResults");

const conversations =
    document.getElementById("conversations");

const logoutButton =
    document.getElementById("logoutButton");

const chatTitle =
    document.getElementById("chatTitle");

const chatStatus =
    document.getElementById("chatStatus");

const messagesContainer =
    document.getElementById("messages");

const emptyChat =
    document.getElementById("emptyChat");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.querySelector(".send");


let isSignup = false;

let currentUser = null;

let currentProfile = null;

let selectedUser = null;

let realtimeChannel = null;


/* =====================================================
   LOGIN / INSCRIPTION
   ===================================================== */

switchAuth.addEventListener("click", () => {

    isSignup = !isSignup;

    authMessage.textContent = "";

    if (isSignup) {

        authTitle.textContent =
            "Crée ton compte MonChat";

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


/* =====================================================
   AUTHENTIFICATION
   ===================================================== */

authForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username =
        usernameInput.value.trim();

    const password =
        passwordInput.value;

    authMessage.textContent = "";


    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {

        authMessage.textContent =
            "Pseudo invalide.";

        return;
    }


    if (username.length < 3 || username.length > 20) {

        authMessage.textContent =
            "Le pseudo doit contenir entre 3 et 20 caractères.";

        return;
    }


    if (password.length < 6) {

        authMessage.textContent =
            "Le mot de passe doit contenir au moins 6 caractères.";

        return;
    }


    authButton.disabled = true;

    authButton.textContent =
        isSignup
            ? "CRÉATION..."
            : "CONNEXION...";


    const email =
        `${username}@monchat.local`;


    try {

        if (isSignup) {

            const {
                data,
                error
            } =
                await supabaseClient.auth.signUp({
                    email,
                    password
                });


            if (error) {
                throw error;
            }


            if (!data.user) {
                throw new Error(
                    "Impossible de créer le compte."
                );
            }


            const {
                error: profileError
            } =
                await supabaseClient
                    .from("profiles")
                    .insert({
                        id: data.user.id,
                        username
                    });


            if (profileError) {
                throw profileError;
            }


            await showChat();

        } else {

            const {
                error
            } =
                await supabaseClient.auth
                    .signInWithPassword({
                        email,
                        password
                    });


            if (error) {
                throw error;
            }


            await showChat();
        }

    } catch (error) {

        console.error(error);

        authMessage.textContent =
            error.message ||
            "Une erreur est survenue.";

    } finally {

        authButton.disabled = false;

        authButton.textContent =
            isSignup
                ? "Créer mon compte"
                : "Se connecter";
    }
});


/* =====================================================
   SESSION
   ===================================================== */

async function checkSession() {

    const {
        data: {
            session
        }
    } =
        await supabaseClient.auth.getSession();


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


/* =====================================================
   AFFICHER L'APPLICATION
   ===================================================== */

async function showChat() {

    const {
        data: {
            user
        }
    } =
        await supabaseClient.auth.getUser();


    if (!user) {
        return;
    }


    currentUser = user;


    const {
        data: profile,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("id, username")
            .eq("id", user.id)
            .single();


    if (error) {

        console.error(error);

        return;
    }


    currentProfile = profile;


    usernameDisplay.textContent =
        profile.username;


    userAvatar.textContent =
        profile.username
            .charAt(0)
            .toUpperCase();


    authScreen.style.display =
        "none";

    chatApp.style.display =
        "flex";


    await loadConversations();
}


/* =====================================================
   DECONNEXION
   ===================================================== */

logoutButton.addEventListener("click", async () => {

    if (realtimeChannel) {

        await supabaseClient
            .removeChannel(realtimeChannel);

        realtimeChannel = null;
    }


    await supabaseClient.auth.signOut();


    currentUser = null;

    currentProfile = null;

    selectedUser = null;


    chatApp.style.display =
        "none";

    authScreen.style.display =
        "flex";


    usernameInput.value = "";

    passwordInput.value = "";

    authMessage.textContent = "";

    messageInput.value = "";

    messageInput.disabled = true;

    sendButton.disabled = true;

    messagesContainer.innerHTML = "";


    const empty =
        document.createElement("div");

    empty.className =
        "empty-chat";

    empty.innerHTML = `
        <div class="empty-icon">💬</div>
        <h3>Tes conversations</h3>
        <p>Recherche un utilisateur pour commencer à discuter.</p>
    `;

    messagesContainer.appendChild(empty);
});


/* =====================================================
   RECHERCHE UTILISATEUR
   ===================================================== */

let searchTimeout = null;


userSearch.addEventListener("input", () => {

    clearTimeout(searchTimeout);


    const query =
        userSearch.value.trim();


    if (!query) {

        searchResults.innerHTML = "";

        return;
    }


    searchTimeout =
        setTimeout(
            () => searchUsers(query),
            250
        );
});


async function searchUsers(query) {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("id, username")
            .ilike("username", `%${query}%`)
            .neq("id", currentUser.id)
            .limit(20);


    if (error) {

        console.error(error);

        return;
    }


    searchResults.innerHTML = "";


    if (!data || data.length === 0) {

        searchResults.innerHTML =
            `<div style="padding:10px;color:#555;font-size:11px;">
                Aucun utilisateur trouvé.
            </div>`;

        return;
    }


    data.forEach(user => {

        const item =
            document.createElement("div");

        item.className =
            "user-result";


        item.innerHTML = `
            <div class="avatar">
                ${escapeHTML(
                    user.username
                        .charAt(0)
                        .toUpperCase()
                )}
            </div>

            <div>
                <div class="user-result-name">
                    ${escapeHTML(user.username)}
                </div>

                <span class="user-result-status">
                    Utilisateur MonChat
                </span>
            </div>
        `;


        item.addEventListener(
            "click",
            () => openConversation(user)
        );


        searchResults.appendChild(item);
    });
}


/* =====================================================
   OUVRIR CONVERSATION
   ===================================================== */

async function openConversation(user) {

    selectedUser = user;


    chatTitle.textContent =
        user.username;


    chatStatus.textContent =
        "🟢 Conversation privée";


    messageInput.disabled = false;

    sendButton.disabled = false;

    messageInput.placeholder =
        `Écris à ${user.username}...`;


    searchResults.innerHTML = "";

    userSearch.value = "";


    await loadPrivateMessages();


    subscribeToPrivateMessages();


    await loadConversations();
}


/* =====================================================
   CHARGER MESSAGES PRIVÉS
   ===================================================== */

async function loadPrivateMessages() {

    if (!currentUser || !selectedUser) {
        return;
    }


    messagesContainer.innerHTML = "";


    const {
        data,
        error
    } =
        await supabaseClient
            .from("private_messages")
            .select("*")
            .or(
                `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`
            )
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error(error);

        return;
    }


    if (!data || data.length === 0) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-chat";

        empty.innerHTML = `
            <div class="empty-icon">👋</div>
            <h3>Nouvelle conversation</h3>
            <p>Envoie ton premier message à ${escapeHTML(selectedUser.username)}.</p>
        `;

        messagesContainer.appendChild(empty);

        return;
    }


    data.forEach(message => {

        displayPrivateMessage(message);
    });


    scrollMessages();
}


/* =====================================================
   AFFICHER MESSAGE PRIVÉ
   ===================================================== */

function displayPrivateMessage(message) {

    const div =
        document.createElement("div");


    div.className =
        "private-message";


    if (
        message.sender_id === currentUser.id
    ) {

        div.classList.add("me");
    }


    const bubble =
        document.createElement("div");


    bubble.className =
        "private-bubble";


    bubble.textContent =
        message.content;


    div.appendChild(bubble);


    messagesContainer.appendChild(div);
}


/* =====================================================
   ENVOYER MESSAGE PRIVÉ
   ===================================================== */

messageForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (
            !currentUser ||
            !selectedUser
        ) {
            return;
        }


        const content =
            messageInput.value.trim();


        if (!content) {
            return;
        }


        const {
            error
        } =
            await supabaseClient
                .from("private_messages")
                .insert({
                    sender_id:
                        currentUser.id,

                    receiver_id:
                        selectedUser.id,

                    content
                });


        if (error) {

            console.error(error);

            return;
        }


        messageInput.value = "";

        messageInput.focus();
    }
);


/* =====================================================
   REALTIME MESSAGES PRIVÉS
   ===================================================== */

function subscribeToPrivateMessages() {

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );
    }


    realtimeChannel =
        supabaseClient
            .channel(
                `private-chat-${currentUser.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "private_messages"
                },
                payload => {

                    const message =
                        payload.new;


                    const belongsToConversation =
                        (
                            message.sender_id === currentUser.id &&
                            message.receiver_id === selectedUser.id
                        )
                        ||
                        (
                            message.sender_id === selectedUser.id &&
                            message.receiver_id === currentUser.id
                        );


                    if (
                        belongsToConversation
                    ) {

                        const existingEmpty =
                            messagesContainer
                                .querySelector(".empty-chat");


                        if (existingEmpty) {
                            existingEmpty.remove();
                        }


                        displayPrivateMessage(
                            message
                        );


                        scrollMessages();
                    }


                    loadConversations();
                }
            )
            .subscribe();
}


/* =====================================================
   CONVERSATIONS
   ===================================================== */

async function loadConversations() {

    if (!currentUser) {
        return;
    }


    conversations.innerHTML = "";


    const {
        data,
        error
    } =
        await supabaseClient
            .from("private_messages")
            .select(
                "sender_id, receiver_id, created_at"
            )
            .or(
                `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(error);

        return;
    }


    const userIds = [];


    data.forEach(message => {

        const otherId =
            message.sender_id === currentUser.id
                ? message.receiver_id
                : message.sender_id;


        if (
            !userIds.includes(otherId)
        ) {

            userIds.push(otherId);
        }
    });


    if (userIds.length === 0) {

        conversations.innerHTML =
            `<div style="padding:10px;color:#555;font-size:11px;">
                Aucune conversation.
            </div>`;

        return;
    }


    const {
        data: profiles,
        error: profilesError
    } =
        await supabaseClient
            .from("profiles")
            .select("id, username")
            .in("id", userIds);


    if (profilesError) {

        console.error(profilesError);

        return;
    }


    userIds.forEach(id => {

        const profile =
            profiles.find(
                p => p.id === id
            );


        if (!profile) {
            return;
        }


        const item =
            document.createElement("div");


        item.className =
            "conversation";


        if (
            selectedUser &&
            selectedUser.id === profile.id
        ) {

            item.classList.add("active");
        }


        item.innerHTML = `
            <div class="avatar">
                ${escapeHTML(
                    profile.username
                        .charAt(0)
                        .toUpperCase()
                )}
            </div>

            <div class="conversation-name">
                ${escapeHTML(profile.username)}
            </div>
        `;


        item.addEventListener(
            "click",
            () => openConversation(profile)
        );


        conversations.appendChild(item);
    });
}


/* =====================================================
   SCROLL
   ===================================================== */

function scrollMessages() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


/* =====================================================
   SECURITE
   ===================================================== */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


/* =====================================================
   PARTICULES CYBERPUNK
   ===================================================== */

const canvas =
    document.getElementById("particles");


if (canvas) {

    const ctx =
        canvas.getContext("2d");


    let particles = [];


    function resizeParticles() {

        const rect =
            canvas.parentElement.getBoundingClientRect();


        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );


        canvas.width =
            rect.width * dpr;

        canvas.height =
            rect.height * dpr;


        canvas.style.width =
            rect.width + "px";

        canvas.style.height =
            rect.height + "px";


        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );
    }


    function createParticles() {

        const width =
            canvas.parentElement.clientWidth;

        const height =
            canvas.parentElement.clientHeight;


        const count =
            Math.min(
                100,
                Math.max(
                    45,
                    Math.floor(width / 15)
                )
            );


        particles = [];


        for (let i = 0; i < count; i++) {

            particles.push({

                x:
                    Math.random() * width,

                y:
                    Math.random() * height,

                size:
                    Math.random() * 1.7 + 0.6,

                speedX:
                    (Math.random() - 0.5) * 0.35,

                speedY:
                    (Math.random() - 0.5) * 0.35
            });
        }
    }


    function animateParticles() {

        const width =
            canvas.parentElement.clientWidth;

        const height =
            canvas.parentElement.clientHeight;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];


            p.x += p.speedX;

            p.y += p.speedY;


            if (p.x < 0)
                p.x = width;

            if (p.x > width)
                p.x = 0;

            if (p.y < 0)
                p.y = height;

            if (p.y > height)
                p.y = 0;


            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                "rgba(255,255,255,0.75)";

            ctx.fill();
        }


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            for (
                let j = i + 1;
                j < particles.length;
                j++
            ) {

                const p1 =
                    particles[i];

                const p2 =
                    particles[j];


                const dx =
                    p1.x - p2.x;

                const dy =
                    p1.y - p2.y;


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                if (distance < 120) {

                    const opacity =
                        (1 - distance / 120)
                        * 0.18;


                    ctx.beginPath();

                    ctx.moveTo(
                        p1.x,
                        p1.y
                    );

                    ctx.lineTo(
                        p2.x,
                        p2.y
                    );


                    ctx.strokeStyle =
                        `rgba(255,255,255,${opacity})`;

                    ctx.lineWidth = 1;

                    ctx.stroke();
                }
            }
        }


        requestAnimationFrame(
            animateParticles
        );
    }


    resizeParticles();

    createParticles();

    animateParticles();


    window.addEventListener(
        "resize",
        () => {

            resizeParticles();

            createParticles();
        }
    );
}