import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, Building2, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { initials } from '@/lib/utils';
import type { Borrower } from '@/types';
import { Users } from 'lucide-react';
import { BorrowerForm } from './BorrowerForm';

export function BorrowersPage() {
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('borrowers').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,pan.ilike.%${search}%,business_name.ilike.%${search}%`);
    }
    const { data } = await q.limit(100);
    setBorrowers((data || []) as Borrower[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Borrowers"
        subtitle={`${borrowers.length} borrowers`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New Borrower
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, mobile, PAN, business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : borrowers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No borrowers found"
          description="Borrowers are created when you convert a lead"
          action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" />Add Borrower</Button>}
        />
      ) : (
        <div className="space-y-2">
          {borrowers.map((b) => (
            <div
              key={b.id}
              onClick={() => navigate(`/borrowers/${b.id}`)}
              className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {initials(b.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{b.name}</span>
                    {b.cibil_score && (
                      <span className={`text-xs font-bold ${b.cibil_score >= 700 ? 'text-green-600' : b.cibil_score >= 600 ? 'text-yellow-600' : 'text-red-600'}`}>
                        CIBIL {b.cibil_score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />{b.mobile}
                    </span>
                    {b.business_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{b.business_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {b.pan && <p className="text-xs font-mono text-muted-foreground">{b.pan}</p>}
                  <p className="text-xs text-muted-foreground">{b.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BorrowerForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
