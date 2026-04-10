import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MessageCircle, Check, X, Clock, AlertCircle, ChevronRight,
  Calendar, Filter, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DPDBadge } from '@/components/common/DPDBadge';
import { StatCard } from '@/components/common/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRShort, formatINR, formatDate, calcDPD, today } from '@/lib/utils';
import type { Payment, RepaymentScheduleItem } from '@/types';
import { cn } from '@/lib/utils';

interface DueItem {
  schedule_id: string;
  loan_id: string;
  loan_number: string;
  instalment_no: number;
  due_date: string;
  total_emi: number;
  status: string;
  borrower_name: string;
  borrower_mobile: string;
  dpd: number;
  ptp_date?: string;
}

type MarkStatus = 'PAID' | 'PARTIAL' | 'NOT_PAID' | 'PTP' | 'DISPUTE';

export function CollectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'today' | 'overdue' | 'ptp'>('today');
  const [markItem, setMarkItem] = useState<DueItem | null>(null);
  const [markForm, setMarkForm] = useState({
    status: 'PAID' as MarkStatus,
    amount: '',
    mode: 'CASH',
    reference: '',
    ptp_date: '',
    notes: '',
  });
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const todayStr = today();

    let dateFilter: string;
    if (tab === 'today') dateFilter = todayStr;
    else if (tab === 'ptp') dateFilter = todayStr;

    // Get due instalments
    let q = supabase
      .from('repayment_schedule')
      .select('id, loan_id, instalment_no, due_date, total_emi, status, ptp_date')
      .neq('status', 'PAID');

    if (tab === 'today') {
      q = q.eq('due_date', todayStr);
    } else if (tab === 'overdue') {
      q = q.lt('due_date', todayStr).neq('status', 'PTP');
    } else if (tab === 'ptp') {
      q = q.eq('status', 'PTP').lte('ptp_date', todayStr);
    }

    const { data: scheduleRows } = await q.order('due_date').limit(100);

    if (!scheduleRows || scheduleRows.length === 0) {
      setDueItems([]);
      setLoading(false);
      return;
    }

    // Get loan + borrower info
    const loanIds = [...new Set(scheduleRows.map((r: any) => r.loan_id))];
    const { data: loansData } = await supabase
      .from('loans')
      .select('id, loan_number, borrowers(name, mobile)')
      .in('id', loanIds);

    const loanMap: Record<string, any> = {};
    (loansData || []).forEach((l: any) => { loanMap[l.id] = l; });

    setDueItems(
      scheduleRows.map((r: any) => {
        const loan = loanMap[r.loan_id] || {};
        return {
          schedule_id: r.id,
          loan_id: r.loan_id,
          loan_number: loan.loan_number || '—',
          instalment_no: r.instalment_no,
          due_date: r.due_date,
          total_emi: r.total_emi,
          status: r.status,
          borrower_name: loan.borrowers?.name || '—',
          borrower_mobile: loan.borrowers?.mobile || '—',
          dpd: calcDPD(r.due_date),
          ptp_date: r.ptp_date,
        };
      })
    );
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function openMark(item: DueItem) {
    setMarkItem(item);
    setMarkForm({
      status: 'PAID',
      amount: String(item.total_emi),
      mode: 'CASH',
      reference: '',
      ptp_date: '',
      notes: '',
    });
  }

  async function submitMark() {
    if (!markItem || !user) return;
    setMarking(true);
    try {
      const paymentDate = today();
      const amount = Number(markForm.amount);

      // Insert payment record
      await supabase.from('payments').insert({
        loan_id: markItem.loan_id,
        schedule_id: markItem.schedule_id,
        instalment_no: markItem.instalment_no,
        payment_date: markForm.status === 'PAID' || markForm.status === 'PARTIAL' ? paymentDate : paymentDate,
        amount: markForm.status === 'NOT_PAID' ? 0 : amount,
        mode: markForm.mode,
        reference: markForm.reference || null,
        status: markForm.status,
        ptp_date: markForm.status === 'PTP' ? markForm.ptp_date : null,
        notes: markForm.notes || null,
        recorded_by: user.id,
      });

      // Update schedule status
      await supabase.from('repayment_schedule').update({
        status: markForm.status,
        paid_date: markForm.status === 'PAID' ? paymentDate : null,
        paid_amount: markForm.status === 'PAID' ? amount : markForm.status === 'PARTIAL' ? amount : null,
        ptp_date: markForm.status === 'PTP' ? markForm.ptp_date : null,
      }).eq('id', markItem.schedule_id);

      toast({ title: `Marked as ${markForm.status}`, variant: 'success' });
      setMarkItem(null);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setMarking(false);
    }
  }

  // Summary stats
  const totalDue = dueItems.reduce((s, i) => s + i.total_emi, 0);
  const overdueCount = dueItems.filter((i) => i.dpd > 0).length;
  const ptpCount = dueItems.filter((i) => i.status === 'PTP').length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Collections</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Total Due" value={formatINRShort(totalDue)} icon={TrendingUp} />
        <StatCard title="Overdue" value={overdueCount} icon={AlertCircle} />
        <StatCard title="PTP" value={ptpCount} icon={Clock} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">Today's Dues</TabsTrigger>
          <TabsTrigger value="overdue" className="flex-1">Overdue</TabsTrigger>
          <TabsTrigger value="ptp" className="flex-1">PTP</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : dueItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {tab === 'today' ? 'All clear for today!' : tab === 'overdue' ? 'No overdue accounts' : 'No PTP follow-ups'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dueItems.map((item) => (
                <DueCard key={item.schedule_id} item={item} onMark={openMark} onNavigate={() => navigate(`/loans/${item.loan_id}`)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mark payment dialog */}
      <Dialog open={!!markItem} onOpenChange={() => setMarkItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          {markItem && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-semibold">{markItem.borrower_name}</p>
                <p className="text-muted-foreground">{markItem.loan_number} · Instalment #{markItem.instalment_no}</p>
                <p className="text-muted-foreground">Due: {formatDate(markItem.due_date)} · {formatINR(markItem.total_emi)}</p>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['PAID', 'PARTIAL', 'NOT_PAID', 'PTP', 'DISPUTE'] as MarkStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMarkForm({ ...markForm, status: s })}
                      className={cn(
                        'text-xs py-1.5 rounded-md font-medium border transition-colors',
                        markForm.status === s
                          ? s === 'PAID' ? 'bg-green-600 text-white border-green-600'
                          : s === 'PARTIAL' ? 'bg-yellow-500 text-white border-yellow-500'
                          : s === 'NOT_PAID' ? 'bg-red-500 text-white border-red-500'
                          : s === 'PTP' ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-orange-500 text-white border-orange-500'
                          : 'border-border text-muted-foreground hover:border-foreground'
                      )}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {(markForm.status === 'PAID' || markForm.status === 'PARTIAL') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Amount (₹)</Label>
                      <Input
                        type="number"
                        value={markForm.amount}
                        onChange={(e) => setMarkForm({ ...markForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mode</Label>
                      <Select value={markForm.mode} onValueChange={(v) => setMarkForm({ ...markForm, mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['CASH', 'UPI', 'NEFT', 'NACH', 'PDC'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reference / UTR</Label>
                    <Input value={markForm.reference} onChange={(e) => setMarkForm({ ...markForm, reference: e.target.value })} placeholder="UPI ref, cheque no…" />
                  </div>
                </>
              )}

              {markForm.status === 'PTP' && (
                <div className="space-y-1">
                  <Label>Promise to Pay Date *</Label>
                  <Input type="date" value={markForm.ptp_date} onChange={(e) => setMarkForm({ ...markForm, ptp_date: e.target.value })} min={today()} />
                </div>
              )}

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={markForm.notes} onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })} placeholder="Any remarks…" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkItem(null)}>Cancel</Button>
            <Button
              onClick={submitMark}
              loading={marking}
              className={cn(
                markForm.status === 'PAID' ? 'bg-green-600 hover:bg-green-700' :
                markForm.status === 'PARTIAL' ? 'bg-yellow-500 hover:bg-yellow-600' :
                markForm.status === 'NOT_PAID' ? 'bg-red-500 hover:bg-red-600' :
                ''
              )}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Due Card ──────────────────────────────────────────────────
function DueCard({ item, onMark, onNavigate }: { item: DueItem; onMark: (i: DueItem) => void; onNavigate: () => void }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1" onClick={onNavigate}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{item.borrower_name}</span>
            {item.dpd > 0 && <DPDBadge dpd={item.dpd} showLabel={false} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.loan_number} · Instalment #{item.instalment_no}
          </p>
          <p className="text-xs text-muted-foreground">Due: {formatDate(item.due_date)}</p>
          {item.status === 'PTP' && item.ptp_date && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">PTP: {formatDate(item.ptp_date)}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold">{formatINRShort(item.total_emi)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <a href={`tel:${item.borrower_mobile}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted px-2 py-1.5 rounded-md">
          <Phone className="h-3.5 w-3.5" /> {item.borrower_mobile}
        </a>
        <a href={`https://wa.me/91${item.borrower_mobile}?text=Dear%20${encodeURIComponent(item.borrower_name)}%2C%20your%20EMI%20of%20%E2%82%B9${item.total_emi}%20is%20due.%20Please%20arrange%20payment.`} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-white bg-green-600 px-2 py-1.5 rounded-md hover:bg-green-700">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
        <Button size="sm" className="ml-auto h-8 text-xs" onClick={() => onMark(item)}>
          Mark Payment
        </Button>
      </div>
    </div>
  );
}
