const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const passport = require("passport");
const {
  isLoggedIn,
  canRequestHostAccess,
  validateHostRequest,
  validateSignUp,
  validateLogin,
} = require("../middleware.js");

const userController = require("../controllers/users.js");

router
   .route("/signup")
   .get(userController.renderSignUpForm)
   .post(validateSignUp, userController.signUp);

router
   .route("/login")
   .get(userController.renderLoginForm)
   .post(
    validateLogin,
    passport.authenticate("local",{
      failureRedirect: "/login",
      failureFlash: true,
      keepSessionInfo: true,
    }),
    userController.login
    );

router
   .route("/become-host")
   .get(isLoggedIn, canRequestHostAccess, userController.renderBecomeHostForm)
   .post(isLoggedIn, canRequestHostAccess, validateHostRequest, userController.submitHostRequest);

router.get("/logout", userController.logOut);

module.exports = router;
