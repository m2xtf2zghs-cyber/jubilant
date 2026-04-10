import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone, MessageCircle, Calendar, Edit, Trash2, Plus, ArrowRight,
  User, MapPin, IndianRupee, Clock, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR, formatDate, daysAgo } from '@/lib/utils';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type Lead } from '@/types';
import { LeadForm } from './LeadForm';
import { toast } from '@/hooks/useToast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CommLog {
  id: string;
  type: string;
  direction?: string;
  summary: string;
  outcome?: string;
  created_at: string;
  next_action?: string;
  next_action_date?: string;
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [commLogs, setCommLogs] = useState<CommLog[]>([]);
  const [logForm, setLogForm] = useState({ type: 'CALL', summary: '', outcome: '', next_action: '', next_action_date: '' });
  const [logLoading, setLogLoading] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [leadRes, logsRes] = await Promise.all([
      supabase.from('leads').select('*, dsas(name)').eq('id', id).single(),
      supabase.from('communication_log').select('*').eq('entity_type', 'LEAD').eq('entity_id', id).order('created_at', { ascending: false }),
    ]);
    if (leadRes.data) setLead({ ...leadRes.data, dsa_name: (leadRes.data as any).dsas?.name } as Lead);
    setCommLogs((logsRes.data || []) as CommLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(newStatus: string) {
    if (!lead) return;
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) { toast({ title: 'Error updating status', variant: 'destructive' }); return; }
    setLead({ ...lead, status: newStatus as any });
    toast({ title: 'Status updated', variant: 'success' });
  }

  async function addCommLog() {
    if (!logForm.summary.trim()) return;
    setLogLoading(true);
    const { error } = await supabase.from('communication_log').insert({
      entity_type: 'LEAD', entity_id: id,
      type: logForm.type, summary: logForm.summary,
      outcome: logForm.outcome, next_action: logForm.next_action,
      next_action_date: logForm.next_action_date || null,
      created_by: user?.id,
    });
    if (!error) {
      toast({ title: 'Note added', variant: 'success' });
      setLogForm({ type: 'CALL', summary: '', outcome: '', next_action: '', next_action_date: '' });
      setLogOpen(false);
      load();
    }
    setLogLoading(false);
  }

  async function convertToBorrower() {
    if (!lead) return;
    setConvertLoading(true);
    try {
      // Create borrower from lead
      const { data: borrower, error: bErr } = await supabase.from('borrowers').insert({
        name: lead.borrower_name,
        mobile: lead.mobile,
        pan: lead.pan_number,
        city: lead.city || '',
        state: '',
        address: lead.district || '',
        created_by: user?.id,
      }).select().single();
      if (bErr) throw bErr;

      // Link borrower to lead
      await supabase.from('leads').update({ borrower_id: borrower.id, status: 'DOCUMENTS_COLLECTED' }).eq('id', lead.id);
      toast({ title: 'Converted to borrower', variant: 'success' });
      navigate(`/borrowers/${borrower.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setConvertLoading(false);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  if (!lead) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Lead not found</p>
      <Button className="mt-4" onClick={() => navigate('/leads')}>Back to Leads</Button>
    </div>
  );

  const NEXT_STATUS: Partial<Record<string, string>> = {
    NEW: 'DOCUMENTS_COLLECTED',
    DOCUMENTS_COLLECTED: 'UNDER_REVIEW',
    UNDER_REVIEW: 'FIELD_VISIT',
    FIELD_VISIT: 'SANCTIONED',
    SANCTIONED: 'DISBURSED',
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={lead.borrower_name}
        subtitle={lead.mobile}
        back
        backTo="/leads"
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        }
      />

      {/* Status + quick actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${LEAD_STATUS_COLORS[lead.status]}`}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <div className="flex gap-2">
              <a href={`tel:${lead.mobile}`} className="inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md font-medium transition-colors">
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a href={`https://wa.me/91${lead.mobile}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          </div>

          {/* Progress through pipeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {['NEW', 'DOCUMENTS_COLLECTED', 'UNDER_REVIEW', 'FIELD_VISIT', 'SANCTIONED', 'DISBURSED'].map((s, i, arr) => (
              <div key={s} className="flex items-center shrink-0">
                <button
                  onClick={() => updateStatus(s)}
                  className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                    lead.status === s
                      ? 'bg-primary text-primary-foreground'
                      : s === NEXT_STATUS[lead.status]
                      ? 'bg-muted hover:bg-primary hover:text-primary-foreground border border-primary'
                      : 'text-muted-foreground bg-muted/50'
                  }`}
                >
                  {LEAD_STATUS_LABELS[s as import('@/types').LeadStatus]}
                </button>
                {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
              </div>
            ))}
          </div>

          {/* Convert button */}
          {!lead.borrower_id && (lead.status === 'DOCUMENTS_COLLECTED' || lead.status === 'UNDER_REVIEW') && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={convertToBorrower} loading={convertLoading}>
              <User className="h-4 w-4 mr-1" /> Convert to Borrower
            </Button>
          )}
          {lead.borrower_id && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate(`/borrowers/${lead.borrower_id}`)}>
              <User className="h-4 w-4 mr-1" /> View Borrower Profile
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="details">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">Notes ({commLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Row icon={IndianRupee} label="Loan Amount" value={formatINR(lead.loan_amount)} />
              <Row icon={Clock} label="Tenure" value={`${lead.tenure_months} months`} />
              <Row icon={FileText} label="Loan Type" value={lead.loan_type.replace('_', ' ')} />
              {lead.purpose && <Row icon={FileText} label="Purpose" value={lead.purpose} />}
              {lead.city && <Row icon={MapPin} label="Location" value={[lead.city, lead.district].filter(Boolean).join(', ')} />}
              {lead.pan_number && <Row icon={User} label="PAN" value={lead.pan_number} />}
              <Row icon={User} label="Source" value={lead.source_type} />
              {lead.dsa_name && <Row icon={User} label="DSA" value={lead.dsa_name} />}
              {lead.next_followup_date && (
                <Row icon={Calendar} label="Next Follow-up" value={formatDate(lead.next_followup_date)} />
              )}
              <Row icon={Calendar} label="Enquiry Date" value={formatDate(lead.created_at)} />
              {lead.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{lead.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Communication Log</CardTitle>
                <Button size="sm" onClick={() => setLogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {commLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {commLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-primary/30 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">{log.type}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-sm mt-0.5">{log.summary}</p>
                      {log.outcome && <p className="text-xs text-muted-foreground mt-0.5">Outcome: {log.outcome}</p>}
                      {log.next_action && <p className="text-xs text-primary mt-0.5">Next: {log.next_action}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit form */}
      {editOpen && (
        <LeadForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} lead={lead} />
      )}

      {/* Add note dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Communication Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={logForm.type} onValueChange={(v) => setLogForm({ ...logForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'NOTE', 'SMS'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Summary *</Label>
              <Textarea value={logForm.summary} onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })} placeholder="What was discussed?" rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Outcome</Label>
              <input className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={logForm.outcome} onChange={(e) => setLogForm({ ...logForm, outcome: e.target.value })} placeholder="Positive, needs follow-up…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Next Action</Label>
                <input className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={logForm.next_action} onChange={(e) => setLogForm({ ...logForm, next_action: e.target.value })} placeholder="Follow up, send docs…" />
              </div>
              <div className="space-y-1">
                <Label>Next Action Date</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={logForm.next_action_date} onChange={(e) => setLogForm({ ...logForm, next_action_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={addCommLog} loading={logLoading}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
