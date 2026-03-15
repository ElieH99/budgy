# Deployment Plan: Convex Seed + Vercel

## Context
The app is built and needs to be deployed. Two things are needed:
1. Update the seed script to create 4 test accounts **with working passwords** (currently seeds 2 accounts without auth credentials)
2. Deploy Next.js to Vercel with a full Convex production backend

---

## Part 1: Update `convex/seed.ts`

### Problem
The current seed script inserts user records directly into the `users` table via `db.insert`, bypassing Convex Auth entirely. Seeded users have no `authAccounts` records and **cannot log in**.

### Accounts to Seed
| Name | Role | Email | Password |
|------|------|-------|----------|
| Miles Morales | employee | miles@employee.dev | MilesEmployee@2026! |
| Peter Parker | employee | peter@employee.dev | PeterEmployee@2026! |
| Jack Black | manager | jack@manager.dev | JackManager@2026! |
| Mike Tyson | manager | mike@manager.dev | MikeManager@2026! |

### Approach
Use `createAccount` from `@convex-dev/auth/server` — this is an officially exported function that:
- Requires a `GenericActionCtx` (must be called from an **action**, not a mutation)
- Creates proper `authAccounts` records with hashed passwords
- Creates the `users` record via the configured `store` function
- Returns the created user ID

### Changes to `convex/seed.ts`

1. **Convert from `internalMutation` to `internalAction`** — required because `createAccount` needs an action context

2. **Extract category seeding into a helper `internalMutation`** — since actions don't have `ctx.db`, categories must be seeded via `ctx.runMutation`

3. **Add a `getUserByEmail` internal query** — for idempotency checks from the action

4. **Add a `patchUserRole` internal mutation** — since the Password provider hardcodes `role: "employee"` in its `profile()` function, manager accounts need a post-creation role patch

5. **Update `TEST_ACCOUNTS`** — add Peter Parker and Mike Tyson, add `password` field to all entries

6. **Main `seed` action flow:**
   ```
   for each account:
     - check if user exists (via getUserByEmail query) → skip if yes
     - call createAccount(ctx, { provider: "password", account: { id: email, secret: password }, profile: { email, firstName, lastName, role: "employee", createdAt } })
     - if role is "manager", call patchUserRole mutation
   ```

### Files Modified
- `convex/seed.ts` — rewrite

### Run Command
```bash
npx convex run seed:seed        # dev
npx convex run seed:seed --prod # production
```

---

## Part 2: Deploy to Vercel

### Step 1: Deploy Convex to Production
```bash
# Deploy backend functions + schema
npx convex deploy

# Set auth secret on production (generate with: openssl rand -hex 32)
npx convex env set CONVEX_AUTH_SECRET <your-secret> --prod

# Set the site URL for auth callbacks (get from Convex dashboard)
npx convex env set CONVEX_SITE_URL <your-prod>.convex.site --prod

# Seed production database (run once)
npx convex run seed:seed --prod
```

### Step 2: Set Up Vercel Project
1. Go to **vercel.com/new** → import your GitHub repo
2. Framework preset: **Next.js** (auto-detected)
3. Build command: `next build` (default)
4. Root directory: `.` (default)

### Step 3: Configure Vercel Environment Variables
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://<prod>.convex.cloud` | Output of `npx convex deploy` / Convex dashboard |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Update after first deploy when URL is known |

**Note:** `CONVEX_AUTH_SECRET` and `CONVEX_SITE_URL` are set on the **Convex side** (via `npx convex env set`), NOT in Vercel.

**Note:** Do NOT set `CONVEX_DEPLOYMENT` on Vercel — that's only for local dev.

### Step 4: Deploy
Click "Deploy" in Vercel or push to main branch.

### Step 5: Post-Deploy
1. Copy the assigned Vercel URL
2. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars → redeploy
3. Verify login works with `miles@employee.dev` / `MilesEmployee@2026!`

### Optional: CI/CD Auto-Deploy
Add to `package.json`:
```json
"vercel-build": "npx convex deploy --cmd 'next build'"
```
And set `CONVEX_DEPLOY_KEY` in Vercel. This auto-deploys Convex functions on every Vercel build. **Skip this for now** — manual `npx convex deploy` is simpler for v1.

---

## Verification
1. Visit deployed URL → login page loads
2. Log in with each of the 4 seeded accounts
3. Employee view: create and submit an expense
4. Manager view: see pending expenses, approve/reject
5. Check Convex dashboard for active production connections

---

## CLAUDE.md Updates Needed
- Update Section 7 (Test Accounts) to include Peter Parker and Mike Tyson
- Update seed run command to `npx convex run seed:seed`
