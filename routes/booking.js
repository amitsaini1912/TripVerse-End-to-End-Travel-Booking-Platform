const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookings");

router.get("/me", isLoggedIn, bookingController.getMyBookings);
router.patch("/:bookingId/cancel", isLoggedIn, bookingController.cancelBooking);

module.exports = router;
