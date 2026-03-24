const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToStartOfDay(inputDate) {
    const date = new Date(inputDate);
    date.setHours(0, 0, 0, 0);
    return date;
}

function buildRegexSearchQuery(baseFilters, queryText) {
    const regex = new RegExp(escapeRegex(queryText), "i");
    return {
      ...baseFilters,
      $or: [
        { title: regex },
        { description: regex },
        { location: regex },
        { country: regex },
      ],
    };
}

module.exports.index = async(req, res) => {
    const q = (req.query.q || "").trim();
    const country = (req.query.country || "").trim();
    const sort = req.query.sort || "latest";
    const checkInRaw = (req.query.checkIn || "").trim();
    const checkOutRaw = (req.query.checkOut || "").trim();
    const minPriceRaw = req.query.minPrice;
    const maxPriceRaw = req.query.maxPrice;
    let minPrice = minPriceRaw !== undefined && minPriceRaw !== "" ? Number(minPriceRaw) : "";
    let maxPrice = maxPriceRaw !== undefined && maxPriceRaw !== "" ? Number(maxPriceRaw) : "";
    let availabilityError = "";

    if (
      minPrice !== "" &&
      maxPrice !== "" &&
      !Number.isNaN(minPrice) &&
      !Number.isNaN(maxPrice) &&
      minPrice > maxPrice
    ) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }

    const filters = {};

    if (country) {
      filters.country = new RegExp(escapeRegex(country), "i");
    }

    if (minPrice !== "" || maxPrice !== "") {
      filters.price = {};

      if (minPrice !== "" && !Number.isNaN(minPrice)) {
        filters.price.$gte = minPrice;
      }

      if (maxPrice !== "" && !Number.isNaN(maxPrice)) {
        filters.price.$lte = maxPrice;
      }

      if (Object.keys(filters.price).length === 0) {
        delete filters.price;
      }
    }

    if (checkInRaw || checkOutRaw) {
      if (!checkInRaw || !checkOutRaw) {
        availabilityError = "Select both check-in and check-out dates to filter by availability.";
      } else {
        const checkIn = normalizeToStartOfDay(checkInRaw);
        const checkOut = normalizeToStartOfDay(checkOutRaw);
        const today = normalizeToStartOfDay(new Date());

        if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
          availabilityError = "Please enter valid check-in and check-out dates.";
        } else if (checkIn < today) {
          availabilityError = "Check-in date cannot be in the past.";
        } else if (checkOut <= checkIn) {
          availabilityError = "Check-out date must be after check-in.";
        } else {
          const unavailableListingIds = await Booking.distinct("listing", {
            status: { $in: ["pending", "confirmed"] },
            checkIn: { $lt: checkOut },
            checkOut: { $gt: checkIn },
          });

          if (unavailableListingIds.length > 0) {
            filters._id = { $nin: unavailableListingIds };
          }
        }
      }
    }

    let listingsQuery;
    let usedTextSearch = false;

    if (q) {
      const textSearchQuery = {
        ...filters,
        $text: { $search: q },
      };

      try {
        const hasTextResults = await Listing.exists(textSearchQuery);

        if (hasTextResults) {
          listingsQuery = Listing.find(textSearchQuery, {
            score: { $meta: "textScore" },
          });
          usedTextSearch = true;
        } else {
          listingsQuery = Listing.find(buildRegexSearchQuery(filters, q));
        }
      } catch (err) {
        const message = err && typeof err.message === "string" ? err.message.toLowerCase() : "";
        const isTextIndexIssue = message.includes("$text") || message.includes("text index");

        if (isTextIndexIssue) {
          listingsQuery = Listing.find(buildRegexSearchQuery(filters, q));
        } else {
          throw err;
        }
      }
    } else {
      listingsQuery = Listing.find(filters);
    }

    if (sort === "price_asc") {
      listingsQuery = listingsQuery.sort({ price: 1, _id: -1 });
    } else if (sort === "price_desc") {
      listingsQuery = listingsQuery.sort({ price: -1, _id: -1 });
    } else if (usedTextSearch) {
      listingsQuery = listingsQuery.sort({ score: { $meta: "textScore" }, _id: -1 });
    } else {
      listingsQuery = listingsQuery.sort({ _id: -1 });
    }

    const allListings = await listingsQuery;

    res.render("listings/index.ejs", {
      allListings,
      listingFilters: {
        q,
        country,
        checkIn: checkInRaw,
        checkOut: checkOutRaw,
        minPrice: minPrice === "" || Number.isNaN(minPrice) ? "" : minPrice,
        maxPrice: maxPrice === "" || Number.isNaN(maxPrice) ? "" : maxPrice,
        sort,
      },
      resultsCount: allListings.length,
      hasActiveFilters: Boolean(
        q ||
        country ||
        checkInRaw ||
        checkOutRaw ||
        minPrice !== "" ||
        maxPrice !== "" ||
        sort !== "latest"
      ),
      availabilityError,
    });
};

module.exports.renderNewForm =  (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate({path: "reviews", populate: {path:"author"}}).populate("owner");
    if(!listing){
      req.flash("error", "listing not found or deleted");
      return res.redirect("/listings");
    }
    res.render("listings/show.ejs", { listing });
};

module.exports.createNewListing = async (req, res, next) => {
    try{
      let responce = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1
      })
        .send(); 

      if (!req.file) {
        req.flash("error", "Please upload an image for the listing.");
        return res.redirect("/listings/new");
      }

      const url = req.file.path || req.file.secure_url || req.file.url;
      const filename = req.file.filename || req.file.public_id || "listing-image";
      if (!url) {
        req.flash("error", "Image upload failed. Please try again.");
        return res.redirect("/listings/new");
      }
      const newListing = new Listing(req.body.listing);
      newListing.owner = req.user._id; //to save user info who created listing
      newListing.image = {url, filename};

      newListing.geometry = responce.body.features[0].geometry;

      let savedListing = await newListing.save();
      console.log(savedListing);
      req.flash("success", "New listing Created!");
      res.redirect("/listings");
    }catch(err){
      next(err);
    }
};

module.exports.renderEditListing =  async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if(!listing){
      req.flash("error", "listing not found or deleted");
      res.render("/listing");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/h_200,w_200");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    if(typeof req.file !== "undefined"){
      const url = req.file.path || req.file.secure_url || req.file.url;
      const filename = req.file.filename || req.file.public_id || "listing-image";
      if (url) {
        listing.image = {url, filename};
        await listing.save();
      }
    }
    req.flash("success", "listing Edited success");
    res.redirect(`/listings/${id}`);
};

module.exports.deleteListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "listing deleted success");
    res.redirect("/listings");
};
