import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Indian Currency Formatting ─────────────────
export function formatINR(amount: number, decimals = 0): string {
  if (isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_00_00_000) {
    // ≥ 1 crore
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    // ≥ 1 lakh
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  }

  // Standard Indian comma format
  const num = abs.toFixed(decimals);
  const [intPart, decPart] = num.split('.');
  let result = '';
  const len = intPart.length;

  if (len <= 3) {
    result = intPart;
  } else {
    // First 3 from right, then groups of 2
    result = intPart.slice(-3);
    let remaining = intPart.slice(0, len - 3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    result = remaining + ',' + result;
  }

  return `${sign}₹${result}${decPart ? '.' + decPart : ''}`;
}

export function formatINRExact(amount: number): string {
  if (isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const len = Math.floor(abs).toString().length;
  let result = Math.floor(abs).toString();

  if (len <= 3) {
    // nothing to do
  } else {
    let r = result.slice(-3);
    let rem = result.slice(0, len - 3);
    while (rem.length > 2) {
      r = rem.slice(-2) + ',' + r;
      rem = rem.slice(0, rem.length - 2);
    }
    r = rem + ',' + r;
    result = r;
  }

  const paise = Math.round((abs % 1) * 100);
  return `${sign}₹${result}${paise ? '.' + paise.toString().padStart(2, '0') : ''}`;
}

// Short label for KPI cards
export function formatINRShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// ── Date Formatting ────────────────────────────
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd-MMM-yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd-MMM-yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysAgo(dateStr: string): number {
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return 0;
  }
}

export function daysUntil(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return 0;
  }
}

// ── Loan Calculations ──────────────────────────
export interface ScheduleRow {
  instalment_no: number;
  due_date: string;
  principal: number;
  interest: number;
  total_emi: number;
  outstanding_balance: number;
}

export function generateRepaymentSchedule(params: {
  principal: number;
  interest_rate_monthly: number;   // flat monthly %
  tenure_months: number;
  start_date: string;              // yyyy-MM-dd
  repayment_frequency?: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
  pre_emi_months?: number;
  bullet?: boolean;
}): ScheduleRow[] {
  const {
    principal,
    interest_rate_monthly,
    tenure_months,
    start_date,
    pre_emi_months = 0,
    bullet = false,
  } = params;

  const schedule: ScheduleRow[] = [];
  const monthlyInterest = (principal * interest_rate_monthly) / 100;
  const totalInterest = monthlyInterest * tenure_months;
  const emi = bullet ? monthlyInterest : Math.round((principal + totalInterest) / tenure_months);

  let outstanding = principal;
  let date = parseISO(start_date);

  // Pre-EMI months (interest only)
  for (let i = 0; i < pre_emi_months; i++) {
    date = addMonths(date, 1);
    schedule.push({
      instalment_no: i + 1,
      due_date: format(date, 'yyyy-MM-dd'),
      principal: 0,
      interest: Math.round(monthlyInterest),
      total_emi: Math.round(monthlyInterest),
      outstanding_balance: outstanding,
    });
  }

  // Main schedule
  const mainEmiPrincipal = bullet ? 0 : Math.round(principal / tenure_months);

  for (let i = 0; i < tenure_months; i++) {
    date = addMonths(date, 1);
    const isLast = i === tenure_months - 1;
    const principalComponent = bullet
      ? isLast ? outstanding : 0
      : isLast ? outstanding : mainEmiPrincipal;
    const interestComponent = Math.round(monthlyInterest);
    const total = principalComponent + interestComponent;

    outstanding = Math.max(0, outstanding - principalComponent);

    schedule.push({
      instalment_no: pre_emi_months + i + 1,
      due_date: format(date, 'yyyy-MM-dd'),
      principal: principalComponent,
      interest: interestComponent,
      total_emi: total,
      outstanding_balance: outstanding,
    });
  }

  return schedule;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function calculateEMI(principal: number, monthlyRate: number, tenure: number): number {
  const totalInterest = (principal * monthlyRate * tenure) / 100;
  return Math.round((principal + totalInterest) / tenure);
}

// ── DPD Calculation ────────────────────────────
export function calcDPD(dueDate: string, paidDate?: string | null): number {
  if (paidDate) return 0;
  const due = parseISO(dueDate);
  const now = new Date();
  if (now <= due) return 0;
  return differenceInDays(now, due);
}

// ── String utils ───────────────────────────────
export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 4) return mobile;
  return mobile.slice(0, 2) + '•'.repeat(mobile.length - 4) + mobile.slice(-2);
}

// ── Validation ─────────────────────────────────
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

export function isValidAadhaar(aadhaar: string): boolean {
  return /^\d{12}$/.test(aadhaar);
}
