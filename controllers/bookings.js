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

    if (booking.status === "cancelled") {
      req.flash("error", "Booking is already cancelled.");
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
