const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin, validateUserRoleUpdate, validateAdminBookingFilters } = require("../middleware");
const adminController = require("../controllers/admin.js");

router
      .route("/")
      .get(isLoggedIn, isAdmin, adminController.renderDashboard);

router.get("/bookings", isLoggedIn, isAdmin, validateAdminBookingFilters, adminController.renderBookingsManagement);
router.get("/listings", isLoggedIn, isAdmin, adminController.renderListingsManagement);
router.patch("/users/:id/approve-host", isLoggedIn, isAdmin, adminController.approveHostRequest);
router.patch("/users/:id/reject-host", isLoggedIn, isAdmin, adminController.rejectHostRequest);
router.patch("/users/:id/role", isLoggedIn, isAdmin, validateUserRoleUpdate, adminController.updateUserRole);
router.delete("/listings/:id", isLoggedIn, isAdmin, adminController.deleteListing);

module.exports = router;
