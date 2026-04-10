// ──────────────────────────────────────────────
// Core domain types for Street Smart Lenders
// ──────────────────────────────────────────────

export type LeadStatus =
  | 'NEW'
  | 'DOCUMENTS_COLLECTED'
  | 'UNDER_REVIEW'
  | 'FIELD_VISIT'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'ON_HOLD';

export type LeadSource = 'DSA' | 'DIRECT' | 'REFERRAL' | 'ONLINE';
export type LoanType = 'LAP' | 'BUSINESS_LOAN' | 'PERSONAL_LOAN' | 'MSME' | 'OTHER';
export type RepaymentMode = 'PDC' | 'NACH' | 'CASH' | 'UPI' | 'NEFT';
export type RepaymentFrequency = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
export type LoanStatus = 'ACTIVE' | 'CLOSED' | 'NPA' | 'WRITTEN_OFF' | 'SANCTIONED';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'NOT_PAID' | 'PTP' | 'DISPUTE';
export type DocumentStatus = 'RECEIVED' | 'PENDING' | 'NOT_APPLICABLE';
export type DSAStatus = 'ACTIVE' | 'INACTIVE';
export type UserRole = 'ADMIN' | 'CREDIT_MANAGER' | 'COLLECTIONS_OFFICER' | 'DSA_COORDINATOR' | 'VIEW_ONLY';

export type DisbursementMode = 'CHEQUE' | 'NEFT' | 'RTGS' | 'CASH' | 'UPI';

// ── Lead ──────────────────────────────────────
export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  borrower_name: string;
  mobile: string;
  city: string;
  district: string;
  loan_amount: number;
  tenure_months: number;
  purpose: string;
  loan_type: LoanType;
  source_type: LeadSource;
  dsa_id?: string;
  dsa_name?: string;
  property_details?: string;
  status: LeadStatus;
  assigned_to?: string;
  last_followup_date?: string;
  next_followup_date?: string;
  pan_number?: string;
  aadhaar_last4?: string;
  notes?: string;
  borrower_id?: string;
  created_by: string;
}

// ── Borrower ──────────────────────────────────
export interface Borrower {
  id: string;
  created_at: string;
  name: string;
  mobile: string;
  alternate_mobile?: string;
  email?: string;
  pan: string;
  aadhaar?: string;
  dob?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  business_name?: string;
  business_type?: string;
  business_vintage_years?: number;
  annual_income?: number;
  annual_turnover?: number;
  cibil_score?: number;
  cibil_date?: string;
  photo_url?: string;
  notes?: string;
  created_by: string;
}

// ── Document ──────────────────────────────────
export type DocumentCategory =
  | 'PAN'
  | 'AADHAAR'
  | 'BANK_STATEMENT'
  | 'ITR'
  | 'GST_RETURN'
  | 'PROPERTY_DOCUMENT'
  | 'BALANCE_SHEET'
  | 'CIBIL_REPORT'
  | 'ELECTRICITY_BILL'
  | 'PHOTO'
  | 'PDC_CHEQUE'
  | 'SANCTION_LETTER'
  | 'OTHER';

export interface Document {
  id: string;
  created_at: string;
  borrower_id: string;
  loan_id?: string;
  category: DocumentCategory;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: DocumentStatus;
  expiry_date?: string;
  notes?: string;
  uploaded_by?: string;
}

// ── Loan ─────────────────────────────────────
export interface Loan {
  id: string;
  created_at: string;
  updated_at: string;
  loan_number: string;
  borrower_id: string;
  borrower_name?: string;
  lead_id?: string;
  dsa_id?: string;
  dsa_name?: string;
  loan_type: LoanType;
  principal_amount: number;
  interest_rate: number;           // monthly flat %
  tenure_months: number;
  repayment_frequency: RepaymentFrequency;
  repayment_mode: RepaymentMode;
  processing_fee_pct: number;
  processing_fee_amount?: number;
  disbursement_date?: string;
  disbursement_mode?: DisbursementMode;
  disbursement_utr?: string;
  disbursement_amount?: number;
  disbursement_bank?: string;
  disbursement_account?: string;
  emi_amount: number;
  total_amount_payable: number;
  status: LoanStatus;
  pre_emi_months?: number;
  bullet_repayment?: boolean;
  collateral_type?: string;
  collateral_value?: number;
  property_address?: string;
  notes?: string;
  created_by: string;
}

