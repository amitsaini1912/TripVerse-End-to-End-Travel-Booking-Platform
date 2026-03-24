# WanderLust to TripVerse Upgrade Notes

WanderLust was a Express + EJS + MongoDB booking platform inspired by stay-listing marketplaces. This project began as WanderLust and was upgraded into TripVerse over a 20-day sprint toward an end-to-end booking platform.

This README documents:

- what the project does today
- the Day 1 to Day 20 upgrade log
- how to run the app locally
- where to find the runbook and demo data

## Current Scope

The codebase currently includes:

- user authentication with Passport
- role-based access for `user`, `host`, and `admin`
- host request workflow with admin approval
- listing creation and management for hosts/admins
- reviews and ratings
- booking creation with overlap protection
- guest and host booking dashboards
- admin dashboards for users, listings, and bookings
- listing search, price filters, country filters, and date availability filters
- Stripe payment intent flow and webhook sync
- database indexes for search and booking performance

## Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- EJS + EJS-Mate
- Passport + passport-local-mongoose
- Cloudinary for image upload
- Mapbox Geocoding
- Stripe for payments

## Project Structure

```text
controllers/     Route and page logic
models/          Mongoose models
routes/          Express routes
scripts/         Seed scripts
utils/           Shared helpers
views/           EJS templates
public/          Static CSS/JS/assets
middleware.js    Auth and request guards
schema.js        Joi schemas used by the app
app.js           Application entry point
```

## Environment Variables

Create a `.env` file with the following values:

```env
DB_URL=mongodb://127.0.0.1:27017/tripverse
SECRET=replace_with_a_long_session_secret
PORT=8000

MAP_TOKEN=your_mapbox_token

CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

ADMIN_USERNAME=demo_admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@12345
```

Notes:

- `DB_URL` and `SECRET` are required at startup.
- Cloudinary and Mapbox are required for listing creation.
- Stripe variables are required only for payment flows.

## Install And Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:8000/listings
```

## Available Scripts

```bash
npm start
npm run seed:admin
npm run seed:demo
```

## Day 1 To Day 20 Upgrade Log

### Day 1

- cleaned up app startup and environment-based configuration
- ensured the app uses `DB_URL` and `SECRET` from environment variables
- improved session defaults and startup flow

### Day 2

- added `role` to the user model
- introduced admin seeding support

### Day 3

- added RBAC middleware foundations
- introduced `hasRole`, `isAdmin`, and host/admin ownership checks

### Day 4

- wired admin-only access to the admin panel
- enabled admin-aware moderation paths

### Day 5

- introduced the `Booking` model
- added booking routes and booking validation
- created guest booking lifecycle foundations

### Day 6

- added booking overlap checks
- blocked invalid date ranges
- blocked hosts from booking their own listings

### Day 7

- added host booking dashboard
- allowed host/admin booking approval and rejection

### Day 8

- added host analytics dashboard
- added per-listing booking and revenue summaries

### Day 9

- added listing availability API
- connected availability checks to the listing detail booking form

### Day 10

- added Stripe payment-intent setup
- introduced checkout page foundation for confirmed bookings

### Day 11

- connected Stripe Elements-based checkout flow
- added payment completion path and payment status updates

### Day 12

- added Stripe webhook support
- synced booking payment state from webhook events

### Day 13

- improved failed payment handling
- added payment retry support and safer unpaid-booking cancellation behavior

### Day 14

- expanded admin dashboard
- added booking, payment, and revenue KPI cards
- added direct user-to-host role management

### Day 15

- added admin listing management
- added listing moderation and delete cleanup for related bookings

### Day 16

- added admin booking management
- added booking filters and moderation actions in admin views

### Day 17

- merged search into the main listings page
- added query-based search, price sorting, country filtering, and mobile index improvements

### Day 18

- added check-in/check-out availability filters on the listings page
- excluded overlapping pending/confirmed bookings from search results

### Day 19

- added MongoDB indexes for listings, users, and bookings
- improved query performance for search, admin pages, and availability checks

### Day 20

- completed the first deployment/security pass in the sprint plan
- established the operational baseline needed before production hardening

## Core User Flows

### User flow

1. Sign up or log in
2. Browse listings
3. Create a booking request
4. Wait for host/admin confirmation
5. Complete payment for confirmed bookings
6. Track booking status from `My Bookings`

### Host flow

1. Sign up as a normal user
2. Submit a host request
3. Get approved by admin
4. Add listings
5. Review incoming booking requests
6. Track booking analytics

### Admin flow

1. Log in as admin
2. Review pending host requests
3. Promote users to host when needed
4. Moderate listings and bookings
5. Monitor revenue and platform activity

## Demo And Ops Docs

- Runbook: [RUNBOOK.md](RUNBOOK.md)
- Demo data guide: [DEMO_DATA.md](DEMO_DATA.md)

## Notes

- This README is the Day 1 to Day 20 project log and onboarding reference.
- Later experimental work should be documented separately so this file stays aligned with the stable sprint milestone.


