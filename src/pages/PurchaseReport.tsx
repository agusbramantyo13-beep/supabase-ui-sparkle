import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Undo2 } from "lucide-react";
import { format } from "date-fns";
import PurchaseReturnDialog from "@/components/PurchaseReturnDialog";

interface PurchaseSession {
  id: string;
  supplier: string;
  purchase_date: string;
  notes: string | null;
  total_items: number;
  total_cost: number;
  created_at: string;
  created_by: string | null;
  creator_name?: string | null;
  status?: string | null;
}

interface PurchaseItem {
  id: string;
  variant_id: number | null;
  product_snapshot: any;
  quantity: number;
  cost_price: number;
  selling_price: number;
  total_cost: number;
  variants?: {
    name: string;
    products?: {
      name: string;
    };
  };
}

export default function PurchaseReport() {
  const [sessions, setSessions] = useState<PurchaseSession[]>([]);
  const [sessionItems, setSessionItems] = useState<Record<string, PurchaseItem[]>>({});
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PurchaseSession | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('purchase_sessions')
      .select('*')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (sessionsError) {
      toast({
        title: "Error",
        description: "Gagal memuat data pembelian",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Fetch creator names
    const creatorIds = [...new Set(sessionsData?.map(s => s.created_by).filter(Boolean))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', creatorIds);

    const profileMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

    const enrichedSessions = sessionsData?.map(session => ({
      ...session,
      creator_name: session.created_by ? profileMap.get(session.created_by) : null
    })) || [];

    setSessions(enrichedSessions);
    setLoading(false);
  };

  const fetchSessionItems = async (sessionId: string) => {
    if (sessionItems[sessionId]) return;

    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        *,
        variants(
          name,
          products(name)
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Gagal memuat detail item",
        variant: "destructive"
      });
      return;
    }

    setSessionItems(prev => ({
      ...prev,
      [sessionId]: data || []
    }));
  };

  const toggleSession = async (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
      await fetchSessionItems(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const handleReturnClick = (session: PurchaseSession) => {
    setSelectedSession(session);
    setReturnDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Laporan Pembelian Stok</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Memuat data...</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground">Belum ada data pembelian</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <Collapsible
                  key={session.id}
                  open={expandedSessions.has(session.id)}
                  onOpenChange={() => toggleSession(session.id)}
                >
                  <Card className={session.status === 'returned' ? 'opacity-60' : ''}>
                    <CollapsibleTrigger className="w-full">
                      <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-left flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {format(new Date(session.purchase_date), 'dd MMM yyyy')}
                              </p>
                              {session.status === 'returned' && (
                                <Badge variant="destructive">Diretur</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Supplier: {session.supplier}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Input oleh: {session.creator_name || 'Unknown'}
                            </p>
                            {session.notes && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Catatan: {session.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Item</p>
                            <p className="text-lg font-bold">{session.total_items}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Modal</p>
                            <p className="text-lg font-bold text-primary">
                              Rp {session.total_cost.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        {expandedSessions.has(session.id) ? (
                          <ChevronUp className="h-5 w-5 ml-4" />
                        ) : (
                          <ChevronDown className="h-5 w-5 ml-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t p-4">
                        {!sessionItems[session.id] ? (
                          <p className="text-muted-foreground">Memuat detail...</p>
                        ) : sessionItems[session.id].length === 0 ? (
                          <p className="text-muted-foreground">Tidak ada item</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produk</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead className="text-right">Harga Beli</TableHead>
                                <TableHead className="text-right">Harga Jual</TableHead>
                                <TableHead className="text-right">Total Modal</TableHead>
                                <TableHead className="text-right">Potensi Laba</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sessionItems[session.id].map((item) => {
                                const potentialProfit = (item.selling_price - item.cost_price) * item.quantity;
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">
                                          {item.variants?.products?.name || item.product_snapshot?.name || 'Unknown'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          {item.variants?.name || ''}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                      Rp {item.cost_price.toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      Rp {item.selling_price.toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      Rp {item.total_cost.toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${potentialProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {potentialProfit >= 0 ? '+' : ''}
                                      Rp {potentialProfit.toLocaleString('id-ID')}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                        
                        {session.status !== 'returned' && (
                          <div className="mt-4 pt-4 border-t flex justify-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReturnClick(session);
                              }}
                            >
                              <Undo2 className="h-4 w-4 mr-2" />
                              Retur Pembelian
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSession && (
        <PurchaseReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          sessionId={selectedSession.id}
          sessionInfo={{
            supplier: selectedSession.supplier,
            purchase_date: format(new Date(selectedSession.purchase_date), 'dd MMM yyyy'),
            total_cost: selectedSession.total_cost,
            total_items: selectedSession.total_items,
          }}
          onSuccess={fetchSessions}
        />
      )}
    </div>
  );
}
