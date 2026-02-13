// ===============================
// COMPLETE ADMIN PANEL SERVER
// ===============================

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();

// -------------------------------
// DATABASE CONNECTION
// -------------------------------

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// -------------------------------
// MODELS
// -------------------------------

const Member = require('./models/Member');
const Membership = require('./models/Membership');

// -------------------------------
// BASIC CONFIG
// -------------------------------

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------------------
// SESSION CONFIG
// -------------------------------

app.use(session({
    secret: 'receipt-secret-key',
    resave: false,
    saveUninitialized: false
}));

// -------------------------------
// FILE UPLOAD (LOGO + SIGNATURE)
// -------------------------------

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

// -------------------------------
// ADMIN LOGIN (HARDCODED)
// -------------------------------

const ADMIN_USER = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 10)
};

function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// -------------------------------
// ROUTES
// -------------------------------

app.get('/', (req, res) => {
    res.redirect('/login');
});

// LOGIN PAGE
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// LOGIN POST
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER.username && bcrypt.compareSync(password, ADMIN_USER.passwordHash)) {
        req.session.user = username;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// -------------------------------
// DASHBOARD PAGE
// -------------------------------

app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard');
});

// DASHBOARD DATA (STATS)
app.get('/dashboard-data', isLoggedIn, async (req, res) => {
    const memberships = await Membership.find();

    let active = 0;
    let expired = 0;
    let inprogress = 0;

    const today = new Date();

    memberships.forEach(m => {
        if (today < m.startDate) inprogress++;
        else if (today >= m.startDate && today <= m.endDate) active++;
        else expired++;
    });

    const totalMembers = await Member.countDocuments();

    res.json({ totalMembers, active, expired, inprogress });
});

// -------------------------------
// ADD MEMBER PAGE
// -------------------------------

app.get('/add-member', isLoggedIn, (req, res) => {
    res.render('add-member');
});

// ADD MEMBER SAVE
app.post('/add-member', isLoggedIn, upload.fields([{ name: 'logo' }, { name: 'signature' }]), async (req, res) => {

    const newMember = new Member({
        organizationName: req.body.organizationName,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        primaryMobile: req.body.primaryMobile,
        email: req.body.email,
        memberPAN: req.body.memberPAN,
        addressLine1: req.body.addressLine1,
        city: req.body.city,
        state: req.body.state,
        pinCode: req.body.pinCode,
        logo: req.files['logo'] ? req.files['logo'][0].filename : null,
        signature: req.files['signature'] ? req.files['signature'][0].filename : null
    });

    await newMember.save();

    // CREATE FIRST MEMBERSHIP
    const duration = parseInt(req.body.membershipDuration);
    const startDate = new Date(req.body.membershipStartDate);

    let endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + duration);

    await Membership.create({
        memberId: newMember._id,
        startDate,
        endDate,
        duration
    });

    res.redirect('/dashboard');
});

// -------------------------------
// MEMBER PROFILE
// -------------------------------

app.get('/member-profile/:id', isLoggedIn, async (req, res) => {

    const member = await Member.findById(req.params.id);
    const memberships = await Membership.find({ memberId: req.params.id }).sort({ startDate: -1 });

    const today = new Date();

    const membershipsWithStatus = memberships.map(m => {
        let status = 'Expired';

        if (today < m.startDate) status = 'In Progress';
        else if (today >= m.startDate && today <= m.endDate) status = 'Active';

        return { ...m.toObject(), status };
    });

    res.render('member-profile', {
        member,
        memberships: membershipsWithStatus
    });
});

// -------------------------------
// RENEW MEMBERSHIP
// -------------------------------

app.post('/renew-membership/:id', isLoggedIn, async (req, res) => {

    const memberId = req.params.id;
    const duration = parseInt(req.body.duration);
    const startDate = new Date(req.body.startDate);

    let endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + duration);

    await Membership.create({
        memberId,
        startDate,
        endDate,
        duration
    });

    res.redirect('/member-profile/' + memberId);
});

// -------------------------------
// SEARCH MEMBERS
// -------------------------------

app.get('/search-member', isLoggedIn, async (req, res) => {
    const keyword = req.query.keyword || '';

    const members = await Member.find({
        $or: [
            { firstName: { $regex: keyword, $options: 'i' } },
            { lastName: { $regex: keyword, $options: 'i' } },
            { primaryMobile: { $regex: keyword, $options: 'i' } }
        ]
    });

    res.render('search-member', { members, keyword });
});

// -------------------------------
// SERVER START
// -------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('Admin panel running on port ' + PORT);
});
