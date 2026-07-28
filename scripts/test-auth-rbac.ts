import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { canAccessAppRoute, canManageInventory, type UserRole } from "../lib/auth/permissions.js";
import { PrismaService } from "../server/src/prisma/prisma.service.js";

type TestIdentity = {
  role: UserRole;
  profileId: string;
  authUserId: string;
  username: string;
  email: string;
  password: string;
  accessToken?: string;
  refreshToken?: string;
};

type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

const prisma = new PrismaService(new ConfigService(process.env));
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const frontendBase = process.env.FRONTEND_URL?.split(",")[0]?.trim() ?? "http://localhost:3000";
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const supabaseSecret = required("SUPABASE_SECRET_KEY");
const supabasePublicKey = process.env.SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabasePublicKey) throw new Error("A Supabase publishable key is required.");

const marker = randomUUID().slice(0, 8);
const identities: TestIdentity[] = [];
let uploadedStoragePath = "";

async function main() {
  await assertServers();
  for (const role of ["ADMIN", "MANAGER", "STAFF"] as const) {
    identities.push(await createIdentity(role));
  }

  for (const identity of identities) {
    const session = await login(identity.username, identity.password);
    identity.accessToken = session.access_token;
    identity.refreshToken = session.refresh_token;
    const me = await api("/auth/me", identity.accessToken);
    assert.equal(me.status, 200);
    assert.equal((me.body as { role?: string }).role, identity.role);
  }

  const admin = identity("ADMIN");
  const manager = identity("MANAGER");
  const staff = identity("STAFF");

  assert.equal(canAccessAppRoute("/users", "ADMIN"), true);
  assert.equal(canManageInventory("ADMIN"), true);
  assert.equal((await api("/users", admin.accessToken)).status, 200);
  assert.equal((await api("/categories", admin.accessToken, invalidPost())).status, 400);
  console.log("PASS 57: Admin sees privileged UI policy and can access Admin/Manager APIs");

  assert.equal(canAccessAppRoute("/users", "MANAGER"), false);
  assert.equal(canAccessAppRoute("/reports", "MANAGER"), true);
  assert.equal(canManageInventory("MANAGER"), true);
  assert.equal((await api("/users", manager.accessToken)).status, 403);
  assert.equal((await api("/categories", manager.accessToken, invalidPost())).status, 400);
  assert.equal((await api("/stock-adjustments", manager.accessToken, invalidPost())).status, 400);
  assert.equal((await api("/inventory/reconciliation", manager.accessToken)).status, 200);
  console.log("PASS 58: Manager cannot manage users but can manage catalog and inventory operations");

  assert.equal(canAccessAppRoute("/users", "STAFF"), false);
  assert.equal(canAccessAppRoute("/reports", "STAFF"), false);
  assert.equal(canManageInventory("STAFF"), false);
  assert.equal((await api("/users", staff.accessToken)).status, 403);
  assert.equal((await api("/categories", staff.accessToken, invalidPost())).status, 403);
  assert.equal((await api("/stock-adjustments", staff.accessToken, invalidPost())).status, 403);
  assert.equal((await api("/reports?period=daily", staff.accessToken)).status, 403);
  assert.equal((await api("/returns/in", staff.accessToken, invalidPost())).status, 400);
  assert.equal((await api("/dashboard", staff.accessToken)).status, 200);
  console.log("PASS 59: Staff has read/transaction access and is blocked from management actions");

  const invalidUuid = await api("/products/not-a-uuid", admin.accessToken);
  assert.equal(invalidUuid.status, 400);
  assert.equal((invalidUuid.body as { code?: string }).code, "HTTP_400");
  assert.ok((invalidUuid.body as { requestId?: string }).requestId);

  const image = new FormData();
  image.append("file", new Blob([
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  ], { type: "image/png" }), "pixel.png");
  const uploaded = await api("/products/images", admin.accessToken, { method: "POST", body: image });
  assert.equal(uploaded.status, 201);
  uploadedStoragePath = (uploaded.body as { path: string }).path;
  const forbiddenUpload = new FormData();
  forbiddenUpload.append("file", new Blob(["denied"], { type: "image/png" }), "denied.png");
  assert.equal((await api("/products/images", staff.accessToken, { method: "POST", body: forbiddenUpload })).status, 403);
  console.log("PASS 59.1: UUID errors are stable and product image uploads enforce Admin/Manager authorization");

  assert.equal((await api("/categories")).status, 401);
  assert.equal((await api("/categories", "invalid.token.value")).status, 401);
  const protectedPage = await fetch(`${frontendBase}/users`, { redirect: "manual" });
  assert.equal(protectedPage.status, 307);
  assert.match(protectedPage.headers.get("location") ?? "", /\/login\?next=%2Fusers/);
  assert.equal((await fetch(`${frontendBase}/forgot-password`, { redirect: "manual" })).status, 200);
  console.log("PASS 60: Direct protected URLs redirect to login and protected APIs reject missing/invalid tokens");

  const expiredToken = [
    toBase64Url({ alg: "none", typ: "JWT" }),
    toBase64Url({ sub: admin.authUserId, exp: 1, aud: "authenticated" }),
    "",
  ].join(".");
  assert.equal((await api("/auth/me", expiredToken)).status, 401);
  const refreshed = await refreshSession(admin.refreshToken!);
  assert.equal((await api("/auth/me", refreshed.access_token)).status, 200);
  admin.accessToken = refreshed.access_token;
  admin.refreshToken = refreshed.refresh_token;
  console.log("PASS 61: Expired tokens are rejected and valid refresh tokens issue a working session");

  const resetRequest = await api("/auth/password-reset-request", undefined, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: manager.username }),
  });
  const unknownRequest = await api("/auth/password-reset-request", undefined, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: `missing-${marker}` }),
  });
  assert.equal(resetRequest.status, 201);
  assert.equal(unknownRequest.status, 201);
  assert.deepEqual(resetRequest.body, unknownRequest.body, "Reset request must not reveal whether a username exists.");
  assert.equal(await prisma.auditLog.count({
    where: { userId: manager.profileId, action: "PASSWORD_RESET_REQUESTED" },
  }), 1);

  const newPassword = `Reset-${marker}-Aa9!`;
  const reset = await api(`/users/${manager.profileId}/reset-password`, admin.accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: newPassword }),
  });
  assert.equal(reset.status, 201);
  assert.equal((await signInSupabase(manager.email, manager.password)).status, 400);
  assert.equal((await signInSupabase(manager.email, newPassword)).status, 200);

  const logout = await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: supabasePublicKey,
      authorization: `Bearer ${admin.accessToken}`,
    },
  });
  assert.ok(logout.status === 204 || logout.status === 200);
  const refreshAfterLogout = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: supabasePublicKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: admin.refreshToken }),
  });
  assert.equal(refreshAfterLogout.ok, false);
  console.log("PASS 62: Reset requests are private, Admin reset changes the password, and logout revokes refresh");
  console.log("RBAC and authentication test completed.");
}

