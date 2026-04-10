import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Edit, Plus, Upload, FileText, CheckCircle, Clock, XCircle,
  Phone, Mail, Building2, MapPin, User, Calendar, TrendingUp, Banknote,
} from 'lucide-react';
import { supabase, uploadDocument } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { formatINR, formatDate, initials } from '@/lib/utils';
import type { Borrower, Document, DocumentCategory, DocumentStatus, Loan } from '@/types';
import { BorrowerForm } from './BorrowerForm';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const DOCUMENT_CATEGORIES: { key: DocumentCategory; label: string; required?: boolean }[] = [
  { key: 'PAN', label: 'PAN Card', required: true },
  { key: 'AADHAAR', label: 'Aadhaar Card', required: true },
  { key: 'PHOTO', label: 'Photograph', required: true },
  { key: 'BANK_STATEMENT', label: 'Bank Statements (12M)', required: true },
  { key: 'ITR', label: 'ITR (3 years)', required: true },
  { key: 'GST_RETURN', label: 'GST Returns' },
  { key: 'BALANCE_SHEET', label: 'Balance Sheet / P&L' },
  { key: 'CIBIL_REPORT', label: 'CIBIL Report' },
  { key: 'PROPERTY_DOCUMENT', label: 'Property Documents' },
  { key: 'ELECTRICITY_BILL', label: 'Electricity Bill' },
  { key: 'PDC_CHEQUE', label: 'PDC / Cheques' },
  { key: 'SANCTION_LETTER', label: 'Existing Loan Sanction Letters' },
  { key: 'OTHER', label: 'Other Documents' },
];

const STATUS_ICONS: Record<DocumentStatus, React.ReactNode> = {
  RECEIVED: <CheckCircle className="h-4 w-4 text-green-600" />,
  PENDING: <Clock className="h-4 w-4 text-yellow-600" />,
  NOT_APPLICABLE: <XCircle className="h-4 w-4 text-muted-foreground" />,
};

