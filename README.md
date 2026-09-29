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
| Orders | — | create, view own, verify payment | view all, update status |
| Referrals | — | view own referral list + link | view all |
| Commissions | — | view own | view all, approve/reverse/pay, configure rates |
| Withdrawals | — | request, view own | approve/reject/pay |
| Members | — | — | list, view detail, suspend/reactivate |

See `backend/routes/` for the full route list.
