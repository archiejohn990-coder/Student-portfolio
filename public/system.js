/* ============================================================
   STUDENT PORTFOLIO — Batch 2 Complete
   Notifications + Comments + Read Receipts + Typing
   ============================================================ */

const API_URL = '';
let currentUser = null;
let authToken = localStorage.getItem('sp_token');
let authMode = "login";
let editingAchievementId = null;
let heartbeatInterval = null;
let activeFriendId = null;
let chatPollInterval = null;
let notifPollInterval = null;
let typingPollInterval = null;
let postsTab = 'feed';
let captchaCode = "";
let postImageB64 = null;
let sessionWarnTimeout = null;
let lastTypingSent = 0;
const VIEW_ORDER = ["profile", "posts", "achievements", "friends", "settings", "friend-detail", "chat"];

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
    setTimeout(() => el.remove(), 4500);
}

// ==================== SKELETONS ====================
function skeletonList(count = 2) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-line medium"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-image"></div>
            </div>
        `;
    }
    return html;
}
function skeletonFriends(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card" style="display:flex; gap:12px; align-items:center;">
                <div class="skeleton skeleton-avatar"></div>
                <div style="flex:1;">
                    <div class="skeleton skeleton-line short"></div>
                    <div class="skeleton skeleton-line medium"></div>
                </div>
            </div>
        `;
    }
    return html;
}

function emptyState(icon, title, text, actionHtml = "") {
    return `
        <div class="empty">
            <div class="empty-illustration"><i class="fas ${icon}"></i></div>
            <div class="empty-title">${escapeHtml(title)}</div>
            <div class="empty-text">${escapeHtml(text)}</div>
            ${actionHtml ? `<div class="empty-action">${actionHtml}</div>` : ""}
        </div>
    `;
}

function categoryIcon(cat) {
    const map = {
        "Academic": "fa-graduation-cap",
        "Sports": "fa-medal",
        "Leadership": "fa-crown",
        "Personal": "fa-heart",
        "Other": "fa-star"
    };
    return map[cat] || "fa-trophy";
}
function categoryClass(cat) {
    return "ach-cat-" + (cat || "other").toLowerCase();
}

// ==================== PROFILE COMPLETION ====================
function computeCompletion(p, photo) {
    const fields = [
        { key: "fullName", label: "Full name", value: p.fullName },
        { key: "course", label: "Course", value: p.course },
        { key: "school", label: "School", value: p.school },
        { key: "yearLevel", label: "Year level", value: p.yearLevel },
        { key: "bio", label: "Bio", value: p.bio },
        { key: "motto", label: "Motto", value: p.motto },
        { key: "pronouns", label: "Pronouns", value: p.pronouns },
        { key: "gender", label: "Gender", value: p.gender },
        { key: "hobbies", label: "Hobbies", value: (p.hobbies || []).length ? "yes" : "" },
        { key: "skills", label: "Skills", value: (p.skills || []).length ? "yes" : "" },
        { key: "photo", label: "Profile photo", value: photo }
    ];
    const done = fields.filter(f => f.value && String(f.value).trim());
    const pct = Math.round((done.length / fields.length) * 100);
    const missing = fields.filter(f => !f.value || !String(f.value).trim()).map(f => f.label);
    return { pct, missing };
}

async function renderCompletionBar() {
    try {
        const data = await apiCall('/api/portfolio');
        const p = data.portfolio || {};
        const { pct, missing } = computeCompletion(p, currentUser?.photo);
        const wrap = $("completionBarWrap");
        if (!wrap) return;
        if (pct >= 100) {
            wrap.innerHTML = `
                <div class="completion-card" style="border-left:4px solid var(--success);">
                    <div class="completion-head">
                        <span><i class="fas fa-check-circle" style="color:var(--success);"></i> Profile complete!</span>
                        <span style="color:var(--success);">100%</span>
                    </div>
                </div>
            `;
            return;
        }
        wrap.innerHTML = `
            <div class="completion-card">
                <div class="completion-head">
                    <span><i class="fas fa-user-circle" style="color:var(--primary);"></i> Profile ${pct}% complete</span>
                    <span style="color:var(--primary);">${pct}%</span>
                </div>
                <div class="completion-bar"><div class="completion-fill" style="width:${pct}%"></div></div>
                <div class="completion-tip">Missing: ${escapeHtml(missing.slice(0, 3).join(", "))}${missing.length > 3 ? "…" : ""}</div>
            </div>
        `;
    } catch (e) {}
}

