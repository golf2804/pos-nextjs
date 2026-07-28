# POS Inventory Management

Inventory management system built with Next.js 16, NestJS, Supabase PostgreSQL, Prisma, Tailwind CSS, Recharts, and Supabase Auth.

## Local Development

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Apply migrations with `npx prisma migrate deploy`.
3. Seed roles and the initial administrator with `npm run prisma:seed`.
4. Start the API with `npm run dev:api`.
5. Start the frontend with `npm run dev`.

Frontend: `http://localhost:3000`  
API: `http://localhost:4000/api`  
Swagger in development: `http://localhost:4000/api/docs`

## Verification

```bash
npm run verify
npm run verify:integration
```

`verify` runs lint and both production builds. `verify:integration` additionally requires running frontend/API servers, valid Supabase credentials, and a migrated test database. Test records use unique prefixes and are removed in `finally` blocks.

## Production

Build and run both containers:

```bash
docker compose up --build -d
```

Do not commit `.env`. Public `NEXT_PUBLIC_*` values are embedded during the frontend image build; secrets are supplied only to the API container at runtime.

Operational documentation:

- [Deployment guide](docs/deployment.md)
- [Backup and restore](docs/backup-restore.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [REST API](docs/rest-api.md)
- [Database](docs/database.md)
