import { useState, useEffect } from "react";
import { Users, ShoppingBag, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/contexts/StoreContext";

interface Member {
  id: string;
  name: string;
  member_code: string | null;
  phone: string | null;
  points: number | null;
  total_purchases: number | null;
}

interface SaleItem {
  id: string;
  quantity: number;
  unit_price: number;
  total: number;
  discount: number;
  product_snapshot: {
    product_name?: string;
    variant_name?: string;
  };
}

interface MemberTransaction {
  id: string;
  receipt_number: string | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  status: string | null;
  sale_items: SaleItem[];
}

export default function MemberTransactionReport() {
  const { currentStoreId } = useStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [transactions, setTransactions] = useState<MemberTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [currentStoreId]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchMemberTransactions();
    } else {
      setTransactions([]);
    }
  }, [selectedMemberId]);

  const fetchMembers = async () => {
    let query = supabase
      .from('members')
      .select('id, name, member_code, phone, points, total_purchases')
      .eq('status', 'active')
      .order('name');
    if (currentStoreId) query = query.eq('store_id', currentStoreId);
    const { data, error } = await query;

    if (!error && data) {
      setMembers(data);
    }
  };

  const fetchMemberTransactions = async () => {
    if (!selectedMemberId) return;

    setLoading(true);
    try {
      // First get sales with member info from payment_details
      let salesQuery = supabase
        .from('sales')
        .select(`
          id,
          receipt_number,
          total,
          created_at,
          payment_method,
          status,
          payment_details,
          sale_items (
            id,
            quantity,
            unit_price,
            total,
            discount,
            product_snapshot
          )
        `)
        .order('created_at', { ascending: false });
      if (currentStoreId) salesQuery = salesQuery.eq('store_id', currentStoreId);
      const { data: salesData, error } = await salesQuery;

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      // Filter transactions for the selected member
      const memberTransactions = salesData?.filter((sale) => {
        const paymentDetails = sale.payment_details as { member_id?: string } | null;
        return paymentDetails?.member_id === selectedMemberId;
      }).map(sale => ({
        id: sale.id,
        receipt_number: sale.receipt_number,
        total: sale.total,
        created_at: sale.created_at || '',
        payment_method: sale.payment_method,
        status: sale.status,
        sale_items: (sale.sale_items || []).map(item => ({
          ...item,
          product_snapshot: item.product_snapshot as SaleItem['product_snapshot']
        }))
      })) || [];

      setTransactions(memberTransactions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = members.find(m => m.id === selectedMemberId);

  const totalSpending = transactions.reduce((sum, t) => {
    if (t.status !== 'returned') {
      return sum + t.total;
    }
    return sum;
  }, 0);

  const toggleExpanded = (transactionId: string) => {
    setExpandedTransaction(prev => prev === transactionId ? null : transactionId);
  };

  return (
    <div className="space-y-6">
      {/* Member Selection */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Pilih Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Pilih member untuk melihat transaksi..." />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    {member.member_code && (
                      <span className="text-muted-foreground text-xs">({member.member_code})</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Member Info & Summary */}
      {selectedMember && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member</p>
                  <p className="font-semibold text-foreground">{selectedMember.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedMember.member_code}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Belanja</p>
                  <p className="font-semibold text-foreground">
                    Rp {totalSpending.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-muted-foreground">{transactions.length} transaksi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Poin</p>
                  <p className="font-semibold text-foreground">
                    {(selectedMember.points || 0).toLocaleString('id-ID')} pts
                  </p>
                  <p className="text-xs text-muted-foreground">Poin aktif</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      {selectedMemberId && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Riwayat Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Belum ada transaksi untuk member ini</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border border-border rounded-lg overflow-hidden">
                    {/* Transaction Header */}
                    <div 
                      className="flex items-center justify-between p-4 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => toggleExpanded(transaction.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {transaction.receipt_number || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(transaction.created_at), "d MMMM yyyy, HH:mm", { locale: localeId })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            Rp {transaction.total.toLocaleString('id-ID')}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={transaction.status === 'returned' ? 'destructive' : 'secondary'}>
                              {transaction.status === 'returned' ? 'Retur' : transaction.payment_method || 'Cash'}
                            </Badge>
                          </div>
                        </div>
                        {expandedTransaction === transaction.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Transaction Items */}
                    {expandedTransaction === transaction.id && (
                      <div className="p-4 border-t border-border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produk</TableHead>
                              <TableHead className="text-center">Qty</TableHead>
                              <TableHead className="text-right">Harga</TableHead>
                              <TableHead className="text-right">Diskon</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transaction.sale_items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {item.product_snapshot?.product_name || 'Unknown'}
                                    </p>
                                    {item.product_snapshot?.variant_name && (
                                      <p className="text-sm text-muted-foreground">
                                        {item.product_snapshot.variant_name}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  Rp {item.unit_price.toLocaleString('id-ID')}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.discount > 0 ? `Rp ${item.discount.toLocaleString('id-ID')}` : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  Rp {item.total.toLocaleString('id-ID')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
