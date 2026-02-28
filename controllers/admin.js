const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.admin = async (req, res, next) => {
  try {
    const [usersCount, listingsCount, reviewsCount] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Review.countDocuments(),
    ]);

    res.json({
      message: "Admin dashboard",
      stats: {
        users: usersCount,
        listings: listingsCount,
        reviews: reviewsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};