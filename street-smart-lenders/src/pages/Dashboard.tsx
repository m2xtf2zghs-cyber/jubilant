import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Banknote, TrendingUp, CreditCard, AlertTriangle,
  Users, FileText, IndianRupee, Percent,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINRShort, formatINR, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DPDBadge } from '@/components/common/DPDBadge';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type Lead, type Loan } from '@/types';
import { calcDPD } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────
interface KPIs {
  totalAUM: number;
  disbursedThisMonth: number;
  collectionsThisMonth: number;
  overdueAmount: number;
  npaCount: number;
  activeLoans: number;
  newLeads: number;
  collectionEfficiency: number;
}

interface MonthlyData {
  month: string;
  disbursed: number;
  collected: number;
  overdue: number;
}

interface DPDData {
  name: string;
  value: number;
  color: string;
}

const DPD_CHART_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#991b1b'];

// Custom tooltip for Recharts showing ₹ amounts
function INRTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatINRShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dpdData, setDpdData] = useState<DPDData[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<(Loan & { dpd: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    // Realtime subscription for live updates
    const paymentsChannel = supabase
      .channel('dashboard-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadDashboard())
      .subscribe();
    return () => { supabase.removeChannel(paymentsChannel); };
  }, []);

  async function loadDashboard() {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [
        loansRes,
        paymentsMonthRes,
        leadsRes,
        scheduleOverdueRes,
        recentLeadsRes,
      ] = await Promise.all([
        supabase.from('loans').select('id,principal_amount,status,disbursement_date,disbursement_amount'),
        supabase.from('payments').select('amount,status,payment_date').gte('payment_date', monthStart),
        supabase.from('leads').select('id,status,created_at').gte('created_at', monthStart),
        supabase.from('repayment_schedule').select('total_emi,due_date,status,loan_id').eq('status', 'NOT_PAID').lt('due_date', now.toISOString().split('T')[0]),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const loans = loansRes.data || [];
      const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
      const npaLoans = loans.filter((l) => l.status === 'NPA');
      const totalAUM = activeLoans.reduce((s, l) => s + (l.principal_amount || 0), 0);
      const disbursedThisMonth = (paymentsMonthRes.data || [])
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s + p.amount, 0);
      const disbursedLoans = loans.filter((l) => l.disbursement_date && l.disbursement_date >= monthStart);
      const disbursedThisMonthAmount = disbursedLoans.reduce((s, l) => s + (l.disbursement_amount || l.principal_amount || 0), 0);

      const overdueSchedule = scheduleOverdueRes.data || [];
      const overdueAmount = overdueSchedule.reduce((s, r) => s + r.total_emi, 0);
      const totalDue = overdueAmount + disbursedThisMonth;
      const collectionEfficiency = totalDue > 0 ? Math.round((disbursedThisMonth / totalDue) * 100) : 0;

      setKpis({
        totalAUM,
        disbursedThisMonth: disbursedThisMonthAmount,
        collectionsThisMonth: disbursedThisMonth,
        overdueAmount,
        npaCount: npaLoans.length,
        activeLoans: activeLoans.length,
        newLeads: (leadsRes.data || []).length,
        collectionEfficiency,
      });

      // Monthly trend (last 6 months)
      const months: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStart = d.toISOString().split('T')[0];
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        const monthName = d.toLocaleString('default', { month: 'short' });

        const mLoans = loans.filter((l) => l.disbursement_date && l.disbursement_date >= mStart && l.disbursement_date <= mEnd);
        const mDisbursed = mLoans.reduce((s, l) => s + (l.disbursement_amount || l.principal_amount || 0), 0);
        months.push({ month: monthName, disbursed: mDisbursed, collected: 0, overdue: 0 });
      }
      setMonthlyData(months);

      // DPD distribution
      const dpdBuckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      overdueSchedule.forEach((r) => {
        const dpd = calcDPD(r.due_date);
        if (dpd === 0) dpdBuckets.current++;
        else if (dpd <= 30) dpdBuckets['1-30']++;
        else if (dpd <= 60) dpdBuckets['31-60']++;
        else if (dpd <= 90) dpdBuckets['61-90']++;
        else dpdBuckets['90+']++;
      });
      setDpdData([
        { name: 'Current', value: activeLoans.length - overdueSchedule.length, color: DPD_CHART_COLORS[0] },
        { name: '1-30d', value: dpdBuckets['1-30'], color: DPD_CHART_COLORS[1] },
        { name: '31-60d', value: dpdBuckets['31-60'], color: DPD_CHART_COLORS[2] },
        { name: '61-90d', value: dpdBuckets['61-90'], color: DPD_CHART_COLORS[3] },
        { name: '90d+', value: dpdBuckets['90+'], color: DPD_CHART_COLORS[4] },
      ].filter((d) => d.value > 0));

      setRecentLeads((recentLeadsRes.data || []) as Lead[]);

      // Overdue loans
      if (overdueSchedule.length > 0) {
        const uniqueLoanIds = [...new Set(overdueSchedule.slice(0, 5).map((r) => r.loan_id))];
        const { data: overdueLoansData } = await supabase
          .from('loans')
          .select('*, borrowers(name, mobile)')
          .in('id', uniqueLoanIds);
        if (overdueLoansData) {
          setOverdueLoans(
            overdueLoansData.map((l: any) => ({
              ...l,
              borrower_name: l.borrowers?.name,
              dpd: calcDPD(overdueSchedule.find((s) => s.loan_id === l.id)?.due_date || ''),
            }))
          );
        }
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total AUM"
          value={formatINRShort(kpis?.totalAUM || 0)}
          subtitle={`${kpis?.activeLoans || 0} active loans`}
          icon={Banknote}
          onClick={() => navigate('/loans')}
        />
        <StatCard
          title="Disbursed (MTD)"
          value={formatINRShort(kpis?.disbursedThisMonth || 0)}
          icon={TrendingUp}
          iconColor="bg-green-500"
          onClick={() => navigate('/loans')}
        />
        <StatCard
          title="Collections (MTD)"
          value={formatINRShort(kpis?.collectionsThisMonth || 0)}
          subtitle={`${kpis?.collectionEfficiency || 0}% efficiency`}
          icon={CreditCard}
          iconColor="bg-blue-500"
          onClick={() => navigate('/collections')}
        />
        <StatCard
          title="Overdue"
          value={formatINRShort(kpis?.overdueAmount || 0)}
          subtitle={`${kpis?.npaCount || 0} NPA accounts`}
          icon={AlertTriangle}
          iconColor="bg-red-500"
          onClick={() => navigate('/collections')}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active Loans" value={kpis?.activeLoans || 0} icon={IndianRupee} />
        <StatCard title="New Leads (MTD)" value={kpis?.newLeads || 0} icon={FileText} onClick={() => navigate('/leads')} />
        <StatCard title="Collection %" value={`${kpis?.collectionEfficiency || 0}%`} icon={Percent} />
        <StatCard title="NPA Count" value={kpis?.npaCount || 0} icon={AlertTriangle} iconColor={kpis?.npaCount ? 'bg-red-500' : undefined} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Disbursement trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Disbursement Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<INRTooltip />} />
                <Bar dataKey="disbursed" name="Disbursed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* DPD Pie */}
        <Card>
          <CardHeader>
            <CardTitle>DPD Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {dpdData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No overdue accounts
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dpdData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dpdData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Loans']} />
                  <Legend iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads + Overdue table */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Leads</CardTitle>
              <button onClick={() => navigate('/leads')} className="text-xs text-primary hover:underline">View all</button>
            </div>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No leads yet</p>
            ) : (
              recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.borrower_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.city} · {formatINRShort(lead.loan_amount)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[lead.status]}`}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Overdue loans */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overdue Accounts</CardTitle>
              <button onClick={() => navigate('/collections')} className="text-xs text-primary hover:underline">View all</button>
            </div>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {overdueLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No overdue accounts</p>
            ) : (
              overdueLoans.map((loan) => (
                <div
                  key={loan.id}
                  onClick={() => navigate(`/loans/${loan.id}`)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{loan.borrower_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{loan.loan_number} · {formatINRShort(loan.emi_amount)}</p>
                  </div>
                  <DPDBadge dpd={loan.dpd} showLabel={false} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
