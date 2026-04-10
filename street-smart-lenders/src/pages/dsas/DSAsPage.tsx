import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, MapPin, TrendingUp, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatINRShort, formatDate, initials } from '@/lib/utils';
import type { DSA } from '@/types';
import { Briefcase } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email().optional().or(z.literal('')),
  pan: z.string().optional(),
  location: z.string().min(1, 'Location required'),
  commission_rate: z.coerce.number().min(0).max(10),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  bank_ifsc: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface DSAWithStats extends DSA {
  leads_count?: number;
  loans_count?: number;
  total_business?: number;
  commission_pending?: number;
}

export function DSAsPage() {
  const { user } = useAuth();
  const [dsas, setDsas] = useState<DSAWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editDSA, setEditDSA] = useState<DSA | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('dsas').select('*').order('name');
    if (search.trim()) q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
    const { data } = await q;

    // Get stats
    const dsaIds = (data || []).map((d: any) => d.id);
    const [leadsRes, loansRes, commissionsRes] = await Promise.all([
      dsaIds.length > 0 ? supabase.from('leads').select('dsa_id').in('dsa_id', dsaIds) : Promise.resolve({ data: [] }),
      dsaIds.length > 0 ? supabase.from('loans').select('dsa_id, principal_amount').in('dsa_id', dsaIds) : Promise.resolve({ data: [] }),
      dsaIds.length > 0 ? supabase.from('dsa_commissions').select('dsa_id, commission_amount, status').in('dsa_id', dsaIds) : Promise.resolve({ data: [] }),
    ]);

    const leadsCount: Record<string, number> = {};
    (leadsRes.data || []).forEach((l: any) => { leadsCount[l.dsa_id] = (leadsCount[l.dsa_id] || 0) + 1; });

    const loansCount: Record<string, number> = {};
    const loansBusiness: Record<string, number> = {};
    (loansRes.data || []).forEach((l: any) => {
      loansCount[l.dsa_id] = (loansCount[l.dsa_id] || 0) + 1;
      loansBusiness[l.dsa_id] = (loansBusiness[l.dsa_id] || 0) + l.principal_amount;
    });

    const commPending: Record<string, number> = {};
    (commissionsRes.data || []).forEach((c: any) => {
      if (c.status === 'PENDING') commPending[c.dsa_id] = (commPending[c.dsa_id] || 0) + c.commission_amount;
    });

    setDsas(
      (data || []).map((d: any) => ({
        ...d,
        leads_count: leadsCount[d.id] || 0,
        loans_count: loansCount[d.id] || 0,
        total_business: loansBusiness[d.id] || 0,
        commission_pending: commPending[d.id] || 0,
      }))
    );
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="DSAs"
        subtitle={`${dsas.length} DSAs`}
        actions={
          <Button size="sm" onClick={() => { setEditDSA(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add DSA
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, mobile…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : dsas.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No DSAs found"
          action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" />Add DSA</Button>}
        />
      ) : (
        <div className="space-y-2">
          {dsas.map((dsa) => (
            <div key={dsa.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {initials(dsa.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{dsa.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      dsa.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {dsa.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <a href={`tel:${dsa.mobile}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                      <Phone className="h-3 w-3" />{dsa.mobile}
                    </a>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{dsa.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="text-muted-foreground">Commission: <strong>{dsa.commission_rate}%</strong></span>
                    <span className="text-muted-foreground">Leads: <strong>{dsa.leads_count}</strong></span>
                    <span className="text-muted-foreground">Loans: <strong>{dsa.loans_count}</strong></span>
                  </div>
                  {(dsa.total_business || 0) > 0 && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      <span className="text-muted-foreground">Business: <strong>{formatINRShort(dsa.total_business || 0)}</strong></span>
                      {(dsa.commission_pending || 0) > 0 && (
                        <span className="text-orange-600 dark:text-orange-400">Commission pending: <strong>{formatINRShort(dsa.commission_pending || 0)}</strong></span>
                      )}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => { setEditDSA(dsa); setFormOpen(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <DSAForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
          dsa={editDSA || undefined}
        />
      )}
    </div>
  );
}

// ── DSA Form ──────────────────────────────────────────────────
function DSAForm({ open, onClose, onSaved, dsa }: { open: boolean; onClose: () => void; onSaved: () => void; dsa?: DSA }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: dsa ? {
      name: dsa.name, mobile: dsa.mobile, email: dsa.email || '',
      pan: dsa.pan || '', location: dsa.location,
      commission_rate: dsa.commission_rate, status: dsa.status,
      bank_name: dsa.bank_name || '', bank_account: dsa.bank_account || '',
      bank_ifsc: dsa.bank_ifsc || '', notes: dsa.notes || '',
    } : { status: 'ACTIVE', commission_rate: 1 },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = { ...data, email: data.email || null, pan: data.pan || null, created_by: user?.id };
      let error;
      if (dsa) {
        ({ error } = await supabase.from('dsas').update(payload).eq('id', dsa.id));
      } else {
        ({ error } = await supabase.from('dsas').insert(payload));
      }
      if (error) throw error;
      toast({ title: dsa ? 'DSA updated' : 'DSA added', variant: 'success' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dsa ? 'Edit DSA' : 'Add New DSA'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Full Name *</Label>
              <Input {...register('name')} placeholder="Arun Verma" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Mobile *</Label>
              <Input {...register('mobile')} placeholder="9876543210" maxLength={10} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register('email')} placeholder="arun@example.com" />
            </div>
            <div className="space-y-1">
              <Label>PAN</Label>
              <Input {...register('pan')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
            </div>
            <div className="space-y-1">
              <Label>Location *</Label>
              <Input {...register('location')} placeholder="Mumbai, Andheri" />
              {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Commission Rate (%) *</Label>
              <Input type="number" step="0.1" {...register('commission_rate')} placeholder="1.0" />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select defaultValue={dsa?.status || 'ACTIVE'} onValueChange={(v) => setValue('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input {...register('bank_name')} placeholder="HDFC" />
            </div>
            <div className="space-y-1">
              <Label>Account No.</Label>
              <Input {...register('bank_account')} placeholder="XXXXXXXXXX" />
            </div>
            <div className="space-y-1">
              <Label>IFSC</Label>
              <Input {...register('bank_ifsc')} placeholder="HDFC0001234" className="uppercase" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Any notes about this DSA…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>{dsa ? 'Update' : 'Add DSA'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
