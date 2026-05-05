# Ads of Stupid Leads

Lead tracking & commission platform for digital marketing agencies whose
clients close deals on WhatsApp.

You (admin) generate leads from ads, assign them to commission-based clients,
and clients update progress in their portal — including uploading payment
proof. You approve / dispute conversions, and commission is auto-calculated.

## Features

- **Admin dashboard** — totals, conversion rate, approved revenue, pending approvals
- **Clients** — create accounts, set commission (none / % of deal / fixed), share login
- **Leads** — single create or bulk paste, assign to a client, generates short ref like `LD-7K3F2`
- **Lead detail timeline** — every status change recorded, by whom, when
- **Client portal** — see assigned leads, update status (CONTACTED → QUOTED → NEGOTIATING / LOST), report conversion with proof upload
- **Conversion review** — admin approves or disputes, can adjust deal amount
- **Audit log** — every meaningful action logged
- **Commission auto-calc** — at conversion, commission is computed from the client's settings

## Stack

- Next.js 15 (App Router, Server Actions)
- Prisma + SQLite (swap to Postgres for prod — see below)
- Tailwind CSS
- bcrypt + jose JWT cookie session

## Run locally

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Then open http://localhost:3000 and log in as the admin (default
`admin@example.com` / `changeme123` — change in `.env`).

## Switch to Postgres for production

In `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Set `DATABASE_URL` to your Postgres connection string (Neon / Supabase / Railway
all have free tiers), then `npx prisma migrate deploy`.

## Deploy

- **Vercel:** push to GitHub, import repo, set `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Build runs migrations automatically (`npm run build` calls `prisma migrate deploy`).
- File uploads: the current implementation writes to `public/uploads/`. On
  Vercel that's not persistent — switch to S3 / R2 / UploadThing. Replace
  `saveUpload` in `src/lib/upload.ts`.

## Roadmap (Phase 2 — WhatsApp integration)

This platform is structured so WhatsApp can plug in cleanly:

1. **WhatsApp Cloud API (Meta):** Register each client's number under your Meta
   Business account; auto-log every message against the lead and auto-detect
   payment screenshots. ~₹0.4–4 per conversation.
2. **Third-party (WATI / Interakt / DoubleTick):** ~₹2–5k/month, unified inbox
   for all client numbers.
3. **Tracking-link hack (no API):** Each lead gets a unique short link the
   client must use to message the customer; clicks confirm contact, and the
   client only receives the next lead after updating the previous one.

## Roles

- **ADMIN** — full access, creates clients & leads, reviews conversions
- **CLIENT** — only sees their assigned leads, can update status + report
  conversions; cannot mark CONVERTED directly (admin approval required)

## Lead status flow

```
NEW → ASSIGNED → CONTACTED → QUOTED → NEGOTIATING → CONVERTED (admin-approved)
                                                  ↘ LOST
                                                  ↘ REJECTED (admin)
```

Clients can move leads forward except into `CONVERTED` — they submit a
conversion *report* with proof, and admin approves. This is the trust
mechanism: clients can't silently mark deals converted to inflate commission,
and they can't hide deals either (admin can manually mark CONVERTED from the
admin lead detail page).
