const User = require("../models/user.js");

module.exports.renderSignUpForm =  (req, res) => {
    res.render("users/signUp.ejs");
};

module.exports.signUp = async(req,res,next) =>{
    try{
        let { username, email, password } = req.body;
        const newUser = new User({email, username});
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        //Auto login after sign up passport method
        req.login( registeredUser, (err) => {
            if(err){
                return next(err);
            }
            req.flash("success", "Wellcome to WanderLust");
            res.redirect("/listings");
        });
    }catch(err){
        req.flash("error" , err.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm =  (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = async(req, res) => {
    req.flash("success", "Wellcome Back to wandelust");
    //let redirectUrl = req.locals.redirectUrl || "/listings";
    res.redirect("/listings");
};

module.exports.logOut = (req, res, next) => {
    //this is also a passport method
    req.logout((err) => {
        if(err){
            return next(err);
        }
        req.flash("success", "Logout successfully");
        res.redirect("/listings");
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
