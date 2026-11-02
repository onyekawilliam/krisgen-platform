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

This creates an admin using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env` and eight sample
phones. Set both values explicitly before running the seed script; the password must be at least 12 characters
and there is no default. If your network cannot resolve `mongodb+srv` addresses, set
`DNS_SERVERS=8.8.8.8,8.8.4.4` for the seed run. Do not run the seed script against an
existing production database.

## Frontend setup

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

If your API runs somewhere other than `http://localhost:5000/api`, set `VITE_API_URL` in a `frontend/.env` file.

## Deployment: Vercel, Render, and MongoDB Atlas

The repository includes `frontend/vercel.json` for React Router deep links and `render.yaml` for the Express API.
Deploy the frontend with **Root Directory** set to `frontend`, and deploy the Render web service from `backend`
(the Blueprint already declares that root directory). Render uses `npm ci`, `npm start`, and `/api/health` as its
health check. It supplies `PORT`; do not configure a fixed production port.

### MongoDB Atlas

Create an Atlas database user with only the application permissions it needs, allow the Render service to connect
in Atlas Network Access, and put the Atlas `mongodb+srv` connection string in Render as `MONGO_URI`. Atlas runs as
a replica set, which is required for transactional stock deduction, in-store sales, and payment fulfillment.

### Render environment variables

Configure these values in Render's Environment settings (never commit them):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `MONGO_URI` | Yes | MongoDB Atlas connection string. |
| `CLIENT_URL` | Yes | Exact HTTPS Vercel frontend origin, without a trailing path. |
| `JWT_SECRET` | Yes | Long, random signing secret. |
| `FLW_SECRET_KEY` | Yes | Flutterwave **live** secret key. |
| `FLW_VERIFY_URL` | Yes | Flutterwave **live** transaction-verification endpoint. |
| `COOKIE_SAME_SITE` | Yes for separate Vercel/Render domains | Set to `none`; the API then requires HTTPS secure cookies. Use `lax` only when the frontend and API are hosted on same-site custom subdomains. |
| `CLOUDINARY_CLOUD_NAME` | Yes for product image uploads | Cloud name from Cloudinary Console. |
| `CLOUDINARY_API_KEY` | Yes for product image uploads | API key from Cloudinary Console → Settings → API Keys. |
| `CLOUDINARY_API_SECRET` | Yes for product image uploads | API secret from Cloudinary Console → Settings → API Keys. Keep this only on Render. |
| `JWT_EXPIRES_IN` | Optional | JWT lifetime; defaults to seven days. |
| `COOKIE_NAME` | Optional | Auth-cookie name; defaults to `krisgen_token`. |

The API verifies every Flutterwave result directly with Flutterwave using `FLW_SECRET_KEY`; no Flutterwave secret is
sent to the browser. Do not use sandbox/test payment credentials in the production Render service.

Product images upload through the authenticated admin API to Cloudinary's `krisgen/products` folder. The backend
keeps the Cloudinary API secret server-side and stores each image's secure URL and public ID with the product.
Obtain all three values in Cloudinary Console → Settings → API Keys (the cloud name is also shown on the Dashboard),
then add them to the Render service's Environment settings. Do not add Cloudinary credentials to Vercel or any
`VITE_` variable. The product upload endpoint accepts JPEG, PNG, WebP, GIF, or AVIF images up to 5 MB.

### Vercel environment variables

Set these in Vercel for the Production environment before its build:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Render API origin with the `/api` suffix. |
| `VITE_FLW_PUBLIC_KEY` | Yes | Flutterwave **live public** key. |

`VITE_API_URL` is embedded at build time. A production build without it refuses to fall back to localhost. Do not
place `JWT_SECRET`, `MONGO_URI`, or `FLW_SECRET_KEY` in Vercel; any `VITE_` variable is public to the browser.

After both services are configured, update Render's `CLIENT_URL` to the final Vercel HTTPS origin, redeploy Render,
then verify the Render `/api/health` endpoint, registration/login, protected admin pages, and a payment verification
using a controlled live transaction. Do not seed or reset the production database during this process.

Browsers increasingly restrict third-party cookies. For the most reliable login behavior, attach custom frontend and
API subdomains beneath the same parent domain and set `COOKIE_SAME_SITE=lax`; otherwise use the configured
cross-site `none` setting over HTTPS.

## API overview

All endpoints are under `/api`. Auth uses an http-only cookie (`credentials: include` from the frontend).

| Area | Public | Member (logged in) | Admin |
|---|---|---|---|
| Products | browse, view | — | create/edit/deactivate, sees cost price |
| Orders | — | create (needs a delivery address), view own, verify payment | view all, update status, record in-store sales |
| Referrals | — | view own referral list + link | view all |
| Commissions | — | view own | view all, approve/reverse, configure rates |
| Withdrawals | — | request, view own | approve/reject/mark paid |
| Members | — | — | list, view detail, suspend/reactivate |

See `backend/routes/` for the full route list.

## Money rules

- **Commissions** are approved or reversed by an admin and only move forward: a cancelled or reversed commission
  can never be brought back, and nothing is settled by hand. A sale at or below cost earns no commission.
- **Rates** — the direct rate and the referral override rate (and a product's own rate plus the override) are
  shares of one profit, so each pair is limited to 100% together.
- **Withdrawals** draw on approved commissions. A member's requests are processed one at a time inside a
  transaction, so the same balance can never be requested twice. Marking a withdrawal *paid* is the only way a
  commission is settled; paid and rejected withdrawals are final. Bank account numbers are 10 digits.
- **Delivery** — checkout requires a full delivery address (name, phone, street, city, state); admins see it on the
  order.
- **Cross-site writes** — the API refuses state-changing requests whose `Origin` is not `CLIENT_URL`.

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
