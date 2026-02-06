const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();

/* ---------- BASIC SETUP ---------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(
  session({
    secret: 'admin-secret',
    resave: false,
    saveUninitialized: false
  })
);

/* ---------- DATABASE ---------- */
mongoose.connect(
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/receiptApp'
);

/* ---------- SCHEMAS ---------- */
const AdminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const MemberSchema = new mongoose.Schema({
  membershipId: String,

  /* Organization */
  organizationName: String,
  orgRegNo: String,
  orgRegDate: Date,
  reg80GNo: String,
  reg80GDate: Date,
  reg12ANo: String,
  reg12ADate: Date,

  /* Contact */
  primaryMobile: String,
  alternateMobile: String,
  landline: String,
  email: String,
  website: String,

  /* Member */
  firstName: String,
  lastName: String,
  memberPAN: String,
  aadhaar: String,

  /* Membership */
  registrationDate: Date,
  startDate: Date,
  endDate: Date,
  status: String,

  /* Assets */
  logo: String,
  signature: String
});

const Admin = mongoose.model('Admin', AdminSchema);
const Member = mongoose.model('Member', MemberSchema);

/* ---------- HELPERS ---------- */
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/');
  next();
}

function calculateStatus(startDate, endDate) {
  const today = new Date();
  if (today < startDate) return 'In Progress';
  if (endDate && today > endDate) return 'Expired';
  return 'Active';
}

async function generateMembershipId() {
  const year = new Date().getFullYear();
  const last = await Member.findOne(
    { membershipId: new RegExp(`MEM-${year}`) },
    {},
    { sort: { membershipId: -1 } }
  );

  let next = '0001';
  if (last) {
    const lastNum = parseInt(last.membershipId.split('-')[2]);
    next = String(lastNum + 1).padStart(4, '0');
  }
  return `MEM-${year}-${next}`;
}

/* ---------- FILE UPLOAD ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'logo') cb(null, 'uploads/logos');
    else cb(null, 'uploads/signatures');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

/* ---------- ROUTES ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

/* ---------- LOGIN ---------- */
app.post('/login', async (req, res) => {
  const admin = await Admin.findOne({ username: req.body.username });
  if (!admin || !bcrypt.compareSync(req.body.password, admin.password)) {
    return res.send('Invalid username or password');
  }
  req.session.admin = true;
  res.redirect('/dashboard');
});

/* ---------- LOGOUT ---------- */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ---------- DASHBOARD ---------- */
app.get('/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

/* ---------- ADD MEMBER ---------- */
app.post(
  '/add-member',
  requireAdmin,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const membershipId = await generateMembershipId();
    const status = calculateStatus(
      new Date(req.body.startDate),
      req.body.endDate ? new Date(req.body.endDate) : null
    );

    await Member.create({
      membershipId,

      organizationName: req.body.organizationName,
      orgRegNo: req.body.orgRegNo,
      orgRegDate: req.body.orgRegDate,
      reg80GNo: req.body.reg80GNo,
      reg80GDate: req.body.reg80GDate,
      reg12ANo: req.body.reg12ANo,
      reg12ADate: req.body.reg12ADate,

      primaryMobile: req.body.primaryMobile,
      alternateMobile: req.body.alternateMobile,
      landline: req.body.landline,
      email: req.body.email,
      website: req.body.website,

      firstName: req.body.firstName,
      lastName: req.body.lastName,
      memberPAN: req.body.memberPAN,
      aadhaar: req.body.aadhaar,

      registrationDate: req.body.registrationDate,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      status,

      logo: req.files.logo ? req.files.logo[0].path : '',
      signature: req.files.signature ? req.files.signature[0].path : ''
    });

    res.redirect('/dashboard');
  }
);

/* ---------- SEARCH MEMBERS ---------- */
app.get('/api/members', requireAdmin, async (req, res) => {
  const query = {};
  if (req.query.membershipId) query.membershipId = req.query.membershipId;
  if (req.query.organizationName)
    query.organizationName = new RegExp(req.query.organizationName, 'i');
  if (req.query.primaryMobile) query.primaryMobile = req.query.primaryMobile;
  if (req.query.email) query.email = req.query.email;
  if (req.query.status) query.status = req.query.status;

  const members = await Member.find(query).sort({ registrationDate: -1 });
  res.json(members);
});

/* ---------- GET MEMBER (VIEW / EDIT) ---------- */
app.get('/api/member/:id', requireAdmin, async (req, res) => {
  const member = await Member.findById(req.params.id);
  res.json(member);
});

/* ---------- UPDATE MEMBER ---------- */
app.post(
  '/update-member/:id',
  requireAdmin,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const member = await Member.findById(req.params.id);

    Object.assign(member, req.body);

    member.status = calculateStatus(
      new Date(member.startDate),
      member.endDate ? new Date(member.endDate) : null
    );

    if (req.files.logo) member.logo = req.files.logo[0].path;
    if (req.files.signature)
      member.signature = req.files.signature[0].path;

    await member.save();
    res.redirect('/dashboard');
  }
);

/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Admin panel running on port ' + PORT);
});
