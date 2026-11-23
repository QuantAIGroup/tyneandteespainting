# Tyne & Tees Painting – Website

**TYNE & TEES PAINTING – QUALITY SERVICE, FAIR PRICE.** Bedroom, living room and skirting board painting across Newcastle upon Tyne (ceilings as an optional extra), with an **instant labour-price calculator**, private photo uploads, booking requests, **secure online payments with Stripe** and a password-protected admin dashboard.

## Logo and photos

- **Logo:** `public/brand-logo.png` (your official logo, empty margins trimmed, original proportions and colours kept). It appears top-left in the header with the business name beside it, in the footer and on the payment pages. To change it, replace that file and restart / redeploy.
- **Before & after photos:** stored in `public/gallery/` and listed in **`src/config/gallery.ts`** (title, description, categories, and whether it's featured on the homepage). To add a pair, save `<name>-before.jpg` and `<name>-after.jpg` there and copy an entry. Photos you upload in **/admin/gallery** are shown too. Only use photos of work you've genuinely carried out.

## Brand

Royal blue `#0012DA` (buttons, links, accents) · Black `#000000` (headings and text) · White `#FFFFFF`. Friendly, rounded, minimal design using the Plus Jakarta Sans typeface. All colours live in `src/app/globals.css`.

---

## What's included

| Area | What it does |
| --- | --- |
| **Homepage** | Hero with "GET AN INSTANT QUOTE" and "CALL US" buttons, three service cards with editable starting prices, call-us strip, why choose us, before/after gallery, booking request form |
| **Navigation** | Home · Our Services · Prices · Our Work · Contact, plus a blue **CALL US: 07444 359371** button (fixed to the bottom of the screen on mobiles). All phone links use `tel:+447444359371` |
| **Calculator** (`/quote`) | 4 steps: select service → measurements (+ quick condition questions, with diagrams) → photos → estimate & send details. Saves the enquiry with a reference like `NP-261119-K7QD` |
| **Service pages** | `/services/bedroom-painting`, `/living-room-painting`, `/skirting-board-painting`, `/ceiling-painting` – SEO pages with worked price examples |
| **Other pages** | `/services`, `/gallery`, `/areas`, `/contact`, `/privacy`, `/terms` |
| **Admin** (`/admin`) | Enquiries (filter by status, view measurements, photos, breakdown, mark contacted / quote accepted / job completed, private notes), contact messages, **edit every price and minimum charge**, edit business details, upload gallery photos |
| **SEO** | Page titles/descriptions, `HousePainter` (LocalBusiness) structured data, sitemap.xml, robots.txt, alt text, service-area page |
| **Online payments** | After you approve the quotation, send a secure payment link for a **deposit (default 50%, editable)**, **full payment** or **a custom amount**. Customer pays by card, Apple Pay or Google Pay via Stripe. Only marked paid after a verified Stripe webhook |
| **Tests** | 67 unit tests for pricing, payments, booking rules, Stripe webhook signatures and validation |

### How prices are calculated

`src/lib/pricing/engine.ts` – plain, commented code:

1. Wall area = 2 × (length + width) × height (or the sum of each wall for irregular rooms)
2. × the labour rate for that room type
3. Minimum charge applied per room
4. Ceilings (length × width) and skirting (per metre) priced as separate lines with their own minimums
5. Everything added together
6. Total rounded to the nearest £5
7. Clear line-by-line breakdown shown to the customer

Major damage, wallpaper removal and damp/staining give a **manual quotation** for that item instead of a guessed price. Extra coats, new plaster, big colour changes and bare-wood skirting are **flagged for review** while still showing the standard price. Materials are never included and there are no hourly rates anywhere.

The browser shows the price instantly, but the **server recalculates it** with the current prices when the enquiry is saved, so nobody can tamper with it.

---

## Setting it up (about 20 minutes)

### 1. Install

You need [Node.js](https://nodejs.org) 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project** (choose the **London** region).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261119000000_initial_schema.sql` and click **Run**. This creates the tables, security rules and the two storage buckets (private `enquiry-photos`, public `gallery`).
   Then do the same with `20261119210000_deposit_payments.sql`, `20261119230000_payment_options_and_redesign.sql` and `20261120000000_gallery_wall_preparation.sql` (all in `supabase/migrations/`). **Run all four, in that order.**
3. Open **Project Settings → API Keys** and copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable (or "anon") key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret (or "service_role") key → `SUPABASE_SECRET_KEY` ⚠️ **never share this or put it in browser code**

### 3. Create your admin login

1. Supabase → **Authentication → Users → Add user** → enter your email and a strong password (tick "auto confirm").
2. Copy the new user's **ID**, then in the **SQL Editor** run:

```sql
insert into public.admin_users (user_id) values ('PASTE-YOUR-USER-ID-HERE');
```

3. Recommended: **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up", so nobody else can create an account.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.

### 5. Replace the placeholders (before launch)

Anything in **[square brackets]** is highlighted in yellow on the site until you replace it.

- **/admin/settings** → business name, phone, email, hours, logo URL, and (only once verified) claims like insurance.
- **/admin/settings** → check your prices.
- **/admin/gallery** → upload genuine before/after photos. The labelled illustrations disappear automatically once you publish your first item.
- **Images** → the homepage and service pictures use your "after" photos (set in `src/config/site.ts`).
- **Privacy notice** (`/privacy`) and **Terms and Conditions** (`/terms`) → plain-English starting points. Fill in the `[cancellation policy]` gap in the terms and check both fit your business.

### 6. Email notifications (optional)

To get an email for every new enquiry, create a free [Resend](https://resend.com) account, verify your domain, and add:

```
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL_TO=you@yourdomain.co.uk
NOTIFICATION_EMAIL_FROM="Website <enquiries@yourdomain.co.uk>"
```

Without these, enquiries are still saved and visible in /admin – nothing is lost.

---

## Online payments (Stripe)

### How it works

1. **Free online estimate.** The calculator never takes payment. Customers are encouraged to call you.
2. **You speak to the customer.** In **/admin**, open the enquiry, review the photos and measurements, then **1. Approve the quotation**: enter the final fixed labour price and choose what the customer pays online now – **Booking deposit** (default % from **/admin/settings → Payment requests**, can be changed per job), **Full payment**, or **Other amount**. You must tick *"I have spoken to the customer and they have agreed this final price"*. Amounts are worked out on the server in whole pence.
3. **Send the payment link.** Click **Send payment link**. It's emailed to the customer (if email is set up) and you can **Copy** or **Text** it. **Resend** sends the same link again. **Withdraw link** stops it working.
4. **Customer pays** on the branded page (`/pay/…`) showing their name, the agreed work, agreed price, amount due today and remaining balance, e.g. **PAY £200 DEPOSIT**. If they back out of Stripe they see a **Payment cancelled** page – nothing is charged.
5. **Stripe confirms** the payment to `/api/stripe/webhook`. Only then is the booking marked **Payment received**, the customer sees the thank-you page with their payment reference and Stripe receipt link, gets a confirmation email, and you get a notification. The Stripe customer, payment and receipt references are saved in Supabase.
6. **Afterwards** mark **Booking confirmed** and **Work completed**, and when you've collected any remaining balance your usual way, **Record remaining balance** → **Balance paid**. The balance is **never** charged automatically.

### Safety rules (enforced by the website AND the database)

- No payment can be requested until a final price is agreed and you've confirmed you spoke to the customer.
- A deposit always equals the chosen percentage of the agreed price; full payment always equals the agreed price; a custom amount can never exceed it. The customer can't change any of it (the amount is read from the database, never from the browser).
- A booking can't be "Payment received", "Booking confirmed", "Work completed" or "Balance paid" without a verified Stripe payment.
- Card numbers and security codes never touch this website – Stripe handles them.
- Payment fields can only be changed by the website server – not even from your own admin login or by hand in the Supabase table editor.
- Changing the price cancels the old payment link. After the deposit is paid, the price is locked.
- Duplicate payments: clicking Pay twice reuses the same Stripe page; if a second deposit ever gets through anyway, it is **refunded automatically** and you're emailed.
- Wrong amount or a payment on a cancelled booking is **not** marked paid – it's flagged on the enquiry for you to check in Stripe.

### Setting up Stripe

1. Create an account at [stripe.com](https://stripe.com) and stay in **Test mode** (toggle at the top of the dashboard).
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
3. **Settings → Payment methods** → make sure **Cards**, **Apple Pay** and **Google Pay** are on.
4. **Settings → Customer emails** → turn on **Successful payments** so Stripe emails customers a receipt.
5. Add the webhook (step below for local testing, or for your live site: **Developers → Webhooks → Add endpoint**, URL `https://YOUR-DOMAIN/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated` and `refund.failed`). Copy its **Signing secret** into `STRIPE_WEBHOOK_SECRET`.
6. Redeploy / restart. **/admin/settings** shows whether Stripe is in TEST or LIVE mode.

### Apple Pay and Google Pay – what you need to know

- The site uses **Stripe Checkout** (Stripe's own secure, hosted payment page). Stripe shows **Apple Pay** automatically to customers on a supported Apple device and browser (e.g. Safari on iPhone with a card in Wallet) and **Google Pay** on supported Chrome/Android devices. Everyone else sees the normal card form, so there's always a card alternative.
- With Stripe Checkout you **don't need to verify your own domain** for Apple Pay – Stripe hosts the payment page on its domain, which Stripe has already registered with Apple. You just need Apple Pay turned on in **Settings → Payment methods**, and your Stripe account fully activated (business details and bank account added) before live payments.
- **If you later switch to Stripe's embedded Payment Element / Express Checkout Element on your own pages**, you must register your domain: Stripe dashboard → **Settings → Payment method domains → Add a new domain** → enter `www.yourdomain.co.uk` (and the version without `www`). Stripe verifies it for Apple Pay automatically. Your live site must use HTTPS (Vercel does this for you).
- Once Apple Pay and Google Pay are switched on in Stripe, set **`STRIPE_WALLETS_ENABLED=true`** so the payment page and emails mention them. Until then the site only promises card payments.
- Apple Pay may not appear while testing on a computer without Apple Pay set up – that's normal. Test it on an iPhone in Safari using **test mode**, where Stripe lets you complete Apple Pay without a real charge.

### ✅ Test the whole process in TEST MODE before going live

You'll need the [Stripe CLI](https://docs.stripe.com/stripe-cli) for local testing.

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_… it prints into STRIPE_WEBHOOK_SECRET in .env.local, then:
npm run dev
```

1. On the website, get an estimate and send your details (use your own email). Check **no payment** was asked for.
2. In **/admin**, open the enquiry → **Approve quotation** with a price of **£400**, Booking deposit 50% (tick the "spoken to customer" box) → shows **£200** due, £200 balance.
3. Click **Send payment link** → open the link.
4. Click **PAY £200 DEPOSIT** → pay with test card **4242 4242 4242 4242**, any future expiry, any CVC, any postcode.
5. You should see *"Thank you! Your 50% booking deposit has been received…"* with a payment reference and receipt link. In admin: status **Payment received**, £200 paid, outstanding £200, payment date, Stripe reference (`pi_…`) and receipt filled in.
6. Try to break it:
   - Open the payment link again → it says the deposit is already received (no second payment possible).
   - Test card **4000 0000 0000 0002** (declined) on a new booking → stays **Payment requested**.
   - On the Stripe page press the back arrow → you land on **Payment cancelled**, nothing charged, **Try again** works.
   - Approve another booking with **Full payment** and one with **Other amount** (e.g. £150) and pay both.
   - Change the price on an unpaid booking → the old link stops working.
   - Run `stripe trigger checkout.session.completed` → it's ignored (not one of your deposits).
7. Record the balance as paid → status **Balance paid**, outstanding £0.

### Going live

Only after the test above works: switch the Stripe dashboard to **Live mode**, create a **live** webhook endpoint for your real domain, put the **live** `sk_live_…` key and the live webhook's `whsec_…` into Vercel, and redeploy. Do one small real payment to yourself and refund it from the Stripe dashboard.

---

## Deploying to Vercel

1. Push this folder to a GitHub repository (`.env.local` is ignored automatically – good).
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repository.
3. Add the same environment variables from `.env.local` (including the Stripe keys), plus `NEXT_PUBLIC_SITE_URL` set to your real domain (e.g. `https://www.yourdomain.co.uk`). Payment links and Stripe return pages use this address, so it must be correct.
4. Deploy. Add your domain under **Settings → Domains**.
5. In Supabase → **Authentication → URL Configuration**, set the Site URL to your domain.

> Environment variables are read when the site is built. If you change them on Vercel, **redeploy**.

---

## Everyday commands

```bash
npm run dev        # run locally
npm test           # run the pricing tests
npm run typecheck  # check for TypeScript errors
npm run lint       # check code style
npm run build      # production build
```

## Where things live

```
src/
  app/
    (site)/            public pages (homepage, quote, services, gallery, areas, contact, privacy)
    admin/             login + dashboard (enquiries, messages, settings, gallery) + actions.ts
    api/               enquiries, contact form, photo upload links, Stripe checkout + webhook
    pay/               customer deposit payment + thank-you pages
    sitemap.ts robots.ts
  components/
    calculator/        the quotation calculator (steps, measurements, condition, photos, breakdown)
    home/              homepage sections
    gallery/           before/after slider
    layout/            header, footer, logo
    ui/                buttons, form fields
  config/
    site.ts            placeholders, service areas, image paths
    services.ts        service descriptions and SEO text
    reviews.ts         review placeholders
  lib/
    pricing/           ⭐ pricing engine, default prices, validation, tests
    payments/          ⭐ payment maths (deposit %/full/custom), booking rules, Stripe checkout + helpers, tests
    settings.ts        loads prices + business details from the database
    enquiry.ts         customer-details validation, statuses, reference numbers
    notifications.ts   email notifications (Resend)
    supabase/          database connections
  proxy.ts             keeps admin logins fresh
supabase/migrations/   database schema
```

## Security notes

- Database tables use Row Level Security: the public can only read prices, business details and published gallery items. Only admins can read enquiries or photos.
- Customer photos go to a **private** bucket via one-time upload links and are viewed in the admin through links that expire after an hour.
- File type (JPG/PNG/WEBP) and size (10 MB) are checked in the browser, on the server and by the storage bucket itself.
- Forms include a hidden spam trap. If you get spam, turn on Vercel's Firewall / Bot protection or add a rate limit.
- Photos uploaded during an abandoned enquiry stay in `enquiry-photos/pending/`. You can clear old ones occasionally from Supabase → Storage.
