export type OfflineQueueStatus = "menunggu" | "sinkron" | "gagal";

export interface OfflineSaleItem {
  variant_id: number;
  product_id?: number;
  display_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface OfflineSalePayload {
  client_txn_id: string;
  store_id: string;
  cashier_user_id: string;
  device_id: string;
  receipt_number: string;
  client_created_at: string;
  items: OfflineSaleItem[];
  payment_method: string;
  payment_details: Record<string, unknown>;
  member_id: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  redeemed_points: number;
}

export interface OfflineReceiptSnapshot {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeFooter?: string;
  logo?: string;
  cashier?: string;
  member?: string;
  dateTime: string;
}

export interface OfflineQueueEntry {
  clientTxnId: string;
  storeId: string;
  receiptNumber: string;
  clientCreatedAt: string;
  createdAt: number;
  updatedAt: number;
  status: OfflineQueueStatus;
  attempts: number;
  nextRetryAt: number;
  errorMessage?: string;
  payload: OfflineSalePayload;
  receipt: OfflineReceiptSnapshot;
}

export interface PosCache {
  storeId: string;
  updatedAt: number;
  products: unknown[];
  members: unknown[];
  discounts: unknown[];
  loyaltyRules: unknown[];
  redemptionRules: unknown[];
  bundlePromos: unknown[];
  store: Record<string, unknown> | null;
}