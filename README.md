# Internal Expense Tracker

An internal web application for employees to submit expense claims and managers to review, approve, reject, or close them. Supports the full expense lifecycle with version-snapshotted resubmissions and a permanent audit trail.

This is an internal tool — clarity, correctness, and auditability take priority over polish.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend / DB | Convex (database, server functions, real-time queries, file storage) |
| Auth | Convex Auth (email/password) |
| Frontend | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix UI) — primary UI building block throughout |
| Tables | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| Dates | date-fns |
| Language | TypeScript (strict) |

## Local Development

### Prerequisites
- Node.js 18+
- A Convex account (free tier is fine): https://convex.dev
- npm or pnpm

### Setup

1. Clone the repo and install dependencies:
```bash
git clone <repo-url>
cd <project-folder>
npm install
```

2. Create a `.env.local` file from the example:
```bash
cp .env.example .env.local
```

3. Create a new Convex project and link it:
```bash
npx convex dev
```
   This will prompt you to log in and create a project. It will populate `NEXT_PUBLIC_CONVEX_URL` automatically.

4. Add the remaining environment variables to `.env.local`:
```env
CONVEX_AUTH_SECRET=<generate a random 32+ char secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Seed the database with categories and test accounts:
```bash
npx convex run seed
```

6. Start the development servers (run both in separate terminals):
```bash
# Terminal 1 — Convex backend
npx convex dev

# Terminal 2 — Next.js frontend
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

### Test Accounts

| Role     | Email                  | Password              |
|----------|------------------------|-----------------------|
| Employee | miles@employee.dev     | MilesEmployee@2026!   |
| Manager  | jack@manager.dev       | JackManager@2026!     |
| Manager  | mike@manager.dev       | MikeManager@2026!     |

## Environment Variables

| Variable                  | Required | Description                                      |
|---------------------------|----------|--------------------------------------------------|
| `NEXT_PUBLIC_CONVEX_URL`  | ✅       | Your Convex deployment URL (set by `convex dev`) |
| `CONVEX_DEPLOY_KEY`       | ✅ prod  | Convex deploy key (production only)              |
| `CONVEX_AUTH_SECRET`      | ✅       | Random secret for Convex Auth token signing      |
| `NEXT_PUBLIC_APP_URL`     | ✅       | Full URL of the app (e.g. https://your-app.vercel.app) |

Never commit `.env.local` or any file containing real secrets.

## Deployment

This app deploys the Next.js frontend to **Vercel** and the backend to **Convex Cloud**. Both are required.

### 1. Deploy Convex backend
```bash
npx convex deploy
```

This will:
- Push your schema, functions, and auth config to Convex Cloud
- Print your production `NEXT_PUBLIC_CONVEX_URL`

After deploying, run the seed script against production **once**:
```bash
npx convex run seed --prod
```

> ⚠️ Only run the seed once. Running it again will create duplicate categories and accounts.

### 2. Deploy Next.js to Vercel

1. Push your repo to GitHub (or GitLab/Bitbucket).
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add the following environment variables in the Vercel dashboard:

   | Variable                  | Value                                      |
   |---------------------------|--------------------------------------------|
   | `NEXT_PUBLIC_CONVEX_URL`  | Your production Convex URL                 |
   | `CONVEX_DEPLOY_KEY`       | From Convex dashboard → Settings → Deploy Keys |
   | `CONVEX_AUTH_SECRET`      | Same value used during `convex deploy`     |
   | `NEXT_PUBLIC_APP_URL`     | Your Vercel deployment URL                 |

4. Deploy. Vercel will run `next build` automatically.

### Redeployment

- **Backend changes:** Run `npx convex deploy` then redeploy on Vercel (or trigger via CI).
- **Frontend-only changes:** Push to your main branch — Vercel redeploys automatically.
- **Schema changes:** Always deploy Convex first, then Vercel, to avoid function/schema mismatches.

## Project Structure

```
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login & registration pages
│   ├── (dashboard)/            # Authenticated pages
│   │   ├── page.tsx            # Employee dashboard
│   │   └── manager/page.tsx    # Manager dashboard
│   └── layout.tsx              # Root layout
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── expenses/               # Expense-specific components
│   └── manager/                # Manager-specific components
├── convex/
│   ├── schema.ts               # Database schema
│   ├── auth.ts                 # Auth configuration
│   ├── http.ts                 # HTTP routes (auth)
│   ├── seed.ts                 # Seed script
│   ├── expenses.ts             # Expense mutations & queries
│   ├── users.ts                # User queries
│   ├── categories.ts           # Category queries
│   └── files.ts                # File upload helpers
├── lib/
│   ├── constants.ts            # Status enums, reasons, currencies
│   ├── permissions.ts          # Role → permission mapping
│   ├── validators.ts           # Shared Zod schemas
│   └── utils.ts                # Utility functions
├── agents/                     # Agent prompt files
├── CLAUDE.md                   # Master context document
├── .env.example                # Environment variable template
└── README.md                   # This file
```
