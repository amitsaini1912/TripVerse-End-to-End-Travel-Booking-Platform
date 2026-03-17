const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookings");

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  bookingController.handleStripeWebhook
);

module.exports = router;
