import "dotenv/config";
import assert from "node:assert/strict";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../server/src/auth/auth-user.interface.js";
import { AppRole } from "../server/src/auth/roles.enum.js";
import { CategoriesService } from "../server/src/categories/categories.service.js";
import { NotificationsService } from "../server/src/notifications/notifications.service.js";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { ProductsService } from "../server/src/products/products.service.js";
import { SuppliersService } from "../server/src/suppliers/suppliers.service.js";

const marker = `TEST-CATALOG-${Date.now()}`;
const prisma = new PrismaService(new ConfigService(process.env));
const categories = new CategoriesService(prisma);
const suppliers = new SuppliersService(prisma);
const products = new ProductsService(prisma, new NotificationsService(prisma));
let categoryId = "";
let supplierId = "";
let productId = "";

async function main() {
  const admin = await prisma.userProfile.findFirstOrThrow({ where: { status: "ACTIVE", role: { code: "ADMIN" } } });
  const actor: AuthUser = { id: admin.id, authUserId: admin.authUserId, username: admin.username, fullName: admin.fullName, avatarUrl: admin.avatarUrl, role: AppRole.ADMIN };

  const category = await categories.create({ name: `${marker}-CATEGORY`, description: "Created by CRUD integration test" }, actor);
  categoryId = category.id;
  assert.equal((await categories.get(category.id)).name, category.name);
  assert.ok((await categories.list({ q: marker })).some((item) => item.id === category.id));
  assert.equal((await categories.update(category.id, { description: "Updated category" }, actor)).description, "Updated category");
  console.log("PASS 64.1: Category create, read, search, and update");

  const supplier = await suppliers.create({ name: `${marker}-SUPPLIER`, email: `${marker.toLowerCase()}@example.test`, phone: "020000000", address: "Integration test" }, actor);
  supplierId = supplier.id;
  assert.equal((await suppliers.get(supplier.id)).name, supplier.name);
  assert.ok((await suppliers.list({ q: marker })).some((item) => item.id === supplier.id));
  assert.equal((await suppliers.update(supplier.id, { phone: "029999999" }, actor)).phone, "029999999");
  console.log("PASS 64.2: Supplier create, read, search, and update");

  const product = await products.create({ sku: `${marker}-SKU`, barcode: `${Date.now()}`, name: `${marker} Product`, description: "CRUD integration test", categoryId, supplierId, costPrice: 25, sellingPrice: 40, quantity: 0, minimumStock: 3, unit: "pcs" }, actor);
  productId = product.id;
  assert.equal((await products.get(product.id)).supplier?.id, supplierId);
  const page = await products.list({ q: marker, page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc", stockStatus: "all" });
  assert.ok(page.items.some((item) => item.id === product.id));
  const updated = await products.update(product.id, { name: `${marker} Updated`, sellingPrice: 45 }, actor);
  assert.equal(updated.name, `${marker} Updated`);
  assert.equal(updated.sellingPrice, 45);
  console.log("PASS 64.3: Product create, relation read, search, pagination, and update");

  assert.equal((await products.remove(product.id, actor)).status, "ARCHIVED");
  assert.equal((await suppliers.remove(supplier.id, actor)).status, "ARCHIVED");
  assert.equal((await categories.remove(category.id, actor)).status, "ARCHIVED");
  assert.equal((await products.list({ q: marker, page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc", stockStatus: "all" })).meta.total, 0);
  console.log("PASS 64.4: Product, Supplier, and Category archive behavior");
  console.log("Catalog CRUD integration test completed.");
}

async function cleanup() {
  if (productId) {
    await prisma.notification.deleteMany({ where: { productId } });
    await prisma.productSupplier.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: productId }, { entityId: supplierId }, { entityId: categoryId }] } });
  if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
