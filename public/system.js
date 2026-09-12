/* ============================================================
   STUDENT PORTFOLIO — Batches 1-4 Complete
   Includes: notifications, comments, read receipts, typing,
   search, stats, admin panel, activity log, albums,
   private notes, public profile, PDF export
   ============================================================ */

const API_URL = '';
let currentUser = null;
let authToken = localStorage.getItem('sp_token');
let authMode = "login";
let editingAchievementId = null;
let heartbeatInterval = null;
let activeFriendId = null;
let activeAlbumId = null;
let editingAlbumId = null;
let chatPollInterval = null;
let notifPollInterval = null;
let typingPollInterval = null;
let postsTab = 'feed';
let captchaCode = "";
let postImageB64 = null;
let albumCoverB64 = null;
let sessionWarnTimeout = null;
let lastTypingSent = 0;
let searchTimeout = null;
const VIEW_ORDER = ["profile", "posts", "albums", "achievements", "friends", "stats", "activity", "settings", "friend-detail", "chat"];

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

// ==================== SKELETONS / EMPTY ====================
function skeletonList(count = 2) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-card">
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line medium"></div>
            <div class="skeleton skeleton-image"></div>
        </div>`;
    }
    return html;
}
function skeletonFriends(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-card" style="display:flex; gap:12px; align-items:center;">
            <div class="skeleton skeleton-avatar"></div>
            <div style="flex:1;">
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-line medium"></div>
            </div>
        </div>`;
    }
    return html;
}
function emptyState(icon, title, text, actionHtml = "") {
    return `<div class="empty">
        <div class="empty-illustration"><i class="fas ${icon}"></i></div>
        <div class="empty-title">${escapeHtml(title)}</div>
        <div class="empty-text">${escapeHtml(text)}</div>
        ${actionHtml ? `<div class="empty-action">${actionHtml}</div>` : ""}
    </div>`;
}
function categoryIcon(cat) {
    const map = { "Academic": "fa-graduation-cap", "Sports": "fa-medal", "Leadership": "fa-crown", "Personal": "fa-heart", "Other": "fa-star" };
    return map[cat] || "fa-trophy";
}
function categoryClass(cat) { return "ach-cat-" + (cat || "other").toLowerCase(); }

// ==================== PROFILE COMPLETION ====================
function computeCompletion(p, photo) {
    const fields = [
        { label: "Full name", value: p.fullName }, { label: "Course", value: p.course },
        { label: "School", value: p.school }, { label: "Year level", value: p.yearLevel },
        { label: "Bio", value: p.bio }, { label: "Motto", value: p.motto },
        { label: "Pronouns", value: p.pronouns }, { label: "Gender", value: p.gender },
        { label: "Hobbies", value: (p.hobbies || []).length ? "y" : "" },
        { label: "Skills", value: (p.skills || []).length ? "y" : "" },
        { label: "Profile photo", value: photo }
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
            wrap.innerHTML = `<div class="completion-card" style="border-left:4px solid var(--success);">
                <div class="completion-head">
                    <span><i class="fas fa-check-circle" style="color:var(--success);"></i> Profile complete!</span>
                    <span style="color:var(--success);">100%</span>
                </div>
            </div>`;
            return;
        }
        wrap.innerHTML = `<div class="completion-card">
            <div class="completion-head">
                <span><i class="fas fa-user-circle" style="color:var(--primary);"></i> Profile ${pct}% complete</span>
                <span style="color:var(--primary);">${pct}%</span>
            </div>
            <div class="completion-bar"><div class="completion-fill" style="width:${pct}%"></div></div>
            <div class="completion-tip">Missing: ${escapeHtml(missing.slice(0, 3).join(", "))}${missing.length > 3 ? "…" : ""}</div>
        </div>`;
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
        if ($("publicLinkPreview") && currentUser?.username) {
            $("publicLinkPreview").innerText = `${location.origin}/u/${currentUser.username}`;
        }
        if ($("setUsername") && !$("setUsername").value) {
            $("setUsername").value = currentUser?.username || "";
        }
    } catch (e) {}
}
function screenshotHint() { toast("info", "Tip", "Take a screenshot to share your card!"); }

