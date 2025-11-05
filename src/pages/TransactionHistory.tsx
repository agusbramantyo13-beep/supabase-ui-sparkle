import { useState, useEffect } from "react";
import { Receipt, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Transaction {
  id: string;
  receipt_number: string | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  user_name: string | null;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("7");

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
          profiles:user_id(name, email)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const formattedData = data?.map(sale => ({
        id: sale.id,
        receipt_number: sale.receipt_number,
        total: sale.total,
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        user_name: sale.profiles?.name || sale.profiles?.email || 'Unknown'
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
    return transactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Transaction History</h1>
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
          <h1 className="text-3xl font-bold text-foreground">Transaction History</h1>
          <p className="text-muted-foreground">View recent transactions</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="2">2 days</SelectItem>
            <SelectItem value="3">3 days</SelectItem>
            <SelectItem value="4">4 days</SelectItem>
            <SelectItem value="5">5 days</SelectItem>
            <SelectItem value="6">6 days</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold text-foreground">
                Rp {getTotalAmount().toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
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
            Transaction List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-muted-foreground">Date & Time</TableHead>
                    <TableHead className="text-muted-foreground">Receipt Number</TableHead>
                    <TableHead className="text-muted-foreground">Kasir</TableHead>
                    <TableHead className="text-muted-foreground">Payment Method</TableHead>
                    <TableHead className="text-right text-muted-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="border-border/50">
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
                        Rp {Number(transaction.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions found for selected period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
