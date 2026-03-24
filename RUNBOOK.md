# TripVerse Runbook

This runbook is for local development, demo preparation, and basic operational checks.

## 1. Prerequisites

- Node.js 20.x
- MongoDB running locally or a MongoDB Atlas connection string
- Cloudinary account
- Mapbox token
- Stripe test keys for payment testing

## 2. Environment Setup

Create `.env` in the project root:

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

## 3. Install Dependencies

```bash
npm install
```

## 4. Start The App

```bash
npm start
```

Expected startup logs:

```text
Connected to DB
Server running on port 8000
```

Open:

```text
http://localhost:8000/listings
```

## 5. Seed Admin User

```bash
npm run seed:admin
```

What it does:

- creates an admin if one does not exist
- promotes an existing matching user/email to admin

## 6. Seed Demo Data

```bash
npm run seed:demo
```

What it does:

- creates demo users
- creates demo listings
- creates demo reviews
- creates demo bookings with multiple statuses
- creates one pending host request for admin review

See [DEMO_DATA.md](DEMO_DATA.md) for exact accounts and sample data.

## 7. Local Smoke Test

### Public pages

1. Open `/listings`
2. Search by text and country
3. Filter by price
4. Filter by check-in/check-out dates

### User flow

1. Log in as demo guest
2. Open a listing
3. Create a booking
4. Open `/bookings/me`

### Host flow

1. Log in as demo host
2. Open `/bookings/host`
3. Confirm or reject a booking
4. Open `/bookings/host/dashboard`

### Admin flow

1. Log in as demo admin
2. Open `/admin`
3. Review pending host requests
4. Open `/admin/listings`
5. Open `/admin/bookings`

## 8. Stripe Test Flow

### Required env vars

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Start webhook forwarding

```bash
stripe listen --forward-to localhost:8000/webhooks/stripe
```

Copy the webhook secret printed by Stripe CLI into `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the app.

### Payment test steps

1. Log in as guest
2. Open a confirmed booking
3. Click `Proceed to Payment`
4. Use Stripe test card:

```text
4242 4242 4242 4242
```

Use any future expiry date, any CVC, and any postal code.

### Verify payment

- booking page should show updated payment status
- webhook endpoint should accept the Stripe callback

## 9. Common Issues

### App fails at startup

Check:

- `DB_URL`
- `SECRET`
- MongoDB connectivity

### Listing creation fails

Check:

- `MAP_TOKEN`
- Cloudinary credentials
- internet connectivity for Cloudinary/Mapbox

### Payment page fails

Check:

- Stripe keys exist in `.env`
- `stripe` package is installed
- booking is in `confirmed` status

### Admin seed fails

Check:

- `ADMIN_USERNAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DB_URL`

## 10. Reset Strategy For Local Demo

If you want a clean demo-ready dataset:

1. stop the app
2. keep the same `.env`
3. run:

```bash
npm run seed:admin
npm run seed:demo
```

The demo seed script is designed to clean and recreate only the demo-labeled records it owns.


