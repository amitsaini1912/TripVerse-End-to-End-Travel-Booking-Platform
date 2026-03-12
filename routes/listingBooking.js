const express = require("express");
const router = express.Router({ mergeParams: true });
const { isLoggedIn, validateBooking } = require("../middleware");
const bookingController = require("../controllers/bookings");

router.get("/availability", bookingController.checkAvailability);
router.post("/", isLoggedIn, validateBooking, bookingController.createBooking);

module.exports = router;
