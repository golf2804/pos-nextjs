import "dotenv/config";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../server/src/prisma/prisma.service.js";

const marker = `E2E-${Date.now()}`;
const username = `e2e-admin-${marker.toLowerCase()}`;
const password = `E2e-${randomUUID().slice(0, 8)}-Aa9!`;
const email = `${username}@inventory-test.internal`;
const prisma = new PrismaService(new ConfigService(process.env));
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const supabaseSecret = required("SUPABASE_SECRET_KEY");
let authUserId = "";
let profileId = "";
let categoryId = "";
let supplierId = "";
let productId = "";
let accessToken = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, full_name: `${marker} Administrator` } }),
  });
  if (!authResponse.ok) throw new Error(`Supabase E2E setup failed: ${await authResponse.text()}`);
  authUserId = ((await authResponse.json()) as { id: string }).id;
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  profileId = (await prisma.userProfile.create({ data: { authUserId, username, email, fullName: `${marker} Administrator`, roleId: role.id } })).id;
  const loginResponse = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!loginResponse.ok) throw new Error(`API E2E login failed: ${await loginResponse.text()}`);
  accessToken = ((await loginResponse.json()) as { access_token: string }).access_token;

  categoryId = (await createFixture("/categories", { name: `${marker} Category`, description: "Playwright test fixture" })).id;
  supplierId = (await createFixture("/suppliers", { name: `${marker} Supplier`, email: `${marker.toLowerCase()}@example.test` })).id;
  productId = (await createFixture("/products", {
    sku: `${marker}-SKU`,
    name: `${marker} Product`,
    categoryId,
    supplierId,
    costPrice: 20,
    sellingPrice: 35,
    quantity: 0,
    minimumStock: 2,
    unit: "pcs",
  })).id;
});

test.afterAll(async () => {
  if (accessToken) {
    for (const path of [`/products/${productId}`, `/suppliers/${supplierId}`, `/categories/${categoryId}`]) {
      if (path.endsWith("/")) continue;
      await fetch(`${apiBase}${path}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
    }
  }
  const transactions = productId ? await prisma.inventoryTransaction.findMany({ where: { items: { some: { productId } } }, select: { id: true } }) : [];
  const transactionIds = transactions.map((item) => item.id);
  if (productId) {
    await prisma.notification.deleteMany({ where: { productId } });
    await prisma.stockIn.deleteMany({ where: { productId } });
    await prisma.stockOut.deleteMany({ where: { productId } });
    await prisma.inventoryTransactionItem.deleteMany({ where: { productId } });
    if (transactionIds.length) await prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } });
    await prisma.productSupplier.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  if (profileId) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: profileId }, { entityId: profileId }] } });
    await prisma.notification.deleteMany({ where: { userId: profileId } });
    await prisma.userProfile.deleteMany({ where: { id: profileId } });
  }
  if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
  if (authUserId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, { method: "DELETE", headers: adminHeaders() });
  await prisma.$disconnect();
});

test("63-68 inventory browser workflow", async ({ page }) => {
  await test.step("Authenticate with the Admin account", async () => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`${marker} Administrator`).first()).toBeVisible();
  });

  await test.step("67: Global Search returns and opens the seeded product", async () => {
    const search = page.getByLabel("Search products, categories, suppliers, and transactions").first();
    await search.fill(`${marker}-SKU`);
    await expect(page.getByRole("button", { name: new RegExp(`${marker} Product`) }).first()).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`${marker} Product`) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/products\\?q=${marker}-SKU`));
    await expect(page.getByText(`${marker} Product`)).toBeVisible();
  });

  await test.step("67: Notification Center shows and marks the stock alert read", async () => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notification Center" })).toBeVisible();
    await expect(page.getByText(`${marker}-SKU`).first()).toBeVisible();
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await expect(page.getByText("0 unread alerts")).toBeVisible();
    await page.screenshot({ path: "test-results/67-notifications-desktop.png", fullPage: true });
  });

  await test.step("68: Record Stock In through the browser", async () => {
    await page.goto("/stock-in");
    await page.locator('select[name="productId"]').selectOption(productId);
    await page.locator('select[name="supplierId"]').selectOption(supplierId);
    await page.locator('input[name="quantity"]').fill("5");
    await page.locator('input[name="costPrice"]').fill("20");
    await page.locator('input[name="notes"]').fill(marker);
    await page.getByRole("button", { name: "Record Stock In" }).click();
    await expect(page.getByRole("status")).toContainText("Recorded SI-");
  });

  await test.step("68: Record Stock Out without creating negative inventory", async () => {
    await page.goto("/stock-out");
    await page.locator('select[name="productId"]').selectOption(productId);
    await expect(page.locator('input[readonly]')).toHaveValue(/5/);
    await page.locator('input[name="quantity"]').fill("2");
    await page.locator('input[name="department"]').fill("E2E QA");
    await page.locator('input[name="receiver"]').fill(marker);
    await page.getByRole("button", { name: "Record Stock Out" }).click();
    await expect(page.getByRole("status")).toContainText("Recorded SO-");
  });

  await test.step("68: Transaction history and final quantity agree", async () => {
    await page.goto("/transactions");
    await expect(page.locator("table").getByText(`${marker}-SKU`).first()).toBeVisible();
    await expect.poll(async () => Number((await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { quantity: true } })).quantity)).toBe(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/transactions");
    await expect(page.locator("table").getByText(`${marker}-SKU`).first()).toBeVisible();
    await page.screenshot({ path: "test-results/68-transactions-mobile.png", fullPage: true });
  });
});

test("69-70 responsive layouts, theme, and accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  const routes = ["/", "/products", "/categories", "/suppliers", "/stock-in", "/stock-out", "/inventory-operations", "/transactions", "/reports", "/users", "/notifications"];
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const offenders = overflow > 1 ? await page.evaluate(() => Array.from(document.querySelectorAll("body *")).map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, className: element.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      }).filter((item) => item.right > document.documentElement.clientWidth + 1 || item.left < -1).slice(0, 8)) : [];
      expect(overflow, `${route} must not overflow the ${viewport.name} viewport: ${JSON.stringify(offenders)}`).toBeLessThanOrEqual(1);
    }
    await page.goto("/");
    await page.screenshot({ path: `test-results/69-dashboard-${viewport.name}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const darkToggle = page.getByRole("button", { name: "Switch to dark mode" });
  await darkToggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");

  for (const route of routes) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = results.violations.filter((item) => item.impact === "critical" || item.impact === "serious");
    const blockingSummary = blocking.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    }));
    expect(blockingSummary, route + " has serious accessibility violations").toEqual([]);
  }
  await page.screenshot({ path: "test-results/70-dashboard-dark.png", fullPage: true });
});

function adminHeaders(extra: Record<string, string> = {}) { return { apikey: supabaseSecret, authorization: `Bearer ${supabaseSecret}`, ...extra }; }
function required(key: string) { const value = process.env[key]; if (!value) throw new Error(`${key} is required.`); return value; }
async function createFixture(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`E2E fixture creation failed at ${path}: ${await response.text()}`);
  return await response.json() as { id: string };
}
