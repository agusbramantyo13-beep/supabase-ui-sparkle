# Project Architecture Rules

- Keep simple-product variant names intact in storage; suppress them only while formatting Excel exports, because receipts, forms, and search may depend on them.
- Keep online checkout behavior unchanged; offline sales use a per-device IndexedDB outbox and the idempotent `sync_offline_sale` RPC because retries must never duplicate a sale.
- Keep actual-discount reporting in the shared display-only helper and additive queries, never mutate stored receipt discounts or financial calculations; Profit discount queries mirror the existing RPC's database-session date bounds (verified UTC) and exclude returned/without-item sales to preserve accounting.