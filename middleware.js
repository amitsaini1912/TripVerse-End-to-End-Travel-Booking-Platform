const Listing = require("./models/listing.js");
const ExpressError = require("./utils/ExpressError.js");
const {
  listingSchema,
  reviewSchema,
  bookingSchema,
  hostRequestSchema,
  signUpSchema,
  loginSchema,
  userRoleSchema,
  bookingStatusUpdateSchema,
  listingFilterSchema,
  adminBookingFilterSchema,
} = require("./schema.js");
const Review = require("./models/review.js");

function saveReturnTo(req) {
  const isSafeGetRequest =
    req.method === "GET" &&
    typeof req.originalUrl === "string" &&
    req.originalUrl.startsWith("/") &&
    !req.originalUrl.startsWith("//") &&
    !req.originalUrl.startsWith("/login") &&
    !req.originalUrl.startsWith("/signup") &&
    !req.originalUrl.startsWith("/logout");

  if (isSafeGetRequest) {
    req.session.returnTo = req.originalUrl;
  }
}

module.exports.isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()){
        saveReturnTo(req);
        req.flash("error", "You must logged in before make change!");
        return res.redirect("/login");
    }
    next();
};

module.exports.hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      saveReturnTo(req);
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

module.exports.isAdmin = module.exports.hasRole("admin");
module.exports.isHostOrAdmin = module.exports.hasRole("host", "admin");

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

module.exports.validateBooking = (req, res, next) => {
  const { error } = bookingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }
  next();
};

module.exports.validateHostRequest = (req, res, next) => {
  const { error } = hostRequestSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }
  next();
};

module.exports.validateSignUp = (req, res, next) => {
  const { error, value } = signUpSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.body = {
    ...req.body,
    ...value,
  };
  next();
};

module.exports.validateLogin = (req, res, next) => {
  const { error, value } = loginSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.body = {
    ...req.body,
    ...value,
  };
  next();
};

module.exports.validateUserRoleUpdate = (req, res, next) => {
  const { error, value } = userRoleSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.body = {
    ...req.body,
    ...value,
  };
  next();
};

module.exports.validateBookingStatusUpdate = (req, res, next) => {
  const { error, value } = bookingStatusUpdateSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.body = {
    ...req.body,
    ...value,
  };
  next();
};

module.exports.validateListingFilters = (req, res, next) => {
  const { error, value } = listingFilterSchema.validate(req.query, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.query = {
    ...req.query,
    ...value,
  };
  next();
};

module.exports.validateAdminBookingFilters = (req, res, next) => {
  const { error, value } = adminBookingFilterSchema.validate(req.query, { stripUnknown: true });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  }

  req.query = {
    ...req.query,
    ...value,
  };
  next();
};

module.exports.canRequestHostAccess = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must logged in before make change!");
    return res.redirect("/login");
  }

  const userRole = req.user.role || "user";
  if (userRole !== "user") {
    req.flash("error", "Only normal users can submit a host request.");
    return res.redirect("/listings");
  }

  next();
};

module.exports.canBookListings = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must logged in before make change!");
    return res.redirect("/login");
  }

  if ((req.user.role || "user") === "host") {
    req.flash("error", "Hosts cannot book listings.");
    return res.redirect("/listings");
  }

  next();
};

