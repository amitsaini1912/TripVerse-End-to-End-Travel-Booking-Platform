// This is for serverSide Validation 

const joi = require("joi");

module.exports.listingSchema = joi.object ({
    listing: joi.object ({
        title: joi.string().required(),
        description: joi.string().required(),
        location: joi.string().required(),
        country: joi.string().required(),
        price: joi.number().required().min(0),
        image: joi.string().allow("", null),
    }).required(),
});

module.exports.reviewSchema = joi.object ({
    review: joi.object ({
        rating: joi.number().required().min(1).max(5),
        comment: joi.string().required(),
    }).required(),
});

module.exports.bookingSchema = joi.object({
    booking: joi.object({
        checkIn: joi.date().required(),
        checkOut: joi.date().greater(joi.ref("checkIn")).required(),
        guests: joi.number().integer().min(1).max(20).required(),
    }).required(),
});

module.exports.hostRequestSchema = joi.object({
    hostRequest: joi.object({
        phone: joi.string().trim().min(7).max(20).required(),
        reason: joi.string().trim().min(20).max(500).required(),
    }).required(),
});

module.exports.signUpSchema = joi.object({
    username: joi.string().trim().min(3).max(30).required(),
    email: joi.string().trim().lowercase().email().required(),
    password: joi.string().min(8).max(128).required(),
});

module.exports.loginSchema = joi.object({
    username: joi.string().trim().required(),
    password: joi.string().min(1).required(),
});

module.exports.userRoleSchema = joi.object({
    role: joi.string().valid("user", "host").required(),
});

module.exports.bookingStatusUpdateSchema = joi.object({
    status: joi.string().valid("confirmed", "rejected").required(),
    redirectTo: joi.string().trim().allow("", null),
});

module.exports.listingFilterSchema = joi.object({
    q: joi.string().trim().allow(""),
    country: joi.string().trim().allow(""),
    checkIn: joi.string().trim().isoDate().allow(""),
    checkOut: joi.string().trim().isoDate().allow(""),
    minPrice: joi.number().min(0).allow("", null),
    maxPrice: joi.number().min(0).allow("", null),
    sort: joi.string().valid("latest", "price_asc", "price_desc").default("latest"),
});

module.exports.adminBookingFilterSchema = joi.object({
    status: joi.string().valid("", "pending", "confirmed", "rejected", "cancelled").default(""),
    paymentStatus: joi.string().valid("", "pending", "processing", "paid", "failed", "refunded").default(""),
});
