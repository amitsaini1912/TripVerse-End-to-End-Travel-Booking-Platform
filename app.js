if(process.env.NODE_ENV != "production"){ //to upload files cloudinary
  require("dotenv").config();
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require('ejs-mate');
// const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const listingBookingRouter = require("./routes/listingBooking.js");
const bookingRouter = require("./routes/booking.js");
const webhookRouter = require("./routes/webhook.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const adminRouter = require("./routes/admin.js");
const Listing = require("./models/listing.js");

const DB_URL = process.env.DB_URL;
const SECRET = process.env.SECRET;

if (!DB_URL) {
  throw new Error("DB_URL is required in environment variables");
}

if (!SECRET) {
  throw new Error("SECRET is required in environment variables");
}

main()
  .then( () => {
    console.log("Connected to DB");
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.log("DB connection failed:", err);
  });

async function main() {
  await mongoose.connect(DB_URL);
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/webhooks", webhookRouter);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname , "/public")));

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}


const store = MongoStore.create({
  mongoUrl: DB_URL,
  crypto: {
    secret: SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR IN MONGO SESSION STORE", err)
})

const sessionOptions = {
  store: store,
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
  if (req.user) {
    if (!req.user.role) req.user.role = "user";
    if (!req.user.hostRequestStatus) req.user.hostRequestStatus = "none";
  }
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});


app.use("/listings", listingRouter );
app.use("/listings/:id/bookings", listingBookingRouter);
app.use("/listings/:id/reviews", reviewRouter );
app.use("/bookings", bookingRouter);
app.use("/", userRouter );
app.use("/admin", adminRouter);
app.get("/search", async(req, res) => {
   const key = req.query.key;
   let resultListings = await Listing.find(
    {
      "$or": [
        {title: {$regex: key, $options: "i"}},
        {description: {$regex: key, $options: "i"}},
        {location: {$regex: key, $options: "i"}},
        {country: {$regex: key, $options: "i"}},
      ]
    }
  )
  res.render("listings/search.ejs", {resultListings});
})


app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

app.use((err, req, res, next) => {
  let { statusCode=500, message="Somthing went wrong" } = err;
  res.status(statusCode).render("error.ejs", {message})
  // res.status(statusCode).send(message);
  // res.send("something went wrong!")
});

