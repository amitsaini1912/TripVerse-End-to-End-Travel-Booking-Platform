const express = require("express");
const router = express.Router();
const Listing = require("../models/listing.js");
// const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, isOwnerOrAdmin, validateListing} = require("../middleware.js");
const listingControllers = require("../controllers/listings.js")
const multer = require("multer"); //to parse file data to backend
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage })

router
  .route("/")
  .get(listingControllers.index)
  .post(isLoggedIn, upload.single("listing[image]"),//to parse file data to abckend
   listingControllers.createNewListing); // If i want Host and Admin both can create listing 
                                         // then i will use hasRole middleware instead of isLoggedIn and
                                         // pass allowed role as argument like this hasRole("host", "admin")

router.get("/new", isLoggedIn, listingControllers.renderNewForm);
  
router
  .route("/:id")   
  .get(listingControllers.showListing)
  .put( isLoggedIn, isOwnerOrAdmin, upload.single("listing[image]"), validateListing, listingControllers.updateListing)
  .delete( isLoggedIn, isOwnerOrAdmin, listingControllers.deleteListing);

router.get("/:id/edit", isLoggedIn, isOwnerOrAdmin, listingControllers.renderEditListing);

module.exports = router;