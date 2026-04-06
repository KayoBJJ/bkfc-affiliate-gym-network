# BKFC Affiliate Gym Network

Single-page Next.js intake site for selected gyms submitting affiliate network registration details and uploaded materials.

## Stack

- Next.js App Router
- React
- TypeScript
- Local file storage for uploads and JSON submission records

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## What is included

- Premium monochrome landing page with BKFC logo placeholder slots
- Responsive intake form with client-side validation
- Upload-capable API route at `/api/affiliate-registration`
- Structured local persistence:
  - submission metadata is written to `data/submissions.json`
  - uploaded files are written to `uploads/<submission-id>/...`

## Submission handling notes

The current backend is set up for local development and internal review workflows:

- Required text fields and required uploads are validated in the browser and again in the API route.
- Files are stored on the local filesystem to keep the initial setup simple.
- Submission records are saved as structured JSON objects for easy inspection or later migration.

## Where to connect production services

The API route is implemented in [app/api/affiliate-registration/route.ts](/Users/KayoBJJ/Documents/BKFC/bkfc-affiliate-gym-network/app/api/affiliate-registration/route.ts).

Replace or extend the local persistence block to connect:

- Cloud object storage for uploads, such as S3, Cloudflare R2, or Supabase Storage
- A database for submission records, such as Postgres or Supabase
- Email notifications or CRM/webhook triggers after a successful submission

Suggested production split:

- Keep the frontend form as-is.
- Swap `persistFile` to upload to cloud storage and return permanent asset URLs.
- Replace JSON append logic with a database insert.
- Add server-side authentication or signed access if this form should remain restricted beyond invitation-only distribution.

## Branding placeholders

Logo slots are clearly marked in the UI through the reusable placeholder component:

- [components/LogoPlaceholder.tsx](/Users/KayoBJJ/Documents/BKFC/bkfc-affiliate-gym-network/components/LogoPlaceholder.tsx)

Replace that component with real image assets or wire it to a CMS/asset pipeline later.
