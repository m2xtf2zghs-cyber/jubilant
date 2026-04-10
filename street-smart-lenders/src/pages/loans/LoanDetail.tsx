import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Banknote, Calendar, User, TrendingDown, CheckCircle, XCircle,
  Clock, Phone, FileText, CreditCard, Edit,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/common/PageHeader';
import { DPDBadge } from '@/components/common/DPDBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR, formatINRShort, formatDate, calcDPD } from '@/lib/utils';
import type { Loan, RepaymentScheduleItem, Payment, Borrower } from '@/types';
import { cn } from '@/lib/utils';

interface LoanWithBorrower extends Loan {
  borrowers?: Borrower;
  dsa_name?: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PAID: <CheckCircle className="h-4 w-4 text-green-600" />,
  PARTIAL: <Clock className="h-4 w-4 text-yellow-600" />,
  NOT_PAID: <XCircle className="h-4 w-4 text-muted-foreground" />,
  PTP: <Clock className="h-4 w-4 text-blue-600" />,
  DISPUTE: <XCircle className="h-4 w-4 text-red-600" />,
};

export function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<LoanWithBorrower | null>(null);
  const [schedule, setSchedule] = useState<RepaymentScheduleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [lRes, sRes, pRes] = await Promise.all([
      supabase.from('loans').select('*, borrowers(name,mobile,pan,business_name), dsas(name)').eq('id', id).single(),
      supabase.from('repayment_schedule').select('*').eq('loan_id', id).order('instalment_no'),
      supabase.from('payments').select('*').eq('loan_id', id).order('created_at', { ascending: false }),
    ]);
    if (lRes.data) setLoan({ ...lRes.data, dsa_name: (lRes.data as any).dsas?.name } as LoanWithBorrower);
    setSchedule((sRes.data || []) as RepaymentScheduleItem[]);
    setPayments((pRes.data || []) as Payment[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  if (!loan) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Loan not found</p>
      <Button className="mt-4" onClick={() => navigate('/loans')}>Back</Button>
    </div>
  );

  const paidCount = schedule.filter((s) => s.status === 'PAID').length;
  const overdueRows = schedule.filter((s) => s.status !== 'PAID' && new Date(s.due_date) < new Date());
  const maxDPD = overdueRows.length > 0 ? Math.max(...overdueRows.map((r) => calcDPD(r.due_date))) : 0;
  const outstandingPrincipal = schedule.filter((s) => s.status !== 'PAID').reduce((sum, s) => sum + s.principal, 0);
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  const borrower = loan.borrowers as Borrower | undefined;

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={loan.loan_number}
        subtitle={borrower?.name}
        back
        backTo="/loans"
      />

      {/* Loan summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="text-xl font-bold">{formatINRShort(loan.principal_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold">{formatINRShort(outstandingPrincipal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EMI / Month</p>
              <p className="text-base font-semibold">{formatINRShort(loan.emi_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">DPD</p>
              {maxDPD > 0 ? <DPDBadge dpd={maxDPD} /> : <span className="text-sm font-semibold text-green-600">Current</span>}
            </div>
          </div>

          <Separator className="my-3" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{paidCount} of {schedule.length} instalments paid</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full ${
              loan.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              loan.status === 'NPA' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {loan.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${schedule.length > 0 ? (paidCount / schedule.length) * 100 : 0}%` }}
            />
          </div>

          <div className="mt-3 flex gap-2">
            {borrower && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/borrowers/${loan.borrower_id}`)}>
                <User className="h-4 w-4 mr-1" /> Borrower
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={() => navigate(`/collections?loan=${id}`)}>
              <CreditCard className="h-4 w-4 mr-1" /> Collections
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="schedule">
        <TabsList className="w-full">
          <TabsTrigger value="schedule" className="flex-1">Schedule</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
        </TabsList>

        {/* Repayment Schedule */}
        <TabsContent value="schedule">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">EMI</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((row) => {
                      const dpd = row.status !== 'PAID' ? calcDPD(row.due_date) : 0;
                      const isOverdue = row.status !== 'PAID' && new Date(row.due_date) < new Date();
                      return (
                        <TableRow key={row.id} className={cn(isOverdue && 'bg-red-50/30 dark:bg-red-900/5')}>
                          <TableCell className="text-xs text-muted-foreground">{row.instalment_no}</TableCell>
                          <TableCell className="text-xs">{formatDate(row.due_date)}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{formatINRShort(row.total_emi)}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{formatINRShort(row.outstanding_balance)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {STATUS_ICON[row.status]}
                              {dpd > 0 && <DPDBadge dpd={dpd} showLabel={false} />}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment History</CardTitle>
                <span className="text-sm font-semibold">Total: {formatINRShort(totalPaid)}</span>
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No payments recorded</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[p.status]}
                        <div>
                          <p className="text-sm font-medium">{formatDate(p.payment_date)}</p>
                          <p className="text-xs text-muted-foreground">{p.mode} {p.reference ? `· ${p.reference}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatINRShort(p.amount)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.status.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan details */}
        <TabsContent value="details">
          <Card>
            <CardContent className="p-4 space-y-2">
              <InfoRow label="Loan Type" value={loan.loan_type.replace('_', ' ')} />
              <InfoRow label="Interest Rate" value={`${loan.interest_rate}% flat/month (${(loan.interest_rate * 12).toFixed(1)}% per annum)`} />
              <InfoRow label="Tenure" value={`${loan.tenure_months} months`} />
              <InfoRow label="Processing Fee" value={`${loan.processing_fee_pct}% = ${formatINR(loan.processing_fee_amount || 0)}`} />
              <InfoRow label="Repayment Mode" value={loan.repayment_mode} />
              <InfoRow label="Total Payable" value={formatINR(loan.total_amount_payable)} />
              {loan.dsa_name && <InfoRow label="DSA" value={loan.dsa_name} />}
              <Separator />
              {loan.disbursement_date && <InfoRow label="Disbursed On" value={formatDate(loan.disbursement_date)} />}
              {loan.disbursement_mode && <InfoRow label="Disbursement Mode" value={loan.disbursement_mode} />}
              {loan.disbursement_utr && <InfoRow label="UTR / Reference" value={loan.disbursement_utr} />}
              {loan.disbursement_bank && <InfoRow label="Beneficiary Bank" value={loan.disbursement_bank} />}
              {loan.disbursement_account && <InfoRow label="Account No." value={loan.disbursement_account} />}
              {loan.collateral_type && (
                <>
                  <Separator />
                  <InfoRow label="Collateral" value={loan.collateral_type} />
                  {loan.collateral_value && <InfoRow label="Collateral Value" value={formatINR(loan.collateral_value)} />}
                  {loan.property_address && <InfoRow label="Property Address" value={loan.property_address} />}
                </>
              )}
              {loan.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{loan.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
