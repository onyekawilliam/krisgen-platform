# Krisgen Communications: owner handover

This is a plain-language guide for the owner of the shop. It contains **no passwords or keys**. Those are handed over
separately, and you should change them (see "Take ownership").

## What you have

An online phone shop with a free referral programme.

- **Customers** browse phones, register free, buy with a card, bank transfer or USSD (through Flutterwave), and can
  earn a commission when someone they referred buys a phone.
- **You (the admin)** manage products, orders, referral commissions, withdrawals and the commission rates.

| Part | Address |
|---|---|
| The shop (what customers see) | https://krisgen-platform.vercel.app |
| The server (works behind the scenes) | https://krisgen-api.onrender.com |
| Admin area | log in on the shop with the admin account, then click **Admin** |

## Who looks after what

The shop is **maintained by its developer** on your behalf: fixing problems, updating the code and keeping the
hosting running. You (the owner) run the business: products, prices, orders, commissions and withdrawals.

The rule: **the owner owns the accounts that hold money or the business identity; the developer is invited in as a
team member.** That way you keep control, and the developer can still do the work without sharing your password.

| Service | What it does | Account owner | Developer access |
|---|---|---|---|
| Flutterwave | takes the payments, pays out to your bank | **Owner** | none needed (developer never sees live payouts) |
| Domain name (optional) | your own web address | **Owner** | invited to manage DNS only |
| MongoDB Atlas | stores all data (customers, orders, money records) | **Owner** | invited as a project member |
| Render | runs the server | **Owner** | invited as a team member |
| Vercel | hosts the shop website | **Owner** | invited as a team member |
| GitHub | keeps the code | Developer or Owner | the other is a collaborator |
| Cloudinary | stores product photos | **Owner** | invited as a user |
| Resend (optional) | sends password-reset emails | **Owner** | invited as a member |

Fill in the owner account emails and tick each row once the owner has the account and the developer has been invited.

Never share any service's password or key in WhatsApp, email or chat. Put keys only into the Render or Vercel
settings pages. Each person should use their **own** login for each service.

## Admin logins

- The **owner** has their own admin login and uses it for the daily work.
- The **developer** has a separate admin login (or none, if the owner prefers) and uses it only for support, such as
  checking something with the owner. Everyone signs in with their own email, so any change can be traced to a person.
- Ask the developer to add or remove an admin whenever someone joins or leaves. Admin accounts can see every
  customer and every cost price, so keep the list short.

## Set-up after the accounts are in the owner's name (do this first)

1. **Owner creates their own admin login** and chooses a long password only they know.
2. **Invite the developer** to each service in the table.
3. **Change the secrets** once everything is moved, so anyone who had them before no longer can: the admin
   passwords, the `JWT_SECRET` in Render, and (in Atlas) the database user's password. Changing `JWT_SECRET` signs
   everyone out, which is fine.

## Before taking real payments

- [ ] **Flutterwave approval.** Flutterwave must approve your business for live payments. Until then only test
  payments work.
- [ ] **Live keys.** Put the live secret key in Render (`FLW_SECRET_KEY`) and the live public key in Vercel
  (`VITE_FLW_PUBLIC_KEY`), then redeploy both.
- [ ] **Payment webhook.** Invent a long random string. Put it in Render as `FLW_SECRET_HASH` and enter the same
  string as the "Secret hash" in Flutterwave, with the URL
  `https://krisgen-api.onrender.com/api/webhooks/flutterwave`. This makes sure a customer who pays and then closes
  the page still gets their order.
- [ ] **Real products.** The shop currently shows **sample phones with sample prices and stock** (Tecno Camon 30 Pro,
  Infinix Note 40 Pro, and so on). Open Admin → Products and replace each with your real phones, real prices and real
  stock, then upload a photo for each.
- [ ] **Legal pages.** Have a Nigerian lawyer check the Terms, Privacy and Refunds pages and the referral
  programme. Then remove the "draft" notice (see the README, "Legal pages").
- [ ] **A test purchase.** Make one real purchase of a cheap item, pay, close the page straight away, and confirm
  the order still shows as paid. Then refund yourself in Flutterwave.
- [ ] **A paid Render plan.** The free plan puts the server to sleep when idle, so the first visitor waits up to a
  minute. For real customers, and so payment confirmations are not missed, use a paid plan.
- [ ] **Database backups.** The free Atlas plan has no automatic backups. Use a paid plan with backups, or export the
  data regularly.

## Everyday tasks

- **Add or change a phone:** Admin → Products. Selling price must be above cost price. Cost price is private to you.
- **Process an order:** Admin → Orders. A paid order shows the customer's delivery address. Mark it
  **processing**, then **delivered**.
- **Cancel or refund a paid order:** use Cancel in Admin → Orders, then **send the money back yourself in the
  Flutterwave dashboard**. The site does not refund automatically. Cancelling also cancels the referral commissions
  on that order.
- **Payments needing attention:** a "payment awaiting review" count appears on the admin overview. This means money
  arrived but the order could not complete (for example the phone sold out). Contact the customer and refund or
  resolve it, then record it.
- **Referral commissions:** Admin → Commissions. New commissions are **pending**. Approve them when you are happy
  the sale is real (for example after delivery). Only approved commissions can be withdrawn.
- **Withdrawals:** Admin → Withdrawals. Approve a request, send the money to the member's bank account yourself,
  then click **Mark paid**. A paid withdrawal cannot be undone.
- **Commission rates:** Admin → Settings. The direct rate and the referral rate together cannot exceed 100% of the
  profit. A product can also have its own rate.
- **In-store sale:** Admin → Orders → Record In-Store Sale, for cash, POS or transfer sales made in person.
- **Suspend a member:** Admin → Members.

## How the money works

- A commission is a percentage of **profit** (selling price minus cost price), never of the full price.
- When someone a member referred buys a phone, that member earns the direct commission, and the member's own
  referrer earns a smaller one. It goes one level only.
- A sale at or below cost earns no commission.
- Members can only withdraw money from **approved** commissions, and never more than they have.

## If something goes wrong

| Problem | Likely cause |
|---|---|
| Nobody can log in, or "Request origin is not allowed" | In Render, `CLIENT_URL` must be exactly your shop address: `https://`, no `/` at the end |
| Shop is empty or says it could not load phones | The server may be waking up (wait a minute), or Render shows an error in its Logs tab |
| Photos will not upload | One of the three `CLOUDINARY_*` settings in Render is missing or wrong |
| Customers paid but the order is not paid | The webhook is not set up, or `FLW_SECRET_HASH` does not match Flutterwave's secret hash |
| No password-reset emails | Resend is not set up (needs `RESEND_API_KEY`, `EMAIL_FROM` and a verified domain) |
| Locked out of admin | Ask the developer to run the admin password reset script |
| Anything else is broken | Message the developer with what you did, what you saw and a screenshot; never send passwords or keys |

## Changes and updates

The developer makes code changes on a separate branch and shows them for approval before they go live, so the shop
is never changed by accident. Vercel and Render redeploy automatically when the approved change is merged. Ask the
developer before changing prices in bulk, commission rules or payment settings.

## The settings the server needs (names only)

Set in Render: `NODE_ENV`, `MONGO_URI`, `CLIENT_URL`, `JWT_SECRET`, `FLW_SECRET_KEY`, `FLW_VERIFY_URL`,
`FLW_SECRET_HASH`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `COOKIE_SAME_SITE`
(and optionally `RESEND_API_KEY`, `EMAIL_FROM`).
Set in Vercel: `VITE_API_URL`, `VITE_FLW_PUBLIC_KEY`.

The README has the technical details for a developer.
