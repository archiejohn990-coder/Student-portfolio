const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, "public")));

// ==================== MONGODB ====================
const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URL;
if (!MONGO_URL) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
}
mongoose.connect(MONGO_URL)
.then(() => console.log("✅ DB Connected:", mongoose.connection.name))
.catch(err => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
});

// ==================== SCHEMAS ====================
const studentSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    photo: { type: String, default: null },
    language: { type: String, default: "en" },
    onlineStatus: { type: String, default: "offline" },
    lastSeen: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    createdAt: { type: Date, default: Date.now }
});

const portfolioSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    fullName: { type: String, default: "" },
    course: { type: String, default: "" },
    school: { type: String, default: "" },
    yearLevel: { type: String, default: "" },
    bio: { type: String, default: "" },
    motto: { type: String, default: "" },
    pronouns: { type: String, default: "" },
    gender: { type: String, default: "" },
    hobbies: [{ type: String }],
    skills: [{ type: String }],
    updatedAt: { type: Date, default: Date.now }
});

const achievementSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "Academic" },
    date: { type: String, default: "" },
    visibility: { type: String, default: "public" },
    createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    image: { type: String, required: true },
    caption: { type: String, default: "" },
    visibility: { type: String, default: "friends" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    type: { type: String, required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    text: { type: String, default: "" },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    type: { type: String, required: true },
    detail: { type: String, default: "" },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", studentSchema);
const Portfolio = mongoose.model("Portfolio", portfolioSchema);
const Achievement = mongoose.model("Achievement", achievementSchema);
const Message = mongoose.model("Message", messageSchema);
const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);
const Notification = mongoose.model("Notification", notificationSchema);
const Activity = mongoose.model("Activity", activitySchema);

// ==================== MIDDLEWARE ====================
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token) token = req.body?.token || req.query?.token;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.studentId = decoded.studentId;
        next();
    } catch {
        res.status(403).json({ error: "Invalid token" });
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const me = await Student.findById(req.studentId);
        if (!me || !me.isAdmin) return res.status(403).json({ error: "Admin access required" });
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const ONLINE_THRESHOLD_MS = 60 * 1000;
function computeOnlineStatus(s) {
    if (!s || !s.lastSeen) return 'offline';
    return (Date.now() - new Date(s.lastSeen).getTime()) < ONLINE_THRESHOLD_MS ? 'online' : 'offline';
}

async function createNotification({ toUser, fromUser, type, postId = null, text = "" }) {
    try {
        if (toUser.toString() === fromUser.toString()) return;
        await Notification.create({ toUser, fromUser, type, postId, text });
    } catch (e) { console.error("Notification error:", e.message); }
}

async function logActivity(studentId, type, detail = "", postId = null) {
    try {
        await Activity.create({ studentId, type, detail, postId });
        const count = await Activity.countDocuments({ studentId });
        if (count > 100) {
            const old = await Activity.find({ studentId }).sort({ createdAt: 1 }).limit(count - 100);
            await Activity.deleteMany({ _id: { $in: old.map(o => o._id) } });
        }
    } catch (e) { console.error("Activity error:", e.message); }
}

// ==================== AUTH ROUTES ====================
app.post("/api/signup", async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) return res.status(400).json({ error: "All fields required" });
        const exists = await Student.findOne({ email });
        if (exists) return res.status(400).json({ error: "Email already registered" });
        const passwordHash = await bcrypt.hash(password, 10);
        const totalUsers = await Student.countDocuments();
        const isFirstUser = totalUsers === 0;
        const student = await Student.create({
            fullName, email, passwordHash,
            onlineStatus: "online",
            lastSeen: new Date(),
            isAdmin: isFirstUser
        });
        await Portfolio.create({ studentId: student._id, fullName });
        await logActivity(student._id, "signup", isFirstUser ? "Created account (admin)" : "Created account");
        const token = jwt.sign({ studentId: student._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({
            success: true, token,
            student: { id: student._id, fullName, email, language: "en", isAdmin: student.isAdmin }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const s = await Student.findOne({ email });
        if (!s) return res.status(401).json({ error: "Invalid credentials" });
        const ok = await bcrypt.compare(password, s.passwordHash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });
        s.onlineStatus = "online";
        s.lastSeen = new Date();
        await s.save();
        await logActivity(s._id, "login", "Logged in");
        const token = jwt.sign({ studentId: s._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({
            success: true, token,
            student: {
                id: s._id, fullName: s.fullName, email: s.email,
                photo: s.photo, language: s.language, isAdmin: s.isAdmin
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== FORGOT PASSWORD ====================
const otpStore = new Map();

app.post("/api/forgot/send", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });
        const s = await Student.findOne({ email });
        if (!s) return res.status(404).json({ error: "No account found with this email" });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
        console.log(`📧 OTP for ${email}: ${otp}`);
        res.json({ success: true, message: "OTP generated", demoOtp: otp });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/forgot/reset", async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ error: "All fields required" });
        if (newPassword.length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });
        const entry = otpStore.get(email);
        if (!entry) return res.status(400).json({ error: "No OTP requested" });
        if (Date.now() > entry.expiresAt) { otpStore.delete(email); return res.status(400).json({ error: "OTP expired" }); }
        if (entry.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });
        const s = await Student.findOne({ email });
        if (!s) return res.status(404).json({ error: "User not found" });
        s.passwordHash = await bcrypt.hash(newPassword, 10);
        await s.save();
        otpStore.delete(email);
        await logActivity(s._id, "password_reset", "Reset password via OTP");
        res.json({ success: true, message: "Password reset successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== USER UPDATES ====================
app.put("/api/user/name", authenticateToken, async (req, res) => {
    try {
        const { fullName } = req.body;
        if (!fullName || fullName.trim().length < 2) return res.status(400).json({ error: "Name too short" });
        await Student.findByIdAndUpdate(req.studentId, { fullName: fullName.trim() });
        await Portfolio.findOneAndUpdate({ studentId: req.studentId }, { fullName: fullName.trim() });
        await logActivity(req.studentId, "name_change", `Changed name to ${fullName.trim()}`);
        res.json({ success: true, fullName: fullName.trim() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== PORTFOLIO ====================
app.get("/api/portfolio", authenticateToken, async (req, res) => {
    try {
        let p = await Portfolio.findOne({ studentId: req.studentId });
        if (!p) p = await Portfolio.create({ studentId: req.studentId });
        res.json({ success: true, portfolio: p });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/portfolio", authenticateToken, async (req, res) => {
    try {
        const { fullName, course, school, yearLevel, bio, motto, pronouns, gender, hobbies, skills } = req.body;
        const p = await Portfolio.findOneAndUpdate(
            { studentId: req.studentId },
            { fullName, course, school, yearLevel, bio, motto, pronouns, gender,
              hobbies: hobbies || [], skills: skills || [], updatedAt: new Date() },
            { new: true, upsert: true }
        );
        await logActivity(req.studentId, "profile_update", "Updated profile");
        res.json({ success: true, portfolio: p });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ACHIEVEMENTS ====================
app.get("/api/achievements", authenticateToken, async (req, res) => {
    try {
        const list = await Achievement.find({ studentId: req.studentId }).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, achievements: list });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/achievements", authenticateToken, async (req, res) => {
    try {
        const { title, description, category, date, visibility } = req.body;
        if (!title) return res.status(400).json({ error: "Title required" });
        const a = await Achievement.create({
            studentId: req.studentId, title,
            description: description || "", category: category || "Academic",
            date: date || "", visibility: visibility === "private" ? "private" : "public"
        });
        await logActivity(req.studentId, "achievement_add", `Added achievement: ${title}`);
        res.json({ success: true, achievement: a });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/achievements/:id", authenticateToken, async (req, res) => {
    try {
        const a = await Achievement.findOneAndUpdate(
            { _id: req.params.id, studentId: req.studentId },
            req.body, { new: true }
        );
        if (!a) return res.status(404).json({ error: "Not found" });
        await logActivity(req.studentId, "achievement_update", `Updated achievement: ${a.title}`);
        res.json({ success: true, achievement: a });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/achievements/:id", authenticateToken, async (req, res) => {
    try {
        const a = await Achievement.findOneAndDelete({ _id: req.params.id, studentId: req.studentId });
        if (a) await logActivity(req.studentId, "achievement_delete", `Deleted achievement: ${a.title}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== POSTS ====================
async function fetchPostsForUser(userId, filter) {
    const me = await Student.findById(userId);
    const ids = filter === "feed" ? [...me.friends, me._id] : [me._id];
    const query = filter === "feed"
        ? { studentId: { $in: ids }, $or: [{ visibility: "friends" }, { studentId: me._id }] }
        : { studentId: me._id };
    const posts = await Post.find(query)
        .populate("studentId", "fullName photo")
        .sort({ createdAt: -1 })
        .limit(100);

    const postIds = posts.map(p => p._id);
    const comments = await Comment.find({ postId: { $in: postIds } })
        .populate("studentId", "fullName photo")
        .sort({ createdAt: 1 });
    const commentsByPost = {};
    comments.forEach(c => {
        const key = c.postId.toString();
        if (!commentsByPost[key]) commentsByPost[key] = [];
        commentsByPost[key].push({
            id: c._id, text: c.text, createdAt: c.createdAt,
            author: { id: c.studentId._id, name: c.studentId.fullName, photo: c.studentId.photo }
        });
    });

    return posts.map(p => ({
        id: p._id, caption: p.caption, image: p.image,
        visibility: p.visibility, createdAt: p.createdAt,
        likes: p.likes.length,
        likedByMe: p.likes.map(l => l.toString()).includes(userId),
        author: { id: p.studentId._id, name: p.studentId.fullName, photo: p.studentId.photo },
        comments: commentsByPost[p._id.toString()] || []
    }));
}

app.get("/api/posts/feed", authenticateToken, async (req, res) => {
    try {
        const posts = await fetchPostsForUser(req.studentId, "feed");
        res.json({ success: true, posts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/posts/mine", authenticateToken, async (req, res) => {
    try {
        const posts = await fetchPostsForUser(req.studentId, "mine");
        res.json({ success: true, posts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/posts", authenticateToken, async (req, res) => {
    try {
        const { image, caption, visibility } = req.body;
        if (!image) return res.status(400).json({ error: "Image required" });
        const post = await Post.create({
            studentId: req.studentId, image,
            caption: caption || "",
            visibility: visibility === "private" ? "private" : "friends"
        });
        await logActivity(req.studentId, "post_create", "Posted a photo", post._id);
        res.json({ success: true, post });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
    try {
        await Post.findOneAndDelete({ _id: req.params.id, studentId: req.studentId });
        await Comment.deleteMany({ postId: req.params.id });
        await logActivity(req.studentId, "post_delete", "Deleted a photo");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/posts/:id/like", authenticateToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Not found" });
        const already = post.likes.map(l => l.toString()).includes(req.studentId);
        if (already) {
            post.likes = post.likes.filter(l => l.toString() !== req.studentId);
        } else {
            post.likes.push(req.studentId);
            await createNotification({
                toUser: post.studentId, fromUser: req.studentId,
                type: "like", postId: post._id
            });
        }
        await post.save();
        res.json({ success: true, likes: post.likes.length, likedByMe: !already });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== COMMENTS ====================
app.get("/api/posts/:id/comments", authenticateToken, async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.id })
            .populate("studentId", "fullName photo")
            .sort({ createdAt: 1 });
        res.json({
            success: true,
            comments: comments.map(c => ({
                id: c._id, text: c.text, createdAt: c.createdAt,
                author: { id: c.studentId._id, name: c.studentId.fullName, photo: c.studentId.photo }
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/posts/:id/comments", authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: "Empty comment" });
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post not found" });
        const comment = await Comment.create({
            postId: post._id, studentId: req.studentId,
            text: text.trim().slice(0, 500)
        });
        await createNotification({
            toUser: post.studentId, fromUser: req.studentId,
            type: "comment", postId: post._id, text: text.trim().slice(0, 80)
        });
        const populated = await Comment.findById(comment._id).populate("studentId", "fullName photo");
        res.json({
            success: true,
            comment: {
                id: populated._id, text: populated.text, createdAt: populated.createdAt,
                author: { id: populated.studentId._id, name: populated.studentId.fullName, photo: populated.studentId.photo }
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/comments/:id", authenticateToken, async (req, res) => {
    try {
        const c = await Comment.findById(req.params.id);
        if (!c) return res.status(404).json({ error: "Not found" });
        if (c.studentId.toString() !== req.studentId) return res.status(403).json({ error: "Not yours" });
        await c.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== NOTIFICATIONS ====================
app.get("/api/notifications", authenticateToken, async (req, res) => {
    try {
        const list = await Notification.find({ toUser: req.studentId })
            .populate("fromUser", "fullName photo")
            .populate("postId", "image")
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({
            success: true,
            notifications: list.map(n => ({
                id: n._id, type: n.type, text: n.text, read: n.read,
                createdAt: n.createdAt,
                postImage: n.postId?.image || null,
                postId: n.postId?._id || null,
                from: { id: n.fromUser._id, name: n.fromUser.fullName, photo: n.fromUser.photo }
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/notifications/unread/count", authenticateToken, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ toUser: req.studentId, read: false });
        res.json({ success: true, count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/notifications/read-all", authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany({ toUser: req.studentId, read: false }, { read: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, toUser: req.studentId });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== FRIENDS ====================
app.post("/api/friends/request", authenticateToken, async (req, res) => {
    try {
        const { toUserEmail } = req.body;
        const toUser = await Student.findOne({ email: toUserEmail });
        if (!toUser) return res.status(404).json({ error: "User not found" });
        if (toUser._id.toString() === req.studentId) return res.status(400).json({ error: "Cannot add yourself" });
        const me = await Student.findById(req.studentId);
        if (me.friends.includes(toUser._id)) return res.status(400).json({ error: "Already friends" });
        const existing = await Student.findOne({ _id: toUser._id, friendRequests: req.studentId });
        if (existing) return res.status(400).json({ error: "Request already sent" });
        await Student.findByIdAndUpdate(toUser._id, { $push: { friendRequests: req.studentId } });
        await createNotification({ toUser: toUser._id, fromUser: req.studentId, type: "friend_request" });
        await logActivity(req.studentId, "friend_request", `Sent friend request to ${toUserEmail}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/friends/requests", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId).populate("friendRequests", "fullName email photo");
        res.json({
            requests: me.friendRequests.map(r => ({
                id: r._id, fromEmail: r.email, fromName: r.fullName, fromPhoto: r.photo
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/friends/accept", authenticateToken, async (req, res) => {
    try {
        const { fromUserId } = req.body;
        await Student.findByIdAndUpdate(req.studentId, {
            $push: { friends: fromUserId }, $pull: { friendRequests: fromUserId }
        });
        await Student.findByIdAndUpdate(fromUserId, { $push: { friends: req.studentId } });
        await createNotification({ toUser: fromUserId, fromUser: req.studentId, type: "friend_accept" });
        await logActivity(req.studentId, "friend_accept", "Accepted a friend request");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/friends/unfriend", authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;
        await Student.findByIdAndUpdate(req.studentId, { $pull: { friends: friendId } });
        await Student.findByIdAndUpdate(friendId, { $pull: { friends: req.studentId } });
        await logActivity(req.studentId, "unfriend", "Removed a friend");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/friends/list", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId).populate("friends", "fullName email photo onlineStatus lastSeen");
        res.json({
            friends: me.friends.map(f => ({
                id: f._id, name: f.fullName, email: f.email, photo: f.photo,
                onlineStatus: computeOnlineStatus(f), lastSeen: f.lastSeen
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/friends/:id/profile", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId);
        if (!me.friends.map(f => f.toString()).includes(req.params.id))
            return res.status(403).json({ error: "Not your friend" });
        const friend = await Student.findById(req.params.id).select("fullName email photo onlineStatus lastSeen");
        if (!friend) return res.status(404).json({ error: "Not found" });
        const portfolio = await Portfolio.findOne({ studentId: friend._id });
        const achievements = await Achievement.find({ studentId: friend._id, visibility: "public" }).sort({ date: -1 });
        const posts = await Post.find({ studentId: friend._id, visibility: "friends" }).sort({ createdAt: -1 }).limit(30);
        res.json({
            success: true,
            friend: {
                id: friend._id, name: friend.fullName, email: friend.email, photo: friend.photo,
                onlineStatus: computeOnlineStatus(friend), lastSeen: friend.lastSeen
            },
            portfolio: portfolio || {},
            achievements,
            posts: posts.map(p => ({
                id: p._id, image: p.image, caption: p.caption,
                likes: p.likes.length,
                likedByMe: p.likes.map(l => l.toString()).includes(req.studentId),
                createdAt: p.createdAt
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== CHAT ====================
app.get("/api/chat/:friendId", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId);
        if (!me.friends.map(f => f.toString()).includes(req.params.friendId))
            return res.status(403).json({ error: "Not your friend" });
        const msgs = await Message.find({
            $or: [
                { from: req.studentId, to: req.params.friendId },
                { from: req.params.friendId, to: req.studentId }
            ]
        }).sort({ createdAt: 1 }).limit(200);
        await Message.updateMany(
            { from: req.params.friendId, to: req.studentId, read: false },
            { read: true, readAt: new Date() }
        );
        res.json({ success: true, messages: msgs });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/chat/:friendId", authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: "Empty message" });
        const me = await Student.findById(req.studentId);
        if (!me.friends.map(f => f.toString()).includes(req.params.friendId))
            return res.status(403).json({ error: "Not your friend" });
        const msg = await Message.create({ from: req.studentId, to: req.params.friendId, text: text.trim() });
        await createNotification({
            toUser: req.params.friendId, fromUser: req.studentId,
            type: "message", text: text.trim().slice(0, 60)
        });
        res.json({ success: true, message: msg });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/chat/:friendId/status", authenticateToken, async (req, res) => {
    try {
        const unread = await Message.countDocuments({
            from: req.studentId, to: req.params.friendId, read: false
        });
        const lastRead = await Message.findOne({
            from: req.studentId, to: req.params.friendId, read: true
        }).sort({ readAt: -1 });
        res.json({
            success: true,
            unreadByThem: unread,
            lastReadAt: lastRead?.readAt || null,
            lastMessageRead: lastRead?._id || null
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/chat/unread/count", authenticateToken, async (req, res) => {
    try {
        const count = await Message.countDocuments({ to: req.studentId, read: false });
        res.json({ success: true, count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const typingStore = new Map();

app.post("/api/chat/:friendId/typing", authenticateToken, async (req, res) => {
    try {
        const key = `${req.studentId}:${req.params.friendId}`;
        typingStore.set(key, Date.now());
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/chat/:friendId/typing", authenticateToken, async (req, res) => {
    try {
        const key = `${req.params.friendId}:${req.studentId}`;
        const t = typingStore.get(key);
        const isTyping = t && (Date.now() - t) < 3000;
        res.json({ success: true, typing: !!isTyping });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== SEARCH ====================
app.get("/api/search", authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        if (!q) return res.json({ success: true, results: { students: [], posts: [], achievements: [] } });
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

        const students = await Student.find({
            _id: { $ne: req.studentId },
            $or: [{ fullName: regex }, { email: regex }]
        }).select("fullName email photo").limit(10);

        const me = await Student.findById(req.studentId);
        const visibleIds = [...me.friends, me._id];

        const posts = await Post.find({
            studentId: { $in: visibleIds },
            caption: regex
        })
        .populate("studentId", "fullName photo")
        .sort({ createdAt: -1 })
        .limit(10);

        const achievements = await Achievement.find({
            $or: [
                { studentId: req.studentId },
                { studentId: { $in: me.friends }, visibility: "public" }
            ],
            title: regex
        })
        .populate("studentId", "fullName photo")
        .limit(10);

        res.json({
            success: true,
            results: {
                students: students.map(s => ({
                    id: s._id, name: s.fullName, email: s.email, photo: s.photo
                })),
                posts: posts.map(p => ({
                    id: p._id, caption: p.caption, image: p.image,
                    author: { id: p.studentId._id, name: p.studentId.fullName, photo: p.studentId.photo }
                })),
                achievements: achievements.map(a => ({
                    id: a._id, title: a.title, category: a.category, date: a.date,
                    author: { id: a.studentId._id, name: a.studentId.fullName, photo: a.studentId.photo }
                }))
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== STATS (personal) ====================
app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId).populate("friends", "_id");
        const totalPosts = await Post.countDocuments({ studentId: req.studentId });
        const totalAchievements = await Achievement.countDocuments({ studentId: req.studentId });
        const totalFriends = me.friends.length;
        const totalMessagesSent = await Message.countDocuments({ from: req.studentId });
        const totalMessagesReceived = await Message.countDocuments({ to: req.studentId });

        const likesAgg = await Post.aggregate([
            { $match: { studentId: me._id } },
            { $project: { likes: { $size: "$likes" } } },
            { $group: { _id: null, total: { $sum: "$likes" } } }
        ]);

        const commentsAgg = await Comment.aggregate([
            { $lookup: { from: "posts", localField: "postId", foreignField: "_id", as: "post" } },
            { $unwind: "$post" },
            { $match: { "post.studentId": me._id } },
            { $count: "total" }
        ]);

        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toISOString().slice(0, 7));
        }
        const allPosts = await Post.find({ studentId: req.studentId }).select("createdAt");
        const postsByMonth = months.map(m => ({
            month: m,
            count: allPosts.filter(p => p.createdAt.toISOString().slice(0, 7) === m).length
        }));

        res.json({
            success: true,
            stats: {
                posts: totalPosts,
                achievements: totalAchievements,
                friends: totalFriends,
                messagesSent: totalMessagesSent,
                messagesReceived: totalMessagesReceived,
                likesReceived: likesAgg[0]?.total || 0,
                commentsReceived: commentsAgg[0]?.total || 0,
                postsByMonth
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ACTIVITY LOG ====================
app.get("/api/activity", authenticateToken, async (req, res) => {
    try {
        const list = await Activity.find({ studentId: req.studentId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({
            success: true,
            activity: list.map(a => ({
                id: a._id, type: a.type, detail: a.detail, createdAt: a.createdAt
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ADMIN STATS ====================
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await Student.countDocuments();
        const totalPosts = await Post.countDocuments();
        const totalMessages = await Message.countDocuments();
        const totalAchievements = await Achievement.countDocuments();
        const totalComments = await Comment.countDocuments();
        const totalNotifications = await Notification.countDocuments();
        const onlineNow = await Student.countDocuments({
            lastSeen: { $gte: new Date(Date.now() - 60 * 1000) }
        });
        const uptime = process.uptime();

        res.json({
            success: true,
            stats: {
                users: totalUsers,
                posts: totalPosts,
                messages: totalMessages,
                achievements: totalAchievements,
                comments: totalComments,
                notifications: totalNotifications,
                online: onlineNow,
                uptimeSeconds: Math.floor(uptime)
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/promote-me", authenticateToken, async (req, res) => {
    try {
        const totalAdmins = await Student.countDocuments({ isAdmin: true });
        if (totalAdmins > 0) {
            return res.status(403).json({ error: "An admin already exists. Contact them." });
        }
        await Student.findByIdAndUpdate(req.studentId, { isAdmin: true });
        res.json({ success: true, message: "You are now an admin. Please log out and log back in." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== STATUS ====================
app.post("/api/status/update", authenticateToken, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.studentId, {
            onlineStatus: req.body.status, lastSeen: new Date()
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== SETTINGS ====================
app.put("/api/user/photo", authenticateToken, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.studentId, { photo: req.body.photo });
        await logActivity(req.studentId, "photo_change", "Updated profile photo");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/user/language", authenticateToken, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.studentId, { language: req.body.language });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/user/password", authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6)
            return res.status(400).json({ error: "New password must be 6+ characters" });
        const s = await Student.findById(req.studentId);
        const ok = await bcrypt.compare(currentPassword, s.passwordHash);
        if (!ok) return res.status(401).json({ error: "Current password incorrect" });
        s.passwordHash = await bcrypt.hash(newPassword, 10);
        await s.save();
        await logActivity(req.studentId, "password_change", "Changed password");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/user/delete", authenticateToken, async (req, res) => {
    try {
        await Portfolio.deleteOne({ studentId: req.studentId });
        await Achievement.deleteMany({ studentId: req.studentId });
        await Message.deleteMany({ $or: [{ from: req.studentId }, { to: req.studentId }] });
        await Post.deleteMany({ studentId: req.studentId });
        await Comment.deleteMany({ studentId: req.studentId });
        await Notification.deleteMany({ $or: [{ toUser: req.studentId }, { fromUser: req.studentId }] });
        await Activity.deleteMany({ studentId: req.studentId });
        await Student.updateMany({ friends: req.studentId }, { $pull: { friends: req.studentId } });
        await Student.updateMany({ friendRequests: req.studentId }, { $pull: { friendRequests: req.studentId } });
        await Student.findByIdAndDelete(req.studentId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== SERVE ====================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`🎓 Running on port ${PORT}`));
