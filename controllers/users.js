const User = require("../models/user.js");

function getSafeRedirectPath(path, fallback = "/listings") {
    if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
        return path;
    }
    return fallback;
}

function completeAuthenticatedSession(req, res, next, user, successMessage, redirectPath = "/listings") {
    req.session.regenerate((err) => {
        if (err) {
            return next(err);
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                return next(loginErr);
            }

            req.flash("success", successMessage);
            res.redirect(redirectPath);
        });
    });
}

module.exports.renderSignUpForm =  (req, res) => {
    res.render("users/signUp.ejs");
};

module.exports.signUp = async(req,res,next) =>{
    try{
        let { username, email, password } = req.body;
        const newUser = new User({email, username});
        const registeredUser = await User.register(newUser, password);
        const redirectPath = getSafeRedirectPath(req.session.returnTo, "/listings");
        completeAuthenticatedSession(
            req,
            res,
            next,
            registeredUser,
            "Wellcome to WanderLust",
            redirectPath
        );
    }catch(err){
        req.flash("error" , err.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm =  (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = async(req, res, next) => {
    const redirectPath = getSafeRedirectPath(req.session.returnTo, "/listings");
    completeAuthenticatedSession(
        req,
        res,
        next,
        req.user,
        "Wellcome Back to wandelust",
        redirectPath
    );
};

module.exports.logOut = (req, res, next) => {
    req.logout((err) => {
        if(err){
            return next(err);
        }

        req.session.regenerate((sessionErr) => {
            if (sessionErr) {
                return next(sessionErr);
            }

            req.flash("success", "Logout successfully");
            res.redirect("/listings");
        });
    });
};

module.exports.renderBecomeHostForm = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect("/listings");
        }

        if ((user.role || "user") !== "user") {
            req.flash("error", "Only normal users can request host access.");
            return res.redirect("/listings");
        }

        res.render("users/becomeHost.ejs", { user });
    } catch (err) {
        next(err);
    }
};

module.exports.submitHostRequest = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect("/listings");
        }

        if ((user.role || "user") !== "user") {
            req.flash("error", "Only normal users can request host access.");
            return res.redirect("/listings");
        }

        if (user.hostRequestStatus === "pending") {
            req.flash("error", "Your host request is already pending review.");
            return res.redirect("/become-host");
        }

        user.role = "user";
        user.hostRequestPhone = req.body.hostRequest.phone;
        user.hostRequestReason = req.body.hostRequest.reason;
        user.hostRequestSubmittedAt = new Date();
        user.hostRequestStatus = "pending";
        await user.save();

        req.flash("success", "Your host request has been submitted for admin approval.");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
};
