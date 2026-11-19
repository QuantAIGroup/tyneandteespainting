# Room Painting Website – Newcastle upon Tyne

A complete website for a painting business specialising in **bedrooms, living rooms and skirting boards** (ceilings as an optional extra), with an **instant labour-price calculator**, private photo uploads, customer enquiries and a password-protected admin dashboard.

> Straightforward room-by-room prices. No hourly rates. No hidden labour fees.

---

## What's included

| Area | What it does |
| --- | --- |
| **Homepage** | Hero, pricing promise, service cards with live "from" prices, why choose us, how it works, before/after gallery, reviews (clearly marked placeholders), contact form |
| **Calculator** (`/quote`) | 6 steps: services → measurements (m or cm, standard or wall-by-wall) → condition → photos → estimate → your details. Saves the enquiry with a reference like `NP-261119-K7QD` |
| **Service pages** | `/services/bedroom-painting`, `/living-room-painting`, `/skirting-board-painting`, `/ceiling-painting` – SEO pages with worked price examples |
| **Other pages** | `/gallery`, `/areas`, `/contact`, `/privacy` |
| **Admin** (`/admin`) | Enquiries (filter by status, view measurements, photos, breakdown, mark contacted / quote accepted / job completed, private notes), contact messages, **edit every price and minimum charge**, edit business details, upload gallery photos |
| **SEO** | Page titles/descriptions, `HousePainter` (LocalBusiness) structured data, sitemap.xml, robots.txt, alt text, service-area page |
| **Tests** | 38 unit tests for pricing, minimums, multiple rooms, rounding, flags and validation |

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
- **Reviews** → edit `src/config/reviews.ts` once you have genuine reviews (with permission), and set `isDemo: false`.
- **Images** → the hero and service images in `public/images/` are illustrations. Replace them with real photographs (same file names, or update the paths in `src/config/site.ts`). Use your own photos or properly licensed stock.
- **Privacy notice** (`/privacy`) → a plain-English starting point; check it fits your business.

### 6. Email notifications (optional)

To get an email for every new enquiry, create a free [Resend](https://resend.com) account, verify your domain, and add:

```
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL_TO=you@yourdomain.co.uk
NOTIFICATION_EMAIL_FROM="Website <enquiries@yourdomain.co.uk>"
```

Without these, enquiries are still saved and visible in /admin – nothing is lost.

---

## Deploying to Vercel

1. Push this folder to a GitHub repository (`.env.local` is ignored automatically – good).
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repository.
3. Add the same environment variables from `.env.local`, plus `NEXT_PUBLIC_SITE_URL` set to your real domain (e.g. `https://www.yourdomain.co.uk`).
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
    api/               enquiries, contact form, photo upload links
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
