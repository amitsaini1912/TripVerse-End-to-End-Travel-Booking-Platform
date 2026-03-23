const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { getStripeClient, getStripePublishableKey, getStripeWebhookSecret } = require("../utils/stripe");

function normalizeToStartOfDay(inputDate) {
  const date = new Date(inputDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function findOverlapBooking(listingId, checkIn, checkOut, extraQuery = {}) {
  return Booking.findOne({
    listing: listingId,
    status: { $in: ["pending", "confirmed"] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    ...extraQuery,
  });
}

function applyPaymentIntentToBooking(booking, paymentIntent, eventType = "") {
  if (!paymentIntent) return;

  if (booking.paymentStatus === "paid" && paymentIntent.status !== "succeeded") {
    return;
  }

  booking.paymentIntentId = paymentIntent.id;

  if (paymentIntent.status === "succeeded") {
    booking.paymentStatus = "paid";
    booking.paidAt = booking.paidAt || new Date();
    booking.lastPaymentErrorMessage = "";
    return;
  }

  if (paymentIntent.status === "processing") {
    booking.paymentStatus = "processing";
    booking.lastPaymentErrorMessage = "";
    return;
  }

  if (eventType === "payment_intent.payment_failed" || paymentIntent.status === "requires_payment_method") {
    booking.paymentStatus = "failed";
    booking.lastPaymentErrorMessage =
      (paymentIntent.last_payment_error && paymentIntent.last_payment_error.message) ||
      "The payment attempt failed. Please try again.";
    return;
  }

  if (paymentIntent.status === "canceled") {
    booking.paymentStatus = "failed";
    booking.lastPaymentErrorMessage = "The payment session was cancelled. You can try again.";
    return;
  }

  booking.paymentStatus = "pending";
  booking.lastPaymentErrorMessage = "";
}

async function cancelPaymentIntentIfPossible(booking) {
  if (!booking.paymentIntentId || booking.paymentStatus === "paid" || booking.paymentStatus === "refunded") {
    return;
  }

  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

    if (paymentIntent.status === "canceled" || paymentIntent.status === "succeeded") {
      applyPaymentIntentToBooking(booking, paymentIntent);
      return;
    }

    const cancelledIntent = await stripe.paymentIntents.cancel(booking.paymentIntentId);
    applyPaymentIntentToBooking(booking, cancelledIntent);
  } catch (err) {
    if (err && err.type === "StripeInvalidRequestError") {
      booking.lastPaymentErrorMessage = "Booking was cancelled, but the payment session could not be closed automatically.";
      return;
    }

    throw err;
  }
}

async function getBookingForGuestOrAdmin(bookingId, userId, userRole) {
  const booking = await Booking.findById(bookingId).populate("listing");
  if (!booking) {
    return { booking: null, isAuthorized: false };
  }

  const isAdmin = userRole === "admin";
  const isGuest = booking.guest.equals(userId);
  return { booking, isAuthorized: isAdmin || isGuest };
}

function getSafeRedirectPath(req, fallbackPath) {
  const redirectTo = (req.body && req.body.redirectTo) || req.query.redirectTo;

  if (
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
  ) {
    return redirectTo;
  }

  return fallbackPath;
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

    if (req.user.role === "host") {
      req.flash("error", "Hosts cannot book listings.");
      return res.redirect(`/listings/${listingId}`);
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

    const overlapBooking = await findOverlapBooking(listing._id, checkIn, checkOut);

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

module.exports.checkAvailability = async (req, res, next) => {
  try {
    const { id: listingId } = req.params;
    const { checkIn: checkInRaw, checkOut: checkOutRaw } = req.query;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ available: false, message: "Listing not found." });
    }

    const checkIn = normalizeToStartOfDay(checkInRaw);
    const checkOut = normalizeToStartOfDay(checkOutRaw);
    const today = normalizeToStartOfDay(new Date());

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return res.status(400).json({ available: false, message: "Invalid dates." });
    }

    if (checkIn < today || checkOut <= checkIn) {
      return res.status(400).json({
        available: false,
        message: "Check-out must be after check-in and dates cannot be in the past.",
      });
    }

    const overlapBooking = await findOverlapBooking(listing._id, checkIn, checkOut);

    if (!overlapBooking) {
      return res.json({ available: true });
    }

    return res.json({
      available: false,
      message: "Selected dates are not available.",
      conflict: {
        checkIn: overlapBooking.checkIn,
        checkOut: overlapBooking.checkOut,
        status: overlapBooking.status,
      },
    });
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

module.exports.renderCheckoutPage = async (req, res, next) => {
  try {
    const { booking, isAuthorized } = await getBookingForGuestOrAdmin(
      req.params.bookingId,
      req.user._id,
      req.user.role
    );

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/me");
    }

    if (!isAuthorized) {
      req.flash("error", "You are not authorized to access this payment page.");
      return res.redirect("/bookings/me");
    }

    if (booking.status !== "confirmed") {
      req.flash("error", "Only confirmed bookings can proceed to payment.");
      return res.redirect("/bookings/me");
    }

    if (booking.paymentStatus === "paid") {
      req.flash("success", "This booking is already paid.");
      return res.redirect("/bookings/me");
    }

    res.render("bookings/checkout.ejs", {
      booking,
      stripePublishableKey: getStripePublishableKey(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { booking, isAuthorized } = await getBookingForGuestOrAdmin(
      req.params.bookingId,
      req.user._id,
      req.user.role
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: "You are not authorized for this payment." });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be paid." });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "This booking is already paid." });
    }

    const stripe = getStripeClient();
    let paymentIntent;

    if (booking.paymentIntentId) {
      paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
      applyPaymentIntentToBooking(booking, paymentIntent);
    }

    if (!paymentIntent || paymentIntent.status === "canceled") {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round((booking.totalAmount || 0) * 100),
          currency: (booking.currency || "INR").toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: {
            bookingId: booking._id.toString(),
            listingId: booking.listing ? booking.listing._id.toString() : "",
            guestId: booking.guest.toString(),
          },
        },
        {
          idempotencyKey: `booking_${booking._id}_payment_intent`,
        }
      );

      applyPaymentIntentToBooking(booking, paymentIntent);
    }

    await booking.save();

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: getStripePublishableKey(),
      amount: booking.totalAmount,
      currency: booking.currency,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ message: err.message || "Unable to create payment intent." });
  }
};

