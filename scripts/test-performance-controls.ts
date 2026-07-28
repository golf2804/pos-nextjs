import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const productsPage = read("app/products/page.tsx");
const transactionsPage = read("app/transactions/page.tsx");
const notificationsPage = read("app/notifications/page.tsx");
const globalSearch = read("components/layout/global-search.tsx");
const productForm = read("components/products/product-form.tsx");
const nextConfig = read("next.config.ts");
const appShell = read("components/layout/app-shell.tsx");

assert.match(productsPage, /page, limit: 10/);
assert.match(productsPage, /meta\.pageCount/);
assert.match(transactionsPage, /page, limit: 20/);
assert.match(transactionsPage, /meta\.pageCount/);
assert.match(notificationsPage, /pageSize/);
assert.match(notificationsPage, /pageCount/);
console.log("PASS: server pagination remains enabled for products, transactions, and notifications");

assert.match(productsPage, /setTimeout\([\s\S]*300\)/);
assert.match(globalSearch, /setTimeout\([\s\S]*250\)/);
console.log("PASS: product and global searches remain debounced");

assert.match(productsPage, /from "next\/image"/);
assert.match(productForm, /from "next\/image"/);
assert.match(nextConfig, /remotePatterns/);
console.log("PASS: product images use Next Image with an explicit remote allowlist");

assert.match(appShell, /usePathname/);
assert.doesNotMatch(appShell, /from ["']@\/app\//);
console.log("PASS: App Router pages remain route-split instead of eagerly imported by the shell");

console.log("Performance controls verification completed.");
