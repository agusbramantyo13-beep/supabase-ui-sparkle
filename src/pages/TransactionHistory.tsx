import { useState, useEffect } from "react";
import { Receipt, Calendar, Undo2 } from "lucide-react";
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
  }, [days]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, 
          receipt_number, 
          total, 
          created_at, 
          payment_method,
          user_id,
          status,
          profiles:user_id(name, email)
        `)
        .eq('store_id', currentStoreId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const formattedData = data?.map(sale => ({
        id: sale.id,
        receipt_number: sale.receipt_number,
        total: sale.total,
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        user_name: sale.profiles?.name || sale.profiles?.email || 'Unknown',
        status: sale.status
      })) || [];

      if (error) throw error;
      setTransactions(formattedData);
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
          <p className="text-muted-foreground">Lihat transaksi terbaru</p>
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
              <p className="text-sm font-medium text-muted-foreground">Total Penjualan</p>
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
                    <TableHead className="text-muted-foreground">No. Struk</TableHead>
                    <TableHead className="text-muted-foreground">Kasir</TableHead>
                    <TableHead className="text-muted-foreground">Pembayaran</TableHead>
                    <TableHead className="text-right text-muted-foreground">Total</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow 
                      key={transaction.id} 
                      className={`border-border/50 ${transaction.status === 'returned' ? 'opacity-60' : ''}`}
                    >
                      <TableCell className="font-medium text-foreground">
                        {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {transaction.receipt_number || '-'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {transaction.user_name || '-'}
                      </TableCell>
                      <TableCell className="text-foreground capitalize">
                        {transaction.payment_method || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        Rp {Number(transaction.total || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        {transaction.status === 'returned' ? (
                          <Badge variant="destructive">Diretur</Badge>
                        ) : (
                          <Badge variant="default">Selesai</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.status !== 'returned' && (
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
                  ))}
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

      {selectedTransaction && (
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
