const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "admin-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 } // 30 days login
  })
);

/* ---------------- STATIC ---------------- */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ---------------- HOMEPAGE ---------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ---------------- ADMIN LOGIN ---------------- */
const ADMIN_USER = {
  username: "admin",
  password: bcrypt.hashSync("admin123", 10)
};

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === ADMIN_USER.username &&
    bcrypt.compareSync(password, ADMIN_USER.password)
  ) {
    req.session.loggedIn = true;
    return res.redirect("/dashboard.html");
  }
  res.send("Invalid username or password");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/* ---------------- AUTH PROTECTION ---------------- */
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/");
}

app.get("/dashboard.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

/* ---------------- JSON DATABASE ---------------- */
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

/* ---------------- MEMBERSHIP HELPERS ---------------- */
function generateMembershipId(members) {
  const year = new Date().getFullYear();
  const count = members.length + 1;
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

/* ---------------- FILE UPLOAD ---------------- */
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

/* ---------------- ADD MEMBER ---------------- */
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
    const status = calculateStatus(req.body.startDate, req.body.endDate);

    const member = {
      membershipId,
      status,
      organization: {
        name: req.body.orgName,
        regNo: req.body.orgRegNo,
        reg80GNo: req.body.reg80GNo,
        reg12ANo: req.body.reg12ANo
      },
      contact: {
        mobile: req.body.primaryMobile,
        email: req.body.email
      },
      member: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        pan: req.body.memberPAN
      },
      membership: {
        registrationDate: req.body.registrationDate,
        startDate: req.body.startDate,
        endDate: req.body.endDate
      },
      assets: {
        logo: req.files.logo ? "/" + req.files.logo[0].path : "",
        signature: req.files.signature ? "/" + req.files.signature[0].path : ""
      }
    };

    members.push(member);
    saveMembers(members);

    res.json({ success: true });
  }
);

/* ---------------- GET MEMBERS ---------------- */
app.get("/api/members", requireLogin, (req, res) => {
  res.json(readMembers());
});

/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
