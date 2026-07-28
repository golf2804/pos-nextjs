# Database

Database provider: Supabase PostgreSQL.

ORM: Prisma.

Main tables implemented:

- `roles` - role master data for Admin, Manager, Staff.
- `user_profiles` - application profile linked to Supabase Auth user ID, including the latest password-change timestamp. Passwords remain only in Supabase Auth.
- `categories` - product categories.
- `suppliers` - supplier contacts.
- `products` - product catalog, price, quantity, minimum stock, and status.
- `product_suppliers` - many-to-many product/supplier links with primary supplier flag.
- `stock_ins` - stock-in records by product, supplier, quantity, cost, date, and user.
- `stock_outs` - stock-out records by product, quantity, department, receiver, date, and user.
- `inventory_transactions` - transaction header/history for all inventory movements.
- `inventory_transaction_items` - product line items for each transaction.
- `notifications` - low-stock and out-of-stock alerts.
- `audit_logs` - security and operational audit records.

Important relationships:

- `user_profiles.role_id -> roles.id`
- `products.category_id -> categories.id`
- `product_suppliers.product_id -> products.id`
- `product_suppliers.supplier_id -> suppliers.id`
- `inventory_transactions.created_by_id -> user_profiles.id`
- `inventory_transaction_items.transaction_id -> inventory_transactions.id`
- `inventory_transaction_items.product_id -> products.id`
- `stock_ins.transaction_id -> inventory_transactions.id`
- `stock_ins.product_id -> products.id`
- `stock_ins.supplier_id -> suppliers.id`
- `stock_outs.transaction_id -> inventory_transactions.id`
- `stock_outs.product_id -> products.id`
- `notifications.user_id -> user_profiles.id`

Local validation commands:

```bash
npx prisma format
npx prisma validate
npm run prisma:generate
```

Deploy migrations to Supabase:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Required environment variables for database deployment:

- `DATABASE_URL` - Supabase pooler PostgreSQL URL.
- `DIRECT_URL` - Supabase direct PostgreSQL URL.
- `BOOTSTRAP_ADMIN_AUTH_USER_ID` - Supabase Auth user UUID for initial admin profile.
- `BOOTSTRAP_ADMIN_USERNAME` - initial admin username.
- `BOOTSTRAP_ADMIN_EMAIL` - initial admin email.
- `BOOTSTRAP_ADMIN_NAME` - initial admin display name.

Current migration chain:

- `20260727010000_init_inventory`
- `20260727020000_add_usernames`
- `20260727030000_add_notifications`
- `20260727040000_add_stock_in_out_tables`
- `20260727050000_add_managed_credentials`
- `20260727060000_add_stock_transaction_safety`
- `20260727070000_add_inventory_cost_constraints`
- `20260727080000_add_inventory_operation_integrity`
- `20260727090000_add_per_user_notification_lifecycle`
- `20260729010000_remove_reversible_passwords`

Backup and restore procedures are documented in `docs/backup-restore.md`.
