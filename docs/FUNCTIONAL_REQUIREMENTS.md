# Inventory Management System Requirements

## Technology Stack

- Frontend: Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui
- Backend: NestJS, TypeScript, REST API
- Database: Supabase PostgreSQL
- ORM: Prisma
- Authentication: Supabase Auth or JWT
- Storage: Supabase Storage for product images
- Forms and validation: React Hook Form, Zod
- Data fetching: TanStack Query, Axios
- Charts: Recharts preferred, Chart.js optional
- Icons: Lucide React

## Core Modules

1. Authentication: login, logout, forgot password, refresh tokens, protected routes, RBAC for Admin, Manager, and Staff.
2. Dashboard: products, categories, suppliers, low stock, out of stock, daily stock in/out, inventory value, recent activities, and recent transactions.
3. Product Management: CRUD, image, SKU, barcode, name, description, category, supplier, prices, quantity, minimum stock, unit, status, search, filters, sorting, pagination, upload, and barcode scanning.
4. Category Management: CRUD for product categories.
5. Supplier Management: CRUD with name, email, phone number, and address.
6. Stock In: product, supplier, quantity, cost price, date, notes, automatic quantity increase, and transaction history.
7. Stock Out: product, quantity, department, receiver, date, notes, stock validation, negative inventory prevention, automatic quantity decrease, and transaction history.
8. Inventory Transactions: track stock in and stock out with filters by product, date, user, and transaction type.
9. Reports: daily, weekly, monthly, yearly reports with PDF and Excel export.
10. User Management: admin user CRUD and role assignment.
11. Notifications: low stock, out of stock, and below-minimum-stock alerts.
12. REST API: auth, users, products, categories, suppliers, stock in, stock out, transactions, reports, and notifications.
13. Database Tables: users, roles, products, categories, suppliers, stock_in, stock_out, inventory_transactions, and notifications.
14. UI/UX: responsive layout, sidebar, top navigation, dashboard, light/dark mode, global search, breadcrumbs, notification center, and user profile menu.
15. Security: JWT, bcrypt, input validation, rate limiting, CORS, Helmet, and role-based authorization.
16. Performance: pagination, debounced search, image optimization, lazy loading, and caching.

## Implementation Direction

Start with the dashboard and frontend shell, then add NestJS API modules, Prisma schema, Supabase configuration, authentication, and module-by-module CRUD flows.
