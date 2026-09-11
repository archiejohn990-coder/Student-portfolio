/* ============================================================
   STUDENT PORTFOLIO — Complete System with Tab Animations
   ============================================================ */

const API_URL = '';
let currentUser = null;
let authToken = localStorage.getItem('sp_token');
let authMode = "login";
let editingAchievementId = null;
let heartbeatInterval = null;
let activeFriendId = null;
let chatPollInterval = null;
let postsTab = 'feed';
let captchaCode = "";
let postImageB64 = null;

// View order for directional animation
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

// ==================== ABOUT MODAL ====================
function openAbout() { $("aboutBackdrop").style.display = "flex"; }
function closeAbout() { $("aboutBackdrop").style.display = "none"; }

// ==================== INIT APP ====================
async function initApp() {
    $("authSection").style.display = "none";
    $("app").style.display = "block";
    hydrateTopBar();
    showView("profile");
    startHeartbeat();
    checkUnreadCount();
    setInterval(checkUnreadCount, 15000);
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

// ==================== NAVIGATION (WITH ANIMATIONS) ====================
function showView(v) {
    // Determine current view index for directional animation
    const currentIdx = VIEW_ORDER.findIndex(id => {
        const el = $("view-" + id);
        return el && !el.classList.contains("hidden");
    });
    const nextIdx = VIEW_ORDER.indexOf(v);
    const goRight = nextIdx >= currentIdx;

    // Hide all views and clear previous animation classes
    VIEW_ORDER.forEach(id => {
        const el = $("view-" + id);
        if (el) {
            el.classList.add("hidden");
            el.classList.remove("view-enter-right", "view-enter-left");
        }
    });

    // Show target view with directional animation
    const target = $("view-" + v);
    if (target) {
        target.classList.remove("hidden");
        // Force reflow so animation replays even on same view
        void target.offsetWidth;
        target.classList.add(goRight ? "view-enter-right" : "view-enter-left");
        setTimeout(() => {
            target.classList.remove("view-enter-right", "view-enter-left");
        }, 500);

        // Smooth scroll to top
        const main = document.querySelector(".main");
        if (main) main.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Update active nav
    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
    const nav = $("nav-" + v);
    if (nav) nav.classList.add("active");

    if (window.innerWidth <= 820) closeDrawer();

    // Load data per view
    if (v === "profile") { loadProfile(); loadSettingsProfile(); }
    if (v === "posts") loadPosts();
    if (v === "achievements") loadAchievements();
    if (v === "friends") { loadFriends(); loadRequests(); }
    if (v === "settings") { updateStatusUI(); loadSettingsProfile(); }

    if (v !== "chat" && chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
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
    try {
        const endpoint = postsTab === "feed" ? '/api/posts/feed' : '/api/posts/mine';
        const data = await apiCall(endpoint);
        const c = $("postsContainer");
        const posts = data.posts || [];
        if (posts.length === 0) {
            c.innerHTML = '<p class="empty">No photos yet.</p>';
            return;
        }
        c.innerHTML = posts.map(p => {
            const av = p.author.photo || `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${p.author.name?.[0] || 'U'}`;
            return `
                <div class="post-card">
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
                                <i class="fas fa-heart"></i> ${p.likes}
                            </button>
                            ${p.visibility === "private" ? `<span class="chip private"><i class="fas fa-lock"></i> Private</span>` : ""}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (e) { toast("danger", "Error", "Load failed"); }
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
            ? '<p class="muted">No photos yet.</p>'
            : posts.map(x => `
                <div class="photo-tile" onclick="openFriendPhoto('${x.image}','${escapeHtml(x.caption || "")}')">
                    <img src="${x.image}">
                    ${x.caption ? `<div class="overlay">${escapeHtml(x.caption)}</div>` : ""}
                </div>
            `).join("");

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
    if (!authToken) return;
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
