import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface AdjustmentSession {
  id: string;
  created_at: string;
  created_by: string | null;
  note: string | null;
  total_value_difference: number;
  status: string | null;
  creator_name?: string | null;
}

interface AdjustmentItem {
  id: string;
  variant_id: number;
  old_quantity: number;
  new_quantity: number;
  quantity_difference: number;
  unit_value: number;
  total_value_difference: number;
  variants?: {
    name: string;
    products?: {
      name: string;
    };
  };
}

export default function StockAdjustmentReport() {
  const [sessions, setSessions] = useState<AdjustmentSession[]>([]);
  const [sessionItems, setSessionItems] = useState<Record<string, AdjustmentItem[]>>({});
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('stock_adjustment_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessionsError) {
      toast({
        title: "Error",
        description: "Gagal memuat data sesi penyesuaian",
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
      .from('stock_adjustment_items')
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Laporan Audit Penyesuaian Stok</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Memuat data...</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground">Belum ada data penyesuaian stok</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <Collapsible
                  key={session.id}
                  open={expandedSessions.has(session.id)}
                  onOpenChange={() => toggleSession(session.id)}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-left flex-1">
                            <p className="font-semibold">
                              {format(new Date(session.created_at), 'dd MMM yyyy HH:mm')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Oleh: {session.creator_name || 'Unknown'}
                            </p>
                            {session.note && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Catatan: {session.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                              {session.status || 'draft'}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${session.total_value_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {session.total_value_difference >= 0 ? '+' : ''}
                              Rp {session.total_value_difference.toLocaleString('id-ID')}
                            </p>
                            <p className="text-xs text-muted-foreground">Selisih Nilai</p>
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
                                <TableHead className="text-right">Stok Lama</TableHead>
                                <TableHead className="text-right">Stok Baru</TableHead>
                                <TableHead className="text-right">Selisih Qty</TableHead>
                                <TableHead className="text-right">Nilai Satuan</TableHead>
                                <TableHead className="text-right">Selisih Nilai</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sessionItems[session.id].map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.variants?.products?.name || 'Unknown'}</p>
                                      <p className="text-sm text-muted-foreground">{item.variants?.name || 'Unknown'}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{item.old_quantity.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{item.new_quantity.toFixed(2)}</TableCell>
                                  <TableCell className={`text-right font-semibold ${item.quantity_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.quantity_difference >= 0 ? '+' : ''}{item.quantity_difference.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    Rp {item.unit_value.toLocaleString('id-ID')}
                                  </TableCell>
                                  <TableCell className={`text-right font-bold ${item.total_value_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.total_value_difference >= 0 ? '+' : ''}
                                    Rp {item.total_value_difference.toLocaleString('id-ID')}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
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
    </div>
  );
}
