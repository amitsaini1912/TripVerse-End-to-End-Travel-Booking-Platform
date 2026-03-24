if(process.env.NODE_ENV != "production"){ //to upload files cloudinary
  require("dotenv").config();
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
const mongoose = require("mongoose");
const path = require("path");
const helmet = require("helmet");
const methodOverride = require("method-override");
const ejsMate = require('ejs-mate');
const rateLimit = require("express-rate-limit");
// const wrapAsync = require("./utils/wrapAsync.js");
const csrf = require("csurf");
const ExpressError = require("./utils/ExpressError.js");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
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

const DB_URL = process.env.DB_URL;
const SECRET = process.env.SECRET;
const isProduction = process.env.NODE_ENV === "production";

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
app.disable("x-powered-by");

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP. Please try again shortly.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login or signup attempts. Please try again later.",
});

const csrfProtection = csrf();

app.use("/webhooks", webhookRouter);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(globalLimiter);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(mongoSanitize());
app.use(hpp());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname , "/public")));

if (isProduction) {
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
  name: "wanderlust.sid",
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(csrfProtection);


app.use((req, res, next) => {
  if (req.user) {
    if (!req.user.role) req.user.role = "user";
    if (!req.user.hostRequestStatus) req.user.hostRequestStatus = "none";
  }
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  res.locals.csrfToken = req.csrfToken();
  next();
});


app.use("/listings", listingRouter );
app.use("/listings/:id/bookings", listingBookingRouter);
app.use("/listings/:id/reviews", reviewRouter );
app.use("/bookings", bookingRouter);
app.use(["/login", "/signup"], authLimiter);
app.use("/", userRouter );
app.use("/admin", adminRouter);
app.get("/search", async(req, res) => {
   const key = (req.query.key || "").trim();
   const searchParams = new URLSearchParams();
   if (key) {
    searchParams.set("q", key);
   }
   return res.redirect(`/listings${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
})


app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    const message = "Your form session expired or became invalid. Please refresh and try again.";
    if (req.get("accept") === "application/json") {
      return res.status(403).json({ message });
    }
    req.flash("error", message);
    return res.redirect(req.get("referer") || "/listings");
  }

  let { statusCode=500, message="Somthing went wrong" } = err;
  res.status(statusCode).render("error.ejs", {message})
  // res.status(statusCode).send(message);
  // res.send("something went wrong!")
});

