const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");

// Models
const Member = require("./models/Member");
const Membership = require("./models/Membership");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session setup
app.use(
  session({
    secret: "adminsecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// --------------------
// MongoDB Connection
// --------------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// --------------------
// Admin login (single admin)
// --------------------
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "$2a$10$W4E9wL4..."; // bcrypt hash of your password

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login", { error: "" }));

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && (await bcrypt.compare(password, ADMIN_PASSWORD))) {
    req.session.admin = true;
    return res.redirect("/dashboard");
  } else {
    return res.render("login", { error: "Invalid username or password" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  if (req.session.admin) next();
  else res.redirect("/login");
}

// --------------------
// Dashboard
// --------------------
app.get("/dashboard", authMiddleware, async (req, res) => {
  const total = await Member.countDocuments();
  const active = await Member.countDocuments({ membershipStatus: "Active" });
  const inProgress = await Member.countDocuments({ membershipStatus: "In Progress" });
  const expired = await Member.countDocuments({ membershipStatus: "Expired" });

  res.render("dashboard", {
    stats: { total, active, inProgress, expired },
  });
});

// --------------------
// Add Member
// --------------------
app.get("/add-member", authMiddleware, (req, res) => {
  res.render("add-member", { error: "" });
});

app.post("/add-member", authMiddleware, upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]), async (req, res) => {
  try {
    const data = req.body;
    if (!data.firstName || !data.lastName || !data.memberPAN || !data.primaryMobile) {
      return res.render("add-member", { error: "Please fill required fields" });
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.logo) data.logo = req.files.logo[0].filename;
      if (req.files.signature) data.signature = req.files.signature[0].filename;
    }

    // Generate membership ID
    const lastMember = await Member.findOne().sort({ _id: -1 });
    const lastIdNum = lastMember ? parseInt(lastMember.membershipID.split("-")[2]) : 0;
    const membershipID = `MEM001-${new Date().getFullYear()}-${lastIdNum + 1}`;
    data.membershipID = membershipID;

    // Determine membership status
    const today = new Date();
    const startDate = data.membershipStartDate ? new Date(data.membershipStartDate) : today;
    const endDate = data.membershipEndDate ? new Date(data.membershipEndDate) : null;

    if (endDate && today > endDate) data.membershipStatus = "Expired";
    else if (today < startDate) data.membershipStatus = "In Progress";
    else data.membershipStatus = "Active";

    // Save to DB
    const newMember = new Member(data);
    await newMember.save();

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("add-member", { error: "Something went wrong" });
  }
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`Admin panel running on port ${PORT}`);
});
