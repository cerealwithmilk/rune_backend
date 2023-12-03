const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    guid: { type: String, required: true, unique: true },       
    license: { type: String, required: false },
    ip_address: { type: String, required: true },

    strikes: { type: Number, required: true, default: 0 },

    blacklisted: { type: Boolean, required: true, default: false },
    blacklisted_reason: { type: String, required: false },
    blacklisted_at: { type: Date, required: false },

    current_checkpoint: { type: Number, required: true, default: 1 },
    current_checkpoint_2fa: { type: String, required: false },
    current_checkpoint_started: { type: Boolean, required: true, default: false },
    current_checkpoint_started_at: { type: Date, required: false },

    started_at: { type: Date, required: true, default: Date.now },
});

module.exports = mongoose.model('Users', userSchema);