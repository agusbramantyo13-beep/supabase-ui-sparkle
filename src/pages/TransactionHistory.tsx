import { useState, useEffect } from "react";
import { Receipt, Calendar, Undo2, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { format } from "date-fns";
import SalesReturnDialog from "@/components/SalesReturnDialog";

interface Transaction {
  id: string;
  receipt_number: string | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  user_name: string | null;
  status: string | null;
  member_name: string | null;
  type: "sale" | "expense";
  description?: string | null;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentStoreId } = useStore();
  const [days, setDays] = useState("7");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, currentStoreId]);

  const fetchTransactions = async () => {
    if (!currentStoreId) return;
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, 
          receipt_number, 
          total, 
          created_at, 
          payment_method,
          user_id,
          status,
          member_id,
          profiles:user_id(name, email),
          members:member_id(name, member_code)
        `)
        .eq('store_id', currentStoreId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch approved store expenses (Belanja Toko)
      const { data: expensesData, error: expErr } = await supabase
        .from('store_expenses')
        .select('id, amount, description, approved_at, submitted_at, submitted_by')
        .eq('store_id', currentStoreId)
        .eq('status', 'approved')
        .gte('approved_at', startDate.toISOString())
        .lte('approved_at', endDate.toISOString());

      if (expErr) throw expErr;

      // Get profile names for expenses
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
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        user_name: (sale.profiles as any)?.name || (sale.profiles as any)?.email || 'Unknown',
        status: sale.status,
        member_name: (sale.members as any)?.name || null,
        type: 'sale',
      }));

      const expenses: Transaction[] = (expensesData || []).map((e: any) => ({
        id: e.id,
        receipt_number: null,
        total: -Number(e.amount || 0),
        created_at: e.approved_at || e.submitted_at,
        payment_method: 'cash',
        user_name: e.submitted_by ? expProfileMap[e.submitted_by] || 'Pengguna' : '-',
        status: 'expense',
        member_name: null,
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

  const getTotalAmount = () => {
    return transactions
      .filter(t => t.status !== 'returned')
      .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  };

  const handleReturnClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setReturnDialogOpen(true);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Riwayat Transaksi</h1>
          <p className="text-muted-foreground">Penjualan dan pengeluaran belanja toko</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hari Ini</SelectItem>
            <SelectItem value="2">2 hari</SelectItem>
            <SelectItem value="3">3 hari</SelectItem>
            <SelectItem value="4">4 hari</SelectItem>
            <SelectItem value="5">5 hari</SelectItem>
            <SelectItem value="6">6 hari</SelectItem>
            <SelectItem value="7">7 hari</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Card */}
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

      {/* Transactions Table */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
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
                        <TableCell className="text-foreground">
                          {transaction.user_name || '-'}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {transaction.member_name || '---'}
                        </TableCell>
                        <TableCell className="text-foreground capitalize">
                          {transaction.payment_method || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isExpense ? 'text-destructive' : 'text-foreground'}`}>
                          {isExpense ? '- ' : ''}Rp {Math.abs(Number(transaction.total || 0)).toLocaleString('id-ID')}
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
              <p className="text-muted-foreground">Tidak ada transaksi untuk periode yang dipilih</p>
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
    </div>
  );
}
