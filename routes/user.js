const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const passport = require("passport");
const { isLoggedIn, canRequestHostAccess, validateHostRequest } = require("../middleware.js");

const userController = require("../controllers/users.js");

router
   .route("/signup")
   .get(userController.renderSignUpForm)
   .post(userController.signUp);

router
   .route("/login")
   .get(userController.renderLoginForm)
   .post(//saveRedirectUrl, 
    passport.authenticate("local",{failureRedirect: "/login", failureFlash: true,}),
    userController.login
    );

router
   .route("/become-host")
   .get(isLoggedIn, canRequestHostAccess, userController.renderBecomeHostForm)
   .post(isLoggedIn, canRequestHostAccess, validateHostRequest, userController.submitHostRequest);

router.get("/logout", userController.logOut);

module.exports = router;
