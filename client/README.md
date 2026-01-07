## Intelligent Repair – Client (Next.js)

This folder contains the Next.js app (UI + API routes).

### Run locally

```bash
cd client
npm install
npm run dev
```

### Required env vars (`client/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server/admin routes + `node test-e2e.js`)
- `OPENAI_API_KEY` (only if you use AI endpoints)

### Tests

DB checks:

```bash
cd client
node test-db-connection.js
node test-e2e.js
```

For API/feature documentation, see the repo root `README.md`.

