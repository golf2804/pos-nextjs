import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../server/src/auth/auth-user.interface.js";
import { AppRole } from "../server/src/auth/roles.enum.js";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { UsersService } from "../server/src/users/users.service.js";
import { NotificationsService } from "../server/src/notifications/notifications.service.js";

const marker = randomUUID().slice(0, 8);
const prisma = new PrismaService(new ConfigService(process.env));
const users = new UsersService(prisma, new ConfigService(process.env), new NotificationsService(prisma));
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const supabaseSecret = required("SUPABASE_SECRET_KEY");
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
let actorAuthId = "";
let actorProfileId = "";
let managedAuthId = "";
let managedProfileId = "";
const actorPassword = `Actor-${marker}-Aa9!`;

async function main() {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const username = `test-admin-${marker}`;
  const email = `${username}@inventory-test.internal`;
  actorAuthId = await createSupabaseUser(email, actorPassword, username);
  const profile = await prisma.userProfile.create({ data: { authUserId: actorAuthId, username, email, fullName: `Test Admin ${marker}`, roleId: role.id } });
  actorProfileId = profile.id;
  const actor: AuthUser = { id: profile.id, authUserId: profile.authUserId, username, fullName: profile.fullName, avatarUrl: null, role: AppRole.ADMIN };

  const initialPassword = `Initial-${marker}-Aa9!`;
  const created = await users.create({ username: `test-staff-${marker}`, fullName: `Managed User ${marker}`, roleCode: "STAFF", password: initialPassword }, actor);
  managedProfileId = created.id;
  managedAuthId = (await prisma.userProfile.findUniqueOrThrow({ where: { id: created.id }, select: { authUserId: true } })).authUserId;
  assert.equal(created.role, "STAFF");
  assert.equal(created.passwordConfigured, true);
  assert.ok(created.passwordUpdatedAt);
  assert.ok((await users.list()).users.some((item) => item.id === created.id));
  console.log("PASS 65.1: Admin creates and lists a Staff account with a configured password");

  const updated = await users.update(created.id, { fullName: `Updated User ${marker}`, roleCode: "MANAGER" }, actor);
  assert.equal(updated.role, "MANAGER");
  assert.equal(updated.fullName, `Updated User ${marker}`);
  console.log("PASS 65.2: Admin updates profile and assigns role");

  assert.equal((await signIn(emailFor(managedAuthId), initialPassword)).ok, true);
  const nextPassword = `Updated-${marker}-Bb8!`;
  const reset = await users.resetPassword(created.id, nextPassword, actor);
  assert.ok(reset.passwordUpdatedAt);
  assert.equal((await signIn(emailFor(managedAuthId), initialPassword)).ok, false);
  assert.equal((await signIn(emailFor(managedAuthId), nextPassword)).ok, true);
  const listed = (await users.list()).users.find((item) => item.id === created.id);
  assert.equal(listed?.passwordConfigured, true);
  assert.equal("password" in (listed ?? {}), false);
  console.log("PASS 65.3: Admin replaces a password; old password fails and plaintext is never returned");

  assert.equal((await users.remove(created.id, actor)).status, "DISABLED");
  assert.equal((await users.list()).users.find((item) => item.id === created.id)?.status, "DISABLED");
  console.log("PASS 65.4: Deleting a user safely disables the account");
  console.log("User Management integration test completed.");
}

async function createSupabaseUser(email: string, password: string, username: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { method: "POST", headers: adminHeaders({ "content-type": "application/json" }), body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } }) });
  if (!response.ok) throw new Error(await response.text());
  return ((await response.json()) as { id: string }).id;
}

async function emailFor(authUserId: string) {
  return (await prisma.userProfile.findUniqueOrThrow({ where: { authUserId }, select: { email: true } })).email;
}

async function signIn(emailPromise: Promise<string>, password: string) {
  const email = await emailPromise;
  return fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: publicKey, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
}

function adminHeaders(extra: Record<string, string> = {}) { return { apikey: supabaseSecret, authorization: `Bearer ${supabaseSecret}`, ...extra }; }
async function deleteAuth(id: string) { if (id) await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: adminHeaders() }); }
function required(key: string) { const value = process.env[key]; if (!value) throw new Error(`${key} is required.`); return value; }

async function cleanup() {
  const ids = [managedProfileId, actorProfileId].filter(Boolean);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { entityId: { in: ids } }] } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userProfile.deleteMany({ where: { id: { in: ids } } });
  }
  await Promise.allSettled([deleteAuth(managedAuthId), deleteAuth(actorAuthId)]);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
