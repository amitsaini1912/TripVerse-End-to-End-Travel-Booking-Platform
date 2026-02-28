const express = require("express");
const router = express.Router({mergeParams: true});
const { validateReview, isLoggedIn, isReviewAuthorOrAdmin } = require("../middleware.js");

const reviewController = require("../controllers/reviews.js");
  
//post route
router.post("/", isLoggedIn, validateReview, reviewController.createReview);
  
//delete route
router.delete("/:reviewId", isLoggedIn, isReviewAuthorOrAdmin, reviewController.destroyReview);
  
module.exports = router;  
