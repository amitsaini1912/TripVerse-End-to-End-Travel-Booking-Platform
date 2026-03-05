const Booking = require("../models/booking");
const Listing = require("../models/listing");

function normalizeToStartOfDay(inputDate) {
  const date = new Date(inputDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

module.exports.createBooking = async (req, res, next) => {
  try {
    const { id: listingId } = req.params;
    if (!listingId) {
      req.flash("error", "Invalid listing for booking.");
      return res.redirect("/listings");
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      req.flash("error", "listing not found or deleted");
      return res.redirect("/listings");
    }

    if (listing.owner && listing.owner.equals(req.user._id)) {
      req.flash("error", "You cannot book your own listing.");
      return res.redirect(`/listings/${listingId}`);
    }

    const checkIn = normalizeToStartOfDay(req.body.booking.checkIn);
    const checkOut = normalizeToStartOfDay(req.body.booking.checkOut);
    const guests = Number(req.body.booking.guests);
    const today = normalizeToStartOfDay(new Date());

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      req.flash("error", "Please provide valid check-in and check-out dates.");
      return res.redirect(`/listings/${listingId}`);
    }

    if (checkIn < today) {
      req.flash("error", "Check-in date cannot be in the past.");
      return res.redirect(`/listings/${listingId}`);
    }

    if (checkOut <= checkIn) {
      req.flash("error", "Check-out date must be after check-in date.");
      return res.redirect(`/listings/${listingId}`);
    }

    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = Math.max(0, nights * (listing.price || 0));

    const overlapBooking = await Booking.findOne({
      listing: listing._id,
      status: { $in: ["pending", "confirmed"] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    });

    if (overlapBooking) {
      req.flash("error", "Selected dates are not available for this listing.");
      return res.redirect(`/listings/${listingId}`);
    }

    const booking = new Booking({
      listing: listing._id,
      guest: req.user._id,
      host: listing.owner,
      checkIn,
      checkOut,
      guests,
      totalAmount,
      currency: "INR",
      status: "pending",
      paymentStatus: "pending",
    });

    await booking.save();
    req.flash("success", "Booking created successfully.");
    return res.redirect(`/listings/${listingId}`);
  } catch (err) {
    next(err);
  }
};

module.exports.getMyBookings = async (req, res, next) => {
  try {
    const myBookings = await Booking.find({ guest: req.user._id })
      .populate("listing")
      .sort({ createdAt: -1 });

    return res.render("bookings/index.ejs", { myBookings });
  } catch (err) {
    next(err);
  }
};

module.exports.getHostBookings = async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? {} : { host: req.user._id };
    const hostBookings = await Booking.find(query)
      .populate("listing")
      .populate("guest", "username email")
      .sort({ createdAt: -1 });

    return res.render("bookings/host.ejs", { hostBookings });
  } catch (err) {
    next(err);
  }
};

module.exports.getHostDashboard = async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? {} : { host: req.user._id };
    const hostBookings = await Booking.find(query)
      .populate("listing", "title location image")
      .sort({ createdAt: -1 });

    const listingStatsMap = new Map();

    for (const booking of hostBookings) {
      const listingId = booking.listing ? booking.listing._id.toString() : "unavailable";

      if (!listingStatsMap.has(listingId)) {
        listingStatsMap.set(listingId, {
          listing: booking.listing || null,
          totalBookings: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          confirmedRevenue: 0,
        });
      }

      const stats = listingStatsMap.get(listingId);
      stats.totalBookings += 1;

      if (booking.status === "pending") stats.pending += 1;
      if (booking.status === "confirmed") {
        stats.confirmed += 1;
        stats.confirmedRevenue += booking.totalAmount || 0;
      }
      if (booking.status === "rejected") stats.rejected += 1;
      if (booking.status === "cancelled") stats.cancelled += 1;
    }

    const listingStats = Array.from(listingStatsMap.values()).sort(
      (a, b) => b.totalBookings - a.totalBookings
    );

    const overallStats = listingStats.reduce(
      (acc, item) => {
        acc.totalListings += 1;
        acc.totalBookings += item.totalBookings;
        acc.pending += item.pending;
        acc.confirmed += item.confirmed;
        acc.rejected += item.rejected;
        acc.cancelled += item.cancelled;
        acc.confirmedRevenue += item.confirmedRevenue;
        return acc;
      },
      {
        totalListings: 0,
        totalBookings: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        confirmedRevenue: 0,
      }
    );

    return res.render("bookings/dashboard.ejs", { listingStats, overallStats });
  } catch (err) {
    next(err);
  }
};

module.exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["confirmed", "rejected"];

    if (!allowedStatuses.includes(status)) {
      req.flash("error", "Invalid booking status update request.");
      return res.redirect("/bookings/host");
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/host");
    }

    const isAdmin = req.user.role === "admin";
    const isHost = booking.host.equals(req.user._id);
    if (!isAdmin && !isHost) {
      req.flash("error", "You are not authorized to update this booking.");
      return res.redirect("/bookings/host");
    }

    if (booking.status !== "pending") {
      req.flash("error", "Only pending bookings can be updated.");
      return res.redirect("/bookings/host");
    }

    if (status === "confirmed") {
      const conflictingConfirmedBooking = await Booking.findOne({
        _id: { $ne: booking._id },
        listing: booking.listing,
        status: "confirmed",
        checkIn: { $lt: booking.checkOut },
        checkOut: { $gt: booking.checkIn },
      });

      if (conflictingConfirmedBooking) {
        req.flash("error", "Cannot confirm due to date conflict with another confirmed booking.");
        return res.redirect("/bookings/host");
      }
    }

    booking.status = status;
    await booking.save();

    req.flash("success", `Booking ${status} successfully.`);
    return res.redirect("/bookings/host");
  } catch (err) {
    next(err);
  }
};

module.exports.cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/me");
    }

    const isAdmin = req.user.role === "admin";
    const isGuest = booking.guest.equals(req.user._id);
    if (!isAdmin && !isGuest) {
      req.flash("error", "You are not authorized to cancel this booking.");
      return res.redirect("/bookings/me");
    }

    if (booking.status === "cancelled" || booking.status === "rejected") {
      req.flash("error", "This booking can no longer be cancelled.");
      return res.redirect("/bookings/me");
    }

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled successfully.");
    return res.redirect("/bookings/me");
  } catch (err) {
    next(err);
  }
};
