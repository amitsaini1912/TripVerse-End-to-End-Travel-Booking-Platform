const Listing = require("./models/listing.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

module.exports.isLoggedIn = (req, res, next) => {
    // console.log(req.path, ".." , req.originalUrl);
    if(!req.isAuthenticated()){
        //redirectUrl save
        // req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must logged in before make change!");
        return res.redirect("/login");
    };
    next();
};

module.exports.hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash("error", "You must logged in before make change!");
      return res.redirect("/login");
    }

    const userRole = req.user && req.user.role ? req.user.role : "user";
    if (!allowedRoles.includes(userRole)) {
      req.flash("error", "You are not authorized to access this resource.");
      return res.redirect("/listings");
    }

    next();
  };
};

//redirectUrl save in locals
// module.exports.saveRedirectUrl = (req, res, next) => {
//     if(req.session.redirectUrl){
//       req.locals.redirectUrl = req.session.redirectUrl;
//     };
//     next();
// };

module.exports.isOwner = async(req, res, next) => {
  try{  
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "listing not found or deleted");
      return res.redirect("/listings");
    }

    const isAdmin = res.locals.currUser && res.locals.currUser.role === "admin";
    const isOwner = listing.owner && listing.owner.equals(res.locals.currUser._id);

    if(!isAdmin && !isOwner){
        req.flash("error", "You don't have permission to make change");
        return res.redirect(`/listings/${id}`)
    }
    next();
  }catch(err){
    next(err);
  }
};

// Serverside Validation Schema
module.exports.validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if(error) {
      let errMsg = error.details.map((el) => el.message).join(",");
      throw new ExpressError(400, errMsg);
    } else{
      next();
    };
  };


  module.exports.validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if(error) {
      let errMsg = error.details.map((el) => el.message).join(",");
      throw new ExpressError(400, errMsg);
    } else{
      next();
    };
  };

  module.exports.isReviewAuthor = async(req, res, next) => {
    try{  
      let { id, reviewId } = req.params;
      let review = await Review.findById(reviewId);
      if (!review) {
        req.flash("error", "review not found or deleted");
        return res.redirect(`/listings/${id}`);
      }

      const isAdmin = res.locals.currUser && res.locals.currUser.role === "admin";
      const isReviewAuthor = review.author && review.author.equals(res.locals.currUser._id);

      if(!isAdmin && !isReviewAuthor){
          req.flash("error", "You don't have permission to make change");
          return res.redirect(`/listings/${id}`)
      }
      next();
    }catch(err){
      next(err);
    }
  };

module.exports.isOwnerOrAdmin = module.exports.isOwner;
module.exports.isReviewAuthorOrAdmin = module.exports.isReviewAuthor;

