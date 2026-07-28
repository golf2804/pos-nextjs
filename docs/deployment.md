# Production Deployment

## Prerequisites

- Node.js 24 LTS or Docker with Compose.
- Supabase project with PostgreSQL, Auth, and the public `product-images` bucket.
- HTTPS domains for the frontend and API.
- A reverse proxy or managed load balancer in front of both services.

## Environment

Create production secrets from `.env.example`. Set `NODE_ENV=production`, use HTTPS values for `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, and `FRONTEND_URL`, and keep `SWAGGER_ENABLED=false` unless API documentation is intentionally exposed behind access control.

`SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `DIRECT_URL` are server-only secrets. Never prefix them with `NEXT_PUBLIC_`.

## Database

Before deploying application containers:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Run migrations as a one-off release job, not concurrently in every API replica. Create and verify a backup before schema changes.

Run the complete release gate against a dedicated staging Supabase project:

```bash
npm run verify:release
```

The integration suite mutates catalog, user, and inventory fixtures. Never point it at production.

## Containers

```bash
docker compose build
docker compose up -d
docker compose ps
```

The API liveness endpoint is `/api/health`; readiness is `/api/health/ready` and includes a database query. Route container logs to the platform log collector. Production Nest logs are JSON and every response includes `X-Request-Id`.

## Reverse Proxy

- Terminate TLS at the proxy.
- Redirect HTTP to HTTPS.
- Forward `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-Id`.
- Apply request body limits and an edge rate limit.
- Do not publicly expose PostgreSQL or Supabase service-role credentials.

## Rollback

1. Stop traffic to the failed application revision.
2. Deploy the previous immutable frontend and API image tags.
3. Roll back a database migration only when a reviewed down migration exists; otherwise deploy a forward fix.
4. Restore a backup only after confirming data loss or incompatible schema changes and obtaining release-owner approval.
5. Run `npm run test:production` and the smoke section of the release checklist.

## CI Integration Environment

Set the repository variable `RUN_SUPABASE_INTEGRATION=true` only after creating the protected `integration` environment and its dedicated Supabase secrets. The workflow deploys migrations and runs the full integration suite against that project. Keep production credentials out of this environment.
