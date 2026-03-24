# WanderLust Demo Data

This file documents the demo data created by:

```bash
npm run seed:demo
```

## Demo Accounts

All demo accounts use this password:

```text
Demo@12345
```

Accounts:

- Admin: `demo_admin`
- Host 1: `demo_host_one`
- Host 2: `demo_host_two`
- Guest 1: `demo_guest_one`
- Guest 2: `demo_guest_two`
- Pending host-request user: `demo_user_pending`

## Demo Listings

The seed script creates listings similar to:

- Demo Lakefront Jaipur Retreat
- Demo Chandigarh Business Hotel
- Demo Udaipur Heritage Stay
- Demo Manali Forest Cabin

These records are spread across the two host accounts and include:

- price
- location
- country
- image URL
- geometry coordinates

## Demo Reviews

The seed script creates reviews so listing pages are not empty during demo.

Examples:

- 4-star and 5-star guest reviews
- reviews attached to multiple listings

## Demo Bookings

The seed script creates a mix of booking states so each dashboard has something to show.

Included statuses:

- `pending`
- `confirmed`
- `cancelled`
- `rejected`

Included payment states:

- `pending`
- `paid`
- `failed`

## Suggested Demo Walkthrough

### Guest demo

1. Log in as `demo_guest_one`
2. Open `My Bookings`
3. Show one confirmed booking and one historical booking

### Host demo

1. Log in as `demo_host_one`
2. Open `Host Booking Requests`
3. Confirm or reject a pending booking
4. Open `Host Analytics`

### Admin demo

1. Log in as `demo_admin`
2. Open `/admin`
3. Show pending host request from `demo_user_pending`
4. Open listing and booking management pages

## Notes

- The demo seed script removes and recreates only demo-owned records.
- It does not wipe the whole database.
- You can run it multiple times to reset the demo dataset.
