const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");

router
      .route("/")
      .get(isLoggedIn, isAdmin, adminController.admin)

module.exports = router;
