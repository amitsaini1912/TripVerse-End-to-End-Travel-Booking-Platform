const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.renderDashboard = async (req, res, next) => {
  try {
    const [usersCount, listingsCount, reviewsCount, pendingHostRequests, users] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Review.countDocuments(),
      User.find({ hostRequestStatus: "pending" }).sort({ hostRequestSubmittedAt: -1 }),
      User.find({}).sort({ username: 1 }),
    ]);

    res.render("admin/index.ejs", {
      stats: {
        users: usersCount,
        listings: listingsCount,
        reviews: reviewsCount,
      },
      pendingHostRequests,
      users,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.approveHostRequest = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/admin");
    }

    user.role = "host";
    user.hostRequestStatus = "approved";
    await user.save();

    req.flash("success", `${user.username} is now a host.`);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
};

module.exports.rejectHostRequest = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/admin");
    }

    user.role = "user";
    user.hostRequestStatus = "rejected";
    await user.save();

    req.flash("success", `${user.username}'s host request was rejected.`);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
};
