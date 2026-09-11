/* ============================================================
   STUDENT PORTFOLIO — Frontend Only (No Database)
   Data is stored in localStorage per user account
   ============================================================ */

// ==================== STATE ====================
let currentStudent = null;
let authMode = "login";
let editingAchievementId = null;

// ==================== HELPERS ====================
function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

function toast(type, title, msg) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.innerHTML = `
        <i class="fas ${type === "danger" ? "fa-triangle-exclamation" : type === "warn" ? "fa-circle-exclamation" : "fa-circle-check"}"></i>
        <div>
            <div class="t-title">${escapeHtml(title)}</div>
            <div class="t-msg">${escapeHtml(msg)}</div>
        </div>
        <button class="x" onclick="this.parentElement.remove()">✕</button>
    `;
    wrap.appendChild(el);
    setTimeout(() => { if (el.parentElement) el.remove(); }, 4000);
}

// ==================== STORAGE ====================
const STORAGE_KEYS = {
    USERS: "portfolio_users",          // all accounts
    SESSION: "portfolio_session",      // current logged-in email
    THEME: "portfolio_theme"
};

function getUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || {}; }
    catch { return {}; }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getUserData(email) {
    const users = getUsers();
    return users[email] || null;
}

function saveUserData(email, data) {
    const users = getUsers();
    users[email] = data;
    saveUsers(users);
}

function getSession() {
    return localStorage.getItem(STORAGE_KEYS.SESSION);
}

