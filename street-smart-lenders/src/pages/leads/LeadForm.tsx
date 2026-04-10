import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Lead, LeadStatus, DSA } from '@/types';

const schema = z.object({
  borrower_name: z.string().min(2, 'Name required'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile (10 digits, starts 6-9)'),
  city: z.string().optional(),
  district: z.string().optional(),
  loan_amount: z.coerce.number().min(1000, 'Min ₹1,000'),
  tenure_months: z.coerce.number().min(1).max(360),
  loan_type: z.enum(['LAP', 'BUSINESS_LOAN', 'PERSONAL_LOAN', 'MSME', 'OTHER']),
  purpose: z.string().optional(),
  source_type: z.enum(['DSA', 'DIRECT', 'REFERRAL', 'ONLINE']),
  dsa_id: z.string().optional(),
  pan_number: z.string().optional(),
  property_details: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['NEW', 'DOCUMENTS_COLLECTED', 'UNDER_REVIEW', 'FIELD_VISIT', 'SANCTIONED', 'DISBURSED', 'REJECTED', 'ON_HOLD']),
  next_followup_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lead?: Lead;
}

export function LeadForm({ open, onClose, onSaved, lead }: LeadFormProps) {
  const { user } = useAuth();
  const [dsas, setDsas] = useState<DSA[]>([]);
  const [loading, setLoading] = useState(false);
  const [dupCheck, setDupCheck] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead ? {
      borrower_name: lead.borrower_name,
      mobile: lead.mobile,
      city: lead.city,
      district: lead.district,
      loan_amount: lead.loan_amount,
      tenure_months: lead.tenure_months,
      loan_type: lead.loan_type,
      purpose: lead.purpose,
      source_type: lead.source_type,
      dsa_id: lead.dsa_id,
      pan_number: lead.pan_number,
      property_details: lead.property_details,
      notes: lead.notes,
      status: lead.status,
      next_followup_date: lead.next_followup_date,
    } : {
      status: 'NEW',
      source_type: 'DIRECT',
      loan_type: 'BUSINESS_LOAN',
      tenure_months: 12,
    },
  });

  const sourceType = watch('source_type');
  const mobile = watch('mobile');

  useEffect(() => {
    supabase.from('dsas').select('id,name').eq('status', 'ACTIVE').then(({ data }) => {
      setDsas((data || []) as DSA[]);
    });
  }, []);

  // Duplicate check on mobile
  useEffect(() => {
    if (mobile?.length === 10 && !lead) {
      supabase.from('leads').select('id,borrower_name,status').eq('mobile', mobile).limit(1).then(({ data }) => {
        if (data && data.length > 0) {
          setDupCheck(`Duplicate: ${data[0].borrower_name} — ${data[0].status}`);
        } else {
          setDupCheck(null);
        }
      });
    } else {
      setDupCheck(null);
    }
  }, [mobile, lead]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = {
        ...data,
        pan_number: data.pan_number?.toUpperCase() || null,
        dsa_id: data.source_type === 'DSA' ? data.dsa_id : null,
        created_by: user?.id,
      };

      let error;
      if (lead) {
        ({ error } = await supabase.from('leads').update(payload).eq('id', lead.id));
      } else {
        ({ error } = await supabase.from('leads').insert(payload));
      }

      if (error) throw error;
      toast({ title: lead ? 'Lead updated' : 'Lead created', variant: 'success' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Borrower */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Borrower Name *</Label>
              <Input {...register('borrower_name')} placeholder="Full name" />
              {errors.borrower_name && <p className="text-xs text-destructive">{errors.borrower_name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Mobile *</Label>
              <Input {...register('mobile')} placeholder="9876543210" maxLength={10} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
              {dupCheck && <p className="text-xs text-orange-600 dark:text-orange-400">{dupCheck}</p>}
            </div>

            <div className="space-y-1">
              <Label>PAN</Label>
              <Input {...register('pan_number')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
            </div>

            <div className="space-y-1">
              <Label>City</Label>
              <Input {...register('city')} placeholder="Mumbai" />
            </div>

            <div className="space-y-1">
              <Label>District</Label>
              <Input {...register('district')} placeholder="Mumbai Suburban" />
            </div>
          </div>

          {/* Loan */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Loan Amount (₹) *</Label>
              <Input {...register('loan_amount')} type="number" placeholder="500000" />
              {errors.loan_amount && <p className="text-xs text-destructive">{errors.loan_amount.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Tenure (months) *</Label>
              <Input {...register('tenure_months')} type="number" placeholder="24" />
            </div>

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
              <Label>Status</Label>
              <Select defaultValue={lead?.status || 'NEW'} onValueChange={(v) => setValue('status', v as LeadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="DOCUMENTS_COLLECTED">Docs Collected</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="FIELD_VISIT">Field Visit</SelectItem>
                  <SelectItem value="SANCTIONED">Sanctioned</SelectItem>
                  <SelectItem value="DISBURSED">Disbursed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Source</Label>
              <Select defaultValue={lead?.source_type || 'DIRECT'} onValueChange={(v) => setValue('source_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Direct</SelectItem>
                  <SelectItem value="DSA">DSA</SelectItem>
                  <SelectItem value="REFERRAL">Referral</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === 'DSA' && (
              <div className="space-y-1">
                <Label>DSA</Label>
                <Select defaultValue={lead?.dsa_id} onValueChange={(v) => setValue('dsa_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select DSA" /></SelectTrigger>
                  <SelectContent>
                    {dsas.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Next Follow-up</Label>
              <Input type="date" {...register('next_followup_date')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Purpose / Requirement</Label>
            <Textarea {...register('purpose')} placeholder="Working capital, machinery purchase, LAP…" rows={2} />
          </div>

          {watch('loan_type') === 'LAP' && (
            <div className="space-y-1">
              <Label>Property Details</Label>
              <Textarea {...register('property_details')} placeholder="Property type, location, area…" rows={2} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Any additional notes…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>{lead ? 'Update' : 'Create Lead'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