module.exports.completePayment = async (req, res, next) => {
  try {
    const { booking, isAuthorized } = await getBookingForGuestOrAdmin(
      req.params.bookingId,
      req.user._id,
      req.user.role
    );

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/me");
    }

    if (!isAuthorized) {
      req.flash("error", "You are not authorized to verify this payment.");
      return res.redirect("/bookings/me");
    }

    const paymentIntentId = req.query.payment_intent || booking.paymentIntentId;
    if (!paymentIntentId) {
      req.flash("error", "Payment session not found for this booking.");
      return res.redirect("/bookings/me");
    }

    if (booking.paymentIntentId && booking.paymentIntentId !== paymentIntentId) {
      req.flash("error", "Payment verification failed because the payment session does not match the booking.");
      return res.redirect("/bookings/me");
    }

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    applyPaymentIntentToBooking(booking, paymentIntent);
    await booking.save();

    return res.render("bookings/paymentResult.ejs", {
      booking,
      paymentIntentStatus: paymentIntent.status,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.handleStripeWebhook = async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();

    if (!webhookSecret) {
      return res.status(500).send("STRIPE_WEBHOOK_SECRET is missing.");
    }

    const signature = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type.startsWith("payment_intent.")) {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata && paymentIntent.metadata.bookingId;

      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          applyPaymentIntentToBooking(booking, paymentIntent, event.type);
          await booking.save();
        }
      }
    }

    return res.json({ received: true });
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
    const redirectPath = getSafeRedirectPath(req, "/bookings/host");

    if (!allowedStatuses.includes(status)) {
      req.flash("error", "Invalid booking status update request.");
      return res.redirect(redirectPath);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect(redirectPath);
    }

    const isAdmin = req.user.role === "admin";
    const isHost = booking.host.equals(req.user._id);
    if (!isAdmin && !isHost) {
      req.flash("error", "You are not authorized to update this booking.");
      return res.redirect(redirectPath);
    }

    if (booking.status !== "pending") {
      req.flash("error", "Only pending bookings can be updated.");
      return res.redirect(redirectPath);
    }

    if (status === "confirmed") {
      const conflictingConfirmedBooking = await findOverlapBooking(
        booking.listing,
        booking.checkIn,
        booking.checkOut,
        { _id: { $ne: booking._id }, status: "confirmed" }
      );

      if (conflictingConfirmedBooking) {
        req.flash("error", "Cannot confirm due to date conflict with another confirmed booking.");
        return res.redirect(redirectPath);
      }
    }

    booking.status = status;
    await booking.save();

    req.flash("success", `Booking ${status} successfully.`);
    return res.redirect(redirectPath);
  } catch (err) {
    next(err);
  }
};

module.exports.cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const redirectPath = getSafeRedirectPath(req, "/bookings/me");
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect(redirectPath);
    }

    const isAdmin = req.user.role === "admin";
    const isGuest = booking.guest.equals(req.user._id);
    if (!isAdmin && !isGuest) {
      req.flash("error", "You are not authorized to cancel this booking.");
      return res.redirect(redirectPath);
    }

    if (booking.status === "cancelled" || booking.status === "rejected") {
      req.flash("error", "This booking can no longer be cancelled.");
      return res.redirect(redirectPath);
    }

    if (booking.paymentStatus === "paid") {
      req.flash("error", "Paid bookings cannot be cancelled until refund handling is added.");
      return res.redirect(redirectPath);
    }

    // Prevent cancellation once the booking has started
    const today = normalizeToStartOfDay(new Date());
    const bookingStart = normalizeToStartOfDay(booking.checkIn);
    if (today >= bookingStart) {
      req.flash("error", "Bookings can only be cancelled before the check-in date.");
      return res.redirect(redirectPath);
    }

    await cancelPaymentIntentIfPossible(booking);

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled successfully.");
    return res.redirect(redirectPath);
  } catch (err) {
    next(err);
  }
};
