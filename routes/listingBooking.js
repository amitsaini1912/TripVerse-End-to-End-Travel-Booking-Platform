const express = require("express");
const router = express.Router({ mergeParams: true });
const { isLoggedIn, canBookListings, validateBooking } = require("../middleware");
const bookingController = require("../controllers/bookings");

router.get("/availability", bookingController.checkAvailability);
router.post("/", isLoggedIn, canBookListings, validateBooking, bookingController.createBooking);

module.exports = router;
