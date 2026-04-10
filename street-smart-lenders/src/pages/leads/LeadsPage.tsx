import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Search, ChevronDown, Phone, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRShort, formatDate, daysAgo } from '@/lib/utils';
import {
  type Lead, type LeadStatus,
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS,
} from '@/types';
import { LeadForm } from './LeadForm';
import { FileText } from 'lucide-react';

const ALL_STATUSES: LeadStatus[] = [
  'NEW', 'DOCUMENTS_COLLECTED', 'UNDER_REVIEW', 'FIELD_VISIT',
  'SANCTIONED', 'DISBURSED', 'REJECTED', 'ON_HOLD',
];

const STATUS_ORDER: Record<LeadStatus, number> = {
  NEW: 0, DOCUMENTS_COLLECTED: 1, UNDER_REVIEW: 2, FIELD_VISIT: 3,
  SANCTIONED: 4, DISBURSED: 5, ON_HOLD: 6, REJECTED: 7,
};

export function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('leads')
      .select('*, dsas(name)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'ALL') q = q.eq('status', statusFilter);
    if (search.trim()) {
      q = q.or(`borrower_name.ilike.%${search}%,mobile.ilike.%${search}%,pan_number.ilike.%${search}%`);
    }

    const { data } = await q.limit(100);
    setLeads(
      (data || []).map((l: any) => ({ ...l, dsa_name: l.dsas?.name })) as Lead[]
    );
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, loadLeads)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLeads]);

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} leads`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, PAN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status summary pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          All ({leads.length})
        </button>
        {ALL_STATUSES.filter((s) => statusCounts[s]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
            className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {LEAD_STATUS_LABELS[s]} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No leads found"
          description="Add your first lead to get started"
          action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" />New Lead</Button>}
        />
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} />
          ))}
        </div>
      )}

      {/* Add lead form */}
      {showForm && (
        <LeadForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadLeads(); }}
        />
      )}
    </div>
  );
}

// ── Lead Card ──────────────────────────────────────────────────
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const age = daysAgo(lead.created_at);
  const followupDue = lead.next_followup_date && daysAgo(lead.next_followup_date) > 0;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{lead.borrower_name}</span>
            {followupDue && (
              <span className="shrink-0 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                Follow-up due
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.mobile}
            </span>
            {lead.city && <span className="text-xs text-muted-foreground">{lead.city}</span>}
          </div>
        </div>
        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold ${LEAD_STATUS_COLORS[lead.status]}`}>
          {LEAD_STATUS_LABELS[lead.status]}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{formatINRShort(lead.loan_amount)}</span>
          <span className="text-xs text-muted-foreground">{lead.tenure_months}M</span>
          {lead.dsa_name && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{lead.dsa_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {age === 0 ? 'Today' : `${age}d ago`}
        </div>
      </div>

      {lead.purpose && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{lead.purpose}</p>
      )}
    </div>
  );
}