// ==================== PDF EXPORT ====================
async function exportProfilePDF() {
    try {
        const data = await apiCall('/api/achievements');
        const list = (data.achievements || []).filter(a => a.visibility === "public");
        const old = $("printAchievementsBlock");
        if (old) old.remove();
        if (list.length) {
            const block = document.createElement("div");
            block.id = "printAchievementsBlock";
            block.className = "achievements-print-list";
            block.innerHTML = `<h3 style="margin-top:20px;"><i class="fas fa-trophy"></i> Achievements</h3>` +
                list.map(a => `
                    <div class="ach-print-item">
                        <b>${escapeHtml(a.title)}</b>
                        <div style="font-size:.8rem; color:#666;">${escapeHtml(a.date || "")} • ${escapeHtml(a.category)}</div>
                        ${a.description ? `<div style="margin-top:4px;">${escapeHtml(a.description)}</div>` : ""}
                    </div>
                `).join("");
            document.querySelector("#view-profile").appendChild(block);
        }
        setTimeout(() => window.print(), 100);
    } catch (e) { toast("danger", "Error", e.message); }
}

// ==================== PUBLIC LINK ====================
function copyPublicLink() {
    if (!currentUser?.username) {
        toast("warn", "No username", "Set a username in Settings first.");
        return;
    }
    const url = `${location.origin}/u/${currentUser.username}`;
    navigator.clipboard.writeText(url).then(() => {
        toast("success", "Copied!", url);
    }).catch(() => {
        prompt("Copy this link:", url);
    });
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
    bar.style.width = width; bar.style.background = color;
    label.innerText = text; label.style.color = color;
}

// ==================== SESSION ====================
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
            if (view === "albums") await loadAlbums();
            if (view === "achievements") await loadAchievements();
            if (view === "friends") { await loadFriends(); await loadRequests(); }
            if (view === "stats") { await loadStats(); await loadAdminStats(); }
            if (view === "activity") await loadActivity();
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
    const data = await apiCall('/api/signup', { method: 'POST', body: JSON.stringify({ fullName, email, password }) });
    authToken = data.token;
    localStorage.setItem('sp_token', authToken);
    currentUser = data.student;
    localStorage.setItem('sp_user', JSON.stringify(currentUser));
}
async function login(email, password) {
    const data = await apiCall('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
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
        const data = await apiCall('/api/forgot/send', { method: 'POST', body: JSON.stringify({ email }) });
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
        const data = await apiCall('/api/forgot/reset', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) });
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
    if (isOpen) panel.classList.remove("show");
    else { panel.classList.add("show"); loadNotifications(); }
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
        const iconMap = { like: "fa-heart", comment: "fa-comment", friend_request: "fa-user-plus", friend_accept: "fa-user-check", message: "fa-comment-dots" };
        c.innerHTML = list.map(n => {
            const av = n.from.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${n.from.name?.[0] || 'U'}`;
            let msg = "";
            if (n.type === "like") msg = `<b>${escapeHtml(n.from.name)}</b> liked your photo`;
            if (n.type === "comment") msg = `<b>${escapeHtml(n.from.name)}</b> commented: <i>${escapeHtml(n.text || "")}</i>`;
            if (n.type === "friend_request") msg = `<b>${escapeHtml(n.from.name)}</b> sent you a friend request`;
            if (n.type === "friend_accept") msg = `<b>${escapeHtml(n.from.name)}</b> accepted your friend request`;
            if (n.type === "message") msg = `<b>${escapeHtml(n.from.name)}</b>: <i>${escapeHtml(n.text || "")}</i>`;
            return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}','${n.type}')">
                <img src="${av}" alt="">
                <div class="notif-body">
                    <div><i class="fas ${iconMap[n.type] || 'fa-bell'} notif-type-icon"></i>${msg}</div>
                    <div class="notif-time">${timeAgo(n.createdAt)}</div>
                </div>
            </div>`;
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
        } else badge.classList.add("hidden");
    } catch {}
}

