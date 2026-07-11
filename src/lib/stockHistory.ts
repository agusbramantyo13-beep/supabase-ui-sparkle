import { supabase } from "@/integrations/supabase/client";

export type StockHistoryType =
  | "product_added"
  | "product_reduced"
  | "sale"
  | "stock_adjustment"
  | "stock_opname"
  | "product_return"
  | "initial_stock";

export const STOCK_HISTORY_TYPE_LABEL: Record<StockHistoryType, string> = {
  product_added: "Produk Ditambahkan",
  product_reduced: "Produk Dikurangi",
  sale: "Transaksi Penjualan",
  stock_adjustment: "Penyesuaian Stok",
  stock_opname: "Stok Opname",
  product_return: "Retur Produk",
  initial_stock: "Stok Awal",
};

/**
 * Update inventory quantity AND record stock history in one server-side call.
 * Automatically captures product/variant name, user, before/after quantity.
 */
export async function applyInventoryChange(params: {
  variantId: number | string;
  newQuantity: number;
  type: StockHistoryType;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc("apply_inventory_change" as any, {
    p_variant_id: Number(params.variantId),
    p_new_qty: Math.max(0, Math.floor(params.newQuantity)),
    p_type: params.type,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return data;
}