async function renderPreviewCard() {
    try {
        const data = await apiCall('/api/portfolio');
        const p = data.portfolio || {};
        const av = currentUser?.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(currentUser?.fullName || "S")}`;
        if ($("ppAvatar")) $("ppAvatar").src = av;
        if ($("ppName")) $("ppName").innerText = p.fullName || currentUser?.fullName || "Your Name";
        if ($("ppCourse")) {
            const line = [p.course, p.school, p.yearLevel].filter(Boolean).join(" • ");
            $("ppCourse").innerText = line || "Course • School • Year";
        }
        if ($("ppMotto")) $("ppMotto").innerText = p.motto ? `"${p.motto}"` : "";
        if ($("ppChips")) {
            const chips = [];
            (p.hobbies || []).slice(0, 2).forEach(h => chips.push(`<span class="chip"><i class="fas fa-heart"></i> ${escapeHtml(h)}</span>`));
            (p.skills || []).slice(0, 3).forEach(s => chips.push(`<span class="chip"><i class="fas fa-star"></i> ${escapeHtml(s)}</span>`));
            $("ppChips").innerHTML = chips.join("");
        }
    } catch (e) {}
}

function screenshotHint() {
    toast("info", "Tip", "Take a screenshot to share your card!");
}

// ==================== PASSWORD STRENGTH ====================
function updatePasswordStrength(pw) {
    const bar = $("pwBar");
    const label = $("pwLabel");
    if (!bar || !label) return;
    if (!pw) { bar.style.width = "0"; label.innerText = ""; return; }
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    let width = "0%", color = "var(--danger)", text = "Weak";
    if (score <= 1) { width = "25%"; color = "var(--danger)"; text = "Weak"; }
    else if (score === 2) { width = "50%"; color = "var(--warn)"; text = "Fair"; }
    else if (score === 3) { width = "70%"; color = "#84cc16"; text = "Good"; }
    else if (score === 4) { width = "85%"; color = "var(--success)"; text = "Strong"; }
    else { width = "100%"; color = "var(--success)"; text = "Very strong"; }
    bar.style.width = width;
    bar.style.background = color;
    label.innerText = text;
    label.style.color = color;
}

// ==================== SESSION WARNING ====================
function scheduleSessionWarning() {
    if (sessionWarnTimeout) clearTimeout(sessionWarnTimeout);
    if (!authToken) return;
    const WARN_AT = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;
    sessionWarnTimeout = setTimeout(() => {
        if ($("sessionWarnBackdrop")) $("sessionWarnBackdrop").style.display = "flex";
    }, WARN_AT);
}
function extendSession() {
    if ($("sessionWarnBackdrop")) $("sessionWarnBackdrop").style.display = "none";
    scheduleSessionWarning();
    updateOnlineStatus(true);
    toast("success", "Extended", "You're still logged in.");
}

// ==================== PULL TO REFRESH ====================
function setupPullToRefresh() {
    const main = $("mainScroll");
    const ind = $("pullIndicator");
    if (!main || !ind) return;
    let startY = 0, pulling = false, distance = 0;
    const THRESHOLD = 70;

    main.addEventListener("touchstart", (e) => {
        if (main.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });

    main.addEventListener("touchmove", (e) => {
        if (!pulling) return;
        distance = e.touches[0].clientY - startY;
        if (distance > 10) {
            ind.classList.add("show");
            if (distance > THRESHOLD) ind.classList.add("ready");
            else ind.classList.remove("ready");
        }
    }, { passive: true });

    main.addEventListener("touchend", async () => {
        if (!pulling) return;
        ind.classList.remove("ready");
        if (distance > THRESHOLD) {
            ind.querySelector("span").innerText = "Refreshing…";
            const activeNav = document.querySelector(".nav a.active");
            const view = activeNav?.id?.replace("nav-", "") || "profile";
            if (view === "profile") { await loadProfile(); await renderPreviewCard(); }
            if (view === "posts") await loadPosts();
            if (view === "achievements") await loadAchievements();
            if (view === "friends") { await loadFriends(); await loadRequests(); }
            await renderCompletionBar();
            toast("success", "Refreshed", "Latest data loaded.");
        }
        ind.querySelector("span").innerText = "Pull to refresh";
        ind.classList.remove("show");
        pulling = false;
        distance = 0;
    });
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
function applyTheme(th) {
    document.documentElement.setAttribute("data-theme", th);
    localStorage.setItem("sp_theme", th);
}
function toggleTheme() {
    const cur = localStorage.getItem("sp_theme") || "light";
    applyTheme(cur === "light" ? "dark" : "light");
}
(function initTheme() {
    const s = localStorage.getItem("sp_theme");
    applyTheme(s || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
})();

// ==================== CAPTCHA ====================
function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    captchaCode = result;
    if ($("captchaBox")) $("captchaBox").innerText = captchaCode;
    if ($("captchaInp")) $("captchaInp").value = "";
}
function verifyCaptcha() {
    const inp = $("captchaInp");
    if (!inp) return true;
    if (inp.value.trim().toUpperCase() !== captchaCode) {
        toast("danger", "Wrong Captcha", "Please enter the correct code");
        generateCaptcha();
        return false;
    }
    return true;
}

// ==================== AUTH ====================
function toggleMode(mode) {
    authMode = mode;
    $("tabLogin").classList.toggle("active", mode === "login");
    $("tabSignup").classList.toggle("active", mode === "signup");
    $("fieldName").classList.toggle("hidden", mode === "login");
    $("submitBtn").innerText = mode === "login" ? "Login" : "Create Account";
    generateCaptcha();
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
}

function logout() {
    if (!confirm("Log out?")) return;
    stopHeartbeat();
    if (chatPollInterval) clearInterval(chatPollInterval);
    if (notifPollInterval) clearInterval(notifPollInterval);
    if (typingPollInterval) clearInterval(typingPollInterval);
    if (sessionWarnTimeout) clearTimeout(sessionWarnTimeout);
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    location.reload();
}

// ==================== FORGOT PASSWORD ====================
function showForgot() {
    $("loginFormContainer").style.display = "none";
    $("forgotContainer").style.display = "block";
    $("forgotStep1").style.display = "block";
    $("forgotStep2").style.display = "none";
}
function hideForgot() {
    $("loginFormContainer").style.display = "block";
    $("forgotContainer").style.display = "none";
    $("forgotEmail").value = "";
    $("otpCode").value = "";
    $("newPassForgot").value = "";
}
function showForgotStep1() {
    $("forgotStep1").style.display = "block";
    $("forgotStep2").style.display = "none";
}

async function sendForgotOtp() {
    const email = $("forgotEmail").value.trim().toLowerCase();
    if (!email) return toast("warn", "Email Required", "Enter your email");
    try {
        const data = await apiCall('/api/forgot/send', {
            method: 'POST', body: JSON.stringify({ email })
        });
        if (data.success) {
            toast("info", "Demo Mode", `Your OTP is: ${data.demoOtp}`);
            $("forgotStep1").style.display = "none";
            $("forgotStep2").style.display = "block";
        }
    } catch (e) { toast("danger", "Error", e.message); }
}

async function resetForgotPassword() {
    const email = $("forgotEmail").value.trim().toLowerCase();
    const otp = $("otpCode").value.trim();
    const newPassword = $("newPassForgot").value;
    if (!otp || otp.length !== 6) return toast("warn", "Invalid OTP", "Enter the 6-digit code");
    if (!newPassword || newPassword.length < 6) return toast("warn", "Weak", "Min 6 characters");
    try {
        const data = await apiCall('/api/forgot/reset', {
            method: 'POST', body: JSON.stringify({ email, otp, newPassword })
        });
        if (data.success) {
            toast("success", "Password Reset", "Log in with your new password.");
            hideForgot();
        }
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== ABOUT ====================
function openAbout() { $("aboutBackdrop").style.display = "flex"; }
function closeAbout() { $("aboutBackdrop").style.display = "none"; }

// ==================== NOTIFICATIONS ====================
function toggleNotifPanel(event) {
    if (event) event.stopPropagation();
    const panel = $("notifPanel");
    const isOpen = panel.classList.contains("show");
    if (isOpen) {
        panel.classList.remove("show");
    } else {
        panel.classList.add("show");
        loadNotifications();
    }
}

document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".notif-wrap");
    const panel = $("notifPanel");
    if (panel && wrap && !wrap.contains(e.target)) panel.classList.remove("show");
});

async function loadNotifications() {
    const c = $("notifList");
    c.innerHTML = '<p class="muted" style="text-align:center; padding:16px;">Loading...</p>';
    try {
        const data = await apiCall('/api/notifications');
        const list = data.notifications || [];
        if (list.length === 0) {
            c.innerHTML = emptyState("fa-bell-slash", "No notifications", "You're all caught up!");
            return;
        }
        const iconMap = {
            like: "fa-heart",
            comment: "fa-comment",
            friend_request: "fa-user-plus",
            friend_accept: "fa-user-check",
            message: "fa-comment-dots"
        };
        c.innerHTML = list.map(n => {
            const av = n.from.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${n.from.name?.[0] || 'U'}`;
            let msg = "";
            if (n.type === "like") msg = `<b>${escapeHtml(n.from.name)}</b> liked your photo`;
            if (n.type === "comment") msg = `<b>${escapeHtml(n.from.name)}</b> commented: <i>${escapeHtml(n.text || "")}</i>`;
            if (n.type === "friend_request") msg = `<b>${escapeHtml(n.from.name)}</b> sent you a friend request`;
            if (n.type === "friend_accept") msg = `<b>${escapeHtml(n.from.name)}</b> accepted your friend request`;
            if (n.type === "message") msg = `<b>${escapeHtml(n.from.name)}</b>: <i>${escapeHtml(n.text || "")}</i>`;
            return `
                <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}','${n.type}')">
                    <img src="${av}" alt="">
                    <div class="notif-body">
                        <div><i class="fas ${iconMap[n.type] || 'fa-bell'} notif-type-icon"></i>${msg}</div>
                        <div class="notif-time">${timeAgo(n.createdAt)}</div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (e) {
        c.innerHTML = `<p class="muted" style="text-align:center; padding:16px;">${escapeHtml(e.message)}</p>`;
    }
}

async function handleNotifClick(id, type) {
    try { await apiCall(`/api/notifications/${id}`, { method: 'DELETE' }); } catch {}
    $("notifPanel").classList.remove("show");
    if (type === "like" || type === "comment") showView("posts");
    else if (type === "friend_request" || type === "friend_accept") showView("friends");
    else if (type === "message") showView("friends");
    refreshNotifBadge();
}

async function markAllNotifRead() {
    try {
        await apiCall('/api/notifications/read-all', { method: 'POST' });
        loadNotifications();
        refreshNotifBadge();
    } catch (e) {}
}

async function refreshNotifBadge() {
    try {
        const data = await apiCall('/api/notifications/unread/count');
        const badge = $("notifBadge");
        if (!badge) return;
        if (data.count > 0) {
            badge.classList.remove("hidden");
            badge.innerText = data.count > 9 ? "9+" : data.count;
        } else {
            badge.classList.add("hidden");
        }
    } catch {}
}

// ==================== INIT ====================
async function initApp() {
    $("authSection").style.display = "none";
    $("app").style.display = "block";
    hydrateTopBar();
    showView("profile");
    startHeartbeat();
    checkUnreadCount();
    setInterval(checkUnreadCount, 15000);
    refreshNotifBadge();
    if (notifPollInterval) clearInterval(notifPollInterval);
    notifPollInterval = setInterval(refreshNotifBadge, 15000);
    scheduleSessionWarning();
    setupPullToRefresh();
    renderCompletionBar();
    renderPreviewCard();
}

function hydrateTopBar() {
    if (!currentUser) return;
    $("userGreet").innerText = currentUser.fullName;
    $("userEmailSmall").innerText = currentUser.email;
    const av = currentUser.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(currentUser.fullName)}`;
    $("topAvatar").src = av;
    $("userAvatar").src = av;
    $("profEmail").innerText = currentUser.email;
    $("setName").value = currentUser.fullName;
}

