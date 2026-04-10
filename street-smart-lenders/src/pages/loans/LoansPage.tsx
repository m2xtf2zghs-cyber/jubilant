import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { DPDBadge } from '@/components/common/DPDBadge';
import { formatINRShort, formatDate, calcDPD } from '@/lib/utils';
import type { Loan, LoanStatus } from '@/types';
import { Banknote } from 'lucide-react';

interface LoanWithBorrower extends Loan {
  borrower_name: string;
  borrower_mobile: string;
  dpd: number;
}

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'SANCTIONED', 'CLOSED', 'NPA', 'WRITTEN_OFF'];

export function LoansPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('loans')
      .select('*, borrowers(name, mobile)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'ALL') q = q.eq('status', statusFilter);
    if (search.trim()) {
      q = q.or(`loan_number.ilike.%${search}%`);
    }

    const { data } = await q.limit(100);

    // Get overdue info
    const loanIds = (data || []).map((l: any) => l.id);
    const overdueMap: Record<string, string> = {};
    if (loanIds.length > 0) {
      const { data: overdueRows } = await supabase
        .from('repayment_schedule')
        .select('loan_id, due_date')
        .in('loan_id', loanIds)
        .eq('status', 'NOT_PAID')
        .lt('due_date', new Date().toISOString().split('T')[0])
        .order('due_date')
        .limit(200);

      (overdueRows || []).forEach((r: any) => {
        if (!overdueMap[r.loan_id]) overdueMap[r.loan_id] = r.due_date;
      });
    }

    setLoans(
      (data || []).map((l: any) => ({
        ...l,
        borrower_name: l.borrowers?.name || '—',
        borrower_mobile: l.borrowers?.mobile || '—',
        dpd: overdueMap[l.id] ? calcDPD(overdueMap[l.id]) : 0,
      }))
    );
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalAUM = loans.filter((l) => l.status === 'ACTIVE').reduce((s, l) => s + l.principal_amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loans"
        subtitle={`${loans.length} loans · AUM ${formatINRShort(totalAUM)}`}
        actions={
          <Button size="sm" onClick={() => navigate('/loans/new')}>
            <Plus className="h-4 w-4" />
            New Loan
          </Button>
        }
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loan #…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No loans found"
          action={<Button size="sm" onClick={() => navigate('/loans/new')}><Plus className="h-4 w-4 mr-1" />Create Loan</Button>}
        />
      ) : (
        <div className="space-y-2">
          {loans.map((loan) => (
            <div
              key={loan.id}
              onClick={() => navigate(`/loans/${loan.id}`)}
              className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono">{loan.loan_number}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      loan.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      loan.status === 'NPA' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      loan.status === 'CLOSED' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {loan.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-0.5">{loan.borrower_name}</p>
                  <p className="text-xs text-muted-foreground">{loan.borrower_mobile}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatINRShort(loan.principal_amount)}</p>
                  <p className="text-xs text-muted-foreground">{loan.interest_rate}% · {loan.tenure_months}M</p>
                  {loan.dpd > 0 && <DPDBadge dpd={loan.dpd} showLabel={false} className="mt-1" />}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span>EMI {formatINRShort(loan.emi_amount)}/mo</span>
                {loan.disbursement_date && <span>Disbursed {formatDate(loan.disbursement_date)}</span>}
                <span>{loan.repayment_mode}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
