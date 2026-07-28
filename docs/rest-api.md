# Inventory Management REST API

Base URL: `http://localhost:4000/api`

Authentication: protected endpoints require `Authorization: Bearer <supabase-access-token>`.

Public endpoints:
- `GET /api`
- `GET /api/health`
- `GET /api/health/ready`
- `POST /api/auth/login`

Swagger UI is available at `/api/docs` when `SWAGGER_ENABLED=true`. Keep it disabled or access-controlled in production.

Read-heavy authenticated responses use private TTL caching: Dashboard 15 seconds, Product Options 5 minutes, and Reports 60 seconds. Stock and catalog mutations invalidate related server caches.

## Authentication

- `POST /api/auth/login` - sign in with `username` and `password`.
- `GET /api/auth/me` - return the authenticated inventory profile and record session verification.

## Users

Admin only.

- `GET /api/users` - list users and roles.
- `POST /api/users` - create a Supabase Auth user and linked application profile with an initial password.
- `PATCH /api/users/:id` - update profile, status, or role.
- `POST /api/users/:id/reset-password` - replace the user's permanent password. The API never returns or stores plaintext.
- `DELETE /api/users/:id` - disable user.

## Products

- `GET /api/products` - list products with search, filters, sort, and pagination.
- `GET /api/products/options` - categories and suppliers for product forms.
- `GET /api/products/:id` - product detail.
- `POST /api/products` - create product. Admin/Manager.
- `PATCH /api/products/:id` - update product. Admin/Manager.
- `DELETE /api/products/:id` - archive product. Admin/Manager.

Supported product list query params: `q`, `categoryId`, `supplierId`, `status`, `stockStatus`, `page`, `limit`, `sortBy`, `sortOrder`.

## Categories

- `GET /api/categories` - list categories, optional `q` search.
- `GET /api/categories/:id` - category detail.
- `POST /api/categories` - create category. Admin/Manager.
- `PATCH /api/categories/:id` - update category. Admin/Manager.
- `DELETE /api/categories/:id` - archive category. Admin/Manager.

## Suppliers

- `GET /api/suppliers` - list suppliers, optional `q` search.
- `GET /api/suppliers/:id` - supplier detail.
- `POST /api/suppliers` - create supplier. Admin/Manager.
- `PATCH /api/suppliers/:id` - update supplier. Admin/Manager.
- `DELETE /api/suppliers/:id` - archive supplier. Admin/Manager.

## Stock In

- `POST /api/stock-in` - record incoming stock, increase product quantity, update weighted average cost, link supplier, and create transaction history.

Body fields: `productId`, `supplierId`, `quantity`, `costPrice`, `date`, `notes`.

## Stock Out

- `POST /api/stock-out` - record outgoing stock, validate available stock, prevent negative quantity, decrease product quantity, and create transaction history.

Body fields: `productId`, `quantity`, `department`, `receiver`, `date`, `notes`.

## Transactions

- `GET /api/transactions` - transaction history with filters.

Supported query params: `productId`, `userId`, `type`, `dateFrom`, `dateTo`, `page`, `limit`.

## Reports

- `GET /api/reports` - summary and movement report.
- `GET /api/reports/export` - export report.

Supported query params: `period=daily|weekly|monthly|yearly`, `dateFrom`, `dateTo`, `format=pdf|excel` for export.

## Notifications

- `GET /api/notifications` - sync and list low-stock/out-of-stock alerts.
- `PATCH /api/notifications/:id/read` - mark one notification as read.
- `POST /api/notifications/read-all` - mark all notifications as read.

## Dashboard

- `GET /api/dashboard` - KPIs, charts, recent transactions, activities, and watchlist.