async function createIdentity(role: UserRole): Promise<TestIdentity> {
  const username = `test-${role.toLowerCase()}-${marker}`;
  const email = `${username}@inventory-test.internal`;
  const password = `Initial-${marker}-${role}-Aa9!`;
  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: `Test ${role} ${marker}` },
    }),
  });
  if (!createResponse.ok) throw new Error(`Unable to create Supabase ${role} test user: ${await createResponse.text()}`);
  const authUser = await createResponse.json() as { id: string };
  try {
    const roleRecord = await prisma.role.findUniqueOrThrow({ where: { code: role } });
    const profile = await prisma.userProfile.create({
      data: {
        authUserId: authUser.id,
        username,
        email,
        fullName: `Test ${role} ${marker}`,
        roleId: roleRecord.id,
        status: "ACTIVE",
      },
    });
    return { role, profileId: profile.id, authUserId: authUser.id, username, email, password };
  } catch (error) {
    await deleteSupabaseUser(authUser.id);
    throw error;
  }
}

async function login(username: string, password: string) {
  const response = await api("/auth/login", undefined, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 201, `Login failed for ${username}: ${JSON.stringify(response.body)}`);
  return response.body as Session;
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: supabasePublicKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (response.status !== 200) {
    throw new Error(`Refresh failed with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<Session>;
}

function signInSupabase(email: string, password: string) {
  return fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabasePublicKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function api(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null) as unknown;
  return { status: response.status, body, headers: response.headers };
}

function invalidPost(): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  };
}

function identity(role: UserRole) {
  return identities.find((item) => item.role === role)!;
}

async function assertServers() {
  const [frontend, backend] = await Promise.all([
    fetch(`${frontendBase}/login`, { redirect: "manual" }).catch(() => null),
    fetch(`${apiBase}/categories`).catch(() => null),
  ]);
  if (!frontend || !backend) {
    throw new Error("Start the frontend and API servers before running test:auth-rbac.");
  }
}

function adminHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: supabaseSecret,
    authorization: `Bearer ${supabaseSecret}`,
    ...extra,
  };
}

async function deleteSupabaseUser(authUserId: string) {
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

async function cleanup() {
  const profileIds = identities.map((item) => item.profileId).filter(Boolean);
  if (profileIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: profileIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: profileIds } } });
    await prisma.userProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  await Promise.allSettled(identities.map((item) => deleteSupabaseUser(item.authUserId)));
  if (uploadedStoragePath) {
    await fetch(`${supabaseUrl}/storage/v1/object/product-images/${uploadedStoragePath}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
  }
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function toBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => console.error("Cleanup failed:", error));
    await prisma.$disconnect();
  });
