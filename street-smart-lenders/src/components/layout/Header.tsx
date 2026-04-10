import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Building2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  type: 'borrower' | 'loan' | 'lead' | 'dsa';
  id: string;
  label: string;
  sublabel?: string;
  path: string;
}

export function Header() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    setShowResults(true);

    const [borrowers, loans, leads, dsas] = await Promise.all([
      supabase.from('borrowers').select('id,name,mobile,pan').or(`name.ilike.%${q}%,mobile.ilike.%${q}%,pan.ilike.%${q}%`).limit(4),
      supabase.from('loans').select('id,loan_number,principal_amount,status').or(`loan_number.ilike.%${q}%`).limit(4),
      supabase.from('leads').select('id,borrower_name,mobile,status').or(`borrower_name.ilike.%${q}%,mobile.ilike.%${q}%`).limit(3),
      supabase.from('dsas').select('id,name,mobile').or(`name.ilike.%${q}%,mobile.ilike.%${q}%`).limit(2),
    ]);

    const all: SearchResult[] = [
      ...(borrowers.data || []).map((b) => ({ type: 'borrower' as const, id: b.id, label: b.name, sublabel: b.mobile, path: `/borrowers/${b.id}` })),
      ...(loans.data || []).map((l) => ({ type: 'loan' as const, id: l.id, label: l.loan_number, sublabel: l.status, path: `/loans/${l.id}` })),
      ...(leads.data || []).map((l) => ({ type: 'lead' as const, id: l.id, label: l.borrower_name, sublabel: l.mobile, path: `/leads/${l.id}` })),
      ...(dsas.data || []).map((d) => ({ type: 'dsa' as const, id: d.id, label: d.name, sublabel: d.mobile, path: `/dsas/${d.id}` })),
    ];

    setResults(all);
    setSearching(false);
  }

  const typeColors: Record<string, string> = {
    borrower: 'text-blue-600 dark:text-blue-400',
    loan: 'text-green-600 dark:text-green-400',
    lead: 'text-purple-600 dark:text-purple-400',
    dsa: 'text-orange-600 dark:text-orange-400',
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold">SSL</span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search borrowers, loans, leads…"
          className="pl-9 pr-8 h-9 text-sm"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setShowResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {showResults && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {searching && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            )}
            {!searching && results.length === 0 && query.length >= 2 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onMouseDown={() => { navigate(r.path); setQuery(''); setShowResults(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left transition-colors"
              >
                <span className={cn('text-[10px] font-bold uppercase w-14 shrink-0', typeColors[r.type])}>
                  {r.type}
                </span>
                <span className="text-sm font-medium truncate">{r.label}</span>
                {r.sublabel && <span className="text-xs text-muted-foreground ml-auto shrink-0">{r.sublabel}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button variant="ghost" size="icon-sm" onClick={() => navigate('/alerts')}>
        <Bell className="h-4 w-4" />
      </Button>
    </header>
  );
}
