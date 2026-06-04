import { useState, useEffect } from "react";
import { Receipt, Calendar as CalendarIcon, Undo2, ShoppingBag, Eye, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { format, startOfDay, endOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import SalesReturnDialog from "@/components/SalesReturnDialog";
import { useBluetoothPrinter } from "@/contexts/BluetoothPrinterContext";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  receipt_number: string | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  payment_details: any;
  user_name: string | null;
  status: string | null;
  member_name: string | null;
  member_code: string | null;
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  type: "sale" | "expense";
  description?: string | null;
}

interface SaleItem {
  id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  product_snapshot: any;
}

const formatRp = (n: number) => `Rp ${Math.abs(Number(n || 0)).toLocaleString('id-ID')}`;

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentStoreId, currentStore } = useStore();
  const btPrinter = useBluetoothPrinter();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [detailItems, setDetailItems] = useState<SaleItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentStoreId]);

  const fetchTransactions = async () => {
    if (!currentStoreId) return;
    setLoading(true);
    try {
      const startDate = startOfDay(selectedDate);
      const endDate = endOfDay(selectedDate);

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, receipt_number, total, subtotal, discount_total, tax_total,
          created_at, payment_method, payment_details, user_id, status, member_id,
          profiles:user_id(name, email),
          members:member_id(name, member_code)
        `)
        .eq('store_id', currentStoreId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      const { data: expensesData, error: expErr } = await supabase
        .from('store_expenses')
        .select('id, amount, description, approved_at, submitted_at, submitted_by')
        .eq('store_id', currentStoreId)
        .eq('status', 'approved')
        .gte('approved_at', startDate.toISOString())
        .lte('approved_at', endDate.toISOString());

      if (expErr) throw expErr;

      const expUserIds = Array.from(
        new Set((expensesData || []).map((e: any) => e.submitted_by).filter(Boolean))
      );
      let expProfileMap: Record<string, string> = {};
      if (expUserIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', expUserIds);
        (profs || []).forEach((p: any) => {
          expProfileMap[p.id] = p.name || p.email || 'Pengguna';
        });
      }

      const sales: Transaction[] = (salesData || []).map((sale: any) => ({
        id: sale.id,
        receipt_number: sale.receipt_number,
        total: Number(sale.total || 0),
        subtotal: Number(sale.subtotal || 0),
        discount_total: Number(sale.discount_total || 0),
        tax_total: Number(sale.tax_total || 0),
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        payment_details: sale.payment_details,
        user_name: (sale.profiles as any)?.name || (sale.profiles as any)?.email || 'Unknown',
        status: sale.status,
        member_name: (sale.members as any)?.name || null,
        member_code: (sale.members as any)?.member_code || null,
        type: 'sale',
      }));

      const expenses: Transaction[] = (expensesData || []).map((e: any) => ({
        id: e.id,
        receipt_number: null,
        total: -Number(e.amount || 0),
        created_at: e.approved_at || e.submitted_at,
        payment_method: 'cash',
        payment_details: null,
        user_name: e.submitted_by ? expProfileMap[e.submitted_by] || 'Pengguna' : '-',
        status: 'expense',
        member_name: null,
        member_code: null,
        type: 'expense',
        description: e.description,
      }));

      const merged = [...sales, ...expenses].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(merged);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalAmount = () =>
    transactions
      .filter(t => t.status !== 'returned')
      .reduce((sum, t) => sum + Number(t.total || 0), 0);

  const handleReturnClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setReturnDialogOpen(true);
  };

  const openDetail = async (tx: Transaction) => {
    setDetailTx(tx);
    setDetailOpen(true);
    setDetailItems([]);
    if (tx.type !== 'sale') return;
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, quantity, unit_price, discount, total, product_snapshot')
        .eq('sale_id', tx.id);
      if (error) throw error;
      setDetailItems((data || []) as any);
    } catch (e) {
      console.error('Error fetching sale items:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Riwayat Transaksi</h1>
        </div>
        <Card className="bg-gradient-card animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pd = detailTx?.payment_details || {};
  const cashAmount = Number(pd.cash ?? pd.cash_amount ?? pd.cashAmount ?? 0);
  const cardAmount = Number(pd.card ?? pd.card_amount ?? pd.cardAmount ?? 0);
  const changeAmount = Number(pd.change ?? pd.change_amount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Riwayat Transaksi</h1>
          <p className="text-muted-foreground">Penjualan dan pengeluaran belanja toko</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[240px] justify-start text-left font-normal")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "EEEE, dd MMMM yyyy", { locale: idLocale })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Bersih (Penjualan - Belanja)</p>
              <p className="text-2xl font-bold text-foreground">
                Rp {getTotalAmount().toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions.filter(t => t.status !== 'returned').length} transaksi
              </p>
            </div>
            <Receipt className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Daftar Transaksi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-muted-foreground">Tanggal & Waktu</TableHead>
                    <TableHead className="text-muted-foreground">No. Struk / Keterangan</TableHead>
                    <TableHead className="text-muted-foreground">Kasir</TableHead>
                    <TableHead className="text-muted-foreground">Member</TableHead>
                    <TableHead className="text-muted-foreground">Pembayaran</TableHead>
                    <TableHead className="text-right text-muted-foreground">Total</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const isExpense = transaction.type === 'expense';
                    return (
                      <TableRow
                        key={`${transaction.type}-${transaction.id}`}
                        className={`border-border/50 ${transaction.status === 'returned' ? 'opacity-60' : ''}`}
                      >
                        <TableCell className="font-medium text-foreground">
                          {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {isExpense ? (
                            <span className="flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-destructive" />
                              {transaction.description || 'Belanja Toko'}
                            </span>
                          ) : (
                            transaction.receipt_number || '-'
                          )}
                        </TableCell>
                        <TableCell className="text-foreground">{transaction.user_name || '-'}</TableCell>
                        <TableCell className="text-foreground">{transaction.member_name || '---'}</TableCell>
                        <TableCell className="text-foreground capitalize">{transaction.payment_method || '-'}</TableCell>
                        <TableCell className={`text-right font-semibold ${isExpense ? 'text-destructive' : 'text-foreground'}`}>
                          {isExpense ? '- ' : ''}{formatRp(transaction.total)}
                        </TableCell>
                        <TableCell>
                          {isExpense ? (
                            <Badge variant="destructive">Belanja</Badge>
                          ) : transaction.status === 'returned' ? (
                            <Badge variant="destructive">Diretur</Badge>
                          ) : (
                            <Badge variant="default">Selesai</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!isExpense && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetail(transaction)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Nota
                              </Button>
                            )}
                            {!isExpense && transaction.status !== 'returned' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReturnClick(transaction)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Undo2 className="h-4 w-4 mr-1" />
                                Retur
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Tidak ada transaksi pada tanggal yang dipilih</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTransaction && selectedTransaction.type === 'sale' && (
        <SalesReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          saleId={selectedTransaction.id}
          saleInfo={{
            receipt_number: selectedTransaction.receipt_number,
            created_at: format(new Date(selectedTransaction.created_at), 'dd/MM/yyyy HH:mm'),
            total: selectedTransaction.total,
            payment_method: selectedTransaction.payment_method,
          }}
          onSuccess={fetchTransactions}
        />
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Nota</DialogTitle>
          </DialogHeader>
          {detailTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">No. Struk</p>
                  <p className="font-medium text-foreground">{detailTx.receipt_number || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal & Waktu</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(detailTx.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kasir</p>
                  <p className="font-medium text-foreground">{detailTx.user_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Member</p>
                  <p className="font-medium text-foreground">
                    {detailTx.member_name
                      ? `${detailTx.member_name}${detailTx.member_code ? ` (${detailTx.member_code})` : ''}`
                      : '---'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Metode Pembayaran</p>
                  <p className="font-medium text-foreground capitalize">{detailTx.payment_method || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">
                    {detailTx.status === 'returned' ? 'Diretur' : 'Selesai'}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="font-semibold text-foreground mb-2">Item</p>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat...</p>
                ) : detailItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada item</p>
                ) : (
                  <div className="rounded-md border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Produk</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Harga</TableHead>
                          <TableHead className="text-right">Diskon</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailItems.map((it) => {
                          const snap = it.product_snapshot || {};
                          const name = snap.product_name || snap.name || 'Produk';
                          const variant = snap.variant_name ? ` - ${snap.variant_name}` : '';
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="text-foreground">{name}{variant}</TableCell>
                              <TableCell className="text-center">{Number(it.quantity)}</TableCell>
                              <TableCell className="text-right">{formatRp(it.unit_price)}</TableCell>
                              <TableCell className="text-right">{formatRp(it.discount)}</TableCell>
                              <TableCell className="text-right font-medium">{formatRp(it.total)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatRp(detailTx.subtotal || 0)}</span>
                </div>
                {(detailTx.discount_total || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diskon</span>
                    <span className="text-foreground">- {formatRp(detailTx.discount_total || 0)}</span>
                  </div>
                )}
                {(detailTx.tax_total || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pajak</span>
                    <span className="text-foreground">{formatRp(detailTx.tax_total || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">{formatRp(detailTx.total)}</span>
                </div>
                {cashAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tunai</span>
                    <span className="text-foreground">{formatRp(cashAmount)}</span>
                  </div>
                )}
                {cardAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kartu / Non-Tunai</span>
                    <span className="text-foreground">{formatRp(cardAmount)}</span>
                  </div>
                )}
                {changeAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kembalian</span>
                    <span className="text-foreground">{formatRp(changeAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