// ==================== NAVIGATION ====================
function showView(v) {
    const currentIdx = VIEW_ORDER.findIndex(id => {
        const el = $("view-" + id);
        return el && !el.classList.contains("hidden");
    });
    const nextIdx = VIEW_ORDER.indexOf(v);
    const goRight = nextIdx >= currentIdx;

    VIEW_ORDER.forEach(id => {
        const el = $("view-" + id);
        if (el) {
            el.classList.add("hidden");
            el.classList.remove("view-enter-right", "view-enter-left");
        }
    });

    const target = $("view-" + v);
    if (target) {
        target.classList.remove("hidden");
        void target.offsetWidth;
        target.classList.add(goRight ? "view-enter-right" : "view-enter-left");
        setTimeout(() => target.classList.remove("view-enter-right", "view-enter-left"), 500);
        const main = document.querySelector(".main");
        if (main) main.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
    const nav = $("nav-" + v);
    if (nav) nav.classList.add("active");

    if (window.innerWidth <= 820) closeDrawer();

    if (v === "profile") { loadProfile(); loadSettingsProfile(); renderPreviewCard(); renderCompletionBar(); }
    if (v === "posts") loadPosts();
    if (v === "achievements") loadAchievements();
    if (v === "friends") { loadFriends(); loadRequests(); }
    if (v === "settings") { updateStatusUI(); loadSettingsProfile(); }

    if (v !== "chat") {
        if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
        if (typingPollInterval) { clearInterval(typingPollInterval); typingPollInterval = null; }
    }
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
        $("pPronouns").value = p.pronouns || "";
        $("pGender").value = p.gender || "";
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
                pronouns: $("pPronouns").value.trim(),
                gender: $("pGender").value,
                motto: $("pMotto").value.trim(),
                bio: $("pBio").value.trim(),
                hobbies: $("pHobbies").value.split(",").map(s => s.trim()).filter(Boolean),
                skills: $("pSkills").value.split(",").map(s => s.trim()).filter(Boolean)
            })
        });
        toast("success", "Saved", "Profile updated.");
        renderCompletionBar();
        renderPreviewCard();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function loadSettingsProfile() {
    try {
        const data = await apiCall('/api/portfolio');
        const p = data.portfolio || {};
        $("setPronouns").value = p.pronouns || "";
        $("setGender").value = p.gender || "";
        $("setBio").value = p.bio || "";
    } catch (e) {}
}

