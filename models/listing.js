const mongoose = require(`mongoose`);
const Review = require("./review");
const Booking = require("./booking");

const listingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
      },
      description: String,
      image: {
        url: String,
        filename: String,
      },
      price: Number,
      location: String,
      country: String,
      reviews: [
         {
           type: mongoose.Schema.Types.ObjectId,
           ref: "Review"
         },
      ],
      owner: {
           type: mongoose.Schema.Types.ObjectId,
           ref: "User"
      },
      geometry: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ['Point'], // 'location.type' must be 'Point'
          required: true
        },
        coordinates: {
          type: [Number],
          required: true
        }
      }
    });

listingSchema.index({ price: 1 });
listingSchema.index({ country: 1, price: 1 });
listingSchema.index({ location: 1, country: 1 });
listingSchema.index({ owner: 1 });
listingSchema.index({ geometry: "2dsphere" });
listingSchema.index(
  {
    title: "text",
    description: "text",
    location: "text",
    country: "text",
  },
  {
    name: "listing_text_search",
    weights: {
      title: 5,
      location: 4,
      country: 3,
      description: 1,
    },
  }
);

//to delete reviews when listing was deleted
    listingSchema.post("findOneAndDelete", async(listing) =>{
      if(listing){
        await Review.deleteMany({_id: {$in: listing.reviews}});
        await Booking.deleteMany({ listing: listing._id });
      }
    });

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
