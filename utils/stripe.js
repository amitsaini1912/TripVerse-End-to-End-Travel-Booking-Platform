function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("STRIPE_SECRET_KEY is missing from environment variables.");
    error.statusCode = 500;
    throw error;
  }

  try {
    return require("stripe")(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      const error = new Error("Stripe SDK is not installed. Run npm install stripe.");
      error.statusCode = 500;
      throw error;
    }
    throw err;
  }
}

function getStripePublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || "";
}

module.exports = {
  getStripeClient,
  getStripePublishableKey,
};
