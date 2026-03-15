# Troubleshooting

Common issues encountered during setup, development, and deployment.

---

## Setup Issues

### Blank page after starting the app

**Symptom:** The app loads but shows a blank white page or a "Convex not configured" error.

**Cause:** `NEXT_PUBLIC_CONVEX_URL` is missing or wrong.

**Fix:**
1. Run `npx convex dev` — it prints and auto-writes your deployment URL.
2. Confirm `.env.local` contains `NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud`.
3. Restart `npm run dev` after changing `.env.local`.

---

### 401 Unauthorized / Authentication errors

**Symptom:** Login fails immediately, or all queries return auth errors after logging in.

**Cause:** Convex Auth JWT keys are not configured.

**Fix:**
1. Generate keys if you haven't already:
   ```bash
   npx @convex-dev/auth generate-keys
   ```
2. Set the following in your **Convex dashboard** (not in Vercel or `.env.local`):
   - `JWT_PRIVATE_KEY`
   - `JWKS`
   - `SITE_URL` (your app's public URL, e.g. `http://localhost:3000` for local dev)
3. Redeploy Convex: `npx convex deploy` (or `npx convex dev` for local).

---

### Seed script fails

**Symptom:** `npx convex run seed:seed` throws an error.

**Causes and fixes:**

- **"Function not found"** — your Convex deployment is out of date. Run `npx convex dev` or `npx convex deploy` first, then re-run the seed.
- **Duplicate key / unique constraint** — the seed has already run. This is safe to ignore; the script is idempotent and skips existing records.
- **Categories not appearing in the form** — the seed ran before the schema was deployed. Deploy schema first (`npx convex dev`), then seed.

---

### Missing categories in the expense form

**Symptom:** The category dropdown is empty.

**Cause:** Seed script has not been run, or ran against the wrong deployment.

**Fix:**
```bash
# Local
npx convex run seed:seed

# Production
npx convex run seed:seed --prod
```

---

## File Upload Issues

### Receipt upload fails with 413 or size error

**Symptom:** Uploading a receipt shows an error or the upload silently fails.

**Cause:** The file exceeds the 5 MB limit.

**Fix:** Compress the image before uploading. The app validates file size client-side (shows an error message) and server-side (rejects the upload). Accepted formats are JPEG, PNG, and WEBP only.

### Receipt upload fails with an unsupported format error

**Symptom:** Upload is rejected with a file type error.

**Cause:** The file is not JPEG, PNG, or WEBP (e.g. PDF, HEIC, GIF).

**Fix:** Convert the receipt to one of the accepted formats before uploading.

---

## Deployment Issues

### Build fails: TypeScript errors

**Symptom:** `next build` fails with type errors.

**Fix:** Run `npx tsc --noEmit` locally to see the errors. Common causes:
- Missing Convex generated types — run `npx convex dev` to regenerate `convex/_generated/`
- Schema mismatch — ensure `convex/schema.ts` matches your function signatures

---

### Functions work locally but fail in production

**Symptom:** Mutations or queries that work in local dev throw errors in production.

**Cause:** Schema or functions deployed out of order, or environment variables missing in production.

**Fix:**
1. Always deploy Convex before Vercel: `npx convex deploy` → then trigger Vercel redeploy.
2. Confirm all required env vars are set:
   - **Vercel:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_APP_URL`
   - **Convex dashboard:** `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`

---

### "Schema mismatch" or "Function not found" in production

**Symptom:** After deploying, some queries or mutations throw unexpected errors.

**Cause:** The frontend was deployed before the Convex backend, so the browser is calling functions that don't exist yet in the new schema.

**Fix:** Always deploy in this order:
1. `npx convex deploy` (deploy schema and functions)
2. Trigger Vercel redeploy (deploy frontend)

Never deploy Vercel first.

---

## Development Issues

### Real-time updates not working

**Symptom:** Changes made in one browser tab don't appear in another without a refresh.

**Cause:** Usually a stale Convex dev server or a query that is not correctly subscribed.

**Fix:**
1. Ensure `npx convex dev` is running in a terminal.
2. Check that the component uses `useQuery` (reactive) and not a one-off fetch.
3. Restart both `npx convex dev` and `npm run dev`.

---

### Test accounts not working after re-seeding

**Symptom:** Login with `miles@employee.dev` or `jack@manager.dev` fails after running the seed.

**Cause:** The seed creates accounts only if they don't exist. If passwords were changed or auth state is corrupted, re-seeding won't fix it.

**Fix:** Delete the user records directly from the Convex dashboard and re-run the seed. Credentials are in CLAUDE.md §7.
