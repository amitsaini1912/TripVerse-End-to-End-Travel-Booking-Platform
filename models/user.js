const mongoose = require(`mongoose`);
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema ({
    email: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["user", "host", "admin"],
        default: "user",
        required: true,
    },
    hostRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
        required: true,
    },
    hostRequestPhone: {
        type: String,
        trim: true,
        default: "",
    },
    hostRequestReason: {
        type: String,
        trim: true,
        default: "",
    },
    hostRequestSubmittedAt: {
        type: Date,
        default: null,
    },
});

userSchema.index({ role: 1 });
userSchema.index({ hostRequestStatus: 1, hostRequestSubmittedAt: -1 });

userSchema.plugin(passportLocalMongoose); //This plugin set a username and password in hash form 

const User = mongoose.model("User", userSchema);
module.exports = User;
