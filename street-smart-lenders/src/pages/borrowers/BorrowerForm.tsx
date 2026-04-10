import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Borrower } from '@/types';

const schema = z.object({
  name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  alternate_mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN').optional().or(z.literal('')),
  aadhaar: z.string().length(12).optional().or(z.literal('')),
  dob: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  business_name: z.string().optional(),
  business_type: z.string().optional(),
  business_vintage_years: z.coerce.number().optional(),
  annual_income: z.coerce.number().optional(),
  annual_turnover: z.coerce.number().optional(),
  cibil_score: z.coerce.number().min(300).max(900).optional(),
  cibil_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function BorrowerForm({ open, onClose, onSaved, borrower }: {
  open: boolean; onClose: () => void; onSaved: () => void; borrower?: Borrower;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: borrower || {},
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = {
        ...data,
        pan: data.pan?.toUpperCase() || null,
        email: data.email || null,
        aadhaar: data.aadhaar || null,
        created_by: user?.id,
      };
      let error;
      if (borrower) {
        ({ error } = await supabase.from('borrowers').update(payload).eq('id', borrower.id));
      } else {
        ({ error } = await supabase.from('borrowers').insert(payload));
      }
      if (error) throw error;
      toast({ title: borrower ? 'Borrower updated' : 'Borrower created', variant: 'success' });
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
          <DialogTitle>{borrower ? 'Edit Borrower' : 'New Borrower'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Full Name *</Label>
              <Input {...register('name')} placeholder="Ramesh Kumar Sharma" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Mobile *</Label>
              <Input {...register('mobile')} placeholder="9876543210" maxLength={10} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Alternate Mobile</Label>
              <Input {...register('alternate_mobile')} placeholder="9876543211" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>PAN</Label>
              <Input {...register('pan')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
              {errors.pan && <p className="text-xs text-destructive">{errors.pan.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Aadhaar (last 4 for display)</Label>
              <Input {...register('aadhaar')} placeholder="XXXXXXXXXXXX" maxLength={12} />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" {...register('dob')} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register('email')} placeholder="email@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Textarea {...register('address')} placeholder="Full address" rows={2} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input {...register('city')} placeholder="Mumbai" />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Select onValueChange={(v) => setValue('state', v)} defaultValue={borrower?.state}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {['Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Andhra Pradesh', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Other'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pincode</Label>
              <Input {...register('pincode')} placeholder="400001" maxLength={6} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Business Name</Label>
              <Input {...register('business_name')} placeholder="Sharma Trading Co." />
            </div>
            <div className="space-y-1">
              <Label>Business Type</Label>
              <Input {...register('business_type')} placeholder="Wholesale, Retail…" />
            </div>
            <div className="space-y-1">
              <Label>Business Vintage (years)</Label>
              <Input type="number" {...register('business_vintage_years')} placeholder="5" />
            </div>
            <div className="space-y-1">
              <Label>Annual Turnover (₹)</Label>
              <Input type="number" {...register('annual_turnover')} placeholder="5000000" />
            </div>
            <div className="space-y-1">
              <Label>Annual Income (₹)</Label>
              <Input type="number" {...register('annual_income')} placeholder="1200000" />
            </div>
            <div className="space-y-1">
              <Label>CIBIL Score</Label>
              <Input type="number" {...register('cibil_score')} placeholder="720" min={300} max={900} />
            </div>
            <div className="space-y-1">
              <Label>CIBIL Report Date</Label>
              <Input type="date" {...register('cibil_date')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Any relevant notes…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>{borrower ? 'Update' : 'Create Borrower'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
