import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const username = process.env.MANAGED_USERNAME?.trim().toLowerCase();
const password = process.env.MANAGED_PASSWORD;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");
if (!username || !password) throw new Error("Username and password are required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const user = await prisma.userProfile.findUnique({ where: { username } });
  if (!user) throw new Error("User profile was not found.");

  const url = required("SUPABASE_URL").replace(/\/$/, "");
  const secret = required("SUPABASE_SECRET_KEY");
  const response = await fetch(`${url}/auth/v1/admin/users/${user.authUserId}`, {
    method: "PUT",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error("Supabase password update failed.");

  const passwordUpdatedAt = new Date();
  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: user.id },
      data: { passwordUpdatedAt },
    }),
    prisma.auditLog.create({
      data: {
        action: "USER_PASSWORD_RESET_BY_SCRIPT",
        entityType: "USER",
        entityId: user.id,
        metadata: { source: "LOCAL_CREATOR_CLI" },
      },
    }),
  ]);
  console.log(`Password updated for @${username}. It cannot be viewed after this command.`);
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
