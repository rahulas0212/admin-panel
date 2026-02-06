const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ===============================
   BASIC MIDDLEWARE
================================ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "admin-secret-key",
    resave: false,
    saveUninitialized: false
  })
);

/* ===============================
   STATIC FILES
================================ */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===============================
   ADMIN LOGIN (SINGLE ADMIN)
================================ */
const ADMIN_USER = {
  username: "admin",
  password: bcrypt.hashSync("admin123", 10)
};

/* ===============================
   AUTH MIDDLEWARE
================================ */
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect("/");
}

/* ===============================
   LOGIN ROUTES
================================ */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === ADMIN_USER.username &&
    bcrypt.compareSync(password, ADMIN_USER.password)
  ) {
    req.session.loggedIn = true;
    res.redirect("/dashboard.html");
  } else {
    res.status(401).send("Invalid username or password");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ===============================
   JSON DATABASE SETUP
================================ */
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "members.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

function readMembers() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveMembers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ===============================
   MEMBERSHIP HELPERS
================================ */
function generateMembershipId(members) {
  const year = new Date().getFullYear();
  const count = members.filter(m => m.membershipId.includes(year)).length + 1;
  return `MEM-${year}-${String(count).padStart(4, "0")}`;
}

function calculateStatus(start, end) {
  const today = new Date();
  const s = new Date(start);
  const e = end ? new Date(end) : null;

  if (today < s) return "In Progress";
  if (!e || today <= e) return "Active";
  return "Expired";
}

/* ===============================
   FILE UPLOAD (LOGO & SIGN)
================================ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir =
      file.fieldname === "logo"
        ? "uploads/logos"
        : "uploads/signatures";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ===============================
   ADD MEMBER
================================ */
app.post(
  "/api/members",
  requireLogin,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "signature", maxCount: 1 }
  ]),
  (req, res) => {
    const members = readMembers();

    const membershipId = generateMembershipId(members);
    const status = calculateStatus(
      req.body.startDate,
      req.body.endDate
    );

    const member = {
      membershipId,
      status,
      createdAt: new Date().toISOString(),

      organization: {
        name: req.body.orgName || "",
        regNo: req.body.orgRegNo || "",
        regDate: req.body.orgRegDate || "",
        reg80GNo: req.body.reg80GNo || "",
        reg80GDate: req.body.reg80GDate || "",
        reg12ANo: req.body.reg12ANo || "",
        reg12ADate: req.body.reg12ADate || ""
      },

      contact: {
        mobile: req.body.primaryMobile || "",
        email: req.body.email || ""
      },

      member: {
        firstName: req.body.firstName || "",
        lastName: req.body.lastName || "",
        pan: req.body.memberPAN || ""
      },

      membership: {
        registrationDate: req.body.registrationDate,
        startDate: req.body.startDate,
        endDate: req.body.endDate
      },

      assets: {
        logo: req.files.logo ? "/" + req.files.logo[0].path : "",
        signature: req.files.signature
          ? "/" + req.files.signature[0].path
          : ""
      }
    };

    members.push(member);
    saveMembers(members);

    res.json({ success: true });
  }
);

/* ===============================
   SEARCH MEMBERS
================================ */
app.get("/api/members", requireLogin, (req, res) => {
  const members = readMembers();
  res.json(members);
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Admin panel running on port " + PORT);
});
