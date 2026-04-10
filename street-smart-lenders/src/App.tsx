import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { LeadsPage } from '@/pages/leads/LeadsPage';
import { LeadDetail } from '@/pages/leads/LeadDetail';
import { BorrowersPage } from '@/pages/borrowers/BorrowersPage';
import { BorrowerDetail } from '@/pages/borrowers/BorrowerDetail';
import { LoansPage } from '@/pages/loans/LoansPage';
import { LoanForm } from '@/pages/loans/LoanForm';
import { LoanDetail } from '@/pages/loans/LoanDetail';
import { CollectionsPage } from '@/pages/collections/CollectionsPage';
import { DSAsPage } from '@/pages/dsas/DSAsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

// ── Protected route wrapper ─────────────────────────────────────
function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="borrowers" element={<BorrowersPage />} />
        <Route path="borrowers/:id" element={<BorrowerDetail />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/new" element={<LoanForm />} />
        <Route path="loans/:id" element={<LoanDetail />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="dsas" element={<DSAsPage />} />
        <Route path="reports" element={<ReportsPlaceholder />} />
        <Route path="alerts" element={<AlertsPlaceholder />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

// ── Placeholder pages (Phase 2) ─────────────────────────────────
function ReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-3">📊</div>
      <h2 className="text-lg font-bold">Reports & MIS</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Portfolio health reports, DSA performance, overdue aging, interest income, and cash flow projection — coming in Phase 2.
      </p>
    </div>
  );
}

function AlertsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-3">🔔</div>
      <h2 className="text-lg font-bold">Alerts & Reminders</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Daily digest, EMI reminders, cheque bounce alerts, CIBIL drop notifications — coming in Phase 2.
      </p>
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