function setSession(email) {
    if (email) localStorage.setItem(STORAGE_KEYS.SESSION, email);
    else localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// Simple hash for password (NOT secure, just for demo)
function hashPassword(pw) {
    let hash = 0;
    for (let i = 0; i < pw.length; i++) {
        hash = ((hash << 5) - hash) + pw.charCodeAt(i);
        hash |= 0;
    }
    return "h_" + Math.abs(hash).toString(36);
}

// ==================== THEME ====================
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function toggleTheme() {
    const cur = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
    applyTheme(cur === "light" ? "dark" : "light");
    toast("", "Theme", `Switched to ${cur === "light" ? "dark" : "light"} mode`);
}

(function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) applyTheme(saved);
    else applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();

// ==================== AUTH ====================
function toggleMode(mode) {
    authMode = mode;
    $("tabLogin").classList.toggle("active", mode === "login");
    $("tabSignup").classList.toggle("active", mode === "signup");
    $("fieldName").classList.toggle("hidden", mode === "login");
    $("submitBtn").innerText = mode === "login" ? "Login" : "Create Account";
}

function signup(fullName, email, password) {
    const users = getUsers();
    if (users[email]) return { error: "Email already registered" };

    users[email] = {
        fullName,
        email,
        passwordHash: hashPassword(password),
        portfolio: {
            fullName,
            course: "",
            school: "",
            yearLevel: "",
            bio: "",
            motto: "",
            hobbies: [],
            skills: [],
            photo: null,
            updatedAt: new Date().toISOString()
        },
        achievements: [],
        createdAt: new Date().toISOString()
    };
    saveUsers(users);
    return { success: true };
}

function login(email, password) {
    const user = getUserData(email);
    if (!user) return { error: "Invalid credentials" };
    if (user.passwordHash !== hashPassword(password)) return { error: "Invalid credentials" };
    return { success: true, user };
}

function logout() {
    if (!confirm("Log out?")) return;
    setSession(null);
    location.reload();
}

// ==================== APP INIT ====================
function initApp() {
    $("authSection").style.display = "none";
    $("app").style.display = "block";
    hydrateUserUI();
    showView("profile");
}

function hydrateUserUI() {
    if (!currentStudent) return;
    $("userGreet").innerText = currentStudent.fullName;
    $("userEmailSmall").innerText = currentStudent.email;

    const fallback = `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(currentStudent.fullName || "S")}`;
    $("topAvatar").src = currentStudent.portfolio?.photo || fallback;
}

// ==================== NAVIGATION ====================
function showView(v) {
    const views = ["profile", "achievements", "summary"];
    views.forEach(id => $("view-" + id).classList.add("hidden"));
    $("view-" + v).classList.remove("hidden");

    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
    $("nav-" + v).classList.add("active");

    if (window.innerWidth <= 820) closeDrawer();

    if (v === "profile") loadProfile();
    if (v === "achievements") loadAchievements();
    if (v === "summary") loadSummary();
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
function loadProfile() {
    if (!currentStudent) return;
    const p = currentStudent.portfolio || {};
    $("pName").value = p.fullName || "";
    $("pCourse").value = p.course || "";
    $("pSchool").value = p.school || "";
    $("pYear").value = p.yearLevel || "";
    $("pMotto").value = p.motto || "";
    $("pBio").value = p.bio || "";
    $("pHobbies").value = (p.hobbies || []).join(", ");
    $("pSkills").value = (p.skills || []).join(", ");
}

function saveProfile() {
    if (!currentStudent) return;

    currentStudent.portfolio = {
        fullName: $("pName").value.trim(),
        course: $("pCourse").value.trim(),
        school: $("pSchool").value.trim(),
        yearLevel: $("pYear").value.trim(),
        motto: $("pMotto").value.trim(),
        bio: $("pBio").value.trim(),
        hobbies: $("pHobbies").value.split(",").map(s => s.trim()).filter(Boolean),
        skills: $("pSkills").value.split(",").map(s => s.trim()).filter(Boolean),
        photo: currentStudent.portfolio?.photo || null,
        updatedAt: new Date().toISOString()
    };

    saveUserData(currentStudent.email, currentStudent);
    hydrateUserUI();
    toast("success", "Saved", "Profile updated.");
}

// ==================== ACHIEVEMENTS ====================
function loadAchievements() {
    if (!currentStudent) return;
    const filter = $("achFilter")?.value || "";
    let list = currentStudent.achievements || [];

    if (filter) list = list.filter(a => a.category === filter);
    list = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const container = $("achievementsList");
    if (list.length === 0) {
        container.innerHTML = '<p class="empty">No achievements yet. Click "Add Achievement" to start.</p>';
        return;
    }

    container.innerHTML = list.map(a => `
        <div class="card" style="border-left:4px solid var(--primary); margin-bottom:10px;">
            <div class="entry">
                <div style="flex:1;">
                    <small>${escapeHtml(a.date || "No date")} • ${escapeHtml(a.category)}</small>
                    <h4><i class="fas fa-trophy" style="color:var(--primary);"></i> ${escapeHtml(a.title)}</h4>
                    ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
                </div>
                <div class="entry-actions">
                    <button class="iconbtn" onclick="editAchievement('${a.id}')"><i class="fas fa-pen"></i></button>
                    <button class="iconbtn danger" onclick="deleteAchievement('${a.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join("");
}

function openAchievementModal(ach = null) {
    editingAchievementId = ach?.id || null;
    $("achModalTitle").innerText = editingAchievementId ? "Edit Achievement" : "New Achievement";
    $("achTitle").value = ach?.title || "";
    $("achCategory").value = ach?.category || "Academic";
    $("achDate").value = ach?.date || new Date().toISOString().slice(0, 10);
    $("achDesc").value = ach?.description || "";
    $("achievementBackdrop").style.display = "flex";
}

function closeAchievementModal() {
    $("achievementBackdrop").style.display = "none";
    editingAchievementId = null;
}

function saveAchievement() {
    const title = $("achTitle").value.trim();
    if (!title) return toast("warn", "Missing title", "Enter a title.");

    const payload = {
        title,
        description: $("achDesc").value.trim(),
        category: $("achCategory").value,
        date: $("achDate").value
    };

    if (!currentStudent.achievements) currentStudent.achievements = [];

    if (editingAchievementId) {
        const idx = currentStudent.achievements.findIndex(a => a.id === editingAchievementId);
        if (idx !== -1) {
            currentStudent.achievements[idx] = {
                ...currentStudent.achievements[idx],
                ...payload
            };
        }
    } else {
        currentStudent.achievements.push({
            id: "ach_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            ...payload,
            createdAt: new Date().toISOString()
        });
    }

    saveUserData(currentStudent.email, currentStudent);
    toast("success", editingAchievementId ? "Updated" : "Added", "Achievement saved.");
    closeAchievementModal();
    loadAchievements();
}

function editAchievement(id) {
    const ach = (currentStudent.achievements || []).find(a => a.id === id);
    if (ach) openAchievementModal(ach);
}

function deleteAchievement(id) {
    if (!confirm("Delete this achievement?")) return;
    currentStudent.achievements = (currentStudent.achievements || []).filter(a => a.id !== id);
    saveUserData(currentStudent.email, currentStudent);
    toast("", "Deleted", "Achievement removed.");
    loadAchievements();
}

// ==================== SUMMARY ====================
function loadSummary() {
    if (!currentStudent) return;
    const list = currentStudent.achievements || [];
    const p = currentStudent.portfolio || {};

    $("kpiTotal").innerText = list.length;
    $("kpiAcademic").innerText = list.filter(a => a.category === "Academic").length;
    $("kpiSports").innerText = list.filter(a => a.category === "Sports").length;
    $("kpiLeadership").innerText = list.filter(a => a.category === "Leadership").length;

    const fallback = `https://ui-avatars.com/api/?background=6366f1&color=fff&name=${encodeURIComponent(p.fullName || currentStudent.fullName || "S")}`;
    $("previewPhoto").src = p.photo || fallback;
    $("previewName").innerText = p.fullName || currentStudent.fullName;
    $("previewCourse").innerText = [p.course, p.school].filter(Boolean).join(" • ") || "Course • School";
    $("previewMotto").innerText = p.motto ? `"${p.motto}"` : "";

    const top = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
    $("previewAchievements").innerHTML = top.map(a =>
        `<span class="chip"><i class="fas fa-trophy"></i> ${escapeHtml(a.title)}</span>`
    ).join("");
}

// ==================== FORM HANDLER ====================
document.addEventListener("DOMContentLoaded", () => {
    // Auto-login if session exists
    const sessionEmail = getSession();
    if (sessionEmail) {
        const user = getUserData(sessionEmail);
        if (user) {
            currentStudent = user;
            initApp();
            return;
        }
    }

    // Auth form
    $("authForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = $("email").value.trim().toLowerCase();
        const password = $("pass").value;

        if (!email || !password) return toast("warn", "Missing fields", "Fill in all inputs.");

        if (authMode === "signup") {
            const fullName = $("regName").value.trim();
            if (!fullName) return toast("warn", "Name required", "Enter your full name.");
            if (password.length < 6) return toast("warn", "Weak password", "Use at least 6 characters.");

            const result = signup(fullName, email, password);
            if (result.error) return toast("danger", "Signup failed", result.error);

            setSession(email);
            currentStudent = getUserData(email);
            toast("success", "Account created!", `Welcome, ${fullName}`);
            initApp();
        } else {
            const result = login(email, password);
            if (result.error) return toast("danger", "Login failed", result.error);

            setSession(email);
            currentStudent = result.user;
            toast("success", "Welcome!", `Hello ${currentStudent.fullName}`);
            initApp();
        }
    });
});
