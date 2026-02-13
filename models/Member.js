const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({

    // Organization
    organizationName: String,
    organizationRegNo: String,
    orgPAN: String,

    // Person
    firstName: String,
    lastName: String,
    memberPAN: String,

    // Contact
    primaryMobile: String,
    alternateMobile: String,
    landline: String,
    email: String,
    website: String,

    // Address
    addressLine1: String,
    addressLine2: String,
    city: String,
    district: String,
    state: String,
    pinCode: String,

    // Files
    logo: String,
    signature: String,

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Member', memberSchema);
