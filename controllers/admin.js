const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");

module.exports.renderDashboard = async (req, res, next) => {
  try {
    const [
      usersCount,
      hostsCount,
      listingsCount,
      reviewsCount,
      bookingsCount,
      confirmedBookingsCount,
      paidBookingsCount,
      pendingPaymentsCount,
      pendingHostRequests,
      users,
      recentBookings,
      paidRevenueResult,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "host" }),
      Listing.countDocuments(),
      Review.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ paymentStatus: "paid" }),
      Booking.countDocuments({ paymentStatus: { $in: ["pending", "processing"] } }),
      User.find({ hostRequestStatus: "pending" }).sort({ hostRequestSubmittedAt: -1 }),
      User.find({}).sort({ username: 1 }),
      Booking.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("listing", "title")
        .populate("guest", "username")
        .populate("host", "username"),
      Booking.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const totalRevenue = paidRevenueResult[0]?.totalRevenue || 0;

    res.render("admin/index.ejs", {
      stats: {
        users: usersCount,
        hosts: hostsCount,
        listings: listingsCount,
        reviews: reviewsCount,
        bookings: bookingsCount,
        confirmedBookings: confirmedBookingsCount,
        paidBookings: paidBookingsCount,
        pendingPayments: pendingPaymentsCount,
        pendingHostRequests: pendingHostRequests.length,
        revenue: totalRevenue,
      },
      pendingHostRequests,
      users,
      recentBookings,
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

module.exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["user", "host"].includes(role)) {
      req.flash("error", "Invalid role selection.");
      return res.redirect("/admin");
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/admin");
    }

    if (user.role === "admin") {
      req.flash("error", "Admin roles must be managed manually.");
      return res.redirect("/admin");
    }

    user.role = role;

    if (role === "host") {
      user.hostRequestStatus = "approved";
      if (!user.hostRequestSubmittedAt) {
        user.hostRequestSubmittedAt = new Date();
      }
    } else {
      user.hostRequestStatus = "none";
      user.hostRequestPhone = "";
      user.hostRequestReason = "";
      user.hostRequestSubmittedAt = null;
    }

    await user.save();
    req.flash("success", `${user.username} is now a ${role}.`);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
};
