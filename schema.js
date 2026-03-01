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
