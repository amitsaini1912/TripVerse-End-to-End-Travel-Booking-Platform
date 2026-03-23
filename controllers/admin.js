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

module.exports.renderListingsManagement = async (req, res, next) => {
  try {
    const [listings, bookingStats] = await Promise.all([
      Listing.find({})
        .populate("owner", "username email")
        .sort({ _id: -1 }),
      Booking.aggregate([
        {
          $group: {
            _id: "$listing",
            totalBookings: { $sum: 1 },
            activeBookings: {
              $sum: {
                $cond: [{ $in: ["$status", ["pending", "confirmed"]] }, 1, 0],
              },
            },
            paidBookings: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const bookingStatsMap = new Map(
      bookingStats.map((item) => [
        String(item._id),
        {
          totalBookings: item.totalBookings || 0,
          activeBookings: item.activeBookings || 0,
          paidBookings: item.paidBookings || 0,
        },
      ])
    );

    const listingsWithStats = listings.map((listing) => {
      const stats = bookingStatsMap.get(String(listing._id)) || {
        totalBookings: 0,
        activeBookings: 0,
        paidBookings: 0,
      };

      return {
        listing,
        stats,
      };
    });

    res.render("admin/listings.ejs", { listingsWithStats });
  } catch (err) {
    next(err);
  }
};

module.exports.renderBookingsManagement = async (req, res, next) => {
  try {
    const status = req.query.status || "";
    const paymentStatus = req.query.paymentStatus || "";
    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (paymentStatus) {
      filters.paymentStatus = paymentStatus;
    }

    const [
      bookings,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      paidBookings,
      failedPayments,
    ] = await Promise.all([
      Booking.find(filters)
        .populate("listing", "title location country")
        .populate("guest", "username email")
        .populate("host", "username email")
        .sort({ createdAt: -1 }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: { $in: ["cancelled", "rejected"] } }),
      Booking.countDocuments({ paymentStatus: "paid" }),
      Booking.countDocuments({ paymentStatus: "failed" }),
    ]);

    res.render("admin/bookings.ejs", {
      bookings,
      filters: {
        status,
        paymentStatus,
      },
      stats: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        paidBookings,
        failedPayments,
      },
      redirectTo: req.originalUrl,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/admin/listings");
    }

    await Listing.findByIdAndDelete(id);

    req.flash("success", `Listing "${listing.title}" was deleted.`);
    res.redirect("/admin/listings");
  } catch (err) {
    next(err);
  }
};
