if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const User = require("../models/user");

const DB_URL = process.env.DB_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function seedAdmin() {
  if (!DB_URL) throw new Error("DB_URL is required");
  if (!ADMIN_USERNAME) throw new Error("ADMIN_USERNAME is required");
  if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL is required");
  if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is required");

  await mongoose.connect(DB_URL);

  const existingByUsername = await User.findOne({ username: ADMIN_USERNAME });
  if (existingByUsername) {
    existingByUsername.email = ADMIN_EMAIL;
    existingByUsername.role = "admin";
    await existingByUsername.save();
    console.log("Existing user promoted/updated as admin.");
    return;
  }

  const existingByEmail = await User.findOne({ email: ADMIN_EMAIL });
  if (existingByEmail) {
    existingByEmail.role = "admin";
    if (!existingByEmail.username) {
      existingByEmail.username = ADMIN_USERNAME;
    }
    await existingByEmail.save();
    console.log("Existing email user promoted as admin.");
    return;
  }

  const adminUser = new User({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    role: "admin",
  });

  await User.register(adminUser, ADMIN_PASSWORD);
  console.log("Admin user created successfully.");
}

seedAdmin()
  .catch((err) => {
    console.error("Admin seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