export function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [bRes, docsRes, loansRes] = await Promise.all([
      supabase.from('borrowers').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('borrower_id', id).order('category'),
      supabase.from('loans').select('*').eq('borrower_id', id).order('created_at', { ascending: false }),
    ]);
    if (bRes.data) setBorrower(bRes.data as Borrower);
    setDocuments((docsRes.data || []) as Document[]);
    setLoans((loansRes.data || []) as Loan[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleFileUpload(category: DocumentCategory, file: File) {
    if (!id || !borrower) return;
    setUploading(category);
    try {
      const url = await uploadDocument(id, file, category);
      if (!url) throw new Error('Upload failed');

      // Upsert document record
      const existing = documents.find((d) => d.category === category);
      if (existing) {
        await supabase.from('documents').update({ file_url: url, file_name: file.name, file_size: file.size, status: 'RECEIVED' }).eq('id', existing.id);
      } else {
        await supabase.from('documents').insert({ borrower_id: id, category, file_url: url, file_name: file.name, file_size: file.size, status: 'RECEIVED' });
      }
      toast({ title: 'Document uploaded', variant: 'success' });
      await load();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  }

  async function toggleDocStatus(category: DocumentCategory, newStatus: DocumentStatus) {
    if (!id) return;
    const existing = documents.find((d) => d.category === category);
    if (existing) {
      await supabase.from('documents').update({ status: newStatus }).eq('id', existing.id);
    } else {
      await supabase.from('documents').insert({ borrower_id: id, category, status: newStatus });
    }
    await load();
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  if (!borrower) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Borrower not found</p>
      <Button className="mt-4" onClick={() => navigate('/borrowers')}>Back</Button>
    </div>
  );

  const docMap = new Map(documents.map((d) => [d.category, d]));
  const receivedCount = documents.filter((d) => d.status === 'RECEIVED').length;
  const totalRequired = DOCUMENT_CATEGORIES.filter((c) => c.required).length;
  const receivedRequired = DOCUMENT_CATEGORIES.filter((c) => c.required && docMap.get(c.key)?.status === 'RECEIVED').length;

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={borrower.name}
        subtitle={borrower.business_name || borrower.mobile}
        back
        backTo="/borrowers"
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        }
      />

      {/* Profile card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
              {initials(borrower.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">{borrower.name}</h2>
              {borrower.business_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />{borrower.business_name}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-2">
                <a href={`tel:${borrower.mobile}`} className="text-xs flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" />{borrower.mobile}
                </a>
                {borrower.email && (
                  <a href={`mailto:${borrower.email}`} className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />{borrower.email}
                  </a>
                )}
                {borrower.city && (
                  <span className="text-xs flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />{borrower.city}, {borrower.state}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {borrower.cibil_score && (
                <div>
                  <p className="text-xs text-muted-foreground">CIBIL</p>
                  <p className={`text-lg font-bold ${borrower.cibil_score >= 700 ? 'text-green-600' : borrower.cibil_score >= 600 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {borrower.cibil_score}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documents">
        <TabsList className="w-full">
          <TabsTrigger value="documents" className="flex-1">
            Documents
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${receivedRequired === totalRequired ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {receivedRequired}/{totalRequired}
            </span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
          <TabsTrigger value="loans" className="flex-1">Loans ({loans.length})</TabsTrigger>
        </TabsList>

        {/* Document Vault */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>KYC & Document Vault</CardTitle>
                <span className="text-xs text-muted-foreground">{receivedCount} of {DOCUMENT_CATEGORIES.length} collected</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {DOCUMENT_CATEGORIES.map((cat) => {
                const doc = docMap.get(cat.key);
                const status: DocumentStatus = doc?.status || 'PENDING';

                return (
                  <div key={cat.key} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="shrink-0">{STATUS_ICONS[status]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {cat.label}
                        {cat.required && <span className="text-red-500 ml-0.5">*</span>}
                      </p>
                      {doc?.file_name && (
                        <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Status toggle */}
                      {status === 'PENDING' && (
                        <button
                          onClick={() => toggleDocStatus(cat.key, 'NOT_APPLICABLE')}
                          className="text-[10px] text-muted-foreground hover:text-foreground bg-muted px-1.5 py-0.5 rounded"
                        >
                          N/A
                        </button>
                      )}
                      {status === 'NOT_APPLICABLE' && (
                        <button
                          onClick={() => toggleDocStatus(cat.key, 'PENDING')}
                          className="text-[10px] text-muted-foreground hover:text-foreground bg-muted px-1.5 py-0.5 rounded"
                        >
                          Reset
                        </button>
                      )}

                      {/* Upload */}
                      <label className={cn('cursor-pointer flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md font-medium hover:bg-primary/90 transition-colors', uploading === cat.key && 'opacity-50 cursor-not-allowed')}>
                        <Upload className="h-3 w-3" />
                        {uploading === cat.key ? '…' : 'Upload'}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.heic"
                          disabled={!!uploading}
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(cat.key, e.target.files[0])}
                        />
                      </label>

                      {/* View */}
                      {doc?.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline px-1">
                          View
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardContent className="p-4 space-y-3">
              {borrower.pan && <InfoRow label="PAN" value={borrower.pan} />}
              {borrower.aadhaar && <InfoRow label="Aadhaar" value={`XXXX XXXX ${borrower.aadhaar.slice(-4)}`} />}
              {borrower.dob && <InfoRow label="Date of Birth" value={formatDate(borrower.dob)} />}
              {borrower.address && <InfoRow label="Address" value={`${borrower.address}, ${borrower.city} - ${borrower.pincode}`} />}
              <Separator />
              {borrower.business_type && <InfoRow label="Business Type" value={borrower.business_type} />}
              {borrower.business_vintage_years && <InfoRow label="Business Vintage" value={`${borrower.business_vintage_years} years`} />}
              {borrower.annual_turnover && <InfoRow label="Annual Turnover" value={formatINR(borrower.annual_turnover)} />}
              {borrower.annual_income && <InfoRow label="Annual Income" value={formatINR(borrower.annual_income)} />}
              {borrower.cibil_score && (
                <>
                  <InfoRow label="CIBIL Score" value={String(borrower.cibil_score)} />
                  {borrower.cibil_date && <InfoRow label="CIBIL Date" value={formatDate(borrower.cibil_date)} />}
                </>
              )}
              {borrower.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{borrower.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loans */}
        <TabsContent value="loans">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Loans</CardTitle>
                <Button size="sm" onClick={() => navigate(`/loans/new?borrower=${id}`)}>
                  <Plus className="h-4 w-4 mr-1" />New Loan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No loans yet</p>
              ) : (
                <div className="space-y-2">
                  {loans.map((loan) => (
                    <div
                      key={loan.id}
                      onClick={() => navigate(`/loans/${loan.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold">{loan.loan_number}</p>
                        <p className="text-xs text-muted-foreground">{formatINR(loan.principal_amount)} · {loan.tenure_months}M · {loan.interest_rate}%</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        loan.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        loan.status === 'NPA' ? 'bg-red-100 text-red-700' :
                        loan.status === 'CLOSED' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {loan.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen && (
        <BorrowerForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} borrower={borrower} />
      )}
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
