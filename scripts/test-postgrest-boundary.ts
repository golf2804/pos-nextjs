import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const tables = [
  "roles",
  "user_profiles",
  "categories",
  "suppliers",
  "products",
  "product_suppliers",
  "inventory_transactions",
  "inventory_transaction_items",
  "stock_ins",
  "stock_outs",
  "notifications",
  "audit_logs",
  "_prisma_migrations",
] as const;

async function main() {
  const grants = await prisma.$queryRaw<Array<{
    grantee: string;
    table_name: string;
    privilege_type: string;
  }>>`
    SELECT grantee, table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      AND table_name IN (
        'roles', 'user_profiles', 'categories', 'suppliers', 'products',
        'product_suppliers', 'inventory_transactions', 'inventory_transaction_items',
        'stock_ins', 'stock_outs', 'notifications', 'audit_logs', '_prisma_migrations'
      )
  `;
  assert.deepEqual(grants, [], `Untrusted table grants remain: ${JSON.stringify(grants)}`);

  const rlsDisabled = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT cls.relname AS table_name
    FROM pg_class AS cls
    JOIN pg_namespace AS namespace ON namespace.oid = cls.relnamespace
    WHERE namespace.nspname = 'public'
      AND cls.relkind = 'r'
      AND cls.relname IN (
        'roles', 'user_profiles', 'categories', 'suppliers', 'products',
        'product_suppliers', 'inventory_transactions', 'inventory_transaction_items',
        'stock_ins', 'stock_outs', 'notifications', 'audit_logs', '_prisma_migrations'
      )
      AND NOT cls.relrowsecurity
  `;
  assert.deepEqual(rlsDisabled, [], `RLS is disabled: ${JSON.stringify(rlsDisabled)}`);

  const schemaAccess = await prisma.$queryRaw<Array<{ role_name: string; has_usage: boolean }>>`
    SELECT role_name, has_schema_privilege(role_name, 'public', 'USAGE') AS has_usage
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
  `;
  assert.equal(schemaAccess.some((entry) => entry.has_usage), false, "Untrusted roles can use the public schema.");

  const productImageWritePolicies = await prisma.$queryRaw<Array<{ policyname: string; cmd: string }>>`
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
      AND (
        COALESCE(qual, '') ILIKE '%product-images%'
        OR COALESCE(with_check, '') ILIKE '%product-images%'
      )
  `;
  assert.deepEqual(
    productImageWritePolicies,
    [],
    `Direct authenticated product-image write policies remain: ${JSON.stringify(productImageWritePolicies)}`,
  );

  for (const table of tables) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: publishableKey },
    });
    assert.equal(response.ok, false, `Publishable key unexpectedly read public.${table}`);
  }

  console.log("PASS SECURITY 1.1: anon/authenticated/PUBLIC table grants are revoked");
  console.log("PASS SECURITY 1.2: RLS is enabled on every API-only table");
  console.log("PASS SECURITY 1.3: publishable-key PostgREST reads are denied");
  console.log("PASS SECURITY 7.1: product-image writes require the authorized Nest API");
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
