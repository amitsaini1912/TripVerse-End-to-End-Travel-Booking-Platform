if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");

const DB_URL = process.env.DB_URL;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@12345";

const demoUsers = [
  {
    username: "demo_admin",
    email: "demo_admin@example.com",
    role: "admin",
    hostRequestStatus: "approved",
  },
  {
    username: "demo_host_one",
    email: "demo_host_one@example.com",
    role: "host",
    hostRequestStatus: "approved",
  },
  {
    username: "demo_host_two",
    email: "demo_host_two@example.com",
    role: "host",
    hostRequestStatus: "approved",
  },
  {
    username: "demo_guest_one",
    email: "demo_guest_one@example.com",
    role: "user",
    hostRequestStatus: "none",
  },
  {
    username: "demo_guest_two",
    email: "demo_guest_two@example.com",
    role: "user",
    hostRequestStatus: "none",
  },
  {
    username: "demo_user_pending",
    email: "demo_user_pending@example.com",
    role: "user",
    hostRequestStatus: "pending",
    hostRequestPhone: "9876543210",
    hostRequestReason:
      "I want to host demo properties on the platform and need approval for the walkthrough.",
    hostRequestSubmittedAt: new Date(),
  },
];

const demoListings = [
  {
    key: "jaipur_retreat",
    title: "Demo Lakefront Jaipur Retreat",
    description: "A calm lakeside stay designed for demo walkthroughs and booking tests.",
    image: {
      url: "https://picsum.photos/id/1043/1200/800",
      filename: "demo-lakefront-jaipur",
    },
    price: 3200,
    location: "Jaipur",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [75.7873, 26.9124],
    },
    ownerUsername: "demo_host_one",
  },
  {
    key: "chandigarh_hotel",
    title: "Demo Chandigarh Business Hotel",
    description: "A city stay used to demonstrate host approvals, booking management, and payments.",
    image: {
      url: "https://picsum.photos/id/1068/1200/800",
      filename: "demo-chandigarh-business-hotel",
    },
    price: 4500,
    location: "Chandigarh",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [76.7794, 30.7333],
    },
    ownerUsername: "demo_host_one",
  },
  {
    key: "udaipur_heritage",
    title: "Demo Udaipur Heritage Stay",
    description: "A heritage-style property for review, booking, and search/filter demos.",
    image: {
      url: "https://picsum.photos/id/1031/1200/800",
      filename: "demo-udaipur-heritage-stay",
    },
    price: 5400,
    location: "Udaipur",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [73.7125, 24.5854],
    },
    ownerUsername: "demo_host_two",
  },
  {
    key: "manali_cabin",
    title: "Demo Manali Forest Cabin",
    description: "A mountain cabin for availability filtering and host analytics scenarios.",
    image: {
      url: "https://picsum.photos/id/1025/1200/800",
      filename: "demo-manali-forest-cabin",
    },
    price: 2800,
    location: "Manali",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [77.1887, 32.2432],
    },
    ownerUsername: "demo_host_two",
  },
];

