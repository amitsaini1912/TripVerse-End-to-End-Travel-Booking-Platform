const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookings");

router.get("/me", isLoggedIn, bookingController.getMyBookings);
router.get("/host", isLoggedIn, bookingController.getHostBookings);
router.get("/host/dashboard", isLoggedIn, bookingController.getHostDashboard);
router.patch("/:bookingId/status", isLoggedIn, bookingController.updateBookingStatus);
router.patch("/:bookingId/cancel", isLoggedIn, bookingController.cancelBooking);

module.exports = router;
