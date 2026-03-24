const express = require("express");
const router = express.Router();
const { isLoggedIn, isHostOrAdmin, validateBookingStatusUpdate } = require("../middleware");
const bookingController = require("../controllers/bookings");

router.get("/me", isLoggedIn, bookingController.getMyBookings);
router.get("/host", isLoggedIn, isHostOrAdmin, bookingController.getHostBookings);
router.get("/host/dashboard", isLoggedIn, isHostOrAdmin, bookingController.getHostDashboard);
router.get("/:bookingId/pay", isLoggedIn, bookingController.renderCheckoutPage);
router.get("/:bookingId/pay/complete", isLoggedIn, bookingController.completePayment);
router.post("/:bookingId/payment-intent", isLoggedIn, bookingController.createPaymentIntent);
router.patch("/:bookingId/status", isLoggedIn, isHostOrAdmin, validateBookingStatusUpdate, bookingController.updateBookingStatus);
router.patch("/:bookingId/cancel", isLoggedIn, bookingController.cancelBooking);

module.exports = router;
