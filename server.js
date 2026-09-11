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
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✅ Student Portfolio DB Connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// ==================== SCHEMAS ====================
const studentSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    photo: { type: String, default: null },
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
    visibility: { type: String, default: "public" }, // "public" or "private"
    createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", studentSchema);
const Portfolio = mongoose.model("Portfolio", portfolioSchema);
const Achievement = mongoose.model("Achievement", achievementSchema);

// ==================== AUTH ====================
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token) token = req.body?.token || req.query?.token;
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.studentId = decoded.studentId;
        next();
    } catch {
        res.status(403).json({ error: "Invalid token" });
    }
};

const ONLINE_THRESHOLD_MS = 60 * 1000;
function computeOnlineStatus(student) {
    if (!student || !student.lastSeen) return 'offline';
    return (Date.now() - new Date(student.lastSeen).getTime()) < ONLINE_THRESHOLD_MS
        ? 'online' : 'offline';
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
        res.json({ success: true, token, student: { id: student._id, fullName, email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const student = await Student.findOne({ email });
        if (!student) return res.status(401).json({ error: "Invalid credentials" });

        const ok = await bcrypt.compare(password, student.passwordHash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        student.onlineStatus = "online";
        student.lastSeen = new Date();
        await student.save();

        const token = jwt.sign({ studentId: student._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, student: { id: student._id, fullName: student.fullName, email: student.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PORTFOLIO ROUTES ====================
app.get("/api/portfolio", authenticateToken, async (req, res) => {
    try {
        let p = await Portfolio.findOne({ studentId: req.studentId });
        if (!p) p = await Portfolio.create({ studentId: req.studentId });
        res.json({ success: true, portfolio: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/portfolio", authenticateToken, async (req, res) => {
    try {
        const { fullName, course, school, yearLevel, bio, motto, hobbies, skills } = req.body;
        const p = await Portfolio.findOneAndUpdate(
            { studentId: req.studentId },
            {
                fullName, course, school, yearLevel, bio, motto,
                hobbies: hobbies || [], skills: skills || [],
                updatedAt: new Date()
            },
            { new: true, upsert: true }
        );
        res.json({ success: true, portfolio: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ACHIEVEMENT ROUTES ====================
app.get("/api/achievements", authenticateToken, async (req, res) => {
    try {
        const list = await Achievement.find({ studentId: req.studentId }).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, achievements: list });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/achievements", authenticateToken, async (req, res) => {
    try {
        const { title, description, category, date, visibility } = req.body;
        if (!title) return res.status(400).json({ error: "Title required" });

        const ach = await Achievement.create({
            studentId: req.studentId, title,
            description: description || "",
            category: category || "Academic",
            date: date || "",
            visibility: visibility === "private" ? "private" : "public"
        });
        res.json({ success: true, achievement: ach });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/achievements/:id", authenticateToken, async (req, res) => {
    try {
        const { title, description, category, date, visibility } = req.body;
        const ach = await Achievement.findOneAndUpdate(
            { _id: req.params.id, studentId: req.studentId },
            { title, description, category, date, visibility },
            { new: true }
        );
        if (!ach) return res.status(404).json({ error: "Not found" });
        res.json({ success: true, achievement: ach });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/achievements/:id", authenticateToken, async (req, res) => {
    try {
        const r = await Achievement.findOneAndDelete({ _id: req.params.id, studentId: req.studentId });
        if (!r) return res.status(404).json({ error: "Not found" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== FRIEND ROUTES ====================
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/friends/requests", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId).populate("friendRequests", "fullName email photo");
        res.json({
            requests: me.friendRequests.map(r => ({
                id: r._id, fromEmail: r.email, fromName: r.fullName, fromPhoto: r.photo
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/friends/accept", authenticateToken, async (req, res) => {
    try {
        const { fromUserId } = req.body;
        await Student.findByIdAndUpdate(req.studentId, {
            $push: { friends: fromUserId }, $pull: { friendRequests: fromUserId }
        });
        await Student.findByIdAndUpdate(fromUserId, { $push: { friends: req.studentId } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/friends/unfriend", authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;
        await Student.findByIdAndUpdate(req.studentId, { $pull: { friends: friendId } });
        await Student.findByIdAndUpdate(friendId, { $pull: { friends: req.studentId } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// View friend's profile + public achievements
app.get("/api/friends/:id/profile", authenticateToken, async (req, res) => {
    try {
        const me = await Student.findById(req.studentId);
        if (!me.friends.map(f => f.toString()).includes(req.params.id)) {
            return res.status(403).json({ error: "Not your friend" });
        }

        const friend = await Student.findById(req.params.id).select("fullName email photo onlineStatus lastSeen");
        if (!friend) return res.status(404).json({ error: "Not found" });

        const portfolio = await Portfolio.findOne({ studentId: friend._id });
        const achievements = await Achievement.find({
            studentId: friend._id,
            visibility: "public"
        }).sort({ date: -1 });

        res.json({
            success: true,
            friend: {
                id: friend._id, name: friend.fullName, email: friend.email, photo: friend.photo,
                onlineStatus: computeOnlineStatus(friend), lastSeen: friend.lastSeen
            },
            portfolio: portfolio || {},
            achievements
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== STATUS & SETTINGS ====================
app.post("/api/status/update", authenticateToken, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.studentId, {
            onlineStatus: req.body.status,
            lastSeen: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/user/photo", authenticateToken, async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.studentId, { photo: req.body.photo });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/user/delete", authenticateToken, async (req, res) => {
    try {
        await Portfolio.deleteOne({ studentId: req.studentId });
        await Achievement.deleteMany({ studentId: req.studentId });
        await Student.updateMany({ friends: req.studentId }, { $pull: { friends: req.studentId } });
        await Student.updateMany({ friendRequests: req.studentId }, { $pull: { friendRequests: req.studentId } });
        await Student.findByIdAndDelete(req.studentId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SERVE ====================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🎓 Student Portfolio running on port ${PORT}`);
});
