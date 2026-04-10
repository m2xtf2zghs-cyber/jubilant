import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calculator, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatINR, formatINRShort, formatDate, generateRepaymentSchedule, calculateEMI } from '@/lib/utils';
import type { ScheduleRow } from '@/lib/utils';
import type { Borrower, DSA } from '@/types';

const schema = z.object({
  borrower_id: z.string().min(1, 'Select a borrower'),
  dsa_id: z.string().optional(),
  loan_type: z.enum(['LAP', 'BUSINESS_LOAN', 'PERSONAL_LOAN', 'MSME', 'OTHER']),
  principal_amount: z.coerce.number().min(1000),
  interest_rate: z.coerce.number().min(0.1).max(10),
  tenure_months: z.coerce.number().min(1).max(360),
  repayment_frequency: z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY']),
  repayment_mode: z.enum(['PDC', 'NACH', 'CASH', 'UPI', 'NEFT']),
  processing_fee_pct: z.coerce.number().min(0).max(10),
  disbursement_date: z.string().optional(),
  disbursement_mode: z.enum(['CHEQUE', 'NEFT', 'RTGS', 'CASH', 'UPI']).optional(),
  disbursement_utr: z.string().optional(),
  disbursement_amount: z.coerce.number().optional(),
  disbursement_bank: z.string().optional(),
  disbursement_account: z.string().optional(),
  collateral_type: z.string().optional(),
  collateral_value: z.coerce.number().optional(),
  property_address: z.string().optional(),
  pre_emi_months: z.coerce.number().min(0).max(12),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LoanForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [dsas, setDsas] = useState<DSA[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      borrower_id: params.get('borrower') || '',
      loan_type: 'BUSINESS_LOAN',
      interest_rate: 2.5,
      tenure_months: 12,
      repayment_frequency: 'MONTHLY',
      repayment_mode: 'NACH',
      processing_fee_pct: 2,
      pre_emi_months: 0,
    },
  });

  const principal = watch('principal_amount');
  const rate = watch('interest_rate');
  const tenure = watch('tenure_months');
  const preEMI = watch('pre_emi_months');

  const emi = (principal && rate && tenure) ? calculateEMI(principal, rate, tenure) : 0;
  const totalPayable = emi * (tenure || 0);
  const processingFee = (principal && watch('processing_fee_pct')) ? Math.round(principal * watch('processing_fee_pct') / 100) : 0;

  useEffect(() => {
    Promise.all([
      supabase.from('borrowers').select('id,name,mobile').order('name').limit(200),
      supabase.from('dsas').select('id,name').eq('status', 'ACTIVE').order('name'),
    ]).then(([bRes, dRes]) => {
      setBorrowers((bRes.data || []) as Borrower[]);
      setDsas((dRes.data || []) as DSA[]);
    });
  }, []);

  function calcSchedule() {
    if (!principal || !rate || !tenure) return;
    const startDate = watch('disbursement_date') || new Date().toISOString().split('T')[0];
    const rows = generateRepaymentSchedule({
      principal, interest_rate_monthly: rate, tenure_months: tenure,
      start_date: startDate, pre_emi_months: preEMI || 0,
    });
    setSchedule(rows);
    setShowSchedule(true);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      // Calculate schedule
      const startDate = data.disbursement_date || new Date().toISOString().split('T')[0];
      const scheduleRows = generateRepaymentSchedule({
        principal: data.principal_amount,
        interest_rate_monthly: data.interest_rate,
        tenure_months: data.tenure_months,
        start_date: startDate,
        pre_emi_months: data.pre_emi_months || 0,
      });

      const emiAmt = calculateEMI(data.principal_amount, data.interest_rate, data.tenure_months);
      const totalAmt = emiAmt * data.tenure_months;
      const processingFeeAmt = Math.round(data.principal_amount * (data.processing_fee_pct / 100));

      // Insert loan
      const { data: loan, error: loanErr } = await supabase.from('loans').insert({
        ...data,
        loan_number: '',   // DB trigger sets this
        emi_amount: emiAmt,
        total_amount_payable: totalAmt,
        processing_fee_amount: processingFeeAmt,
        status: data.disbursement_date ? 'ACTIVE' : 'SANCTIONED',
        dsa_id: data.dsa_id || null,
        created_by: user?.id,
      }).select().single();

      if (loanErr) throw loanErr;

      // Insert repayment schedule
      const schedulePayload = scheduleRows.map((r) => ({
        loan_id: loan.id,
        instalment_no: r.instalment_no,
        due_date: r.due_date,
        principal: r.principal,
        interest: r.interest,
        total_emi: r.total_emi,
        outstanding_balance: r.outstanding_balance,
        status: 'NOT_PAID',
      }));

      const { error: schedErr } = await supabase.from('repayment_schedule').insert(schedulePayload);
      if (schedErr) throw schedErr;

      // If DSA, create commission record
      if (data.dsa_id && data.disbursement_date && data.disbursement_amount) {
        const dsa = dsas.find((d) => d.id === data.dsa_id);
        if (dsa) {
          await supabase.from('dsa_commissions').insert({
            dsa_id: data.dsa_id,
            loan_id: loan.id,
            disbursement_amount: data.disbursement_amount,
            commission_rate: (dsa as any).commission_rate,
            commission_amount: Math.round(data.disbursement_amount * (dsa as any).commission_rate / 100),
          });
        }
      }

      toast({ title: 'Loan created', description: `${loan.loan_number} with ${scheduleRows.length} instalments`, variant: 'success' });
      navigate(`/loans/${loan.id}`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="New Loan" back />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Borrower */}
        <Card>
          <CardHeader><CardTitle>Borrower Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Borrower *</Label>
              <Select value={watch('borrower_id')} onValueChange={(v) => setValue('borrower_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select borrower…" />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} — {b.mobile}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.borrower_id && <p className="text-xs text-destructive">{errors.borrower_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Loan Type</Label>
                <Select defaultValue="BUSINESS_LOAN" onValueChange={(v) => setValue('loan_type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUSINESS_LOAN">Business Loan</SelectItem>
                    <SelectItem value="LAP">LAP</SelectItem>
                    <SelectItem value="PERSONAL_LOAN">Personal Loan</SelectItem>
                    <SelectItem value="MSME">MSME</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>DSA (if applicable)</Label>
                <Select onValueChange={(v) => setValue('dsa_id', v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {dsas.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Terms */}
        <Card>
          <CardHeader><CardTitle>Loan Terms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Principal Amount (₹) *</Label>
                <Input type="number" {...register('principal_amount')} placeholder="500000" />
                {errors.principal_amount && <p className="text-xs text-destructive">{errors.principal_amount.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Interest Rate (% flat/month) *</Label>
                <Input type="number" step="0.01" {...register('interest_rate')} placeholder="2.5" />
                {errors.interest_rate && <p className="text-xs text-destructive">{errors.interest_rate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Tenure (months) *</Label>
                <Input type="number" {...register('tenure_months')} placeholder="24" />
              </div>
              <div className="space-y-1">
                <Label>Processing Fee (%)</Label>
                <Input type="number" step="0.1" {...register('processing_fee_pct')} placeholder="2" />
              </div>
              <div className="space-y-1">
                <Label>Pre-EMI Months</Label>
                <Input type="number" {...register('pre_emi_months')} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Repayment Mode</Label>
                <Select defaultValue="NACH" onValueChange={(v) => setValue('repayment_mode', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NACH">NACH</SelectItem>
                    <SelectItem value="PDC">PDC</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="NEFT">NEFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* EMI Calculator summary */}
            {emi > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase">Calculated</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly EMI</p>
                    <p className="text-base font-bold">{formatINRShort(emi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Payable</p>
                    <p className="text-base font-bold">{formatINRShort(totalPayable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Processing Fee</p>
                    <p className="text-base font-bold">{formatINRShort(processingFee)}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={calcSchedule}>
                  <Calculator className="h-4 w-4 mr-1" />
                  Preview Repayment Schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disbursement */}
        <Card>
          <CardHeader><CardTitle>Disbursement Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Disbursement Date</Label>
                <Input type="date" {...register('disbursement_date')} />
              </div>
              <div className="space-y-1">
                <Label>Disbursement Mode</Label>
                <Select onValueChange={(v) => setValue('disbursement_mode', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEFT">NEFT</SelectItem>
                    <SelectItem value="RTGS">RTGS</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Disbursement Amount (₹)</Label>
                <Input type="number" {...register('disbursement_amount')} placeholder="Same as principal" />
              </div>
              <div className="space-y-1">
                <Label>UTR / Reference</Label>
                <Input {...register('disbursement_utr')} placeholder="UTR123456" />
              </div>
              <div className="space-y-1">
                <Label>Beneficiary Bank</Label>
                <Input {...register('disbursement_bank')} placeholder="HDFC Bank" />
              </div>
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input {...register('disbursement_account')} placeholder="XXXXXXXXXX" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collateral */}
        <Card>
          <CardHeader><CardTitle>Collateral (Optional)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Collateral Type</Label>
                <Input {...register('collateral_type')} placeholder="Property, Gold, FD…" />
              </div>
              <div className="space-y-1">
                <Label>Collateral Value (₹)</Label>
                <Input type="number" {...register('collateral_value')} placeholder="1000000" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Property Address</Label>
                <Textarea {...register('property_address')} placeholder="Complete address of collateral property" rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea {...register('notes')} placeholder="Any remarks about this loan…" rows={2} />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={loading}>Create Loan</Button>
        </div>
      </form>

      {/* Schedule Preview */}
      {showSchedule && schedule.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Repayment Schedule Preview</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSchedule(false)}>Hide</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">EMI</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((row) => (
                    <TableRow key={row.instalment_no}>
                      <TableCell className="text-xs text-muted-foreground">{row.instalment_no}</TableCell>
                      <TableCell className="text-xs">{formatDate(row.due_date)}</TableCell>
                      <TableCell className="text-xs text-right">{formatINRShort(row.principal)}</TableCell>
                      <TableCell className="text-xs text-right">{formatINRShort(row.interest)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{formatINRShort(row.total_emi)}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{formatINRShort(row.outstanding_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
