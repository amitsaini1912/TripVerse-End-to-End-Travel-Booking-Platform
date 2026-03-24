const express = require("express");
const router = express.Router();
const Listing = require("../models/listing.js");
// const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, isHostOrAdmin, isOwnerOrAdmin, validateListing, validateListingFilters} = require("../middleware.js");
const listingControllers = require("../controllers/listings.js")
const multer = require("multer"); //to parse file data to backend
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage })

router
  .route("/")
  .get(validateListingFilters, listingControllers.index)
  .post(isLoggedIn, isHostOrAdmin, upload.single("listing[image]"), validateListing,
   listingControllers.createNewListing);

router.get("/new", isLoggedIn, isHostOrAdmin, listingControllers.renderNewForm);
  
router
  .route("/:id")   
  .get(listingControllers.showListing)
  .put( isLoggedIn, isOwnerOrAdmin, upload.single("listing[image]"), validateListing, listingControllers.updateListing)
  .delete( isLoggedIn, isOwnerOrAdmin, listingControllers.deleteListing);

router.get("/:id/edit", isLoggedIn, isOwnerOrAdmin, listingControllers.renderEditListing);

module.exports = router;
