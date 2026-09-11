/* ============================================================
   STUDENT PORTFOLIO — Full feature set
   ============================================================ */

const API_URL = '';
let currentUser = null;
let authToken = localStorage.getItem('sp_token');
let authMode = "login";
let editingAchievementId = null;
let heartbeatInterval = null;
let activeFriendId = null;
let chatPollInterval = null;
let language = localStorage.getItem('sp_lang') || 'en';

// ==================== TRANSLATIONS ====================
const TRANSLATIONS = {
    en: {
        fullName: "Full Name", email: "Email", password: "Password",
        login: "Login", signup: "Sign Up", logout: "Logout",
        aboutMe: "About Me", achievements: "Achievements", friends: "Friends",
        settings: "Settings", save: "Save", cancel: "Cancel", back: "Back",
        addFriend: "Add a Friend", send: "Send", pendingRequests: "Pending Requests",
        myFriends: "My Friends", chat: "Chat", publicAchievements: "Public Achievements",
        personalInfo: "Personal Info", course: "Course", school: "School",
        yearLevel: "Year Level", motto: "Motto", bio: "Bio",
        hobbies: "Hobbies", skills: "Skills", filterCategory: "Filter",
        addAchievement: "Add Achievement", title: "Title", category: "Category",
        date: "Date", visibility: "Visibility", description: "Description",
        public: "Public (friends see)", private: "Private",
        changePassword: "Change Password", currentPassword: "Current Password",
        newPassword: "New Password", changePhoto: "Change Photo",
        language: "Language", account: "Account", dangerZone: "Danger Zone",
        deleteAccount: "Delete Account", online: "Online", offline: "Offline"
    },
    fil: {
        fullName: "Buong Pangalan", email: "Email", password: "Password",
        login: "Mag-login", signup: "Mag-sign Up", logout: "Mag-logout",
        aboutMe: "Tungkol sa Akin", achievements: "Mga Tagumpay", friends: "Mga Kaibigan",
        settings: "Mga Setting", save: "I-save", cancel: "Kanselahin", back: "Bumalik",
        addFriend: "Magdagdag ng Kaibigan", send: "Ipadala", pendingRequests: "Mga Kahilingan",
        myFriends: "Aking mga Kaibigan", chat: "Makipag-usap", publicAchievements: "Pampublikong Tagumpay",
        personalInfo: "Personal na Impormasyon", course: "Kurso", school: "Paaralan",
        yearLevel: "Antas ng Taon", motto: "Motto", bio: "Tungkol sa Sarili",
        hobbies: "Mga Libangan", skills: "Mga Kasanayan", filterCategory: "Salain",
        addAchievement: "Magdagdag ng Tagumpay", title: "Pamagat", category: "Kategorya",
        date: "Petsa", visibility: "Pagkakita", description: "Paglalarawan",
        public: "Pampubliko (nakikita ng kaibigan)", private: "Pribado",
        changePassword: "Palitan ang Password", currentPassword: "Kasalukuyang Password",
        newPassword: "Bagong Password", changePhoto: "Palitan ang Larawan",
        language: "Wika", account: "Account", dangerZone: "Mapanganib",
        deleteAccount: "Burahin ang Account", online: "Online", offline: "Offline"
    },
    es: {
        fullName: "Nombre Completo", email: "Correo", password: "Contraseña",
        login: "Iniciar Sesión", signup: "Registrarse", logout: "Cerrar Sesión",
        aboutMe: "Sobre Mí", achievements: "Logros", friends: "Amigos",
        settings: "Ajustes", save: "Guardar", cancel: "Cancelar", back: "Atrás",
        addFriend: "Añadir Amigo", send: "Enviar", pendingRequests: "Solicitudes Pendientes",
        myFriends: "Mis Amigos", chat: "Chatear", publicAchievements: "Logros Públicos",
        personalInfo: "Información Personal", course: "Curso", school: "Escuela",
        yearLevel: "Año", motto: "Lema", bio: "Biografía",
        hobbies: "Pasatiempos", skills: "Habilidades", filterCategory: "Filtrar",
        addAchievement: "Añadir Logro", title: "Título", category: "Categoría",
        date: "Fecha", visibility: "Visibilidad", description: "Descripción",
        public: "Público (visible a amigos)", private: "Privado",
        changePassword: "Cambiar Contraseña", currentPassword: "Contraseña Actual",
        newPassword: "Nueva Contraseña", changePhoto: "Cambiar Foto",
        language: "Idioma", account: "Cuenta", dangerZone: "Zona de Peligro",
        deleteAccount: "Eliminar Cuenta", online: "En línea", offline: "Desconectado"
    }
};