async function saveSettingsProfile() {
    try {
        const data = await apiCall('/api/portfolio');
        const p = data.portfolio || {};
        await apiCall('/api/portfolio', {
            method: 'PUT',
            body: JSON.stringify({
                fullName: p.fullName || currentUser.fullName,
                course: p.course || "",
                school: p.school || "",
                yearLevel: p.yearLevel || "",
                motto: p.motto || "",
                hobbies: p.hobbies || [],
                skills: p.skills || [],
                pronouns: $("setPronouns").value.trim(),
                gender: $("setGender").value,
                bio: $("setBio").value.trim()
            })
        });
        toast("success", "Saved", "Profile updated.");
        renderCompletionBar();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function changeName() {
    const name = $("setName").value.trim();
    if (!name || name.length < 2) return toast("warn", "Invalid", "Name too short.");
    try {
        await apiCall('/api/user/name', {
            method: 'PUT', body: JSON.stringify({ fullName: name })
        });
        currentUser.fullName = name;
        localStorage.setItem('sp_user', JSON.stringify(currentUser));
        hydrateTopBar();
        toast("success", "Updated", "Display name changed.");
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== ACHIEVEMENTS ====================
async function loadAchievements() {
    const c = $("achievementsList");
    c.innerHTML = skeletonList(2);
    try {
        const data = await apiCall('/api/achievements');
        const filter = $("achFilter").value;
        let list = data.achievements || [];
        if (filter) list = list.filter(a => a.category === filter);
        if (list.length === 0) {
            c.innerHTML = emptyState(
                "fa-trophy",
                filter ? "No matches" : "No achievements yet",
                filter ? "Try a different category." : "Add your first achievement!",
                `<button class="btn-inline" onclick="openAchievementModal()"><i class="fas fa-plus"></i> Add Achievement</button>`
            );
            return;
        }
        c.innerHTML = list.map(a => `
            <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                <div class="entry">
                    <div style="flex:1;">
                        <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                        <h4>
                            <i class="fas ${categoryIcon(a.category)} ${categoryClass(a.category)}"></i>
                            ${escapeHtml(a.title)}
                        </h4>
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
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
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

// ==================== POSTS ====================
function previewPostImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
        e.target.value = "";
        return toast("warn", "Too large", "Max 3MB.");
    }
    const reader = new FileReader();
    reader.onload = () => {
        postImageB64 = reader.result;
        const prev = $("postPreview");
        prev.src = postImageB64;
        prev.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

async function createPost() {
    if (!postImageB64) return toast("warn", "No image", "Choose an image first.");
    try {
        await apiCall('/api/posts', {
            method: 'POST',
            body: JSON.stringify({
                image: postImageB64,
                caption: $("postCaption").value.trim(),
                visibility: $("postVisibility").value
            })
        });
        toast("success", "Posted", "Your photo is live.");
        postImageB64 = null;
        $("postImageInput").value = "";
        $("postPreview").classList.add("hidden");
        $("postCaption").value = "";
        loadPosts();
    } catch (e) { toast("danger", "Error", e.message); }
}

function switchPostsTab(tab) {
    postsTab = tab;
    $("tabFeed").classList.toggle("active", tab === "feed");
    $("tabMine").classList.toggle("active", tab === "mine");
    loadPosts();
}

async function loadPosts() {
    const c = $("postsContainer");
    c.innerHTML = skeletonList(2);
    try {
        const endpoint = postsTab === "feed" ? '/api/posts/feed' : '/api/posts/mine';
        const data = await apiCall(endpoint);
        const posts = data.posts || [];
        if (posts.length === 0) {
            c.innerHTML = emptyState(
                "fa-camera-retro",
                postsTab === "feed" ? "Feed is empty" : "No photos yet",
                postsTab === "feed" ? "Add friends or post your first photo!" : "Share your first memory!",
                postsTab === "mine" ? `<button class="btn-inline" onclick="document.getElementById('postImageInput').click()"><i class="fas fa-plus"></i> Post a photo</button>` : ""
            );
            return;
        }
        c.innerHTML = posts.map(p => {
            const av = p.author.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${p.author.name?.[0] || 'U'}`;
            const comments = p.comments || [];
            return `
                <div class="post-card" id="post-${p.id}">
                    <div class="post-head">
                        <img src="${av}">
                        <div style="flex:1;">
                            <div class="name">${escapeHtml(p.author.name)}</div>
                            <div class="time">${timeAgo(p.createdAt)}</div>
                        </div>
                        ${p.author.id === currentUser.id
                            ? `<button class="iconbtn danger" onclick="deletePost('${p.id}')" title="Delete"><i class="fas fa-trash"></i></button>`
                            : ""}
                    </div>
                    <img class="post-image" src="${p.image}" onclick="openPostViewer('${p.id}')" style="cursor:pointer;">
                    <div class="post-body">
                        ${p.caption ? `<div class="post-caption">${escapeHtml(p.caption)}</div>` : ""}
                        <div class="post-actions">
                            <button class="like-btn ${p.likedByMe ? 'liked' : ''}" onclick="toggleLike('${p.id}')">
                                <i class="fas fa-heart"></i> <span>${p.likes}</span>
                            </button>
                            <button class="comment-btn" onclick="focusComment('${p.id}')">
                                <i class="fas fa-comment"></i> <span>${comments.length}</span>
                            </button>
                            ${p.visibility === "private" ? `<span class="chip private"><i class="fas fa-lock"></i> Private</span>` : ""}
                        </div>
                        <div class="comments-section" id="comments-${p.id}">
                            ${comments.map(c => commentHtml(c, p.id)).join("")}
                            <div class="comment-form">
                                <input class="input" id="commentInp-${p.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter')addComment('${p.id}')">
                                <button class="btn-inline" onclick="addComment('${p.id}')"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
}

function commentHtml(c, postId) {
    const av = c.author.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${c.author.name?.[0] || 'U'}`;
    const mine = c.author.id === currentUser.id;
    return `
        <div class="comment-item" id="comment-${c.id}">
            <img src="${av}">
            <div class="comment-body">
                <div class="comment-name">${escapeHtml(c.author.name)}</div>
                <div class="comment-text">${escapeHtml(c.text)}</div>
                <div class="comment-time">${timeAgo(c.createdAt)}</div>
                ${mine ? `<button class="comment-del" onclick="deleteComment('${c.id}','${postId}')"><i class="fas fa-trash"></i></button>` : ""}
            </div>
        </div>
    `;
}

function focusComment(postId) {
    const inp = $("commentInp-" + postId);
    if (inp) inp.focus();
}

async function addComment(postId) {
    const inp = $("commentInp-" + postId);
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    inp.value = "";
    try {
        const data = await apiCall(`/api/posts/${postId}/comments`, {
            method: 'POST', body: JSON.stringify({ text })
        });
        if (data.success) {
            const container = $("comments-" + postId);
            const form = container.querySelector(".comment-form");
            const div = document.createElement("div");
            div.innerHTML = commentHtml(data.comment, postId);
            container.insertBefore(div.firstElementChild, form);
            // Update count
            const btn = document.querySelector(`#post-${postId} .comment-btn span`);
            if (btn) btn.innerText = parseInt(btn.innerText || 0) + 1;
        }
    } catch (e) { toast("danger", "Error", e.message); }
}

async function deleteComment(commentId, postId) {
    if (!confirm("Delete this comment?")) return;
    try {
        await apiCall(`/api/comments/${commentId}`, { method: 'DELETE' });
        const el = $("comment-" + commentId);
        if (el) el.remove();
        const btn = document.querySelector(`#post-${postId} .comment-btn span`);
        if (btn) btn.innerText = Math.max(0, parseInt(btn.innerText || 1) - 1);
    } catch (e) { toast("danger", "Error", e.message); }
}

async function toggleLike(id) {
    try {
        await apiCall(`/api/posts/${id}/like`, { method: 'POST' });
        loadPosts();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function deletePost(id) {
    if (!confirm("Delete this photo?")) return;
    try {
        await apiCall(`/api/posts/${id}`, { method: 'DELETE' });
        toast("", "Deleted", "");
        loadPosts();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function openPostViewer(id) {
    const endpoint = postsTab === "feed" ? '/api/posts/feed' : '/api/posts/mine';
    const data = await apiCall(endpoint);
    const p = (data.posts || []).find(x => x.id === id);
    if (!p) return;
    $("postViewerImg").src = p.image;
    $("postViewerCaption").innerText = p.caption || "";
    $("postViewerMeta").innerText = `By ${p.author.name} • ${timeAgo(p.createdAt)} • ${p.likes} likes`;
    $("postViewerBackdrop").style.display = "flex";
}
function closePostViewer() {
    $("postViewerBackdrop").style.display = "none";
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
        loadRequests();
    } catch (e) { toast("danger", "Error", e.message); }
}

async function loadRequests() {
    const c = $("pendingRequests");
    c.innerHTML = skeletonFriends(1);
    try {
        const data = await apiCall('/api/friends/requests');
        if (!data.requests?.length) {
            c.innerHTML = emptyState("fa-bell-slash", "No pending requests", "You're all caught up!");
            updateFriendsBadge(0);
            return;
        }
        updateFriendsBadge(data.requests.length);
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

function updateFriendsBadge(count) {
    const navFriends = $("nav-friends");
    if (!navFriends) return;
    const existing = navFriends.querySelector(".badge");
    if (existing) existing.remove();
    if (count > 0) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.innerText = count;
        navFriends.appendChild(badge);
    }
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
    const c = $("friendsList");
    c.innerHTML = skeletonFriends(3);
    try {
        const data = await apiCall('/api/friends/list');
        if (!data.friends?.length) {
            c.innerHTML = emptyState("fa-user-friends", "No friends yet", "Add your first friend by their email above.");
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
                                <span>${f.onlineStatus === "online" ? "Online" : `Last seen ${timeAgo(f.lastSeen)}`}</span>
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
        $("fdPronouns").innerText = p.pronouns ? `(${p.pronouns})` : "";
        $("fdStatus").innerHTML = `<span class="status-dot ${f.onlineStatus}"></span> ${f.onlineStatus === "online" ? "Online" : `Last seen ${timeAgo(f.lastSeen)}`}`;
        $("fdCourse").innerText = [p.course, p.school, p.yearLevel].filter(Boolean).join(" • ");
        $("fdBio").innerText = p.bio || "";
        $("fdMotto").innerText = p.motto ? `"${p.motto}"` : "";

        const meta = [];
        if (p.gender) meta.push(`<span class="chip"><i class="fas fa-user"></i> ${escapeHtml(p.gender)}</span>`);
        if (p.pronouns) meta.push(`<span class="chip"><i class="fas fa-comment"></i> ${escapeHtml(p.pronouns)}</span>`);
        (p.hobbies || []).forEach(h => meta.push(`<span class="chip"><i class="fas fa-heart"></i> ${escapeHtml(h)}</span>`));
        (p.skills || []).forEach(s => meta.push(`<span class="chip"><i class="fas fa-star"></i> ${escapeHtml(s)}</span>`));
        $("fdMeta").innerHTML = meta.join("");

        const posts = data.posts || [];
        $("fdPosts").innerHTML = posts.length === 0
            ? emptyState("fa-camera-retro", "No photos yet", "This user hasn't posted anything.")
            : posts.map(x => `
                <div class="photo-tile" onclick="openFriendPhoto('${x.image}','${escapeHtml(x.caption || "")}')">
                    <img src="${x.image}">
                    ${x.caption ? `<div class="overlay">${escapeHtml(x.caption)}</div>` : ""}
                </div>
            `).join("");

        const ach = data.achievements || [];
        $("fdAchievements").innerHTML = ach.length === 0
            ? emptyState("fa-trophy", "No public achievements", "This user hasn't shared any achievements.")
            : ach.map(a => `
                <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                    <small>${escapeHtml(a.date || "")} • ${escapeHtml(a.category)}</small>
                    <h4><i class="fas ${categoryIcon(a.category)} ${categoryClass(a.category)}"></i> ${escapeHtml(a.title)}</h4>
                    ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                </div>
            `).join("");

        showView("friend-detail");
    } catch (e) { toast("danger", "Error", e.message); }
}

function openFriendPhoto(img, caption) {
    $("postViewerImg").src = img;
    $("postViewerCaption").innerText = caption;
    $("postViewerMeta").innerText = "";
    $("postViewerBackdrop").style.display = "flex";
}

// ==================== CHAT ====================
function openChat() {
    if (!activeFriendId) return;
    showView("chat");
    $("chatName").innerText = $("fdName").innerText;
    $("chatAvatar").src = $("fdPhoto").src;
    const isOnline = $("fdStatus").querySelector(".status-dot")?.className.includes("online");
    $("chatStatusDot").className = "status-dot " + (isOnline ? "online" : "offline");
    $("chatStatusText").innerText = $("fdStatus").innerText.replace(/^[^\s]+\s/, '');
    loadChat();
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadChat, 3000);
    if (typingPollInterval) clearInterval(typingPollInterval);
    typingPollInterval = setInterval(checkTyping, 2000);
}

async function loadChat() {
    if (!activeFriendId) return;
    try {
        const data = await apiCall(`/api/chat/${activeFriendId}`);
        const c = $("chatMessages");
        if (!data.messages?.length) {
            c.innerHTML = emptyState("fa-comments", "No messages yet", "Say hi to start the conversation!");
            return;
        }
        // Get status for read receipts
        let status = { unreadByThem: 0, lastReadAt: null, lastMessageRead: null };
        try { status = await apiCall(`/api/chat/${activeFriendId}/status`); } catch {}

        c.innerHTML = data.messages.map(m => {
            const isMine = m.from === currentUser.id;
            const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let readBadge = "";
            if (isMine) {
                if (status.unreadByThem === 0) {
                    readBadge = `<div class="msg-read-status read">✓✓ Seen</div>`;
                } else {
                    readBadge = `<div class="msg-read-status">✓ Sent</div>`;
                }
            }
            return `<div class="msg-wrap ${isMine ? 'mine' : 'theirs'}">
                <div class="msg ${isMine ? 'mine' : 'theirs'}">${escapeHtml(m.text)}</div>
                <div class="msg-time">${time}</div>
                ${readBadge}
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

// ==================== TYPING ====================
async function notifyTyping() {
    if (!activeFriendId) return;
    const now = Date.now();
    if (now - lastTypingSent < 2000) return;
    lastTypingSent = now;
    try {
        await apiCall(`/api/chat/${activeFriendId}/typing`, { method: 'POST' });
    } catch {}
}

async function checkTyping() {
    if (!activeFriendId) return;
    try {
        const data = await apiCall(`/api/chat/${activeFriendId}/typing`);
        const ind = $("typingIndicator");
        if (!ind) return;
        if (data.typing) ind.classList.remove("hidden");
        else ind.classList.add("hidden");
    } catch {}
}

async function checkUnreadCount() {
    if (!authToken) return;
    try {
        const data = await apiCall('/api/chat/unread/count');
        const navFriends = $("nav-friends");
        if (!navFriends) return;
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

// ==================== STATUS ====================
function updateStatusUI() {
    if (!currentUser) return;
    const isOnline = currentUser.onlineStatus === "online";
    $("myStatusDot").className = "status-dot " + (isOnline ? "online" : "offline");
    $("myStatusText").innerText = isOnline ? "Online" : "Offline";
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
    toast("", "Status", newStatus ? "Online" : "Offline");
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
        renderCompletionBar();
        renderPreviewCard();
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
        updatePasswordStrength("");
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
    generateCaptcha();
    const stored = localStorage.getItem('sp_user');
    if (authToken && stored) {
        currentUser = JSON.parse(stored);
        initApp();
    }

    $("authForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!verifyCaptcha()) return;
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
            generateCaptcha();
        }
    });
});
