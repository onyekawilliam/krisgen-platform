# Krisgen Communications — Phone Retail & Referral Platform

A phone retail platform with a free, sale-based referral program.

## What this is (and isn't)

- Registration is **free** — no fee, no required purchase.
- Commissions are calculated from **profit** (selling price − cost price), never from the selling price itself.
- The referral structure is **one level only**: a direct-sale commission for whoever made the sale, and a single
  override for whoever referred that seller. There is no multi-level matrix, no spillover, and no payout that
  depends on a position in a recruitment tree — only on an actual phone sale.
- Cost price is **never exposed** to customers or members, only to admin accounts, and is enforced at the schema
  and controller level, not just hidden in the UI.
- Every commission stores a **snapshot** of the price/cost/profit at the time of sale, so later product price
  changes never alter a commission that was already earned.

## Project structure

```
backend/   Node.js + Express + MongoDB (Mongoose) API
frontend/  React + Vite + Tailwind CSS
```

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI (MongoDB Atlas), JWT_SECRET, FLW_SECRET_KEY, etc.
npm run dev        # starts on http://localhost:5000
```

Seed an admin account and sample phones:

```bash
node seed.js
```

This creates an admin using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env` (defaults to
`admin@krisgen.com` / `changeMe123!` — change this before going live) and eight sample phones.

## Frontend setup

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

If your API runs somewhere other than `http://localhost:5000/api`, set `VITE_API_URL` in a `frontend/.env` file.

## Before going to production

1. **MongoDB Atlas** — create a cluster, get your connection string into `MONGO_URI`.
2. **Flutterwave** — get live API keys from your Flutterwave dashboard, set `FLW_SECRET_KEY` /
   `FLW_PUBLIC_KEY`. The checkout flow in `ProductDetails.jsx` creates a pending order; you'll want to wire in
   Flutterwave's inline checkout SDK on the frontend and call `POST /api/orders/verify-payment` with the
   `transaction_id` it returns — the backend re-verifies with Flutterwave directly and never trusts the frontend's
   claim that payment succeeded.
3. **JWT_SECRET** — set a long random string, not the placeholder.
4. **Change the seeded admin password** immediately after first login.
5. **HTTPS** — the auth cookie is set `secure: true` in production, so the app must be served over HTTPS for login
   to work.
6. Review `backend/services/commissionService.js` and `backend/models/Settings.js` if you want to adjust the
   default 15% / 5% rates — they're configurable from Admin → Settings without a redeploy.

## API overview

All endpoints are under `/api`. Auth uses an http-only cookie (`credentials: include` from the frontend).

| Area | Public | Member (logged in) | Admin |
|---|---|---|---|
| Products | browse, view | — | create/edit/deactivate, sees cost price |
| Orders | — | create, view own, verify payment | view all, update status, record in-store sales |
| Referrals | — | view own referral list + link | view all |
| Commissions | — | view own | view all, approve/reverse/pay, configure rates |
| Withdrawals | — | request, view own | approve/reject/pay |
| Members | — | — | list, view detail, suspend/reactivate |

See `backend/routes/` for the full route list.

## Admin in-store sales

Open Admin → Orders → Record In-Store Sale. Choose a registered customer or
enter a walk-in customer's name and phone (email is optional), then choose a
product, quantity, and cash, POS, or bank transfer. Registered customers use
their saved referrer as the seller. Walk-ins may name an active referring member;
no account is created for the walk-in. Without a seller there is no commission.

The admin-only endpoint is POST /api/admin/orders/in-store. Send a stable
idempotencyKey with productId, quantity, paymentMethod, and either customerId or
customerName/customerPhone with optional customerEmail/referrerId. Repeating the
same request returns the original order (200); a new sale returns 201. Reusing
a key with different details or a different admin returns 409.

Order creation, conditional stock deduction, and profit-based direct/one-hop
override commissions commit in one MongoDB transaction. **MongoDB Atlas or a
replica set is required**; standalone MongoDB cannot record these sales. The API
ensures the order request key has a unique sparse index before recording sales.
No Flutterwave call is made for an in-store payment.

If confirmation is interrupted, the form saves the request in browser session
storage and offers Retry / Confirm Sale with the same ID. Keep using that retry
until the result is confirmed. A key conflict remains saved so the original admin
can reconcile it; do not clear browser session storage to resubmit the same sale.

## In-store sales tests

From backend, run npm install followed by npm test (Node 20.19+).
The suite starts and stops an isolated local MongoDB replica set; it never loads
.env or uses the application database. The first run downloads a MongoDB binary.
It checks registered/walk-in attribution, profit and product-rate overrides,
duplicate requests, concurrent stock changes, rollback, admin access, and the
existing Flutterwave checkout/verification flow with a mocked payment provider.

From frontend, run npm run build to check the production build.

## Safe local browser testing

The regular development scripts are npm run dev from backend and frontend.
Their defaults are http://localhost:5000/api and http://localhost:5173.
Keep the frontend API origin and the backend CLIENT_URL aligned. The backend
requires its existing MongoDB connection and replica-set support for sales.

For automated or manual sale tests, use a disposable local database:

~~~powershell
cd backend
npm run e2e:local
# Keep the disposable frontend, API and database running for manual checks:
npm run e2e:local -- --serve
~~~

The browser test verifies a newly generated loopback MongoDB replica-set URI
and confirms the database is empty before seeding synthetic accounts/products.
It overrides child-process configuration without changing .env files. External
payment verification is disabled. It never seeds or writes to the configured
application database. It uses installed Chrome/Edge, or KRISGEN_TEST_BROWSER
to specify a browser executable.

The output prints the temporary website/API URLs and synthetic admin login.
Use those URLs for manual sales; the normal development site uses your existing
database. The --serve environment is temporary: stop its process to shut it down
and remove the disposable database. A later run creates a fresh environment.

Checks cover real cookie login/CORS, dashboard payment-review visibility,
product/member response contracts, walk-in and registered in-store sales,
inventory/commission views, and visible handling of simulated API failures.
No real payments are performed.
