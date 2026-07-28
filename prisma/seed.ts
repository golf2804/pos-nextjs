import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleCode } from "@prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const roles = [
    { code: RoleCode.ADMIN, name: "Admin", description: "Full system access" },
    { code: RoleCode.MANAGER, name: "Manager", description: "Inventory operations and reports" },
    { code: RoleCode.STAFF, name: "Staff", description: "Day-to-day stock operations" },
  ];
  for (const role of roles) {
    await prisma.role.upsert({ where: { code: role.code }, update: role, create: role });
  }

  const adminAuthUserId = process.env.BOOTSTRAP_ADMIN_AUTH_USER_ID;
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (adminAuthUserId && adminEmail) {
    const adminUsername = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? adminEmail.split("@")[0]).toLowerCase();
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: RoleCode.ADMIN },
    });
    await prisma.userProfile.upsert({
      where: { authUserId: adminAuthUserId },
      update: {
        username: adminUsername,
        email: adminEmail,
        fullName: process.env.BOOTSTRAP_ADMIN_NAME ?? "System Admin",
        roleId: adminRole.id,
        status: "ACTIVE",
      },
      create: {
        authUserId: adminAuthUserId,
        username: adminUsername,
        email: adminEmail,
        fullName: process.env.BOOTSTRAP_ADMIN_NAME ?? "System Admin",
        roleId: adminRole.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
