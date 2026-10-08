
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


/* =========================
   ELEMENTS
   ========================= */

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

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const messagesContainer =
    document.getElementById("messages");


let isSignup = false;


/* =========================
   CHANGER LOGIN / INSCRIPTION
   ========================= */

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


/* =========================
   AUTH
   ========================= */

authForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username =
        usernameInput.value.trim();

    const password =
        passwordInput.value;

    authMessage.textContent = "";


    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {

        authMessage.textContent =
            "Le pseudo contient des caractères invalides.";

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
            ? "Création..."
            : "Connexion...";


    const email =
        `${username}@monchat.local`;


    try {

        if (isSignup) {

            const { data, error } =
                await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });


            if (error) {
                throw error;
            }


            if (!data.user) {
                throw new Error(
                    "Impossible de créer le compte."
                );
            }


            const { error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .insert({
                        id: data.user.id,
                        username: username
                    });


            if (profileError) {

                console.error(profileError);

                authMessage.textContent =
                    "Compte créé, mais impossible de créer le profil.";

                return;
            }


            await showChat();

        } else {

            const { error } =
                await supabaseClient.auth
                    .signInWithPassword({
                        email: email,
                        password: password
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


/* =========================
   AFFICHER LE CHAT
   ========================= */

async function showChat() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    if (!user) {
        return;
    }


    const {
        data: profile,
        error
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();


    if (error) {

        console.error(error);

        return;
    }


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


    await loadMessages();
}


/* =========================
   SESSION
   ========================= */

async function checkSession() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();


    if (session) {
        await showChat();
    }
}


checkSession();


/* =========================
   CHARGER LES MESSAGES
   ========================= */

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

        console.error(error);

        return;
    }


    messagesContainer.innerHTML = "";


    for (const message of data) {

        await displayMessage(message);
    }


    scrollMessages();
}


/* =========================
   AFFICHER UN MESSAGE
   ========================= */

async function displayMessage(message) {

    const {
        data: profile
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", message.username)
        .maybeSingle();


    let username =
        message.username;


    if (profile) {
        username = profile.username;
    }


    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    const div =
        document.createElement("div");


    div.className =
        "message";


    if (
        user &&
        message.username === user.id
    ) {
        div.classList.add("me");
    }


    const bubble =
        document.createElement("div");


    bubble.className =
        "message-bubble";


    bubble.innerHTML =
        `<strong>${escapeHTML(username)}</strong><br>${escapeHTML(message.content)}`;


    div.appendChild(bubble);

    messagesContainer.appendChild(div);
}


/* =========================
   ENVOYER MESSAGE
   ========================= */

messageForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const content =
        messageInput.value.trim();


    if (!content) {
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


    const {
        error
    } = await supabaseClient
        .from("messages")
        .insert({
            username: user.id,
            content: content
        });


    if (error) {

        console.error(error);

        return;
    }


    messageInput.value = "";
});


/* =========================
   REALTIME
   ========================= */

supabaseClient
    .channel("messages-channel")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages"
        },
        async (payload) => {

            await displayMessage(
                payload.new
            );

            scrollMessages();
        }
    )
    .subscribe();


/* =========================
   SCROLL
   ========================= */

function scrollMessages() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


/* =========================
   SECURITE HTML
   ========================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


/* =========================
   PARTICULES ANIMÉES
   ========================= */

const canvas =
    document.getElementById("particles");


if (canvas) {

    const ctx =
        canvas.getContext("2d");


    let particles = [];


    function resizeParticles() {

        const rect =
            canvas.parentElement.getBoundingClientRect();


        canvas.width =
            rect.width * window.devicePixelRatio;

        canvas.height =
            rect.height * window.devicePixelRatio;


        canvas.style.width =
            rect.width + "px";

        canvas.style.height =
            rect.height + "px";


        ctx.setTransform(
            window.devicePixelRatio,
            0,
            0,
            window.devicePixelRatio,
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

                x: Math.random() * width,

                y: Math.random() * height,

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


        /* Points */

        for (const p of particles) {

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
                "rgba(150, 170, 255, 0.75)";

            ctx.fill();
        }


        /* Lignes entre les points */

        for (let i = 0; i < particles.length; i++) {

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
                        (1 - distance / 120) * 0.18;


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
                        `rgba(120, 140, 255, ${opacity})`;

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