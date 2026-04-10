import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Street Smart Lenders] Supabase env vars missing. ' +
    'Copy .env.example to .env.local and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

// ── Typed query helpers ────────────────────────
export type Tables = {
  leads: 'leads';
  borrowers: 'borrowers';
  loans: 'loans';
  repayment_schedule: 'repayment_schedule';
  payments: 'payments';
  documents: 'documents';
  dsas: 'dsas';
  dsa_commissions: 'dsa_commissions';
  field_visits: 'field_visits';
  cheque_details: 'cheque_details';
  user_profiles: 'user_profiles';
  company_settings: 'company_settings';
  alerts: 'alerts';
  communication_log: 'communication_log';
};

export async function uploadDocument(
  borrowerId: string,
  file: File,
  category: string
): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `borrowers/${borrowerId}/${category}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: false });
  if (error) {
    console.error('Upload error:', error);
    return null;
  }
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path);
  return urlData.publicUrl;
}
