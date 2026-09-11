/* ============================================================
   STUDENT PORTFOLIO — with Friends, Status, Achievements
   ============================================================ */

const API_URL = ''; // same origin — leave empty
let currentUser = null;
let authToken = localStorage.getItem('sp_token');
let authMode = "login";
let editingAchievementId = null;
let heartbeatInterval = null;

// ==================== HELPERS ====================
function $(id) { return document.getElementById(id); }
function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
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
    $("submitBtn").innerText = mode === "login" ? "Login" : "Create Account";
}

async function signup(fullName, email, password) {
    const data = await apiCall('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password })
    });
    authToken = data.token;
    localStorage.setItem('sp_token', authToken);
    currentUser = data.student;
    localStorage.setItem('sp_user', JSON.stringify(currentUser));
}

async function login(email, password) {
    const data = await apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    authToken = data.token;
    localStorage.setItem('sp_token', authToken);
    currentUser = data.student;
    localStorage.setItem('sp_user', JSON.stringify(currentUser));
}

function logout() {
    if (!confirm("Log out?")) return;
    stopHeartbeat();
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    location.reload();
}

// ==================== APP INIT ====================
async function initApp() {
    $("authSection").style.display = "none";
    $("app").style.display = "block";
    hydrateTopBar();
    showView("profile");
    startHeartbeat();
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
}

// ==================== NAVIGATION ====================
function showView(v) {
    ["profile", "achievements", "friends", "settings", "friend-detail"].forEach(id => {
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
        if (list.length === 0) {
            c.innerHTML = '<p class="empty">No achievements yet.</p>';
            return;
        }
        c.innerHTML = list.map(a => `
            <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                <div class="entry">
                    <div style="flex:1;">
                        <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                        <h4><i class="fas fa-trophy" style="color:var(--primary);"></i> ${escapeHtml(a.title)}</h4>
                        ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                        <div class="chips">
                            ${a.visibility === "private"
                                ? '<span class="chip private"><i class="fas fa-lock"></i> Private</span>'
                                : '<span class="chip"><i class="fas fa-eye"></i> Public</span>'}
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
    $("achModalTitle").innerText = editingAchievementId ? "Edit Achievement" : "New Achievement";
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
    if (!title) return toast("warn", "Missing title", "Enter a title.");
    const body = {
        title,
        description: $("achDesc").value.trim(),
        category: $("achCategory").value,
        date: $("achDate").value,
        visibility: $("achVisibility").value
    };
    try {
        if (editingAchievementId) {
            await apiCall(`/api/achievements/${editingAchievementId}`, {
                method: 'PUT', body: JSON.stringify(body)
            });
        } else {
            await apiCall('/api/achievements', {
                method: 'POST', body: JSON.stringify(body)
            });
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
    if (!confirm("Delete this achievement?")) return;
    await apiCall(`/api/achievements/${id}`, { method: 'DELETE' });
    toast("", "Deleted", "Achievement removed.");
    loadAchievements();
}

// ==================== FRIENDS ====================
async function addFriendAction() {
    const email = $("friendEmail").value.trim().toLowerCase();
    if (!email) return toast("warn", "Missing email", "Enter an email.");
    try {
        await apiCall('/api/friends/request', {
            method: 'POST',
            body: JSON.stringify({ toUserEmail: email })
        });
        $("friendEmail").value = "";
        toast("success", "Sent", `Request sent to ${email}`);
    } catch (e) { toast("danger", "Error", e.message); }
}

async function loadRequests() {
    try {
        const data = await apiCall('/api/friends/requests');
        const c = $("pendingRequests");
        if (!data.requests || data.requests.length === 0) {
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
                <button class="btn-inline" onclick="acceptFriend('${r.id}')"><i class="fas fa-check"></i> Accept</button>
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
        if (!data.friends || data.friends.length === 0) {
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
                                <span>${f.onlineStatus === "online" ? "Online" : "Offline"}</span>
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
    toast("", "Unfriended", "Removed.");
    loadFriends();
}

async function viewFriendProfile(id) {
    try {
        const data = await apiCall(`/api/friends/${id}/profile`);
        const f = data.friend;
        const p = data.portfolio || {};
        const av = f.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${f.name?.[0] || 'U'}`;

        $("fdPhoto").src = av;
        $("fdName").innerText = f.name;
        $("fdStatus").innerHTML = `<span class="status-dot ${f.onlineStatus}"></span> ${f.onlineStatus === "online" ? "Online" : "Offline"}`;
        $("fdCourse").innerText = [p.course, p.school, p.yearLevel].filter(Boolean).join(" • ") || "";
        $("fdBio").innerText = p.bio || "No bio.";
        $("fdMotto").innerText = p.motto ? `"${p.motto}"` : "";

        const ach = data.achievements || [];
        $("fdAchievements").innerHTML = ach.length === 0
            ? '<p class="muted">No public achievements yet.</p>'
            : ach.map(a => `
                <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                    <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                    <h4><i class="fas fa-trophy" style="color:var(--primary);"></i> ${escapeHtml(a.title)}</h4>
                    ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                </div>
            `).join("");

        showView("friend-detail");
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== STATUS ====================
function updateStatusUI() {
    if (!currentUser) return;
    const dot = $("myStatusDot");
    const txt = $("myStatusText");
    const isOnline = currentUser.onlineStatus === "online";
    dot.className = "status-dot " + (isOnline ? "online" : "offline");
    txt.innerText = isOnline ? "Online" : "Offline";
}

async function updateOnlineStatus(isOnline) {
    try {
        await apiCall('/api/status/update', {
            method: 'POST',
            body: JSON.stringify({ status: isOnline ? "online" : "offline" })
        });
        if (currentUser) currentUser.onlineStatus = isOnline ? "online" : "offline";
        updateStatusUI();
    } catch {}
}

async function toggleOnlineStatus() {
    if (!currentUser) return;
    const newStatus = currentUser.onlineStatus !== "online";
    await updateOnlineStatus(newStatus);
    toast("", "Status", `You are now ${newStatus ? "Online" : "Offline"}`);
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
    navigator.sendBeacon(
        "/api/status/update",
        new Blob([JSON.stringify({ status: "offline", token: authToken })], { type: "application/json" })
    );
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

async function wipeMyData() {
    if (!confirm("Delete your account permanently?")) return;
    if (!confirm("Are you SURE? This cannot be undone.")) return;
    await apiCall('/api/user/delete', { method: 'DELETE' });
    logout();
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
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