function t(key) {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[language]?.[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = TRANSLATIONS[language][key];
            } else {
                el.innerText = TRANSLATIONS[language][key];
            }
        }
    });
}

function changeLanguage(lang) {
    language = lang;
    localStorage.setItem('sp_lang', lang);
    applyLanguage();
    // Persist to server
    if (authToken) {
        apiCall('/api/user/language', {
            method: 'PUT', body: JSON.stringify({ language: lang })
        }).catch(() => {});
    }
}

// ==================== HELPERS ====================
function $(id) { return document.getElementById(id); }
function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
}
function timeAgo(date) {
    if (!date) return "";
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
}
function toast(type, title, msg) {
    const wrap = $("toastWrap");
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.innerHTML = `<i class="fas ${type==="danger"?"fa-triangle-exclamation":type==="warn"?"fa-circle-exclamation":"fa-circle-check"}"></i>
        <div><div class="t-title">${escapeHtml(title)}</div><div class="t-msg">${escapeHtml(msg)}</div></div>
        <button class="x" onclick="this.parentElement.remove()">✕</button>`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// ==================== API ====================
async function apiCall(endpoint, options = {}) {
    const res = await fetch(API_URL + endpoint, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
            ...options.headers
        }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ==================== THEME ====================
function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("sp_theme", t);
}
function toggleTheme() {
    const cur = localStorage.getItem("sp_theme") || "light";
    applyTheme(cur === "light" ? "dark" : "light");
}
(function initTheme() {
    const s = localStorage.getItem("sp_theme");
    applyTheme(s || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
})();

// ==================== AUTH ====================
function toggleMode(mode) {
    authMode = mode;
    $("tabLogin").classList.toggle("active", mode === "login");
    $("tabSignup").classList.toggle("active", mode === "signup");
    $("fieldName").classList.toggle("hidden", mode === "login");
    $("submitBtn").innerText = mode === "login" ? t("login") : t("signup");
}

async function signup(fullName, email, password) {
    const data = await apiCall('/api/signup', {
        method: 'POST', body: JSON.stringify({ fullName, email, password })
    });
    authToken = data.token;
    localStorage.setItem('sp_token', authToken);
    currentUser = data.student;
    localStorage.setItem('sp_user', JSON.stringify(currentUser));
}

async function login(email, password) {
    const data = await apiCall('/api/login', {
        method: 'POST', body: JSON.stringify({ email, password })
    });
    authToken = data.token;
    localStorage.setItem('sp_token', authToken);
    currentUser = data.student;
    localStorage.setItem('sp_user', JSON.stringify(currentUser));
    if (data.student.language) {
        language = data.student.language;
        localStorage.setItem('sp_lang', language);
    }
}

function logout() {
    if (!confirm("Log out?")) return;
    stopHeartbeat();
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    location.reload();
}

// ==================== INIT ====================
async function initApp() {
    $("authSection").style.display = "none";
    $("app").style.display = "block";
    applyLanguage();
    hydrateTopBar();
    showView("profile");
    startHeartbeat();
    checkUnreadCount();
}

function hydrateTopBar() {
    if (!currentUser) return;
    $("userGreet").innerText = currentUser.fullName;
    $("userEmailSmall").innerText = currentUser.email;
    const av = currentUser.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(currentUser.fullName)}`;
    $("topAvatar").src = av;
    $("userAvatar").src = av;
    $("profName").innerText = currentUser.fullName;
    $("profEmail").innerText = currentUser.email;
    $("langSelect").value = language;
}

// ==================== NAVIGATION ====================
function showView(v) {
    ["profile", "achievements", "friends", "settings", "friend-detail", "chat"].forEach(id => {
        const el = $("view-" + id);
        if (el) el.classList.add("hidden");
    });
    $("view-" + v).classList.remove("hidden");

    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
    const nav = $("nav-" + v);
    if (nav) nav.classList.add("active");

    if (window.innerWidth <= 820) closeDrawer();

    if (v === "profile") loadProfile();
    if (v === "achievements") loadAchievements();
    if (v === "friends") { loadFriends(); loadRequests(); }
    if (v === "settings") updateStatusUI();
}

function toggleDrawer() {
    $("sidebar").classList.toggle("open");
    $("drawerBackdrop").classList.toggle("show");
}
function closeDrawer() {
    $("sidebar").classList.remove("open");
    $("drawerBackdrop").classList.remove("show");
}

// ==================== PROFILE ====================
async function loadProfile() {
    try {
        const data = await apiCall('/api/portfolio');
        const p = data.portfolio || {};
        $("pName").value = p.fullName || "";
        $("pCourse").value = p.course || "";
        $("pSchool").value = p.school || "";
        $("pYear").value = p.yearLevel || "";
        $("pMotto").value = p.motto || "";
        $("pBio").value = p.bio || "";
        $("pHobbies").value = (p.hobbies || []).join(", ");
        $("pSkills").value = (p.skills || []).join(", ");
    } catch (e) { toast("danger", "Error", "Load failed"); }
}

async function saveProfile() {
    try {
        await apiCall('/api/portfolio', {
            method: 'PUT',
            body: JSON.stringify({
                fullName: $("pName").value.trim(),
                course: $("pCourse").value.trim(),
                school: $("pSchool").value.trim(),
                yearLevel: $("pYear").value.trim(),
                motto: $("pMotto").value.trim(),
                bio: $("pBio").value.trim(),
                hobbies: $("pHobbies").value.split(",").map(s => s.trim()).filter(Boolean),
                skills: $("pSkills").value.split(",").map(s => s.trim()).filter(Boolean)
            })
        });
        toast("success", "Saved", "Profile updated.");
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== ACHIEVEMENTS ====================
async function loadAchievements() {
    try {
        const data = await apiCall('/api/achievements');
        const filter = $("achFilter").value;
        let list = data.achievements || [];
        if (filter) list = list.filter(a => a.category === filter);

        const c = $("achievementsList");
        if (list.length === 0) { c.innerHTML = '<p class="empty">No achievements yet.</p>'; return; }
        c.innerHTML = list.map(a => `
            <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                <div class="entry">
                    <div style="flex:1;">
                        <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                        <h4><i class="fas fa-trophy" style="color:var(--primary);"></i> ${escapeHtml(a.title)}</h4>
                        ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                        <div class="chips">
                            ${a.visibility === "private"
                                ? `<span class="chip private"><i class="fas fa-lock"></i> ${t("private")}</span>`
                                : `<span class="chip"><i class="fas fa-eye"></i> ${t("public")}</span>`}
                        </div>
                    </div>
                    <div class="entry-actions">
                        <button class="iconbtn" onclick="editAchievement('${a._id}')"><i class="fas fa-pen"></i></button>
                        <button class="iconbtn danger" onclick="deleteAchievement('${a._id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (e) { toast("danger", "Error", "Load failed"); }
}

function openAchievementModal(ach = null) {
    editingAchievementId = ach?._id || null;
    $("achModalTitle").innerText = editingAchievementId ? "Edit" : "New Achievement";
    $("achTitle").value = ach?.title || "";
    $("achCategory").value = ach?.category || "Academic";
    $("achDate").value = ach?.date || new Date().toISOString().slice(0,10);
    $("achVisibility").value = ach?.visibility || "public";
    $("achDesc").value = ach?.description || "";
    $("achievementBackdrop").style.display = "flex";
}
function closeAchievementModal() {
    $("achievementBackdrop").style.display = "none";
    editingAchievementId = null;
}

async function saveAchievement() {
    const title = $("achTitle").value.trim();
    if (!title) return toast("warn", "Missing", "Enter a title.");
    const body = {
        title,
        description: $("achDesc").value.trim(),
        category: $("achCategory").value,
        date: $("achDate").value,
        visibility: $("achVisibility").value
    };
    try {
        if (editingAchievementId) {
            await apiCall(`/api/achievements/${editingAchievementId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            await apiCall('/api/achievements', { method: 'POST', body: JSON.stringify(body) });
        }
        toast("success", "Saved", "Achievement saved.");
        closeAchievementModal();
        loadAchievements();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function editAchievement(id) {
    const data = await apiCall('/api/achievements');
    const ach = data.achievements.find(a => a._id === id);
    if (ach) openAchievementModal(ach);
}

async function deleteAchievement(id) {
    if (!confirm("Delete?")) return;
    await apiCall(`/api/achievements/${id}`, { method: 'DELETE' });
    toast("", "Deleted", "");
    loadAchievements();
}

// ==================== FRIENDS ====================
async function addFriendAction() {
    const email = $("friendEmail").value.trim().toLowerCase();
    if (!email) return toast("warn", "Missing", "Enter an email.");
    try {
        await apiCall('/api/friends/request', {
            method: 'POST', body: JSON.stringify({ toUserEmail: email })
        });
        $("friendEmail").value = "";
        toast("success", "Sent", `Request sent`);
    } catch (e) { toast("danger", "Error", e.message); }
}

async function loadRequests() {
    try {
        const data = await apiCall('/api/friends/requests');
        const c = $("pendingRequests");
        if (!data.requests?.length) {
            c.innerHTML = '<p class="muted" style="text-align:center;">No pending requests.</p>';
            return;
        }
        c.innerHTML = data.requests.map(r => `
            <div class="friend-item">
                <div class="friend-info">
                    <img class="friend-avatar" src="${r.fromPhoto || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${r.fromName?.[0] || 'U'}`}">
                    <div>
                        <div class="friend-name">${escapeHtml(r.fromName)}</div>
                        <div class="friend-email">${escapeHtml(r.fromEmail)}</div>
                    </div>
                </div>
                <button class="btn-inline" onclick="acceptFriend('${r.id}')"><i class="fas fa-check"></i></button>
            </div>
        `).join("");
    } catch (e) { console.error(e); }
}

async function acceptFriend(fromUserId) {
    await apiCall('/api/friends/accept', {
        method: 'POST', body: JSON.stringify({ fromUserId })
    });
    toast("success", "Accepted", "You are now friends!");
    loadRequests();
    loadFriends();
}

async function loadFriends() {
    try {
        const data = await apiCall('/api/friends/list');
        const c = $("friendsList");
        if (!data.friends?.length) {
            c.innerHTML = '<p class="muted" style="text-align:center;">No friends yet.</p>';
            $("onlineCount").innerText = "";
            return;
        }
        let online = 0;
        c.innerHTML = data.friends.map(f => {
            if (f.onlineStatus === "online") online++;
            const av = f.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${f.name?.[0] || 'U'}`;
            return `
                <div class="friend-item">
                    <div class="friend-info" onclick="viewFriendProfile('${f.id}')" style="cursor:pointer;">
                        <img class="friend-avatar" src="${av}">
                        <div>
                            <div class="friend-name">${escapeHtml(f.name)}</div>
                            <div class="friend-email">${escapeHtml(f.email)}</div>
                            <div class="friend-status">
                                <span class="status-dot ${f.onlineStatus}"></span>
                                <span>${f.onlineStatus === "online" ? t("online") : `Last seen ${timeAgo(f.lastSeen)}`}</span>
                            </div>
                        </div>
                    </div>
                    <button class="iconbtn danger" onclick="unfriend('${f.id}','${escapeHtml(f.email)}')"><i class="fas fa-user-minus"></i></button>
                </div>
            `;
        }).join("");
        $("onlineCount").innerText = `(${online} online)`;
    } catch (e) { console.error(e); }
}

async function unfriend(id, email) {
    if (!confirm(`Unfriend ${email}?`)) return;
    await apiCall('/api/friends/unfriend', {
        method: 'POST', body: JSON.stringify({ friendId: id })
    });
    toast("", "Unfriended", "");
    loadFriends();
}

async function viewFriendProfile(id) {
    try {
        activeFriendId = id;
        const data = await apiCall(`/api/friends/${id}/profile`);
        const f = data.friend;
        const p = data.portfolio || {};
        const av = f.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${f.name?.[0] || 'U'}`;

        $("fdPhoto").src = av;
        $("fdName").innerText = f.name;
        $("fdStatus").innerHTML = `<span class="status-dot ${f.onlineStatus}"></span> ${f.onlineStatus === "online" ? t("online") : `Last seen ${timeAgo(f.lastSeen)}`}`;
        $("fdCourse").innerText = [p.course, p.school, p.yearLevel].filter(Boolean).join(" • ");
        $("fdBio").innerText = p.bio || "";
        $("fdMotto").innerText = p.motto ? `"${p.motto}"` : "";

        const ach = data.achievements || [];
        $("fdAchievements").innerHTML = ach.length === 0
            ? '<p class="muted">No public achievements yet.</p>'
            : ach.map(a => `
                <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                    <small>${escapeHtml(a.date || "")} • ${escapeHtml(a.category)}</small>
                    <h4><i class="fas fa-trophy" style="color:var(--primary);"></i> ${escapeHtml(a.title)}</h4>
                    ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                </div>
            `).join("");

        showView("friend-detail");
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== CHAT ====================
function openChat() {
    if (!activeFriendId) return;
    showView("chat");
    // populate header
    const friendName = $("fdName").innerText;
    const friendPhoto = $("fdPhoto").src;
    $("chatName").innerText = friendName;
    $("chatAvatar").src = friendPhoto;
    $("chatStatusDot").className = $("fdStatus").querySelector(".status-dot")?.className || "status-dot offline";
    $("chatStatusText").innerText = $("fdStatus").innerText.replace(/^[^\s]+\s/, '');

    loadChat();
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadChat, 3000);
}

async function loadChat() {
    if (!activeFriendId) return;
    try {
        const data = await apiCall(`/api/chat/${activeFriendId}`);
        const c = $("chatMessages");
        if (!data.messages?.length) {
            c.innerHTML = '<p class="muted" style="text-align:center;">No messages yet. Say hi!</p>';
            return;
        }
        c.innerHTML = data.messages.map(m => {
            const isMine = m.from === currentUser.id;
            const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `<div class="msg-wrap ${isMine ? 'mine' : 'theirs'}">
                <div class="msg ${isMine ? 'mine' : 'theirs'}">${escapeHtml(m.text)}</div>
                <div class="msg-time">${time}</div>
            </div>`;
        }).join("");
        c.scrollTop = c.scrollHeight;
    } catch (e) { console.error(e); }
}

async function sendMessage() {
    const input = $("chatInput");
    const text = input.value.trim();
    if (!text || !activeFriendId) return;
    input.value = "";
    try {
        await apiCall(`/api/chat/${activeFriendId}`, {
            method: 'POST', body: JSON.stringify({ text })
        });
        loadChat();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function checkUnreadCount() {
    try {
        const data = await apiCall('/api/chat/unread/count');
        const navFriends = $("nav-friends");
        const existing = navFriends.querySelector(".badge");
        if (existing) existing.remove();
        if (data.count > 0) {
            const badge = document.createElement("span");
            badge.className = "badge";
            badge.innerText = data.count;
            navFriends.appendChild(badge);
        }
    } catch {}
}
setInterval(checkUnreadCount, 15000);

// ==================== STATUS ====================
function updateStatusUI() {
    if (!currentUser) return;
    const isOnline = currentUser.onlineStatus === "online";
    $("myStatusDot").className = "status-dot " + (isOnline ? "online" : "offline");
    $("myStatusText").innerText = isOnline ? t("online") : t("offline");
}

async function updateOnlineStatus(isOnline) {
    try {
        await apiCall('/api/status/update', {
            method: 'POST', body: JSON.stringify({ status: isOnline ? "online" : "offline" })
        });
        if (currentUser) currentUser.onlineStatus = isOnline ? "online" : "offline";
        updateStatusUI();
    } catch {}
}

async function toggleOnlineStatus() {
    if (!currentUser) return;
    const newStatus = currentUser.onlineStatus !== "online";
    await updateOnlineStatus(newStatus);
    toast("", "Status", newStatus ? t("online") : t("offline"));
}

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    updateOnlineStatus(true);
    heartbeatInterval = setInterval(() => {
        if (currentUser && document.visibilityState === "visible") updateOnlineStatus(true);
    }, 30000);
}
function stopHeartbeat() {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    if (currentUser) updateOnlineStatus(false);
}

window.addEventListener("beforeunload", () => {
    if (!currentUser || !authToken) return;
    navigator.sendBeacon("/api/status/update",
        new Blob([JSON.stringify({ status: "offline", token: authToken })], { type: "application/json" }));
});

// ==================== SETTINGS ====================
async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return toast("warn", "Too large", "Max 2MB.");
    const reader = new FileReader();
    reader.onload = async () => {
        await apiCall('/api/user/photo', {
            method: 'PUT', body: JSON.stringify({ photo: reader.result })
        });
        currentUser.photo = reader.result;
        localStorage.setItem('sp_user', JSON.stringify(currentUser));
        hydrateTopBar();
        toast("success", "Updated", "Photo changed.");
    };
    reader.readAsDataURL(file);
}

async function changePassword() {
    const cur = $("curPass").value;
    const nw = $("newPass").value;
    if (!cur || !nw) return toast("warn", "Missing", "Fill in both passwords.");
    if (nw.length < 6) return toast("warn", "Weak", "Min 6 characters.");
    try {
        await apiCall('/api/user/password', {
            method: 'PUT', body: JSON.stringify({ currentPassword: cur, newPassword: nw })
        });
        $("curPass").value = "";
        $("newPass").value = "";
        toast("success", "Changed", "Password updated.");
    } catch (e) { toast("danger", "Error", e.message); }
}

async function wipeMyData() {
    if (!confirm("Delete account permanently?")) return;
    if (!confirm("Are you SURE?")) return;
    await apiCall('/api/user/delete', { method: 'DELETE' });
    logout();
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
    applyLanguage();
    const stored = localStorage.getItem('sp_user');
    if (authToken && stored) {
        currentUser = JSON.parse(stored);
        initApp();
    }

    $("authForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = $("email").value.trim().toLowerCase();
        const password = $("pass").value;
        try {
            if (authMode === "signup") {
                const name = $("regName").value.trim();
                if (!name) return toast("warn", "Missing", "Enter your name.");
                if (password.length < 6) return toast("warn", "Weak", "Min 6 characters.");
                await signup(name, email, password);
                toast("success", "Welcome!", `Hello ${name}`);
            } else {
                await login(email, password);
                toast("success", "Welcome!", `Hello ${currentUser.fullName}`);
            }
            initApp();
        } catch (err) {
            toast("danger", "Error", err.message);
        }
    });
});