// ==================== SEARCH ====================
function onSearchInput() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(doSearch, 300);
}
function onSearchFocus() {
    const panel = $("searchResults");
    if (panel) panel.classList.add("show");
}
document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".search-wrap");
    const panel = $("searchResults");
    if (panel && wrap && !wrap.contains(e.target)) panel.classList.remove("show");
});
async function doSearch() {
    const q = $("globalSearch").value.trim();
    const panel = $("searchResults");
    if (!panel) return;
    if (!q) {
        panel.innerHTML = '<p class="muted" style="text-align:center; padding:16px;">Type to search...</p>';
        return;
    }
    panel.classList.add("show");
    panel.innerHTML = '<p class="muted" style="text-align:center; padding:16px;">Searching...</p>';
    try {
        const data = await apiCall(`/api/search?q=${encodeURIComponent(q)}`);
        const r = data.results || {};
        let html = "";
        if (r.students?.length) {
            html += `<div class="search-section-title">People</div>`;
            r.students.forEach(s => {
                const av = s.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${s.name?.[0] || 'U'}`;
                html += `<div class="search-item" onclick="searchGoFriend('${s.id}','${s.username || ''}')">
                    <img src="${av}">
                    <div class="s-body">
                        <div class="s-name">${escapeHtml(s.name)}</div>
                        <div class="s-sub">${escapeHtml(s.email)}</div>
                    </div>
                </div>`;
            });
        }
        if (r.posts?.length) {
            html += `<div class="search-section-title">Posts</div>`;
            r.posts.forEach(p => {
                html += `<div class="search-item" onclick="searchGoPost('${p.id}')">
                    <img src="${p.image}" class="s-thumb">
                    <div class="s-body">
                        <div class="s-name">${escapeHtml(p.caption || "(no caption)")}</div>
                        <div class="s-sub">By ${escapeHtml(p.author.name)}</div>
                    </div>
                </div>`;
            });
        }
        if (r.achievements?.length) {
            html += `<div class="search-section-title">Achievements</div>`;
            r.achievements.forEach(a => {
                html += `<div class="search-item" onclick="searchGoAch()">
                    <div class="s-thumb person-logo xs"><i class="fas ${categoryIcon(a.category)}"></i></div>
                    <div class="s-body">
                        <div class="s-name">${escapeHtml(a.title)}</div>
                        <div class="s-sub">${escapeHtml(a.category)} • ${escapeHtml(a.author.name)}</div>
                    </div>
                </div>`;
            });
        }
        if (!html) html = '<p class="muted" style="text-align:center; padding:16px;">No results found.</p>';
        panel.innerHTML = html;
    } catch (e) {
        panel.innerHTML = `<p class="muted" style="text-align:center; padding:16px;">${escapeHtml(e.message)}</p>`;
    }
}
function searchGoFriend(id, username) {
    $("searchResults").classList.remove("show");
    $("globalSearch").value = "";
    viewFriendProfile(id).catch(() => {
        if (username) {
            if (confirm("Not your friend. Open their public profile?")) {
                window.open(`/u/${username}`, "_blank");
            }
        } else {
            toast("info", "Not a friend", "Send them a friend request to see their profile.");
        }
    });
}
function searchGoPost(id) {
    $("searchResults").classList.remove("show");
    $("globalSearch").value = "";
    showView("posts");
    setTimeout(() => openPostViewer(id), 400);
}
function searchGoAch() {
    $("searchResults").classList.remove("show");
    $("globalSearch").value = "";
    showView("achievements");
}

// ==================== STATS ====================
async function loadStats() {
    try {
        const data = await apiCall('/api/stats');
        const s = data.stats;
        if ($("kpiPosts")) $("kpiPosts").innerText = s.posts;
        if ($("kpiAch")) $("kpiAch").innerText = s.achievements;
        if ($("kpiFriends")) $("kpiFriends").innerText = s.friends;
        if ($("kpiLikes")) $("kpiLikes").innerText = s.likesReceived;
        if ($("kpiComments")) $("kpiComments").innerText = s.commentsReceived;
        if ($("kpiMsgsSent")) $("kpiMsgsSent").innerText = s.messagesSent;
        if ($("kpiMsgsRecv")) $("kpiMsgsRecv").innerText = s.messagesReceived;
        drawPostsChart(s.postsByMonth || []);
    } catch (e) { console.error("Stats error:", e); }
}
function drawPostsChart(months) {
    const c = $("postsChart");
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth || 600;
    const cssH = 220;
    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    ctx.scale(dpr, dpr);
    const W = cssW, H = cssH;
    ctx.clearRect(0, 0, W, H);
    const pad = 30;
    const max = Math.max(1, ...months.map(m => m.count));
    const barW = (W - pad * 2) / months.length;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border");
    for (let i = 0; i <= 4; i++) {
        const y = pad + (H - pad * 2) * (i / 4);
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#6366f1";
    const primary2 = getComputedStyle(document.documentElement).getPropertyValue("--primary2").trim() || "#8b5cf6";
    months.forEach((m, i) => {
        const bh = (H - pad * 2) * (m.count / max);
        const x = pad + i * barW + 6;
        const y = H - pad - bh;
        const bw = Math.max(8, barW - 12);
        const grad = ctx.createLinearGradient(0, y, 0, H - pad);
        grad.addColorStop(0, primary);
        grad.addColorStop(1, primary2);
        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = Math.min(6, bw / 2);
        ctx.moveTo(x, H - pad);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + bw - r, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
        ctx.lineTo(x + bw, H - pad);
        ctx.closePath();
        ctx.fill();
        if (m.count > 0) {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text");
            ctx.font = "700 11px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(m.count, x + bw / 2, y - 4);
        }
    });
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    months.forEach((m, i) => {
        const label = m.month.slice(5);
        const x = pad + i * barW + barW / 2;
        ctx.fillText(label, x, H - 10);
    });
}

// ==================== ADMIN STATS ====================
async function loadAdminStats() {
    const container = document.querySelector("#view-stats");
    if (!container) return;

    const oldCard = document.getElementById("adminStatsCard");
    if (oldCard) oldCard.remove();

    if (!currentUser?.isAdmin) return;

    try {
        await apiCall('/api/admin/stats');
    } catch {
        return;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.id = "adminStatsCard";
    card.style.borderLeft = "6px solid var(--danger)";
    card.innerHTML = `
        <h3>
            <i class="fas fa-shield-halved" style="color:var(--danger);"></i>
            Admin Panel — Site-wide
            <span class="chip private" style="margin-left:8px; font-size:.7rem;">
                <i class="fas fa-lock"></i> Restricted
            </span>
        </h3>
        <p class="muted" style="font-size:.85rem; margin-bottom:12px;">
            Only visible to administrators.
        </p>
        <div class="kpi-grid">
            <div class="kpi-tile"><i class="fas fa-user-group"></i><div class="kpi-num" id="adminUsers">0</div><div class="kpi-lbl">Total users</div></div>
            <div class="kpi-tile"><i class="fas fa-images"></i><div class="kpi-num" id="adminPosts">0</div><div class="kpi-lbl">Total posts</div></div>
            <div class="kpi-tile"><i class="fas fa-comments"></i><div class="kpi-num" id="adminMsgs">0</div><div class="kpi-lbl">Messages</div></div>
            <div class="kpi-tile"><i class="fas fa-trophy"></i><div class="kpi-num" id="adminAch">0</div><div class="kpi-lbl">Achievements</div></div>
            <div class="kpi-tile"><i class="fas fa-comment-dots"></i><div class="kpi-num" id="adminCmts">0</div><div class="kpi-lbl">Comments</div></div>
            <div class="kpi-tile"><i class="fas fa-bell"></i><div class="kpi-num" id="adminNotifs">0</div><div class="kpi-lbl">Notifications</div></div>
            <div class="kpi-tile"><i class="fas fa-circle" style="color:var(--success);"></i><div class="kpi-num" id="adminOnline">0</div><div class="kpi-lbl">Online now</div></div>
            <div class="kpi-tile"><i class="fas fa-clock"></i><div class="kpi-num" id="adminUptime">0</div><div class="kpi-lbl">Uptime (h)</div></div>
        </div>
    `;
    container.appendChild(card);

    try {
        const data = await apiCall('/api/admin/stats');
        const s = data.stats;
        if ($("adminUsers")) $("adminUsers").innerText = s.users;
        if ($("adminPosts")) $("adminPosts").innerText = s.posts;
        if ($("adminMsgs")) $("adminMsgs").innerText = s.messages;
        if ($("adminAch")) $("adminAch").innerText = s.achievements;
        if ($("adminCmts")) $("adminCmts").innerText = s.comments;
        if ($("adminNotifs")) $("adminNotifs").innerText = s.notifications;
        if ($("adminOnline")) $("adminOnline").innerText = s.online;
        if ($("adminUptime")) $("adminUptime").innerText = Math.floor(s.uptimeSeconds / 3600);
    } catch {}
}

// ==================== ACTIVITY ====================
async function loadActivity() {
    const c = $("activityList");
    c.innerHTML = skeletonList(3);
    try {
        const data = await apiCall('/api/activity');
        const list = data.activity || [];
        if (list.length === 0) {
            c.innerHTML = emptyState("fa-clock", "No activity yet", "Start posting, adding achievements, and chatting!");
            return;
        }
        const iconMap = {
            signup: "fa-user-plus", login: "fa-right-to-bracket",
            password_reset: "fa-key", password_change: "fa-key",
            name_change: "fa-user-pen", photo_change: "fa-image",
            username_change: "fa-at", profile_update: "fa-id-card",
            post_create: "fa-camera", post_delete: "fa-trash",
            achievement_add: "fa-trophy", achievement_update: "fa-pen", achievement_delete: "fa-trash",
            friend_request: "fa-user-plus", friend_accept: "fa-user-check", unfriend: "fa-user-minus",
            album_create: "fa-folder-plus", album_delete: "fa-folder-minus"
        };
        c.innerHTML = list.map(a => `
            <div class="activity-item">
                <div class="activity-icon"><i class="fas ${iconMap[a.type] || 'fa-circle-dot'}"></i></div>
                <div class="activity-body">
                    <div class="activity-text">${escapeHtml(a.detail || a.type.replace(/_/g, " "))}</div>
                    <div class="activity-time">${timeAgo(a.createdAt)}</div>
                </div>
            </div>
        `).join("");
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
}

// ==================== INIT ====================
async function initApp() {
    $("authSection").style.display = "none";
    $("publicProfileSection").style.display = "none";
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
    loadAlbumSelectOptions();
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
    if ($("setUsername")) $("setUsername").value = currentUser.username || "";
    if ($("publicLinkPreview") && currentUser.username) {
        $("publicLinkPreview").innerText = `${location.origin}/u/${currentUser.username}`;
    }
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
    if (v === "posts") { loadPosts(); loadAlbumSelectOptions(); }
    if (v === "albums") { loadAlbums(); closeAlbumDetail(); }
    if (v === "achievements") loadAchievements();
    if (v === "friends") { loadFriends(); loadRequests(); }
    if (v === "stats") { loadStats(); loadAdminStats(); }
    if (v === "activity") loadActivity();
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
                course: p.course || "", school: p.school || "", yearLevel: p.yearLevel || "",
                motto: p.motto || "", hobbies: p.hobbies || [], skills: p.skills || [],
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
        await apiCall('/api/user/name', { method: 'PUT', body: JSON.stringify({ fullName: name }) });
        currentUser.fullName = name;
        localStorage.setItem('sp_user', JSON.stringify(currentUser));
        hydrateTopBar();
        toast("success", "Updated", "Display name changed.");
    } catch (e) { toast("danger", "Error", e.message); }
}
async function changeUsername() {
    const username = $("setUsername").value.trim().toLowerCase();
    if (!username || username.length < 3) return toast("warn", "Invalid", "Username must be 3+ characters");
    try {
        const data = await apiCall('/api/user/username', { method: 'PUT', body: JSON.stringify({ username }) });
        currentUser.username = data.username;
        localStorage.setItem('sp_user', JSON.stringify(currentUser));
        if ($("publicLinkPreview")) $("publicLinkPreview").innerText = `${location.origin}/u/${data.username}`;
        toast("success", "Saved", `Your link: /u/${data.username}`);
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
            c.innerHTML = emptyState("fa-trophy", filter ? "No matches" : "No achievements yet",
                filter ? "Try a different category." : "Add your first achievement!",
                `<button class="btn-inline" onclick="openAchievementModal()"><i class="fas fa-plus"></i> Add Achievement</button>`);
            return;
        }
        c.innerHTML = list.map(a => `
            <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                <div class="entry">
                    <div style="flex:1;">
                        <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                        <h4><i class="fas ${categoryIcon(a.category)} ${categoryClass(a.category)}"></i> ${escapeHtml(a.title)}</h4>
                        ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                        ${a.privateNote ? `
                            <div class="private-note-box">
                                <strong><i class="fas fa-lock"></i> Note to self</strong>
                                ${escapeHtml(a.privateNote)}
                            </div>` : ""}
                        <div class="chips">
                            ${a.visibility === "private"
                                ? '<span class="chip private"><i class="fas fa-lock"></i> Private</span>'
                                : '<span class="chip"><i class="fas fa-eye"></i> Public</span>'}
                            ${a.privateNote ? '<span class="chip note"><i class="fas fa-sticky-note"></i> Has note</span>' : ""}
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
    $("achPrivateNote").value = ach?.privateNote || "";
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
        visibility: $("achVisibility").value,
        privateNote: $("achPrivateNote").value.trim()
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

// ==================== ALBUMS ====================
async function loadAlbums() {
    const c = $("albumsGrid");
    c.innerHTML = skeletonList(3);
    try {
        const data = await apiCall('/api/albums');
        const albums = data.albums || [];
        if (albums.length === 0) {
            c.innerHTML = emptyState("fa-folder-open", "No albums yet", "Group your photos into albums.",
                `<button class="btn-inline" onclick="openAlbumModal()"><i class="fas fa-plus"></i> New Album</button>`);
            return;
        }
        c.innerHTML = albums.map(a => `
            <div class="album-card" onclick="openAlbumDetail('${a.id}','${escapeHtml(a.name)}')">
                <div class="album-cover">
                    ${a.cover ? `<img src="${a.cover}">` : `<i class="fas fa-folder-open"></i>`}
                    <div class="album-actions">
                        <button class="iconbtn" onclick="event.stopPropagation(); editAlbum('${a.id}','${escapeHtml(a.name)}')" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="iconbtn danger" onclick="event.stopPropagation(); deleteAlbum('${a.id}','${escapeHtml(a.name)}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="album-info">
                    <div class="album-name">${escapeHtml(a.name)}</div>
                    <div class="album-count">${a.count} photo${a.count !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `).join("");
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
}
async function loadAlbumSelectOptions() {
    const sel = $("postAlbumSelect");
    if (!sel) return;
    try {
        const data = await apiCall('/api/albums');
        const albums = data.albums || [];
        sel.innerHTML = '<option value="">No album</option>' +
            albums.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    } catch {}
}
function openAlbumModal(album = null) {
    editingAlbumId = album?.id || null;
    $("albumModalTitle").innerText = editingAlbumId ? "Edit Album" : "New Album";
    $("albumName").value = album?.name || "";
    albumCoverB64 = album?.cover || null;
    const prev = $("albumCoverPreview");
    if (albumCoverB64) { prev.src = albumCoverB64; prev.classList.remove("hidden"); }
    else prev.classList.add("hidden");
    $("albumCoverInput").value = "";
    $("albumBackdrop").style.display = "flex";
}
function closeAlbumModal() {
    $("albumBackdrop").style.display = "none";
    editingAlbumId = null;
    albumCoverB64 = null;
}
function previewAlbumCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) { e.target.value = ""; return toast("warn", "Too large", "Max 3MB."); }
    const reader = new FileReader();
    reader.onload = () => {
        albumCoverB64 = reader.result;
        const prev = $("albumCoverPreview");
        prev.src = albumCoverB64;
        prev.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}
async function saveAlbum() {
    const name = $("albumName").value.trim();
    if (!name) return toast("warn", "Missing", "Enter album name.");
    try {
        if (editingAlbumId) {
            await apiCall(`/api/albums/${editingAlbumId}`, { method: 'PUT', body: JSON.stringify({ name, cover: albumCoverB64 }) });
        } else {
            await apiCall('/api/albums', { method: 'POST', body: JSON.stringify({ name, cover: albumCoverB64 }) });
        }
        toast("success", "Saved", "Album saved.");
        closeAlbumModal();
        loadAlbums();
        loadAlbumSelectOptions();
    } catch (e) { toast("danger", "Error", e.message); }
}
async function editAlbum(id, name) {
    try {
        const data = await apiCall('/api/albums');
        const album = data.albums.find(a => a.id === id);
        if (album) openAlbumModal(album);
    } catch (e) { toast("danger", "Error", e.message); }
}
async function deleteAlbum(id, name) {
    if (!confirm(`Delete album "${name}"?\nPhotos will stay but be removed from the album.`)) return;
    try {
        await apiCall(`/api/albums/${id}`, { method: 'DELETE' });
        toast("", "Deleted", "Album removed.");
        loadAlbums();
        loadAlbumSelectOptions();
    } catch (e) { toast("danger", "Error", e.message); }
}
async function openAlbumDetail(id, name) {
    activeAlbumId = id;
    $("albumDetail").classList.remove("hidden");
    $("albumDetailName").innerText = name;
    const c = $("albumDetailPhotos");
    c.innerHTML = skeletonList(2);
    try {
        const data = await apiCall(`/api/albums/${id}/photos`);
        const photos = data.photos || [];
        if (photos.length === 0) {
            c.innerHTML = emptyState("fa-camera-retro", "Album is empty", "Post a new photo and select this album.");
            return;
        }
        c.innerHTML = photos.map(p => `
            <div class="photo-tile" onclick="openAlbumPhoto('${p.image}','${escapeHtml(p.caption || "")}')">
                <img src="${p.image}">
                ${p.caption ? `<div class="overlay">${escapeHtml(p.caption)}</div>` : ""}
            </div>
        `).join("");
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
}
function closeAlbumDetail() {
    activeAlbumId = null;
    $("albumDetail").classList.add("hidden");
}
function openAlbumPhoto(img, caption) {
    $("postViewerImg").src = img;
    $("postViewerCaption").innerText = caption;
    $("postViewerMeta").innerText = "";
    $("postViewerBackdrop").style.display = "flex";
}

// ==================== POSTS ====================
function previewPostImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) { e.target.value = ""; return toast("warn", "Too large", "Max 3MB."); }
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
                visibility: $("postVisibility").value,
                albumId: $("postAlbumSelect").value || null
            })
        });
        toast("success", "Posted", "Your photo is live.");
        postImageB64 = null;
        $("postImageInput").value = "";
        $("postPreview").classList.add("hidden");
        $("postCaption").value = "";
        $("postAlbumSelect").value = "";
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
            c.innerHTML = emptyState("fa-camera-retro",
                postsTab === "feed" ? "Feed is empty" : "No photos yet",
                postsTab === "feed" ? "Add friends or post your first photo!" : "Share your first memory!",
                postsTab === "mine" ? `<button class="btn-inline" onclick="document.getElementById('postImageInput').click()"><i class="fas fa-plus"></i> Post a photo</button>` : "");
            return;
        }
        c.innerHTML = posts.map(p => {
            const av = p.author.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${p.author.name?.[0] || 'U'}`;
            const comments = p.comments || [];
            return `<div class="post-card" id="post-${p.id}">
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
            </div>`;
        }).join("");
    } catch (e) {
        c.innerHTML = emptyState("fa-triangle-exclamation", "Failed to load", e.message);
    }
}
function commentHtml(c, postId) {
    const av = c.author.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${c.author.name?.[0] || 'U'}`;
    const mine = c.author.id === currentUser.id;
    return `<div class="comment-item" id="comment-${c.id}">
        <img src="${av}">
        <div class="comment-body">
            <div class="comment-name">${escapeHtml(c.author.name)}</div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
            <div class="comment-time">${timeAgo(c.createdAt)}</div>
            ${mine ? `<button class="comment-del" onclick="deleteComment('${c.id}','${postId}')"><i class="fas fa-trash"></i></button>` : ""}
        </div>
    </div>`;
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
        const data = await apiCall(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        if (data.success) {
            const container = $("comments-" + postId);
            const form = container.querySelector(".comment-form");
            const div = document.createElement("div");
            div.innerHTML = commentHtml(data.comment, postId);
            container.insertBefore(div.firstElementChild, form);
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
function closePostViewer() { $("postViewerBackdrop").style.display = "none"; }

// ==================== FRIENDS ====================
async function addFriendAction() {
    const email = $("friendEmail").value.trim().toLowerCase();
    if (!email) return toast("warn", "Missing", "Enter an email.");
    try {
        await apiCall('/api/friends/request', { method: 'POST', body: JSON.stringify({ toUserEmail: email }) });
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
            </div>`).join("");
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
    await apiCall('/api/friends/accept', { method: 'POST', body: JSON.stringify({ fromUserId }) });
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
            return `<div class="friend-item">
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
            </div>`;
        }).join("");
        $("onlineCount").innerText = `(${online} online)`;
    } catch (e) { console.error(e); }
}
async function unfriend(id, email) {
    if (!confirm(`Unfriend ${email}?`)) return;
    await apiCall('/api/friends/unfriend', { method: 'POST', body: JSON.stringify({ friendId: id }) });
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
                </div>`).join("");
        const ach = data.achievements || [];
        $("fdAchievements").innerHTML = ach.length === 0
            ? emptyState("fa-trophy", "No public achievements", "This user hasn't shared any achievements.")
            : ach.map(a => `
                <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
                    <small>${escapeHtml(a.date || "")} • ${escapeHtml(a.category)}</small>
                    <h4><i class="fas ${categoryIcon(a.category)} ${categoryClass(a.category)}"></i> ${escapeHtml(a.title)}</h4>
                    ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                </div>`).join("");
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
        let status = { unreadByThem: 0 };
        try { status = await apiCall(`/api/chat/${activeFriendId}/status`); } catch {}
        c.innerHTML = data.messages.map(m => {
            const isMine = m.from === currentUser.id;
            const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let readBadge = "";
            if (isMine) {
                if (status.unreadByThem === 0) readBadge = `<div class="msg-read-status read">✓✓ Seen</div>`;
                else readBadge = `<div class="msg-read-status">✓ Sent</div>`;
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
        await apiCall(`/api/chat/${activeFriendId}`, { method: 'POST', body: JSON.stringify({ text }) });
        loadChat();
    } catch (e) { toast("danger", "Error", e.message); }
}
async function notifyTyping() {
    if (!activeFriendId) return;
    const now = Date.now();
    if (now - lastTypingSent < 2000) return;
    lastTypingSent = now;
    try { await apiCall(`/api/chat/${activeFriendId}/typing`, { method: 'POST' }); } catch {}
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
        await apiCall('/api/status/update', { method: 'POST', body: JSON.stringify({ status: isOnline ? "online" : "offline" }) });
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
        await apiCall('/api/user/photo', { method: 'PUT', body: JSON.stringify({ photo: reader.result }) });
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
        await apiCall('/api/user/password', { method: 'PUT', body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
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

// ==================== PUBLIC PROFILE ====================
async function loadPublicProfile() {
    $("authSection").style.display = "none";
    $("app").style.display = "none";
    $("publicProfileSection").style.display = "block";

    const pathParts = location.pathname.split("/");
    const username = pathParts[pathParts.length - 1];
    const container = $("publicContent");
    container.innerHTML = '<p style="text-align:center; padding:40px;">Loading profile...</p>';

    try {
        const res = await fetch(`/api/public/u/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Profile not found");
        const p = data.profile;
        const pf = p.portfolio || {};
        const av = p.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${p.name?.[0] || 'U'}`;
        const since = new Date(p.stats.memberSince).toLocaleDateString([], { year: 'numeric', month: 'long' });

        container.innerHTML = `
            <div class="public-card">
                <div class="public-hero">
                    <img src="${av}" alt="${escapeHtml(p.name)}">
                    <div class="public-hero-info">
                        <h1>${escapeHtml(p.name)}</h1>
                        ${pf.course ? `<div class="tag">${escapeHtml(pf.course)}${pf.school ? ' • ' + escapeHtml(pf.school) : ''}${pf.yearLevel ? ' • ' + escapeHtml(pf.yearLevel) : ''}</div>` : ''}
                        <div class="username">@${escapeHtml(p.username)}</div>
                        ${pf.pronouns ? `<div class="tag">(${escapeHtml(pf.pronouns)})</div>` : ''}
                    </div>
                </div>

                <div class="public-body">
                    ${pf.bio ? `<h3><i class="fas fa-quote-left"></i> About</h3><p style="line-height:1.6;">${escapeHtml(pf.bio)}</p>` : ''}
                    ${pf.motto ? `<p style="font-style:italic; color:var(--muted); margin-top:10px;">"${escapeHtml(pf.motto)}"</p>` : ''}

                    ${(pf.hobbies && pf.hobbies.length) ? `
                        <h3><i class="fas fa-heart"></i> Hobbies</h3>
                        <div class="chips">${pf.hobbies.map(h => `<span class="chip">${escapeHtml(h)}</span>`).join("")}</div>
                    ` : ''}

                    ${(pf.skills && pf.skills.length) ? `
                        <h3><i class="fas fa-star"></i> Skills</h3>
                        <div class="chips">${pf.skills.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join("")}</div>
                    ` : ''}

                    <h3><i class="fas fa-trophy"></i> Achievements <span style="color:var(--muted); font-weight:500; font-size:.85rem;">(${p.achievements.length})</span></h3>
                    ${p.achievements.length === 0
                        ? '<p class="muted">No public achievements yet.</p>'
                        : p.achievements.map(a => `
                            <div class="public-ach">
                                <div class="t"><i class="fas ${categoryIcon(a.category)} ${categoryClass(a.category)}"></i> ${escapeHtml(a.title)}</div>
                                <div class="m">${escapeHtml(a.date || '')} • ${escapeHtml(a.category)}</div>
                                ${a.description ? `<div class="d">${escapeHtml(a.description)}</div>` : ''}
                            </div>`).join("")}
                </div>

                <div class="public-footer">
                    <p>Member since ${since}</p>
                    <p style="margin-top:6px;">Built with <a href="/">Student Portfolio</a></p>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `
            <div class="public-card" style="text-align:center;">
                <div style="font-size:4rem; color:var(--muted); margin-bottom:16px;">
                    <i class="fas fa-user-slash"></i>
                </div>
                <h1 style="margin-bottom:8px;">Profile not found</h1>
                <p class="muted" style="margin-bottom:20px;">${escapeHtml(e.message)}</p>
                <a href="/" class="btn-inline" style="display:inline-block; text-decoration:none;">Go to Student Portfolio</a>
            </div>`;
    }
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
    if (location.pathname.startsWith("/u/")) {
        loadPublicProfile();
        return;
    }

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
