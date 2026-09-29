# Project Architecture Rules

- Keep simple-product variant names intact in storage; suppress them only while formatting Excel exports, because receipts, forms, and search may depend on them.
- Keep online checkout behavior unchanged; offline sales use a per-device IndexedDB outbox and the idempotent `sync_offline_sale` RPC because retries must never duplicate a sale.