// ── Repayment Schedule ────────────────────────
export interface RepaymentScheduleItem {
  id: string;
  loan_id: string;
  instalment_no: number;
  due_date: string;
  principal: number;
  interest: number;
  total_emi: number;
  outstanding_balance: number;
  status: PaymentStatus;
  paid_date?: string;
  paid_amount?: number;
}

// ── Payment ───────────────────────────────────
export interface Payment {
  id: string;
  created_at: string;
  loan_id: string;
  schedule_id?: string;
  instalment_no?: number;
  payment_date: string;
  amount: number;
  mode: RepaymentMode;
  reference?: string;
  status: PaymentStatus;
  ptp_date?: string;
  bounce_charge?: number;
  penal_interest?: number;
  notes?: string;
  recorded_by: string;
}

// ── DSA ──────────────────────────────────────
export interface DSA {
  id: string;
  created_at: string;
  name: string;
  mobile: string;
  email?: string;
  pan?: string;
  location: string;
  commission_rate: number;         // % of disbursement
  status: DSAStatus;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  notes?: string;
  created_by: string;
}

// ── DSA Commission ────────────────────────────
export interface DSACommission {
  id: string;
  created_at: string;
  dsa_id: string;
  loan_id: string;
  disbursement_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'PENDING' | 'PAID';
  paid_date?: string;
  payment_reference?: string;
}

// ── Field Visit ───────────────────────────────
export interface FieldVisit {
  id: string;
  created_at: string;
  lead_id?: string;
  borrower_id?: string;
  loan_id?: string;
  visit_date: string;
  visited_by: string;
  photos?: string[];
  employee_count?: number;
  daily_footfall?: string;
  stock_observation?: string;
  neighborhood_assessment?: string;
  signage_check?: boolean;
  overall_remarks?: string;
  recommendation: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  gps_lat?: number;
  gps_lng?: number;
}

// ── Cheque Detail ─────────────────────────────
export interface ChequeDetail {
  id: string;
  loan_id: string;
  cheque_number: string;
  bank_name: string;
  branch: string;
  amount: number;
  cheque_date: string;
  status: 'PENDING' | 'PRESENTED' | 'BOUNCED' | 'CLEARED';
  bounce_date?: string;
  bounce_reason?: string;
  legal_notice_sent?: boolean;
  notice_date?: string;
}

// ── User Profile ──────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  mobile?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

// ── Company Settings ──────────────────────────
export interface CompanySettings {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  pin?: string;
  cin?: string;
  gstin?: string;
  rbi_nbfc_no?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
}

// ── Dashboard KPI ─────────────────────────────
export interface DashboardKPIs {
  total_aum: number;
  disbursed_this_month: number;
  collections_this_month: number;
  total_overdue: number;
  npa_count: number;
  npa_amount: number;
  active_loans: number;
  total_leads: number;
  new_leads_this_month: number;
  avg_yield: number;
  collection_efficiency: number;
}

// ── Utility types ─────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface FilterParams {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  dsa_id?: string;
  amount_min?: number;
  amount_max?: number;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  DOCUMENTS_COLLECTED: 'Docs Collected',
  UNDER_REVIEW: 'Under Review',
  FIELD_VISIT: 'Field Visit',
  SANCTIONED: 'Sanctioned',
  DISBURSED: 'Disbursed',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  DOCUMENTS_COLLECTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  FIELD_VISIT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  SANCTIONED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  DISBURSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ON_HOLD: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export const LOAN_STATUS_COLORS: Record<LoanStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SANCTIONED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  NPA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  WRITTEN_OFF: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
};

export const DPD_BUCKET = (dpd: number): string => {
  if (dpd === 0) return 'current';
  if (dpd <= 30) return 'mild';
  if (dpd <= 60) return 'moderate';
  if (dpd <= 90) return 'severe';
  return 'critical';
};

export const DPD_COLOR: Record<string, string> = {
  current: 'text-green-600 dark:text-green-400',
  mild: 'text-yellow-600 dark:text-yellow-400',
  moderate: 'text-orange-600 dark:text-orange-400',
  severe: 'text-red-600 dark:text-red-400',
  critical: 'text-red-900 dark:text-red-300',
};

export const DPD_BG: Record<string, string> = {
  current: 'bg-green-100 dark:bg-green-900/30',
  mild: 'bg-yellow-100 dark:bg-yellow-900/30',
  moderate: 'bg-orange-100 dark:bg-orange-900/30',
  severe: 'bg-red-100 dark:bg-red-900/30',
  critical: 'bg-red-200 dark:bg-red-900/50',
};
