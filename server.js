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
    createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", studentSchema);
const Portfolio = mongoose.model("Portfolio", portfolioSchema);
const Achievement = mongoose.model("Achievement", achievementSchema);
const Message = mongoose.model("Message", messageSchema);

// ==================== AUTH ====================
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

const ONLINE_THRESHOLD_MS = 60 * 1000;
function computeOnlineStatus(s) {
    if (!s || !s.lastSeen) return 'offline';
    return (Date.now() - new Date(s.lastSeen).getTime()) < ONLINE_THRESHOLD_MS ? 'online' : 'offline';
}

// ==================== AUTH ROUTES ====================
app.post("/api/signup", async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) return res.status(400).json({ error: "All fields required" });
        const exists = await Student.findOne({ email });
        if (exists) return res.status(400).json({ error: "Email already registered" });
        const passwordHash = await bcrypt.hash(password, 10);
        const student = await Student.create({ fullName, email, passwordHash, onlineStatus: "online", lastSeen: new Date() });
        await Portfolio.create({ studentId: student._id, fullName });
        const token = jwt.sign({ studentId: student._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, student: { id: student._id, fullName, email, language: "en" } });
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
        const token = jwt.sign({ studentId: s._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({
            success: true, token,
            student: { id: s._id, fullName: s.fullName, email: s.email, photo: s.photo, language: s.language }
        });
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
        const { fullName, course, school, yearLevel, bio, motto, hobbies, skills } = req.body;
        const p = await Portfolio.findOneAndUpdate(
            { studentId: req.studentId },
            { fullName, course, school, yearLevel, bio, motto, hobbies: hobbies || [], skills: skills || [], updatedAt: new Date() },
            { new: true, upsert: true }
        );
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
        res.json({ success: true, achievement: a });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/achievements/:id", authenticateToken, async (req, res) => {
    try {
        await Achievement.findOneAndDelete({ _id: req.params.id, studentId: req.studentId });
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/friends/unfriend", authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;
        await Student.findByIdAndUpdate(req.studentId, { $pull: { friends: friendId } });
        await Student.findByIdAndUpdate(friendId, { $pull: { friends: req.studentId } });
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
        res.json({
            success: true,
            friend: {
                id: friend._id, name: friend.fullName, email: friend.email, photo: friend.photo,
                onlineStatus: computeOnlineStatus(friend), lastSeen: friend.lastSeen
            },
            portfolio: portfolio || {},
            achievements
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
            { read: true }
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
        res.json({ success: true, message: msg });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/chat/unread/count", authenticateToken, async (req, res) => {
    try {
        const count = await Message.countDocuments({ to: req.studentId, read: false });
        res.json({ success: true, count });
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/user/delete", authenticateToken, async (req, res) => {
    try {
        await Portfolio.deleteOne({ studentId: req.studentId });
        await Achievement.deleteMany({ studentId: req.studentId });
        await Message.deleteMany({ $or: [{ from: req.studentId }, { to: req.studentId }] });
        await Student.updateMany({ friends: req.studentId }, { $pull: { friends: req.studentId } });
        await Student.updateMany({ friendRequests: req.studentId }, { $pull: { friendRequests: req.studentId } });
        await Student.findByIdAndDelete(req.studentId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== SERVE ====================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`🎓 Running on port ${PORT}`));