function daysFromToday(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function cleanupDemoData() {
  const usernames = demoUsers.map((user) => user.username);
  const existingUsers = await User.find({ username: { $in: usernames } });
  const existingUserIds = existingUsers.map((user) => user._id);

  const existingListings = await Listing.find({
    $or: [
      { owner: { $in: existingUserIds } },
      { title: { $in: demoListings.map((listing) => listing.title) } },
    ],
  });

  const existingListingIds = existingListings.map((listing) => listing._id);
  const existingReviewIds = existingListings.flatMap((listing) => listing.reviews || []);

  await Booking.deleteMany({
    $or: [
      { listing: { $in: existingListingIds } },
      { guest: { $in: existingUserIds } },
      { host: { $in: existingUserIds } },
    ],
  });

  await Review.deleteMany({
    $or: [
      { _id: { $in: existingReviewIds } },
      { author: { $in: existingUserIds } },
    ],
  });

  await Listing.deleteMany({ _id: { $in: existingListingIds } });
  await User.deleteMany({ _id: { $in: existingUserIds } });
}

async function createDemoUsers() {
  const usersByUsername = {};

  for (const userData of demoUsers) {
    const user = new User({
      username: userData.username,
      email: userData.email,
      role: userData.role,
      hostRequestStatus: userData.hostRequestStatus,
      hostRequestPhone: userData.hostRequestPhone || "",
      hostRequestReason: userData.hostRequestReason || "",
      hostRequestSubmittedAt: userData.hostRequestSubmittedAt || null,
    });

    const registeredUser = await User.register(user, DEMO_PASSWORD);
    usersByUsername[userData.username] = registeredUser;
  }

  return usersByUsername;
}

async function createDemoListings(usersByUsername) {
  const listingsByKey = {};

  for (const listingData of demoListings) {
    const listing = await Listing.create({
      title: listingData.title,
      description: listingData.description,
      image: listingData.image,
      price: listingData.price,
      location: listingData.location,
      country: listingData.country,
      geometry: listingData.geometry,
      owner: usersByUsername[listingData.ownerUsername]._id,
      reviews: [],
    });

    listingsByKey[listingData.key] = listing;
  }

  return listingsByKey;
}

async function createDemoReviews(usersByUsername, listingsByKey) {
  const reviewInputs = [
    {
      listingKey: "jaipur_retreat",
      authorUsername: "demo_guest_one",
      rating: 5,
      comment: "Beautiful demo property with a clean booking flow.",
    },
    {
      listingKey: "chandigarh_hotel",
      authorUsername: "demo_guest_two",
      rating: 4,
      comment: "Good listing for showing search, reviews, and admin moderation.",
    },
    {
      listingKey: "udaipur_heritage",
      authorUsername: "demo_guest_one",
      rating: 5,
      comment: "Helpful for demonstrating filters and host dashboards.",
    },
  ];

  for (const reviewInput of reviewInputs) {
    const review = await Review.create({
      rating: reviewInput.rating,
      comment: reviewInput.comment,
      author: usersByUsername[reviewInput.authorUsername]._id,
    });

    const listing = listingsByKey[reviewInput.listingKey];
    listing.reviews.push(review._id);
    await listing.save();
  }
}

async function createDemoBookings(usersByUsername, listingsByKey) {
  await Booking.insertMany([
    {
      listing: listingsByKey.chandigarh_hotel._id,
      guest: usersByUsername.demo_guest_one._id,
      host: usersByUsername.demo_host_one._id,
      checkIn: daysFromToday(10),
      checkOut: daysFromToday(13),
      guests: 2,
      totalAmount: 13500,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "pending",
      paymentIntentId: null,
      lastPaymentErrorMessage: "",
      paidAt: null,
    },
    {
      listing: listingsByKey.jaipur_retreat._id,
      guest: usersByUsername.demo_guest_two._id,
      host: usersByUsername.demo_host_one._id,
      checkIn: daysFromToday(20),
      checkOut: daysFromToday(23),
      guests: 3,
      totalAmount: 9600,
      currency: "INR",
      status: "pending",
      paymentStatus: "pending",
      paymentIntentId: null,
      lastPaymentErrorMessage: "",
      paidAt: null,
    },
    {
      listing: listingsByKey.udaipur_heritage._id,
      guest: usersByUsername.demo_guest_one._id,
      host: usersByUsername.demo_host_two._id,
      checkIn: daysFromToday(30),
      checkOut: daysFromToday(33),
      guests: 2,
      totalAmount: 16200,
      currency: "INR",
      status: "confirmed",
      paymentStatus: "paid",
      paymentIntentId: "pi_demo_paid_booking",
      lastPaymentErrorMessage: "",
      paidAt: daysFromToday(-1),
    },
    {
      listing: listingsByKey.manali_cabin._id,
      guest: usersByUsername.demo_guest_two._id,
      host: usersByUsername.demo_host_two._id,
      checkIn: daysFromToday(40),
      checkOut: daysFromToday(43),
      guests: 2,
      totalAmount: 8400,
      currency: "INR",
      status: "rejected",
      paymentStatus: "failed",
      paymentIntentId: "pi_demo_failed_booking",
      lastPaymentErrorMessage: "The payment attempt failed. Please try again.",
      paidAt: null,
    },
    {
      listing: listingsByKey.jaipur_retreat._id,
      guest: usersByUsername.demo_guest_one._id,
      host: usersByUsername.demo_host_one._id,
      checkIn: daysFromToday(50),
      checkOut: daysFromToday(52),
      guests: 1,
      totalAmount: 6400,
      currency: "INR",
      status: "cancelled",
      paymentStatus: "pending",
      paymentIntentId: null,
      lastPaymentErrorMessage: "",
      paidAt: null,
    },
  ]);
}

async function seedDemoData() {
  if (!DB_URL) {
    throw new Error("DB_URL is required");
  }

  await mongoose.connect(DB_URL);
  await cleanupDemoData();

  const usersByUsername = await createDemoUsers();
  const listingsByKey = await createDemoListings(usersByUsername);
  await createDemoReviews(usersByUsername, listingsByKey);
  await createDemoBookings(usersByUsername, listingsByKey);

  console.log("Demo data seeded successfully.");
  console.log("Demo password:", DEMO_PASSWORD);
  console.log("Demo users:", demoUsers.map((user) => user.username).join(", "));
}

seedDemoData()
  .catch((err) => {
    console.error("Demo data seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
