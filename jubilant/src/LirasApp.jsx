import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Chart from "chart.js/auto";
import html2canvas from "html2canvas";
import { callAiAction } from "./ai/aiClient.js";
import { deleteAttachmentBlob, getAttachmentBlob, putAttachmentBlob } from "./attachments/attachmentsStore.js";
import { callAdminAction } from "./backend/adminClient.js";
import { getFunctionsBaseUrl, setFunctionsBaseUrl } from "./backend/functionsBase.js";
import { BRAND, BrandMark, ReportBrandHeader } from "./brand/Brand.jsx";
import AndroidCrm from "./android/AndroidCrm.jsx";
import UnderwritingView from "./underwriting/UnderwritingView.jsx";
import PdView from "./pd/PdView.jsx";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  ClipboardList,
  Clock,
  Coffee,
  Database,
  DollarSign,
  Download,
  Edit2,
  FileBarChart,
  FileCheck,
  FileText,
  FileWarning,
  Globe,
  HelpCircle,
  History,
  Layout,
  Lightbulb,
  Link as LinkIcon,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  PenLine,
  PenTool,
  Phone,
  PieChart,
  Plus,
  Printer,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  Sheet,
  ShieldAlert,
  Sparkles,
  Star,
  Sun,
  Table2,
  Target,
  ThumbsDown,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  UploadCloud,
  UserCircle,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
  Layers,
} from "lucide-react";

// --- Configuration ---
const STATUS_CONFIG = {
  New: { days: 1, color: "bg-blue-100 text-blue-800", label: "New Lead", probability: 0.1 },
  "Meeting Scheduled": {
    days: 1,
    color: "bg-purple-100 text-purple-800",
    label: "Meeting Scheduled",
    probability: 0.4,
  },
  "Follow-Up Required": {
    days: 7,
    color: "bg-indigo-100 text-indigo-800",
    label: "Internal Follow-Up",
    probability: 0.2,
  },
  "Partner Follow-Up": {
    days: 3,
    color: "bg-pink-100 text-pink-800",
    label: "Partner Follow-Up",
    probability: 0.2,
  },
  "Statements Not Received": {
    days: 3,
    color: "bg-slate-100 text-slate-800",
    label: "Stmt Not Received",
    probability: 0.1,
  },
  "Contact Details Not Received": {
    days: 2,
    color: "bg-rose-100 text-rose-800",
    label: "No Contact Info",
    probability: 0.05,
  },
  "Interest Rate Issue": {
    days: 15,
    color: "bg-orange-100 text-orange-800",
    label: "Rate Issue",
    probability: 0.3,
  },
  "Commercial Client": {
    days: 7,
    color: "bg-teal-100 text-teal-800",
    label: "Commercial Client",
    probability: 0.5,
  },
  "Payment Done": { days: 30, color: "bg-green-100 text-green-800", label: "Payment Done", probability: 1.0 },
  "Deal Closed": { days: 90, color: "bg-emerald-100 text-emerald-800", label: "Deal Closed", probability: 1.0 },
  "No Appointment": { days: 5, color: "bg-yellow-100 text-yellow-800", label: "No Appointment", probability: 0.1 },
  "Lost to Competitor": {
    days: 365,
    color: "bg-gray-200 text-gray-600",
    label: "Lost to Competitor",
    probability: 0.0,
  },
  "Not Eligible": { days: 180, color: "bg-red-100 text-red-800", label: "Rejected", probability: 0.0 },
  "Not Reliable": { days: 365, color: "bg-red-100 text-red-800", label: "Not Reliable", probability: 0.0 },
  "Not Interested (Temp)": {
    days: 60,
    color: "bg-gray-100 text-gray-500",
    label: "Not Interested",
    probability: 0.0,
  },
};

const REJECTION_STRATEGIES = {
  Risk: {
    label: "Risk / Policy",
    color: "bg-red-100 text-red-800 border-red-200",
    reasons: ["Low CIBIL Score", "Insufficient Income", "Negative Area", "Collateral Issue", "Profile Mismatch", "Overleveraged"],
  },
  Competitor: {
    label: "Lost to Competitor",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    reasons: ["Better Rate Offered", "Higher LTV / Amount", "Faster Processing", "Client Relationship", "Lower Processing Fee"],
  },
  Internal: {
    label: "Internal Gap",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    reasons: ["Slow TAT / Delay", "Communication Gap", "Strict Policy", "Valuation Mismatch", "Document Collection Delay"],
  },
  Client: {
    label: "Client Withdrew",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    reasons: ["Not Interested", "Plan Dropped", "Duplicate Application", "Self-Funding"],
  },
};

const INITIAL_MEDIATORS = [
  { id: "1", name: "Aashish", phone: "9876543210" },
  { id: "2", name: "Rahul", phone: "9123456789" },
  { id: "3", name: "Direct/None", phone: "" },
];

const MOCK_LEADS = [];

// --- Helper Functions ---
const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const formatTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const getDaysDiff = (d) =>
  Math.ceil((new Date(new Date(d).setHours(0, 0, 0, 0)) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
const formatCurrency = (a) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(a || 0);

// NEW: Compact Currency Formatter for Reports (Cr/Lakhs)
const formatCompactCurrency = (num) => {
  const value = Number(num) || 0;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)} k`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
};

const isToday = (d) => {
  const date = new Date(d);
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
};
const isTomorrow = (d) => {
  const date = new Date(d);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
};
const isThisMonth = (d) => {
  const date = new Date(d);
  const t = new Date();
  return date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
};
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const toYmdLocal = (dateLike) => {
  try {
    const d = new Date(dateLike);
    if (!Number.isFinite(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
};

const isOnYmdLocal = (dateLike, ymd) => {
  if (!ymd) return false;
  return toYmdLocal(dateLike) === ymd;
};

const endOfLocalDay = (ymd) => new Date(`${ymd}T23:59:59`);
const startOfIstDay = (ymd) => new Date(`${ymd}T00:00:00+05:30`);
const endOfIstDay = (ymd) => new Date(`${ymd}T23:59:59+05:30`);

const toYmdInTimeZone = (dateLike, timeZone = BRAND.tz) => {
  try {
    const d = new Date(dateLike);
    if (!Number.isFinite(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
};

const toYmdIST = (dateLike) => toYmdInTimeZone(dateLike, BRAND.tz);
const isOnYmdIST = (dateLike, ymd) => (ymd ? toYmdIST(dateLike) === ymd : false);

const toYmIST = (dateLike) => {
  const ymd = toYmdIST(dateLike);
  return ymd ? ymd.slice(0, 7) : "";
};

const isOnYmIST = (dateLike, ym) => (ym ? toYmIST(dateLike) === ym : false);

const formatTimeIST = (dateLike) => {
  try {
    const d = new Date(dateLike);
    if (!Number.isFinite(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: BRAND.tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
};

const isTodayIST = (dateLike) => {
  const todayYmd = toYmdIST(new Date());
  return isOnYmdIST(dateLike, todayYmd);
};

const isTomorrowIST = (dateLike) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = toYmdIST(tomorrow);
  return isOnYmdIST(dateLike, tomorrowYmd);
};

const STALE_AFTER_DAYS = 3;

const daysSinceIST = (dateLike) => {
  const ymd = toYmdIST(dateLike);
  if (!ymd) return 0;
  const dayStart = startOfIstDay(ymd).getTime();
  const todayStart = startOfIstDay(toYmdIST(new Date())).getTime();
  if (!Number.isFinite(dayStart) || !Number.isFinite(todayStart)) return 0;
  return Math.floor((todayStart - dayStart) / 86400000);
};

const maxIsoDate = (values) => {
  let best = "";
  let bestMs = -Infinity;
  (values || []).forEach((v) => {
    if (!v) return;
    const parsed = parseIsoOrNull(v);
    const ms = parsed?.getTime?.() ?? NaN;
    if (!Number.isFinite(ms)) return;
    if (ms > bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  });
  return best;
};

const isClosedOrRejectedLeadStatus = (status) => {
  const s = String(status || "").trim();
  if (!s) return false;
  if (
    [
      "Payment Done",
      "Deal Closed",
      "Not Eligible",
      "Not Reliable",
      "Lost to Competitor",
      "Not Interested (Temp)",
      "Rejected",
    ].includes(s)
  ) {
    return true;
  }
  return /reject/i.test(s);
};

const getLeadLastActivityIso = (lead) => {
  const candidates = [];
  if (lead?.createdAt) candidates.push(lead.createdAt);
  if (lead?.loanDetails?.paymentDate) candidates.push(lead.loanDetails.paymentDate);
  const notes = Array.isArray(lead?.notes) ? lead.notes : [];
  if (notes.length) {
    const lastNote = notes[notes.length - 1];
    if (lastNote?.date) candidates.push(lastNote.date);
  }
  const attachments = Array.isArray(lead?.documents?.attachments) ? lead.documents.attachments : [];
  attachments.forEach((a) => a?.createdAt && candidates.push(a.createdAt));
  return maxIsoDate(candidates) || (lead?.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString());
};

const isStaleLead = (lead) => {
  if (!lead) return false;
  if (isClosedOrRejectedLeadStatus(lead.status) || lead.status === "Meeting Scheduled") return false;
  const nextAction = parseIsoOrNull(lead?.nextFollowUp);
  if (nextAction && getDaysDiff(nextAction) > 0) return false; // any future scheduled action means not stale
  return daysSinceIST(getLeadLastActivityIso(lead)) >= STALE_AFTER_DAYS;
};

const isMeetingDoneNoteText = (text) => {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  if (t.includes("meeting rescheduled") || t.includes("meeting scheduled")) return false;
  return (
    t.includes("[commercial visit]") ||
    t.includes("meeting/follow-up conducted") ||
    t.includes("meeting done") ||
    t.includes("meeting completed") ||
    t.includes("visit completed") ||
    t.includes("met client")
  );
};

const calculateLeadScore = (lead) => {
  let score = 0;
  if (lead.isHighPotential) score += 30;
  if (lead.documents?.kyc && (lead.documents.kyc === true || lead.documents.kyc.status)) score += 15;
  if (lead.documents?.itr && (lead.documents.itr === true || lead.documents.itr.status)) score += 15;
  if (lead.documents?.bank && (lead.documents.bank === true || lead.documents.bank.status)) score += 15;
  if (lead.company?.length > 3) score += 10;
  if (["Deal Closed", "Payment Done"].includes(lead.status)) return 100;
  if (["Not Eligible", "Not Reliable"].includes(lead.status)) return 0;
  if (lead.phone) score += 15;
  return Math.min(100, score);
};
const getScoreColor = (score) => (score >= 75 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500");

const calculateTAT = (lead) => {
  if (!lead.notes || lead.notes.length <= 1) return null;
  const sortedNotes = [...lead.notes].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstAction = sortedNotes.find(
    (n) =>
      n.type !== "system" ||
      (n.text && !n.text.includes("Lead captured") && !n.text.includes("Imported via CSV")) ||
      (n.text && n.text.startsWith("Status changed to"))
  );
  return firstAction ? Math.max(0, Math.round((new Date(firstAction.date) - new Date(lead.createdAt)) / 36e5)) : null;
};

// --- Shared Components ---
const SidebarItem = ({ icon: Icon, label, active, onClick, count, alert, href, target, rel }) => {
  const className = `relative w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all duration-200 rounded-xl mb-1 group ${
    active
      ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
      : "text-slate-300/80 hover:bg-white/5 hover:text-white"
  }`;

  const inner = (
    <>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-blue-400 rounded-r-full" />
      )}
      <div className="flex items-center gap-3">
        <Icon
          size={18}
          className={`${
            alert
              ? "text-red-400 animate-pulse"
              : active
                ? "text-indigo-300"
                : "text-slate-400 group-hover:text-slate-200"
          }`}
        />
        <span className={alert ? "text-red-400 font-bold" : ""}>{label}</span>
      </div>
      {count !== undefined && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            alert
              ? "bg-red-500 text-white"
              : active
                ? "bg-white/15 text-white"
                : "bg-white/10 text-slate-200/80"
          }`}
        >
          {count}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
};

const SectionTabs = ({ value, tabs, onChange, right = null }) => (
  <div className="print:hidden px-6 pt-4 pb-3 border-b border-slate-200 bg-white">
    <div className="flex flex-wrap items-center gap-2 justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const isActive = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange?.(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {right}
    </div>
  </div>
);

const StatCard = ({ title, value, color, icon: Icon, onClick }) => (
  <div
    className={`surface p-5 flex items-start justify-between transition-all hover:shadow-elevated ${
      onClick ? "cursor-pointer hover:ring-1 hover:ring-indigo-200" : ""
    }`}
    onClick={onClick}
  >
    <div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
    <div className={`p-3 rounded-2xl ${color} text-white shadow-soft`}>
      <Icon size={20} />
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children, large }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-fade-in print:hidden">
      <div
        className={`surface-solid shadow-elevated w-full ${large ? "max-w-5xl h-[90vh]" : "max-w-lg max-h-[90vh]"} overflow-hidden flex flex-col animate-slide-up`}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-200/60 bg-white/70 backdrop-blur">
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-secondary px-3 py-2">
            <X size={18} className="text-slate-700" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

const AnnouncementBanner = ({ announcement, onDismiss, canManage = false, onManage = null }) => {
  const a = announcement ? sanitizeAnnouncement(announcement) : null;
  if (!a || !a.isActive) return null;
  const styles = ANNOUNCEMENT_STYLES[a.severity] || ANNOUNCEMENT_STYLES.info;

  return (
    <div className={`surface-solid p-4 border ${styles.border} ${styles.bg} print:hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${styles.chip}`}>{a.severity}</span>
            <div className={`font-extrabold ${styles.text} truncate`}>{a.title || "Announcement"}</div>
          </div>
          {a.body ? <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{a.body}</div> : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && typeof onManage === "function" ? (
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={onManage} title="Open announcements">
              <Settings size={14} /> Manage
            </button>
          ) : null}
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={onDismiss} title="Dismiss">
            <X size={14} /> Close
          </button>
        </div>
      </div>
    </div>
  );
};

const parseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw ?? "") ?? fallback;
  } catch {
    return fallback;
  }
};

const safeLocalStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  },
};

const AI_TONE_OPTIONS = [
  { value: "partner", label: "Partner-friendly" },
  { value: "corporate", label: "Corporate" },
];

const AI_LANGUAGE_OPTIONS = ["English", "Tamil", "Hindi", "Telugu", "Malayalam", "Kannada"];

const copyToClipboard = async (value) => {
  const text = String(value || "");
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const isFollowUpStatusValue = (status) => {
  const s = String(status || "").trim().toUpperCase();
  if (!s) return false;
  if (s.includes("FOLLOW")) return true;
  return ["FOLLOW UP", "FOLLOW-UP", "FOLLOW_UP", "FOLLOW-UP REQUIRED", "FOLLOW_UP_REQUIRED", "PARTNER FOLLOW-UP", "PARTNER FOLLOW_UP"].includes(s);
};

const nextBusinessDay10AmIstIso = (baseDateLike = new Date()) => {
  const baseYmd = toYmdIST(baseDateLike) || toYmdIST(new Date());
  let probe = startOfIstDay(baseYmd);
  probe.setDate(probe.getDate() + 1);
  while (true) {
    const ymd = toYmdIST(probe);
    const dow = new Intl.DateTimeFormat("en-US", { timeZone: BRAND.tz, weekday: "short" }).format(new Date(`${ymd}T00:00:00+05:30`));
    if (dow !== "Sat" && dow !== "Sun") {
      return new Date(`${ymd}T10:00:00+05:30`).toISOString();
    }
    probe.setDate(probe.getDate() + 1);
  }
};

const simpleChecksum = (input) => {
  const text = typeof input === "string" ? input : JSON.stringify(input || {});
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `h${(h >>> 0).toString(16)}`;
};

const parseIsoOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Fast path for native ISO / RFC inputs.
  let d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;

  // Support common user-entered formats like DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY.
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    d = new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+05:30`);
    if (Number.isFinite(d.getTime())) return d;
  }

  // Support compact YYYYMMDD.
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    d = new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00+05:30`);
    if (Number.isFinite(d.getTime())) return d;
  }

  return null;
};

const parseTenorMonths = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const m = String(value).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
};

const isRenewalEligibleLead = (lead) => {
  if (!lead) return false;
  const status = String(lead.status || "").toUpperCase();
  if (["PAYMENT DONE", "DEAL CLOSED", "FUNDED", "ACTIVE"].includes(status)) return true;
  if (status.includes("RENEW")) return true;
  const loanDetails = lead.loanDetails && typeof lead.loanDetails === "object" ? lead.loanDetails : {};
  const tags = Array.isArray(lead.documents?.tags) ? lead.documents.tags.map((t) => String(t || "").toLowerCase()) : [];
  if (tags.some((t) => t.includes("renew"))) return true;
  const notes = Array.isArray(lead.notes) ? lead.notes : [];
  if (notes.some((n) => String(n?.text || n || "").toLowerCase().includes("renew"))) return true;
  if (lead.nextFollowUp && (status.includes("PAYMENT") || status.includes("DEAL") || status.includes("CLOSED"))) return true;
  if (loanDetails && Object.keys(loanDetails).length > 0) {
    if (
      loanDetails.paymentDate ||
      loanDetails.payment_date ||
      loanDetails.principal ||
      loanDetails.netDisbursed ||
      loanDetails.net_disbursed ||
      loanDetails.tenure ||
      loanDetails.tenureMonths ||
      loanDetails.tenor_months
    ) {
      return true;
    }
  }
  return Boolean(
    lead.nextRenewalDate ||
      lead.next_renewal_date ||
      lead.renewalDate ||
      lead.renewal_date ||
      lead.maturityDate ||
      lead.maturity_date ||
      lead.fundedDate ||
      lead.funded_date ||
    loanDetails.nextRenewalDate ||
      loanDetails.next_renewal_date ||
      loanDetails.nextRenewal ||
      loanDetails.renewalDate ||
      loanDetails.renewal_date ||
      loanDetails.maturityDate ||
      loanDetails.maturity_date ||
      loanDetails.fundedDate ||
      loanDetails.funded_date ||
      loanDetails.paymentDate ||
      loanDetails.payment_date
  );
};

const addMonthsIsoSafe = (value, months) => {
  const d = parseIsoOrNull(value);
  if (!d) return null;
  const next = new Date(d.getTime());
  next.setMonth(next.getMonth() + Number(months || 0));
  return Number.isFinite(next.getTime()) ? next : null;
};

const getRenewalTimelineInfo = (lead) => {
  const loanDetails = lead?.loanDetails && typeof lead.loanDetails === "object" ? lead.loanDetails : {};
  const nextRenewalRaw =
    lead?.nextRenewalDate ||
    lead?.next_renewal_date ||
    lead?.renewalDate ||
    lead?.renewal_date ||
    loanDetails.nextRenewalDate ||
    loanDetails.next_renewal_date ||
    loanDetails.nextRenewal ||
    loanDetails.renewalDate ||
    loanDetails.renewal_date ||
    null;
  const maturityRaw = lead?.maturityDate || lead?.maturity_date || loanDetails.maturityDate || loanDetails.maturity_date || loanDetails.maturity || null;
  const fundedRaw =
    lead?.fundedDate ||
    lead?.funded_date ||
    lead?.paymentDate ||
    lead?.payment_date ||
    loanDetails.fundedDate ||
    loanDetails.funded_date ||
    loanDetails.disbursedDate ||
    loanDetails.disbursed_date ||
    loanDetails.disbursementDate ||
    loanDetails.disbursement_date ||
    loanDetails.paymentDate ||
    loanDetails.payment_date ||
    null;
  const tenorRaw = lead?.tenureMonths || lead?.tenor_months || lead?.tenure || loanDetails.tenureMonths || loanDetails.tenor_months || loanDetails.tenure || null;

  const nextRenewal = parseIsoOrNull(nextRenewalRaw);
  if (nextRenewal) {
    return { renewalDate: nextRenewal, source: "next_renewal_date", priorityRank: 1 };
  }

  const maturity = parseIsoOrNull(maturityRaw);
  if (maturity) {
    return { renewalDate: maturity, source: "maturity_date", priorityRank: 2 };
  }

  const tenorMonths = parseTenorMonths(tenorRaw);
  if (tenorMonths > 0) {
    const fundedPlusTenor = addMonthsIsoSafe(fundedRaw, tenorMonths);
    if (fundedPlusTenor) {
      return { renewalDate: fundedPlusTenor, source: "funded_plus_tenor", priorityRank: 3 };
    }
  }

  // Legacy fallback for funded leads where renewal date is tracked in next follow-up.
  const leadFollowUp = parseIsoOrNull(lead?.nextFollowUp);
  if (leadFollowUp && isRenewalEligibleLead(lead)) {
    return { renewalDate: leadFollowUp, source: "lead_follow_up_fallback", priorityRank: 4 };
  }

  return { renewalDate: null, source: "unknown", priorityRank: 4 };
};

const sourceLabelForRenewal = (source) => {
  if (source === "next_renewal_date") return "Next Renewal";
  if (source === "maturity_date") return "Maturity";
  if (source === "funded_plus_tenor") return "Funded + Tenor";
  if (source === "lead_follow_up_fallback") return "Lead Follow-up";
  return "Unknown";
};

const monthKeyLabel = (ym) => {
  const d = new Date(`${ym}-01T00:00:00+05:30`);
  if (!Number.isFinite(d.getTime())) return ym;
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: BRAND.tz }).format(d);
};

const RenewalWatchTimeline = ({ leads = [], onOpenLead }) => {
  const [query, setQuery] = useState("");

  const fundedLeads = useMemo(
    () => (Array.isArray(leads) ? leads : []).filter((l) => isRenewalEligibleLead(l)),
    [leads]
  );

  const monthKeys = useMemo(() => {
    const anchorYm = toYmIST(new Date());
    const anchorDate = new Date(`${anchorYm || toYmdIST(new Date()).slice(0, 7)}-01T00:00:00+05:30`);
    const out = [];
    for (let i = 0; i < 6; i += 1) {
      const d = new Date(anchorDate.getTime());
      d.setMonth(d.getMonth() + i);
      const ym = toYmIST(d);
      if (ym) out.push(ym);
    }
    return out;
  }, []);

  const rows = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return fundedLeads
      .map((lead) => {
        const info = getRenewalTimelineInfo(lead);
        const renewalYmd = info.renewalDate ? toYmdIST(info.renewalDate) : "";
        const renewalMonthKey = renewalYmd ? renewalYmd.slice(0, 7) : "";
        const nextActionDate = parseIsoOrNull(lead?.nextFollowUp);
        const nextActionYmd = nextActionDate ? toYmdIST(nextActionDate) : "";
        const nextActionMonthKey = nextActionYmd ? nextActionYmd.slice(0, 7) : "";
        let monthKey = "";
        let monthReason = "";
        if (renewalMonthKey && monthKeys.includes(renewalMonthKey)) {
          monthKey = renewalMonthKey;
          monthReason = "renewal";
        } else if (nextActionMonthKey && monthKeys.includes(nextActionMonthKey)) {
          monthKey = nextActionMonthKey;
          monthReason = "next_action";
        }
        return {
          lead,
          ...info,
          renewalYmd,
          renewalMonthKey,
          nextActionDate,
          nextActionYmd,
          nextActionMonthKey,
          monthKey,
          monthReason,
        };
      })
      .filter((r) => {
        if (!q) return true;
        const hay = [r.lead?.name, r.lead?.company, r.lead?.id, r.renewalYmd, r.nextActionYmd, sourceLabelForRenewal(r.source)].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        const aDate = a.renewalDate || a.nextActionDate || null;
        const bDate = b.renewalDate || b.nextActionDate || null;
        const am = aDate ? aDate.getTime() : Number.POSITIVE_INFINITY;
        const bm = bDate ? bDate.getTime() : Number.POSITIVE_INFINITY;
        if (am !== bm) return am - bm;
        return String(a.lead?.name || "").localeCompare(String(b.lead?.name || ""));
      });
  }, [fundedLeads, query, monthKeys]);

  const monthBuckets = useMemo(() => {
    const map = new Map(monthKeys.map((ym) => [ym, []]));
    const unknown = [];
      rows.forEach((row) => {
        if (row.monthKey && map.has(row.monthKey)) {
          map.get(row.monthKey).push(row);
        } else {
          unknown.push(row);
        }
      });
    return { map, unknown };
  }, [rows, monthKeys]);

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Renewal Watch</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">Next 6 months timeline</div>
            <div className="text-xs text-slate-500 mt-1">
              Priority: next renewal date → maturity date → funded date + tenor → unknown. If renewal is beyond 6 months, the lead can still appear by next action month.
            </div>
          </div>
          <div className="w-full md:w-[320px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-3"
              placeholder="Search client / loan id / renewal date…"
            />
          </div>
        </div>
      </div>

      {monthKeys.map((ym) => {
        const items = monthBuckets.map.get(ym) || [];
        return (
          <div key={ym} className="surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-extrabold text-slate-900">{monthKeyLabel(ym)}</div>
              <div className="text-xs text-slate-500">{items.length} client{items.length === 1 ? "" : "s"}</div>
            </div>
            {items.length === 0 ? (
              <div className="mt-3 text-sm text-slate-400 italic">No renewals / next actions in this month.</div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                    <tr>
                      <th className="p-3 text-left">Client</th>
                      <th className="p-3 text-left">Bucket</th>
                      <th className="p-3 text-left">Renewal Source</th>
                      <th className="p-3 text-left">Renewal Date</th>
                      <th className="p-3 text-left">Next Action</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((r) => (
                      <tr
                        key={`${r.lead.id}_${r.monthKey || r.renewalYmd || r.nextActionYmd || "unknown"}`}
                        onClick={() => onOpenLead?.(r.lead)}
                        className="cursor-pointer hover:bg-slate-50 transition"
                      >
                        <td className="p-3 min-w-[260px]">
                          <div className="font-bold text-slate-900">{r.lead.name || "—"}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Loan ID: {r.lead.id}
                            {r.lead.company ? ` • ${r.lead.company}` : ""}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.monthReason === "next_action" ? (
                            <span className="chip bg-blue-50 border-blue-200 text-blue-700">Next Action Month</span>
                          ) : (
                            <span className="chip bg-slate-50 border-slate-200 text-slate-700">Renewal Month</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="chip bg-slate-50 border-slate-200 text-slate-700">{sourceLabelForRenewal(r.source)}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.renewalYmd ? (
                            <span className="chip bg-orange-50 border-orange-200 text-orange-700">{r.renewalYmd}</span>
                          ) : (
                            <span className="text-slate-400">Unknown</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.nextActionYmd ? (
                            <span className="chip bg-emerald-50 border-emerald-200 text-emerald-700">{r.nextActionYmd}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap font-bold text-slate-700">
                          {formatCurrency(r.lead.loanAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div className="surface p-4">
        <div className="font-extrabold text-slate-900">Unknown Renewal Date</div>
        {monthBuckets.unknown.length === 0 ? (
          <div className="mt-2 text-sm text-slate-400 italic">No unknown items.</div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Next Action</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthBuckets.unknown.map((r) => (
                  <tr
                    key={`${r.lead.id}_unknown`}
                    onClick={() => onOpenLead?.(r.lead)}
                    className="cursor-pointer hover:bg-slate-50 transition"
                  >
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.lead.name || "—"}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Loan ID: {r.lead.id}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-600">{r.nextActionYmd || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="chip bg-slate-50 border-slate-200 text-slate-700">Add next renewal / maturity in loan details</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportsHealthCheckPanel = ({ backendEnabled, supabase, authUser, leads }) => {
  const userId = authUser?.id || "";
  const fallbackKey = useMemo(() => `liras_report_health_v1_${userId || "offline"}`, [userId]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeRegenKey, setActiveRegenKey] = useState("");

  const last14Days = useMemo(() => {
    const out = [];
    const todayYmd = toYmdIST(new Date());
    const today = startOfIstDay(todayYmd);
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      const ymd = toYmdIST(d);
      if (ymd) out.push(ymd);
    }
    return out;
  }, []);

  const readFallbackRows = () => {
    const parsed = parseJson(safeLocalStorage.getItem(fallbackKey), []);
    return Array.isArray(parsed) ? parsed : [];
  };

  const writeFallbackRows = (nextRows) => {
    safeLocalStorage.setItem(fallbackKey, JSON.stringify(Array.isArray(nextRows) ? nextRows : []));
  };

  const computeHealthRecord = (reportDate, reportType) => {
    const dateYmd = String(reportDate || "");
    const allLeads = Array.isArray(leads) ? leads : [];
    const isOnYmdFlexible = (value) => {
      if (!dateYmd) return false;
      const parsed = parseIsoOrNull(value);
      return parsed ? toYmdIST(parsed) === dateYmd : false;
    };

    const noteEvents = [];
    const dueEvents = [];
    allLeads.forEach((l) => {
      if (!l) return;
      if (isOnYmdFlexible(l.createdAt)) {
        noteEvents.push({ kind: "lead_created", leadId: String(l.id || "") });
      }
      if (isOnYmdFlexible(l.nextFollowUp)) {
        dueEvents.push({ kind: "next_follow_up", leadId: String(l.id || ""), status: String(l.status || "") });
      }
      (Array.isArray(l.notes) ? l.notes : []).forEach((n, idx) => {
        if (isOnYmdFlexible(n?.date)) {
          noteEvents.push({
            kind: "note",
            leadId: String(l.id || ""),
            idx,
            text: String(n?.text || "").slice(0, 120),
          });
        }
      });
    });

    const rawActivityCount = noteEvents.length + dueEvents.length;
    const rowCount = reportType === "EOD" ? Math.max(noteEvents.length, dueEvents.length) : rawActivityCount;
    const emptyOutputMismatch = rowCount === 0 && rawActivityCount > 0;
    const payload = {
      owner_id: userId || null,
      report_date: dateYmd,
      report_type: reportType,
      row_count: rowCount,
      totals_checksum: simpleChecksum({
        reportType,
        reportDate: dateYmd,
        noteEvents,
        dueEvents,
      }),
      status: emptyOutputMismatch ? "FAILED" : "SUCCESS",
      activity_count: rawActivityCount,
      regenerated_at: new Date().toISOString(),
      meta_json: {
        generated_at: new Date().toISOString(),
        error_reason: emptyOutputMismatch ? "Empty output mismatch" : "",
        note_events: noteEvents.length,
        due_events: dueEvents.length,
      },
    };
    return payload;
  };

  const loadRows = async () => {
    setError("");
    if (!backendEnabled || !supabase || !userId) {
      setRows(readFallbackRows());
      return;
    }
    setBusy(true);
    try {
      const oldest = last14Days[last14Days.length - 1];
      const { data, error: e } = await supabase
        .from("report_health_checks")
        .select("*")
        .eq("owner_id", userId)
        .gte("report_date", oldest)
        .order("report_date", { ascending: false })
        .order("report_type", { ascending: true });
      if (e) throw e;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e?.message || e));
      setRows(readFallbackRows());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadRows().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendEnabled, userId, fallbackKey]);

  const upsertHealthRecord = async (reportDate, reportType) => {
    const regenKey = `${reportDate}_${reportType}`;
    setActiveRegenKey(regenKey);
    setError("");
    const payload = computeHealthRecord(reportDate, reportType);
    try {
      if (backendEnabled && supabase && userId) {
        const { error: e } = await supabase.from("report_health_checks").upsert(payload, { onConflict: "owner_id,report_date,report_type" });
        if (e) throw e;
        await loadRows();
      } else {
        const prev = readFallbackRows();
        const next = [...prev.filter((r) => !(String(r?.report_date) === reportDate && String(r?.report_type) === reportType)), payload];
        writeFallbackRows(next);
        setRows(next);
      }
    } catch (e) {
      setError(String(e?.message || e));
      const prev = readFallbackRows();
      const next = [...prev.filter((r) => !(String(r?.report_date) === reportDate && String(r?.report_type) === reportType)), payload];
      writeFallbackRows(next);
      setRows(next);
    } finally {
      setActiveRegenKey("");
    }
  };

  const matrix = useMemo(() => {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const key = `${String(r?.report_date || "")}_${String(r?.report_type || "")}`;
      map.set(key, r);
    });
    return map;
  }, [rows]);

  const statusChip = (status) => {
    const s = String(status || "MISSING").toUpperCase();
    if (s === "SUCCESS") return "chip bg-emerald-50 border-emerald-200 text-emerald-700";
    if (s === "FAILED") return "chip bg-rose-50 border-rose-200 text-rose-700";
    return "chip bg-slate-50 border-slate-200 text-slate-600";
  };

  return (
    <div className="surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Reports Health Check</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">Daily Activity + EOD (last 14 days)</div>
          <div className="text-xs text-slate-500 mt-1">Regenerate is idempotent by owner + date + report type.</div>
        </div>
        <button type="button" className="btn-secondary px-3 py-2" onClick={() => loadRows()} disabled={busy}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{error}</div> : null}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Daily Activity</th>
              <th className="p-3 text-left">EOD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {last14Days.map((ymd) => {
              const daily = matrix.get(`${ymd}_DAILY_ACTIVITY`) || null;
              const eod = matrix.get(`${ymd}_EOD`) || null;
              const renderCell = (row, reportType) => {
                const status = row?.status || "MISSING";
                const regenKey = `${ymd}_${reportType}`;
                const meta = row?.meta_json && typeof row.meta_json === "object" ? row.meta_json : {};
                return (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={statusChip(status)}>{status}</span>
                      <span className="text-[11px] text-slate-500">rows: {row?.row_count ?? "—"}</span>
                      <span className="text-[11px] text-slate-500">activity: {row?.activity_count ?? "—"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Generated: {row?.regenerated_at ? `${formatDate(row.regenerated_at)} ${formatTime(row.regenerated_at)}` : row?.created_at ? `${formatDate(row.created_at)} ${formatTime(row.created_at)}` : "—"}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">Checksum: {row?.totals_checksum || "—"}</div>
                    {meta?.error_reason ? <div className="text-[11px] text-rose-700">{String(meta.error_reason)}</div> : null}
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs"
                      onClick={() => upsertHealthRecord(ymd, reportType)}
                      disabled={activeRegenKey === regenKey}
                    >
                      <RotateCcw size={12} /> {activeRegenKey === regenKey ? "Regenerating…" : "Regenerate"}
                    </button>
                  </div>
                );
              };
              return (
                <tr key={ymd}>
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-900">{ymd}</div>
                    <div className="text-xs text-slate-500">{formatDate(`${ymd}T00:00:00+05:30`)}</div>
                  </td>
                  <td className="p-3 align-top">{renderCell(daily, "DAILY_ACTIVITY")}</td>
                  <td className="p-3 align-top">{renderCell(eod, "EOD")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AiToneLanguageControls = ({ tone, setTone, language, setLanguage, disabled = false, compact = false }) => (
  <div className={`flex ${compact ? "flex-col sm:flex-row" : "flex-col"} gap-2`}>
    <select
      value={tone}
      onChange={(e) => setTone(e.target.value)}
      disabled={disabled}
      className="p-2 border rounded bg-white text-sm font-bold text-slate-700 disabled:opacity-60"
      aria-label="AI tone"
    >
      {AI_TONE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      disabled={disabled}
      className="p-2 border rounded bg-white text-sm font-bold text-slate-700 disabled:opacity-60"
      aria-label="AI language"
    >
      {AI_LANGUAGE_OPTIONS.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  </div>
);

const ensureIsoString = (value, fallbackIso) => {
  if (!value) return fallbackIso;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : fallbackIso;
};

const sanitizeLead = (raw) => {
  const nowIso = new Date().toISOString();
  const nextIso = new Date(Date.now() + 86400000).toISOString();
  const l = raw && typeof raw === "object" ? raw : {};

  const notesRaw = Array.isArray(l.notes) ? l.notes : [];
  const notes = notesRaw
    .map((n) => {
      if (!n) return null;
      if (typeof n === "string") return { text: n, date: nowIso };
      if (typeof n === "object") return { text: String(n.text || ""), date: ensureIsoString(n.date, nowIso) };
      return null;
    })
    .filter(Boolean);

  const docs = l.documents && typeof l.documents === "object" ? l.documents : {};
  const tagsRaw = Array.isArray(docs.tags) ? docs.tags : [];
  const tags = tagsRaw.map((t) => String(t || "").trim()).filter(Boolean);
  const attachmentsRaw = Array.isArray(docs.attachments) ? docs.attachments : [];
  const attachments = attachmentsRaw.filter((a) => a && typeof a === "object");
  const documents = {
    ...(docs || {}),
    kyc: !!(typeof docs.kyc === "object" && docs.kyc !== null ? docs.kyc.status : docs.kyc),
    itr: !!(typeof docs.itr === "object" && docs.itr !== null ? docs.itr.status : docs.itr),
    bank: !!(typeof docs.bank === "object" && docs.bank !== null ? docs.bank.status : docs.bank),
    tags,
    attachments,
  };

  return {
    id: String(l.id || Date.now() + Math.random()),
    name: String(l.name || ""),
    phone: String(l.phone || ""),
    company: String(l.company || ""),
    location: String(l.location || ""),
    status: String(l.status || "New"),
    loanAmount: Number(l.loanAmount || 0),
    createdAt: ensureIsoString(l.createdAt, nowIso),
    nextFollowUp: ensureIsoString(l.nextFollowUp, nextIso),
    mediatorId: String(l.mediatorId || "3"),
    isHighPotential: !!l.isHighPotential,
    notes,
    documents,
    loanDetails: l.loanDetails || undefined,
    rejectionDetails: l.rejectionDetails || undefined,
    assignedStaff: l.assignedStaff || undefined,
    ownerId: l.ownerId || undefined,
    createdBy: l.createdBy || undefined,
  };
};

const sanitizeMediator = (raw) => {
  const m = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(m.id || Date.now() + Math.random()),
    name: String(m.name || ""),
    phone: String(m.phone || ""),
    followUpHistory: Array.isArray(m.followUpHistory) ? m.followUpHistory : [],
    ownerId: m.ownerId || undefined,
    createdBy: m.createdBy || undefined,
    createdAt: m.createdAt || undefined,
  };
};

const sanitizeAnnouncement = (raw) => {
  const a = raw && typeof raw === "object" ? raw : {};
  const severity = String(a.severity || a.level || "info").toLowerCase();
  const audienceRole = String(a.audienceRole || a.audience_role || a.audience || "all").toLowerCase();
  return {
    id: String(a.id || Date.now() + Math.random()),
    title: String(a.title || "").slice(0, 140),
    body: String(a.body || a.message || "").slice(0, 2000),
    severity: ["info", "success", "warning", "danger"].includes(severity) ? severity : "info",
    audienceRole: ["all", "staff", "admin"].includes(audienceRole) ? audienceRole : "all",
    startsAt: a.startsAt || a.starts_at || "",
    endsAt: a.endsAt || a.ends_at || "",
    isActive: a.isActive === false ? false : Boolean(a.is_active ?? a.isActive ?? true),
    createdAt: a.createdAt || a.created_at || new Date().toISOString(),
    createdBy: a.createdBy || a.created_by || "",
  };
};

const ANNOUNCEMENT_STYLES = {
  info: { border: "border-indigo-200/70", bg: "bg-indigo-50/70", text: "text-indigo-900", chip: "bg-indigo-100 border-indigo-200 text-indigo-700" },
  success: { border: "border-emerald-200/70", bg: "bg-emerald-50/70", text: "text-emerald-900", chip: "bg-emerald-100 border-emerald-200 text-emerald-700" },
  warning: { border: "border-amber-200/70", bg: "bg-amber-50/70", text: "text-amber-950", chip: "bg-amber-100 border-amber-200 text-amber-800" },
  danger: { border: "border-rose-200/70", bg: "bg-rose-50/70", text: "text-rose-950", chip: "bg-rose-100 border-rose-200 text-rose-800" },
};

// --- SETTINGS MODAL ---
const SettingsModal = ({
  isOpen,
  onClose,
  exportCSV,
  importCSV,
  handleBackup,
  handleRestore,
  backendEnabled,
  isAdmin,
  supabase,
  onUsersChanged,
  announcements,
  announcementsError,
  onCreateAnnouncement,
  onDeactivateAnnouncement,
  onDeleteAnnouncement,
  onReloadAnnouncements,
}) => {
  const about = useMemo(() => {
    const platform = (() => {
      try {
        const p = String(document.documentElement?.dataset?.platform || "");
        if (p === "android") return "Android App";
        if (p === "ios") return "iPhone App";
        return "Web";
      } catch {
        return "Web";
      }
    })();

    const origin = (() => {
      try {
        return window.location.origin || "";
      } catch {
        return "";
      }
    })();

    const buildTimeLabel = (() => {
      try {
        return new Date(__BUILD_TIME__).toLocaleString("en-IN", { timeZone: BRAND.tz });
      } catch {
        return String(__BUILD_TIME__);
      }
    })();

    return { platform, origin, buildTimeLabel, gitSha: String(__GIT_SHA__ || "") };
  }, []);

  const [functionsBaseUrlInput, setFunctionsBaseUrlInput] = useState(() => {
    try {
      return safeLocalStorage.getItem("liras_functions_base_url") || "";
    } catch {
      return "";
    }
  });
  const [functionsBaseUrlOk, setFunctionsBaseUrlOk] = useState("");
  const [functionsBaseUrlError, setFunctionsBaseUrlError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setFunctionsBaseUrlOk("");
    setFunctionsBaseUrlError("");
    try {
      setFunctionsBaseUrlInput(safeLocalStorage.getItem("liras_functions_base_url") || "");
    } catch {
      setFunctionsBaseUrlInput("");
    }
  }, [isOpen]);

  const saveFunctionsBaseUrl = () => {
    setFunctionsBaseUrlOk("");
    setFunctionsBaseUrlError("");
    const val = String(functionsBaseUrlInput || "").trim();
    if (val && !/^https?:\/\//i.test(val)) {
      setFunctionsBaseUrlError("Enter a full URL like https://jubilantcrm.netlify.app");
      return;
    }
    setFunctionsBaseUrl(val);
    setFunctionsBaseUrlOk(val ? "Saved. Re-open this screen if you still see errors." : "Cleared. Web will use relative functions.");
  };

  const handleResetLocal = () => {
    if (confirm("DANGER: This will delete ALL local data on this device. Are you sure?")) {
      if (confirm("Double Check: Have you downloaded a backup?")) {
        safeLocalStorage.clear();
        window.location.reload();
      }
    }
  };

  const [userMode, setUserMode] = useState("create"); // create | invite
  const [userEmail, setUserEmail] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [userPassword, setUserPassword] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userOk, setUserOk] = useState("");
  const [userError, setUserError] = useState("");

  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceSeverity, setAnnounceSeverity] = useState("info");
  const [announceAudience, setAnnounceAudience] = useState("all");
  const [announceStartsAt, setAnnounceStartsAt] = useState("");
  const [announceEndsAt, setAnnounceEndsAt] = useState("");
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceOk, setAnnounceOk] = useState("");
  const [announceError, setAnnounceError] = useState("");

  const generatePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint8Array(14);
    try {
      (globalThis.crypto || window.crypto).getRandomValues(bytes);
    } catch {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = "";
    for (const b of bytes) out += alphabet[b % alphabet.length];
    setUserPassword(out);
  };

  const submitUser = async () => {
    setUserOk("");
    setUserError("");
    setUserBusy(true);
    try {
      const redirectTo = (() => {
        try {
          return /^https?:$/.test(window.location.protocol) ? window.location.origin : "";
        } catch {
          return "";
        }
      })();

      const action = userMode === "invite" ? "invite_user" : "create_user";
      const payload = {
        email: userEmail,
        fullName: userFullName,
        role: userRole,
        password: userMode === "invite" ? undefined : userPassword,
        redirectTo,
      };

      await callAdminAction({ supabase, action, payload });
      setUserOk(userMode === "invite" ? "Invite sent. Ask the user to check email and set a password." : "User created successfully.");
      setUserEmail("");
      setUserFullName("");
      setUserPassword("");
      onUsersChanged?.();
    } catch (err) {
      setUserError(err?.message || "Failed to create user");
    } finally {
      setUserBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setAnnounceOk("");
    setAnnounceError("");
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Management & Settings">
      <div className="space-y-6">
        <div className="surface-solid p-4">
          <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Database size={18} className="text-indigo-600" /> Backup & Restore
          </h3>
          <p className="text-xs text-slate-600 mb-4">
            {backendEnabled
              ? "Export your data to a JSON backup. Restoring will import and add records into your account."
              : "Save your entire system state (leads, mediators, settings) to a JSON file."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBackup}
              className="flex-1 btn-primary py-2 text-xs"
            >
              <Download size={14} /> Download Backup
            </button>
            <label className="flex-1 btn-secondary py-2 text-xs cursor-pointer">
              <UploadCloud size={14} /> Restore from File
              <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
            </label>
          </div>
        </div>

        <div className="surface-solid p-4">
          <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Sheet size={18} className="text-emerald-600" /> Excel / CSV
          </h3>
          <p className="text-xs text-slate-600 mb-4">Export list for analysis in Excel or bulk import leads from a CSV file.</p>
          <div className="flex gap-3">
            <button
              onClick={exportCSV}
              className="flex-1 py-2 rounded-xl font-bold text-xs text-white shadow-soft transition active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            >
              <Download size={14} /> Export CSV
            </button>
            <label className="flex-1 btn-secondary py-2 text-xs cursor-pointer">
              <Upload size={14} /> Import CSV
              <input type="file" className="hidden" accept=".csv" onChange={importCSV} />
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200">
          {backendEnabled ? (
            <div className="text-xs text-slate-500 text-center">
              Factory reset is disabled in backend mode. Use backups for migration, or ask an admin to purge data in Supabase.
            </div>
          ) : (
            <button
              onClick={handleResetLocal}
              className="w-full text-red-500 hover:text-red-700 text-xs font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} /> Factory Reset (Clear Local Data)
            </button>
          )}
        </div>

        {backendEnabled && isAdmin && (
          <div className="surface-solid p-4">
            <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
              <UserPlus size={18} className="text-indigo-600" /> Admin: Add Staff Account
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Create users without exposing your Supabase service key to the browser. Requires Netlify env var{" "}
              <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>.
            </p>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setUserMode("create")}
                className={`py-2 rounded-lg text-xs font-extrabold transition ${userMode === "create" ? "bg-white shadow-soft text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Create (Set Password)
              </button>
              <button
                type="button"
                onClick={() => setUserMode("invite")}
                className={`py-2 rounded-lg text-xs font-extrabold transition ${userMode === "invite" ? "bg-white shadow-soft text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Invite (Email Link)
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
                  <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full py-3" placeholder="staff@company.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Full Name</label>
                  <input value={userFullName} onChange={(e) => setUserFullName(e.target.value)} className="w-full py-3" placeholder="(optional)" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Role</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full py-3 text-sm">
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {userMode === "create" ? (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Temporary Password</label>
                    <div className="flex gap-2">
                      <input
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        className="flex-1 py-3"
                        placeholder="Min 8 characters"
                        type="text"
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={generatePassword} className="btn-secondary px-3 py-2 text-xs whitespace-nowrap">
                        Generate
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Share this password with the user. They can change it after login.</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 flex items-end">
                    Supabase will email an invite link. Ensure your Supabase Auth “Site URL” includes your Netlify domain.
                  </div>
                )}
              </div>

              {userError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{userError}</div>}
              {userOk && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-bold">{userOk}</div>}

              <button
                type="button"
                disabled={userBusy}
                onClick={submitUser}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-soft transition ${
                  userBusy ? "bg-slate-400" : "bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900"
                }`}
              >
                {userBusy ? "Working…" : userMode === "invite" ? "Send Invite" : "Create User"}
              </button>
            </div>
          </div>
        )}

        {backendEnabled && isAdmin && (
          <div className="surface-solid p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                <Mail size={18} className="text-indigo-600" /> Admin: Announcements
              </h3>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onReloadAnnouncements?.()}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">Post a banner for staff. Staff can dismiss per device.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Title</label>
                <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} className="w-full py-3" placeholder="System update / reminder…" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Message</label>
                <textarea value={announceBody} onChange={(e) => setAnnounceBody(e.target.value)} className="w-full p-3 h-24 resize-none text-sm" placeholder="Write a short message…" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Severity</label>
                  <select value={announceSeverity} onChange={(e) => setAnnounceSeverity(e.target.value)} className="w-full py-3 text-sm">
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Audience</label>
                  <select value={announceAudience} onChange={(e) => setAnnounceAudience(e.target.value)} className="w-full py-3 text-sm">
                    <option value="all">All</option>
                    <option value="staff">Staff (and admin)</option>
                    <option value="admin">Admin only</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Starts (optional)</label>
                  <input type="datetime-local" value={announceStartsAt} onChange={(e) => setAnnounceStartsAt(e.target.value)} className="w-full py-3" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ends (optional)</label>
                  <input type="datetime-local" value={announceEndsAt} onChange={(e) => setAnnounceEndsAt(e.target.value)} className="w-full py-3" />
                </div>
              </div>

              {announcementsError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 font-bold">
                  Announcements not available: {announcementsError}
                  <div className="text-[11px] font-medium text-amber-800 mt-1">
                    If this is a new backend, run the “Announcements” SQL in <span className="font-mono">jubilant/SUPABASE_SETUP.md</span>.
                  </div>
                </div>
              ) : null}

              {announceError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{announceError}</div>}
              {announceOk && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-bold">{announceOk}</div>}

              <button
                type="button"
                disabled={announceBusy}
                onClick={async () => {
                  setAnnounceOk("");
                  setAnnounceError("");
                  setAnnounceBusy(true);
                  try {
                    await onCreateAnnouncement?.({
                      title: announceTitle,
                      body: announceBody,
                      severity: announceSeverity,
                      audienceRole: announceAudience,
                      startsAt: announceStartsAt ? new Date(announceStartsAt).toISOString() : "",
                      endsAt: announceEndsAt ? new Date(announceEndsAt).toISOString() : "",
                    });
                    setAnnounceOk("Announcement posted.");
                    setAnnounceTitle("");
                    setAnnounceBody("");
                    setAnnounceSeverity("info");
                    setAnnounceAudience("all");
                    setAnnounceStartsAt("");
                    setAnnounceEndsAt("");
                    onReloadAnnouncements?.();
                  } catch (err) {
                    setAnnounceError(err?.message || "Failed to post announcement");
                  } finally {
                    setAnnounceBusy(false);
                  }
                }}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-soft transition ${
                  announceBusy ? "bg-slate-400" : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                }`}
              >
                {announceBusy ? "Posting…" : "Post Announcement"}
              </button>
            </div>

            <div className="mt-5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">Recent</div>
              {(Array.isArray(announcements) ? announcements : []).length === 0 ? (
                <div className="text-xs text-slate-500 italic">No announcements yet.</div>
              ) : (
                <div className="space-y-2">
                  {(announcements || [])
                    .map(sanitizeAnnouncement)
                    .slice(0, 10)
                    .map((a) => {
                      const styles = ANNOUNCEMENT_STYLES[a.severity] || ANNOUNCEMENT_STYLES.info;
                      const created = a.createdAt
                        ? new Date(a.createdAt).toLocaleString("en-IN", { timeZone: BRAND.tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "";
                      return (
                        <div key={a.id} className={`rounded-2xl border p-3 bg-white/70 ${styles.border}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`chip ${styles.chip}`}>{a.severity}</span>
                                <span className="chip">{a.audienceRole}</span>
                                {!a.isActive ? <span className="chip bg-slate-100 border-slate-200 text-slate-600">inactive</span> : null}
                              </div>
                              <div className="font-extrabold text-slate-900 mt-1 truncate">{a.title}</div>
                              {a.body ? <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{a.body.slice(0, 220)}</div> : null}
                              {created ? <div className="text-[10px] text-slate-400 mt-2 font-mono">{created}</div> : null}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                              {a.isActive ? (
                                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => onDeactivateAnnouncement?.(a.id)}>
                                  <Ban size={14} /> Deactivate
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn-secondary px-3 py-2 text-xs"
                                onClick={() => {
                                  if (!confirm("Delete this announcement?")) return;
                                  onDeleteAnnouncement?.(a.id);
                                }}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {backendEnabled && (
          <div className="surface-solid p-4">
            <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
              <Globe size={18} className="text-indigo-600" /> Mobile App: Netlify Site URL
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Needed for <span className="font-bold">AI</span> and <span className="font-bold">Admin tools</span> inside the Android/iPhone app (Capacitor uses a non-HTTP origin, so relative URLs won’t work).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                value={functionsBaseUrlInput}
                onChange={(e) => setFunctionsBaseUrlInput(e.target.value)}
                className="w-full py-3"
                placeholder="https://jubilantcrm.netlify.app"
                inputMode="url"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                  onClick={() => {
                    try {
                      if (/^https?:$/.test(window.location.protocol)) {
                        setFunctionsBaseUrlInput(window.location.origin);
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  title="Use current website URL"
                >
                  Use this site
                </button>
                <button type="button" className="btn-primary px-3 py-2 text-xs whitespace-nowrap" onClick={saveFunctionsBaseUrl}>
                  Save
                </button>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              Current: <span className="font-mono font-bold">{getFunctionsBaseUrl() || "relative (web-only)"}</span>
            </div>
            {functionsBaseUrlError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{functionsBaseUrlError}</div>
            )}
            {functionsBaseUrlOk && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-bold">{functionsBaseUrlOk}</div>
            )}
          </div>
        )}

        <div className="surface-solid p-4">
          <h3 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <HelpCircle size={18} className="text-slate-700" /> About This Build
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Platform</div>
              <div className="mt-1 font-extrabold text-slate-900">{about.platform}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mode</div>
              <div className="mt-1 font-extrabold text-slate-900">{backendEnabled ? "Cloud" : "Offline"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Build Time (IST)</div>
              <div className="mt-1 font-extrabold text-slate-900">{about.buildTimeLabel}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Git SHA</div>
              <div className="mt-1 font-mono font-bold text-slate-800">{about.gitSha || "—"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3 md:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">URL</div>
              <div className="mt-1 font-mono font-bold text-slate-800 break-all">{about.origin || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// --- WIDGETS ---
const MediatorFollowUpWidget = ({ mediators, onFollowUp }) => {
  const today = toYmdIST(new Date());
  const activeMediators = mediators.filter((m) => m.id !== "3"); // Exclude Direct/None

  return (
    <div className="surface p-5 h-full flex flex-col">
      <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-200/60">
        <Users className="text-indigo-600" size={18} /> Daily Partner Connect
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activeMediators.map((m) => {
          const history = (m.followUpHistory || [])
            .map((entry) => (typeof entry === "string" ? { date: entry, time: "--", type: "legacy" } : entry))
            .filter((h) => h && typeof h === "object" && typeof h.date === "string");
          const doneEntry = [...history]
            .reverse()
            .find((h) => (h?.ts ? toYmdIST(h.ts) === today : String(h.date || "") === today));
          const isDoneToday = !!doneEntry;

          return (
            <div
              key={m.id}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                isDoneToday ? "bg-emerald-50 border-emerald-200/70" : "bg-white/60 border-slate-200/70 hover:border-indigo-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDoneToday ? "bg-emerald-600 text-white shadow-soft" : "bg-white/70 border-2 border-slate-200/70"
                  }`}
                >
                  {isDoneToday &&
                    (doneEntry.type === "meeting" ? (
                      <Briefcase size={14} />
                    ) : doneEntry.type === "call" ? (
                      <Phone size={14} />
                    ) : (
                      <MessageCircle size={14} />
                    ))}
                </div>
                <div>
                  <div className={`font-bold text-sm ${isDoneToday ? "text-green-800" : "text-slate-700"}`}>{m.name}</div>
                  {isDoneToday ? (
                    <div className="text-[10px] text-green-600 font-medium">
                      {doneEntry.time} •{" "}
                      {doneEntry.type === "meeting" ? "Meeting" : doneEntry.type === "call" ? "Called" : "Msg Sent"}
                      {doneEntry.type === "call" && doneEntry.outcome ? ` • ${String(doneEntry.outcome).replace(/_/g, " ")}` : ""}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-medium">Total Connects: {history.length}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {isDoneToday ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowUp(m.id, "undo");
                    }}
                    className="bg-white/70 border border-slate-200/70 text-slate-500 hover:text-red-600 p-2 rounded-full transition-colors"
                    title="Undo / Uncheck"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!m.phone) {
                          alert("No phone number for this mediator.");
                          return;
                        }
                        const startedAt = new Date().toISOString();
                        onFollowUp(m.id, "call", { ts: startedAt });
                        try {
                          localStorage.setItem(
                            "liras_pending_call_v1",
                            JSON.stringify({
                              kind: "mediator",
                              mediatorId: m.id,
                              phone: m.phone,
                              startedAt,
                              ts: startedAt,
                            })
                          );
                        } catch {
                          // ignore
                        }
                        window.location.href = `tel:${String(m.phone).replace(/[^\d+]/g, "")}`;
                      }}
                      className={`p-2 rounded-full transition-colors ${
                        m.phone ? "bg-indigo-100 hover:bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                      title={m.phone ? "Call + auto-log" : "No phone number"}
                    >
                      <Phone size={16} />
                    </button>
                    <a
                      href={`https://wa.me/${m.phone}?text=${encodeURIComponent(
                        `Good Morning ${m.name}, hope you're doing well. Do we have any new cases or updates for today?`
                      )}`}
                      target="_blank"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollowUp(m.id, "whatsapp");
                      }}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-2 rounded-full transition-colors"
                      title="Send WhatsApp"
                      rel="noreferrer"
                    >
                      <MessageCircle size={16} />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollowUp(m.id, "meeting");
                      }}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-full transition-colors"
                      title="Log Meeting"
                    >
                      <Briefcase size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {activeMediators.length === 0 && <div className="text-center text-slate-400 text-sm py-4 italic">No partners to follow up.</div>}
      </div>
    </div>
  );
};

const MonthlyPerformanceWidget = ({ leads, targetStorageKey = "liras_monthly_target" }) => {
  const currentYm = toYmIST(new Date());
  const monthKey = useMemo(() => `${targetStorageKey}_${currentYm}`, [targetStorageKey, currentYm]);
  const [target, setTarget] = useState(() => parseInt(safeLocalStorage.getItem(monthKey)) || 5000000);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Monthly reset: store targets per IST month (new key each month).
    setTarget(parseInt(safeLocalStorage.getItem(monthKey)) || 5000000);
  }, [monthKey]);

  const handleSaveTarget = (val) => {
    const num = parseInt(val);
    if (!isNaN(num)) {
      setTarget(num);
      safeLocalStorage.setItem(monthKey, String(num));
    }
    setIsEditing(false);
  };

  const stats = useMemo(() => {
    let achieved = 0;
    let pipeline = 0;
    let stuck = 0;

    leads.forEach((l) => {
      const amt = parseInt(l.loanAmount) || 0;
      if (l.status === "Payment Done" && isOnYmIST(l.loanDetails?.paymentDate || l.createdAt, currentYm)) {
        achieved += amt;
      } else if (!["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable"].includes(l.status)) {
        if (["Statements Not Received", "Contact Details Not Received", "Interest Rate Issue"].includes(l.status)) {
          stuck += amt;
        } else {
          pipeline += amt;
        }
      }
    });

    return { achieved, pipeline, stuck };
  }, [leads, currentYm]);

  const percentage = Math.min(100, Math.round((stats.achieved / target) * 100));
  const gap = target - stats.achieved;

  return (
    <div className="surface p-5 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 border-b border-slate-200/60 pb-2">
        <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
          <Target className="text-rose-600" size={18} /> Monthly Sales Target
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="btn-secondary px-3 py-2">
          <Edit2 size={14} className="text-slate-700" />
        </button>
      </div>

      {isEditing ? (
        <div className="mb-4">
          <label className="text-xs text-slate-500 font-bold block mb-1">Set Target (₹)</label>
          <input
            type="number"
            defaultValue={target}
            className="w-full py-2 font-mono font-bold text-slate-900"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveTarget(e.target.value)}
            onBlur={(e) => handleSaveTarget(e.target.value)}
          />
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex justify-between items-end mb-1">
            <span className="text-sm text-slate-500 font-medium">Achieved</span>
            <span className="text-2xl font-bold text-slate-800">{formatCurrency(stats.achieved)}</span>
          </div>
          <div className="w-full bg-slate-200/70 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400 uppercase">
            <span>0%</span>
            <span>Target: {formatCurrency(target)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200/60">
          <div className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Gap to Target</div>
          <div className="font-bold text-slate-700 text-lg">{gap > 0 ? formatCurrency(gap) : "Goal Hit!"}</div>
        </div>
        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
          <div className="text-[10px] font-bold text-orange-500 uppercase mb-1">Active Pipeline</div>
          <div className="font-bold text-slate-700 text-lg">{formatCurrency(stats.pipeline)}</div>
        </div>
      </div>
    </div>
  );
};

const EnhancedDashboardSummary = ({ leads }) => {
  const [timeRange, setTimeRange] = useState("month");

  const calculateAverageTAT = (leadsToAnalyze) => {
    const tats = leadsToAnalyze.map((l) => calculateTAT(l)).filter((t) => t !== null);
    return tats.length ? Math.round(tats.reduce((a, b) => a + b) / tats.length) : 0;
  };

  const metrics = useMemo(() => {
    const now = new Date();
    let filteredLeads = leads;

    if (timeRange === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredLeads = leads.filter((l) => new Date(l.createdAt) > weekAgo);
    } else if (timeRange === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredLeads = leads.filter((l) => new Date(l.createdAt) > monthAgo);
    }

    const closed = filteredLeads.filter((l) => ["Payment Done", "Deal Closed"].includes(l.status));
    const active = filteredLeads.filter((l) => !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status));
    const rejected = filteredLeads.filter((l) => ["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status));

    const totalVolume = filteredLeads.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0);
    const closedVolume = closed.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0);

    const conversionRate = filteredLeads.length ? ((closed.length / filteredLeads.length) * 100).toFixed(1) : "0.0";
    const avgDealSize = closed.length ? (closedVolume / closed.length).toLocaleString("en-IN") : "0";

    return {
      total: filteredLeads.length,
      closed: closed.length,
      active: active.length,
      rejected: rejected.length,
      totalVolume,
      closedVolume,
      conversionRate,
      avgDealSize,
      avgTAT: calculateAverageTAT(closed),
    };
  }, [leads, timeRange]);

  return (
    <div className="surface p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Performance</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 flex items-center gap-2">
            <Activity className="text-indigo-600" size={20} /> Pipeline & Conversion
          </div>
          <div className="text-sm text-slate-600 mt-1">Decision metrics for the selected period.</div>
        </div>

        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 self-start">
          {["week", "month", "all"].map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setTimeRange(period)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold capitalize transition-colors ${
                timeRange === period ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-solid p-4">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Conversion Rate</div>
          <div className="text-2xl font-extrabold text-emerald-700">{metrics.conversionRate}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.closed} / {metrics.total} closed
          </div>
        </div>
        <div className="surface-solid p-4">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Closed Volume</div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(metrics.closedVolume)}</div>
          <div className="text-xs text-slate-500 mt-1">Avg deal: ₹{metrics.avgDealSize}</div>
        </div>
        <div className="surface-solid p-4">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Active Pipeline</div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.active}</div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.total ? ((metrics.active / metrics.total) * 100).toFixed(1) : "0.0"}% of total
          </div>
        </div>
        <div className="surface-solid p-4">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Avg TAT</div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.avgTAT}h</div>
          <div className="text-xs text-slate-500 mt-1">Time to close</div>
        </div>
      </div>
    </div>
  );
};

const LossAnalysisWidget = ({ leads }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const lostLeads = useMemo(() => {
    const lost = leads.filter((l) => ["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status));
    return lost.reduce((acc, lead) => {
      const reasonNote = (lead.notes || [])
        .slice()
        .reverse()
        .find((n) => n.text.includes("[REJECTION REASON]"));
      const reason = reasonNote ? reasonNote.text.split("]:")[1]?.trim() : lead.status === "Lost to Competitor" ? "Competitor" : "Unspecified";
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
  }, [leads]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (Object.keys(lostLeads).length === 0) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    const ctx = chartRef.current.getContext("2d");
    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(lostLeads),
        datasets: [
          {
            data: Object.values(lostLeads),
            backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 10, font: { size: 10 } } },
          title: { display: false },
        },
        maintainAspectRatio: false,
      },
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [lostLeads]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-full flex flex-col">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <ThumbsDown className="text-red-500" size={18} /> Loss Analysis (Rejections)
      </h3>
      <div className="flex-1 min-h-[200px] relative">
        {Object.keys(lostLeads).length > 0 ? (
          <canvas ref={chartRef}></canvas>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 italic">No lost leads data available</div>
        )}
      </div>
    </div>
  );
};

const RenewalAnalyticsWidget = ({ leads }) => {
  const renewalData = useMemo(() => {
    const now = new Date();
    const monthKeys = [];
    const anchorYm = toYmIST(now);
    const anchorDate = new Date(`${anchorYm || "1970-01"}-01T00:00:00+05:30`);
    for (let i = 0; i < 6; i += 1) {
      const d = new Date(anchorDate.getTime());
      d.setMonth(d.getMonth() + i);
      const ym = toYmIST(d);
      if (ym) monthKeys.push(ym);
    }

    const rows = (Array.isArray(leads) ? leads : [])
      .filter((l) => isRenewalEligibleLead(l))
      .map((lead) => {
        const info = getRenewalTimelineInfo(lead);
        const renewalYmd = info.renewalDate ? toYmdIST(info.renewalDate) : "";
        return {
          lead,
          ...info,
          renewalYmd,
          monthKey: renewalYmd ? renewalYmd.slice(0, 7) : "",
        };
      })
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        const am = a.renewalDate ? a.renewalDate.getTime() : Number.POSITIVE_INFINITY;
        const bm = b.renewalDate ? b.renewalDate.getTime() : Number.POSITIVE_INFINITY;
        return am - bm;
      });

    const upcoming = rows.filter((r) => r.renewalDate && r.renewalDate >= now && monthKeys.includes(r.monthKey));
    const overdue = rows.filter((r) => r.renewalDate && r.renewalDate < now);
    const unknown = rows.filter((r) => !r.renewalDate);
    return { upcoming, overdue, unknown };
  }, [leads]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <RefreshCw className="text-green-600" size={18} /> Retention & Next Actions
      </h3>
      <div className="flex gap-4 mb-4">
        <div className="flex-1 bg-red-50 p-3 rounded-lg border border-red-100 text-center">
          <div className="text-2xl font-bold text-red-700">{renewalData.overdue.length}</div>
          <div className="text-[10px] uppercase font-bold text-red-400">Overdue Follow-ups</div>
        </div>
        <div className="flex-1 bg-green-50 p-3 rounded-lg border border-green-100 text-center">
          <div className="text-2xl font-bold text-green-700">{renewalData.upcoming.length}</div>
          <div className="text-[10px] uppercase font-bold text-green-400">In Next 6 Months</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
            <tr>
              <th className="p-2">Client</th>
              <th className="p-2">Renewal Date</th>
              <th className="p-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renewalData.upcoming.length === 0 && renewalData.overdue.length === 0 && renewalData.unknown.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-4 text-center text-slate-400 italic">
                  No pending renewals found.
                </td>
              </tr>
            ) : (
              <>
                {renewalData.overdue.map((r) => (
                  <tr key={`${r.lead.id}_${r.renewalYmd || "unknown"}`} className="hover:bg-red-50/30 bg-red-50/10">
                    <td className="p-2">
                      <div className="font-bold text-slate-700">{r.lead.name}</div>
                      <div className="text-[10px] text-slate-500">{formatCurrency(r.lead.loanAmount)}</div>
                    </td>
                    <td className="p-2 text-red-600 font-bold text-xs">{r.renewalYmd || "Unknown"}</td>
                    <td className="p-2 text-[10px] text-slate-500">{sourceLabelForRenewal(r.source)}</td>
                  </tr>
                ))}
                {renewalData.upcoming.map((r) => (
                  <tr key={`${r.lead.id}_${r.renewalYmd || "unknown"}`} className="hover:bg-slate-50">
                    <td className="p-2">
                      <div className="font-bold text-slate-700">{r.lead.name}</div>
                      <div className="text-[10px] text-slate-500">{formatCurrency(r.lead.loanAmount)}</div>
                    </td>
                    <td className="p-2 text-green-600 font-bold text-xs">{r.renewalYmd || "Unknown"}</td>
                    <td className="p-2 text-[10px] text-slate-500">{sourceLabelForRenewal(r.source)}</td>
                  </tr>
                ))}
                {renewalData.unknown.slice(0, 5).map((r) => (
                  <tr key={`${r.lead.id}_unknown`} className="hover:bg-slate-50/60">
                    <td className="p-2">
                      <div className="font-bold text-slate-700">{r.lead.name}</div>
                      <div className="text-[10px] text-slate-500">{formatCurrency(r.lead.loanAmount)}</div>
                    </td>
                    <td className="p-2 text-slate-400 font-bold text-xs">Unknown</td>
                    <td className="p-2 text-[10px] text-slate-500">{sourceLabelForRenewal(r.source)}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AiPartnerInsightsWidget = ({ ai }) => {
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tone, setTone] = useState(ai?.tone || "partner");
  const [language, setLanguage] = useState(ai?.language || "English");
  const [rangeDays, setRangeDays] = useState(30);

  if (!ai?.run) return null;

  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white mb-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h3 className="font-bold text-xl flex items-center gap-2">
            <Sparkles className="text-yellow-200" /> AI Partner Intelligence
          </h3>
          <p className="text-violet-100 text-xs mt-1">Dormant mediators • top performers • re-engagement plan</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/15 p-2 rounded-lg border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Range</span>
            <input
              type="number"
              value={rangeDays}
              min={7}
              max={365}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="w-20 p-1 rounded bg-white text-slate-900 text-xs font-bold"
              title="Days of history to consider"
            />
            <span className="text-[10px] font-bold text-white/80">days</span>
          </div>
          <AiToneLanguageControls tone={tone} setTone={setTone} language={language} setLanguage={setLanguage} disabled={busy} compact />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const textOut = await ai.run("mediator_insights", { rangeDays }, { tone, language });
                setAnalysis(textOut);
              } catch (err) {
                setError(err?.message || "AI analysis failed");
              } finally {
                setBusy(false);
              }
            }}
            className={`px-4 py-2 rounded-lg font-extrabold text-sm shadow-lg ${
              busy ? "bg-white/20 text-white/70" : "bg-white text-indigo-700 hover:bg-slate-50"
            }`}
          >
            {busy ? "Analyzing…" : analysis ? "Refresh" : "Analyze"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm font-bold text-red-100 bg-red-500/20 border border-red-300/30 rounded-lg p-3">{error}</div>}

      {analysis ? (
        <div className="bg-black/20 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap shadow-inner border border-white/10 max-h-72 overflow-y-auto">
          {analysis}
        </div>
      ) : (
        <div className="bg-white/10 rounded-lg p-4 text-center border border-white/15 border-dashed">
          <p className="text-white/90 text-sm font-medium">Generate insights from your current mediators + leads.</p>
        </div>
      )}

      {analysis && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(analysis);
              if (!ok) alert("Could not copy. Please select and copy manually.");
            }}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/20 border border-white/10"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
};

const CalendarView = ({ leads, onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100"></div>);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString();
      const dayLeads = leads.filter(
        (l) =>
          new Date(l.nextFollowUp).toDateString() === dateStr &&
          !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable"].includes(l.status)
      );
      const isTodayCell = new Date().toDateString() === dateStr;
      days.push(
        <div
          key={i}
          onClick={() => dayLeads.length > 0 && onDateClick(dayLeads)}
          className={`h-24 border border-slate-100 p-2 relative overflow-hidden hover:bg-blue-50 transition-colors cursor-pointer group ${
            isTodayCell ? "bg-blue-50 ring-1 ring-blue-500 inset-0" : "bg-white"
          }`}
        >
          <div className={`text-xs font-bold mb-1 ${isTodayCell ? "text-blue-600" : "text-slate-500"}`}>{i}</div>
          <div className="space-y-1">
            {dayLeads.slice(0, 3).map((l) => (
              <div
                key={l.id}
                className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${
                  l.status === "Meeting Scheduled" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {l.status === "Meeting Scheduled" && "📅 "}
                {l.name}
              </div>
            ))}
            {dayLeads.length > 3 && <div className="text-[10px] text-slate-400 font-bold">+{dayLeads.length - 3} more</div>}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronLeft />
        </button>
        <h2 className="text-lg font-bold text-slate-800">{currentDate.toLocaleString("default", { month: "long", year: "numeric" })}</h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center border-b bg-slate-50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-xs font-bold text-slate-500 uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">{renderDays()}</div>
    </div>
  );
};

const LoanBookView = ({ leads, mediators }) => {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toYmdIST(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toYmdIST(new Date()));

  const closedLeads = leads.filter((l) => {
    if (l.status !== "Payment Done" || !l.loanDetails?.paymentDate) return false;
    const pDate = toYmdIST(l.loanDetails.paymentDate);
    return pDate >= startDate && pDate <= endDate;
  });

  const totals = useMemo(() => {
    return closedLeads.reduce(
      (acc, curr) => ({
        principal: acc.principal + (Number(curr.loanDetails?.principal) || 0),
        interest: acc.interest + (Number(curr.loanDetails?.interest) || 0),
        commission: acc.commission + (Number(curr.loanDetails?.commissionAmount) || 0),
        netProfit: acc.netProfit + ((Number(curr.loanDetails?.interest) || 0) - (Number(curr.loanDetails?.commissionAmount) || 0)),
      }),
      { principal: 0, interest: 0, commission: 0, netProfit: 0 }
    );
  }, [closedLeads]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 bg-white border-b flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-blue-600" /> Loan Book & Business Report
          </h1>
          <p className="text-sm text-slate-500">Track disbursed amounts, upfront interest, and collection terms.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
          <Printer size={16} /> Print Report
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 animate-fade-in a4-page">
        <ReportBrandHeader
          title="Loan Book & Business Report"
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-bold">Period:</span>
              <span className="font-bold text-slate-900">
                {new Date(startDate).toLocaleDateString("en-IN", { timeZone: BRAND.tz })}
              </span>
              <span className="text-slate-300">→</span>
              <span className="font-bold text-slate-900">
                {new Date(endDate).toLocaleDateString("en-IN", { timeZone: BRAND.tz })}
              </span>
            </span>
          }
          metaRight={
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Generated (IST)</div>
              <div className="text-slate-900">{new Date().toLocaleString("en-IN", { timeZone: BRAND.tz })}</div>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 no-break">
          <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Total Principal Booked</p>
            <h3 className="text-3xl font-bold">{formatCurrency(totals.principal)}</h3>
          </div>
          <div className="bg-emerald-600 text-white p-6 rounded-xl shadow-lg">
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">Total Upfront Interest</p>
            <h3 className="text-3xl font-bold">{formatCurrency(totals.interest)}</h3>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Commission Paid</p>
            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(totals.commission)}</h3>
          </div>
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Net Profit</p>
            <h3 className="text-3xl font-bold text-green-400">{formatCurrency(totals.netProfit)}</h3>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
            <span>Disbursement Register</span>
            <span className="text-xs font-normal text-slate-500">
              Period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </span>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="p-3 border-b">Date</th>
                <th className="p-3 border-b">Client</th>
                <th className="p-3 border-b">Mediator</th>
                <th className="p-3 border-b text-right">Principal</th>
                <th className="p-3 border-b text-right">Interest</th>
                <th className="p-3 border-b text-right">Comm.</th>
                <th className="p-3 border-b text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closedLeads.length > 0 ? (
                closedLeads.map((l) => {
                  const profit = (Number(l.loanDetails?.interest) || 0) - (Number(l.loanDetails?.commissionAmount) || 0);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-xs text-slate-500">{new Date(l.loanDetails.paymentDate).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{l.name}</div>
                      </td>
                      <td className="p-3 text-slate-600">{mediators.find((m) => m.id === l.mediatorId)?.name}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(l.loanDetails.principal)}</td>
                      <td className="p-3 text-right text-emerald-600 font-medium">{formatCurrency(l.loanDetails.interest)}</td>
                      <td className="p-3 text-right text-red-500 font-medium">{formatCurrency(l.loanDetails.commissionAmount)}</td>
                      <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(profit)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 italic">
                    No disbursements found in this date range.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-800 text-xs uppercase border-t">
              <tr>
                <td colSpan="3" className="p-3 text-right">
                  Totals:
                </td>
                <td className="p-3 text-right">{formatCurrency(totals.principal)}</td>
                <td className="p-3 text-right text-emerald-600">{formatCurrency(totals.interest)}</td>
                <td className="p-3 text-right text-red-500">{formatCurrency(totals.commission)}</td>
                <td className="p-3 text-right text-slate-900">{formatCurrency(totals.netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 print:block hidden">
          <p>Generated by LIRAS System on {new Date().toLocaleString()}</p>
          <p>Confidential Financial Report</p>
        </div>
      </div>
    </div>
  );
};

// --- Reports (AI-free) ---

const EnhancedProfessionalReport = ({ type, leads, mediators, onBack, targetStorageKey = "liras_monthly_target", ai = null }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("month");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiTone, setAiTone] = useState(ai?.tone || "partner");
  const [aiLanguage, setAiLanguage] = useState(ai?.language || "English");

  const currentYm = toYmIST(new Date());
  const [selectedMonthYm, setSelectedMonthYm] = useState(currentYm);
  const monthOptions = useMemo(() => {
    const base = new Date(`${currentYm}-01T00:00:00+05:30`);
    return Array.from({ length: 12 }, (_, index) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() - index);
      const ym = toYmIST(d);
      return {
        value: ym,
        label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: BRAND.tz }).format(d),
      };
    });
  }, [currentYm]);
  const monthKey = useMemo(() => `${targetStorageKey}_${selectedMonthYm}`, [targetStorageKey, selectedMonthYm]);
  const monthlyTarget = parseInt(safeLocalStorage.getItem(monthKey)) || 5000000;
  const achievedThisMonth = useMemo(() => {
    let achieved = 0;
    leads.forEach((l) => {
      if (l.status !== "Payment Done") return;
      const amt = parseInt(l.loanAmount) || 0;
      if (isOnYmIST(l.loanDetails?.paymentDate || l.createdAt, selectedMonthYm)) achieved += amt;
    });
    return achieved;
  }, [leads, selectedMonthYm]);
  const reportingPeriodLabel = useMemo(() => {
    if (selectedTimeframe === "month") {
      const match = monthOptions.find((opt) => opt.value === selectedMonthYm);
      return match?.label || selectedMonthYm;
    }
    return selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1);
  }, [monthOptions, selectedMonthYm, selectedTimeframe]);

  const reportData = useMemo(() => {
    const now = new Date();
    let filteredLeads = leads;
    let timeframeStart = new Date(0);

    if (selectedTimeframe === "week") {
      timeframeStart = new Date(now.setDate(now.getDate() - 7));
      filteredLeads = leads.filter((l) => new Date(l.createdAt) > timeframeStart);
    } else if (selectedTimeframe === "month") {
      timeframeStart = new Date(`${selectedMonthYm}-01T00:00:00+05:30`);
      filteredLeads = leads.filter((l) => toYmIST(l.createdAt) === selectedMonthYm);
    }

    const totalLeads = filteredLeads.length;
    const inWindowByIso = (iso) => {
      if (!iso) return selectedTimeframe === "all";
      if (selectedTimeframe === "all") return true;
      if (selectedTimeframe === "month") return toYmIST(iso) === selectedMonthYm;
      return parseIsoOrNull(iso)?.getTime?.() > timeframeStart.getTime();
    };
    const closedLeads = leads.filter((l) => {
      if (!["Payment Done", "Deal Closed"].includes(l.status)) return false;
      const eventIso = l.loanDetails?.paymentDate || getLeadLastActivityIso(l) || l.createdAt;
      return inWindowByIso(eventIso);
    });
    const activeLeads = filteredLeads.filter(
      (l) => !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status)
    );
    const rejectedLeads = leads.filter((l) => {
      if (!["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status)) return false;
      const eventIso = getLeadLastActivityIso(l) || l.createdAt;
      return inWindowByIso(eventIso);
    });
    const totalVolume = filteredLeads.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0);
    const closedVolume = closedLeads.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0);
    const avgDealSize = closedLeads.length ? closedVolume / closedLeads.length : 0;
    const conversionRate = totalLeads ? (closedLeads.length / totalLeads) * 100 : 0;
    const rejectionRate = totalLeads ? (rejectedLeads.length / totalLeads) * 100 : 0;
    const tats = closedLeads.map((l) => calculateTAT(l)).filter((t) => t !== null);
    const avgTAT = tats.length ? Math.round(tats.reduce((a, b) => a + b) / tats.length) : 0;

    const ticketSizes = {
      small: { count: 0, volume: 0, label: "Small (< 5L)" },
      medium: { count: 0, volume: 0, label: "Medium (5L - 20L)" },
      large: { count: 0, volume: 0, label: "Large (> 20L)" },
    };
    closedLeads.forEach((l) => {
      const amt = parseInt(l.loanAmount) || 0;
      if (amt < 500000) {
        ticketSizes.small.count += 1;
        ticketSizes.small.volume += amt;
      } else if (amt <= 2000000) {
        ticketSizes.medium.count += 1;
        ticketSizes.medium.volume += amt;
      } else {
        ticketSizes.large.count += 1;
        ticketSizes.large.volume += amt;
      }
    });

    let clientVisits = 0;
    let commercialVisits = 0;
    let mediatorsCollected = 0;

    filteredLeads.forEach((l) => {
      (l.notes || []).forEach((n) => {
        if (new Date(n.date) >= timeframeStart) {
          if (isMeetingDoneNoteText(n.text)) {
            clientVisits += 1;
            if (l.status === "Commercial Client" || String(n.text || "").includes("[Commercial Visit]")) commercialVisits += 1;
          }
          if (n.text.includes("[MEDIATOR COLLECTED]")) mediatorsCollected += 1;
        }
      });
    });

    const newMediatorsAdded = mediators.filter((m) => {
      const created = new Date(parseInt(m.id));
      return created >= timeframeStart && !isNaN(created.getTime());
    }).length;

    const directLeads = filteredLeads.filter((l) => l.mediatorId === "3");
    const directVolume = directLeads.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0);

    const staffClosures = closedLeads
      .filter((l) => l.assignedStaff)
      .map((l) => ({
        client: l.name,
        amount: l.loanAmount,
        staff: l.assignedStaff,
        date: l.loanDetails?.paymentDate || l.createdAt,
      }));

    const mediatorPerformance = mediators
      .filter((m) => m.id !== "3")
      .map((mediator) => {
        const mLeads = filteredLeads.filter((l) => l.mediatorId === mediator.id);
        const mClosed = closedLeads.filter((l) => l.mediatorId === mediator.id);

        const history = (mediator.followUpHistory || [])
          .map((h) => (typeof h === "string" ? { date: h, type: "legacy" } : h))
          .filter((h) => h && typeof h === "object" && typeof h.date === "string");
        const relevantHistory = selectedTimeframe === "all" ? history : history.filter((h) => new Date(h.date) >= timeframeStart);

        const meetingsCount = relevantHistory.filter((h) => h.type === "meeting").length;
        const connectsCount = relevantHistory.filter((h) => h.type !== "meeting").length;

        let impression = "Passive";
        let impressionColor = "text-slate-400 bg-slate-100";
        if (meetingsCount >= 2 || (mLeads.length > 5 && mClosed.length > 0)) {
          impression = "Strategic Partner";
          impressionColor = "text-purple-700 bg-purple-100 border-purple-200";
        } else if (meetingsCount > 0 || connectsCount > 5) {
          impression = "Highly Active";
          impressionColor = "text-green-700 bg-green-100 border-green-200";
        } else if (connectsCount > 0 || mLeads.length > 0) {
          impression = "Engaged";
          impressionColor = "text-blue-700 bg-blue-100 border-blue-200";
        } else {
          impression = "Cold / Dormant";
          impressionColor = "text-slate-500 bg-slate-100 border-slate-200";
        }

        return {
          name: mediator.name,
          total: mLeads.length,
          closed: mClosed.length,
          volume: mClosed.reduce((sum, l) => sum + (parseInt(l.loanAmount) || 0), 0),
          conversion: mLeads.length ? (mClosed.length / mLeads.length) * 100 : 0,
          meetingsCount,
          connectsCount,
          impression,
          impressionColor,
        };
      })
      .sort((a, b) => b.volume - a.volume);

    const topPartnerVolume = mediatorPerformance.length > 0 ? mediatorPerformance[0].volume : 0;
    const topPartnerName = mediatorPerformance.length > 0 ? mediatorPerformance[0].name : "None";
    const dependencyRatio = closedVolume > 0 ? (topPartnerVolume / closedVolume) * 100 : 0;

    const statusData = {};
    filteredLeads.forEach((l) => {
      const status = l.status;
      if (!statusData[status]) statusData[status] = { count: 0, volume: 0 };
      statusData[status].count += 1;
      statusData[status].volume += parseInt(l.loanAmount) || 0;
    });

    const totalInterestEarned = closedLeads.reduce((sum, l) => sum + (Number(l.loanDetails?.interest) || 0), 0);
    const avgInterestRate = closedLeads.length
      ? closedLeads.reduce((sum, l) => sum + (Number(l.loanDetails?.rate) || 0), 0) / closedLeads.length
      : 0;

    return {
      totalLeads,
      closedLeads: closedLeads.length,
      closedLeadRows: closedLeads,
      activeLeads: activeLeads.length,
      rejectedLeads: rejectedLeads.length,
      totalVolume,
      closedVolume,
      avgDealSize,
      conversionRate: conversionRate.toFixed(1),
      rejectionRate: rejectionRate.toFixed(1),
      avgTAT,
      mediatorPerformance,
      statusData,
      filteredLeads,
      totalInterestEarned,
      avgInterestRate,
      clientVisits,
      commercialVisits,
      mediatorsCollected,
      newMediatorsAdded,
      directLeads,
      directVolume,
      staffClosures,
      ticketSizes,
      topPartnerName,
      topPartnerVolume,
      dependencyRatio,
    };
  }, [leads, mediators, selectedTimeframe]);

  useEffect(() => {
    if (!includeCharts || !chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext("2d");
    const topMediators = reportData.mediatorPerformance.slice(0, 5);
    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: topMediators.map((m) => m.name),
        datasets: [
          {
            label: "Closed Volume (₹)",
            data: topMediators.map((m) => m.volume),
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: "Conversion Rate (%)",
            data: topMediators.map((m) => m.conversion),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderColor: "rgb(16, 185, 129)",
            borderWidth: 1,
            borderRadius: 6,
            type: "line",
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "₹" + value.toLocaleString("en-IN");
              },
            },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            ticks: {
              callback: function (value) {
                return value.toFixed(0) + "%";
              },
            },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [reportData, includeCharts]);

  const handlePrint = () => {
    document.title = `Jubilant_Enterprises_${type}_Report_${new Date().toISOString().slice(0, 10)}`;
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans text-slate-900">
      <div className="hidden print:block fixed top-0 left-0 right-0 bg-white border-b border-slate-200 p-4 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <BrandMark size={44} />
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold tracking-[0.24em] uppercase text-slate-500">{BRAND.name}</div>
                <div className="text-xl font-extrabold text-slate-900 truncate">
                  Professional {type.charAt(0).toUpperCase() + type.slice(1)} Performance Report
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Timeframe: <span className="font-bold text-slate-900">{reportingPeriodLabel}</span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-600 font-bold whitespace-nowrap">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Generated (IST)</div>
              <div className="text-slate-900">{new Date().toLocaleString("en-IN", { timeZone: BRAND.tz })}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="print:hidden px-4 py-5 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <button onClick={onBack} className="flex items-center gap-2 font-bold text-sm text-slate-300 hover:text-white mb-4">
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Professional {type.charAt(0).toUpperCase() + type.slice(1)} Performance Report
              </h1>
              <p className="text-slate-300 mt-2">Comprehensive analysis of business performance</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {["week", "month", "all"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTimeframe(t)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
                      selectedTimeframe === t ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {selectedTimeframe === "month" && (
                  <select
                    value={selectedMonthYm}
                    onChange={(e) => setSelectedMonthYm(e.target.value)}
                    className="px-3 sm:px-4 py-2 rounded-lg text-sm font-bold bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={handlePrint}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105"
                >
                  <Printer size={18} /> Print Professional Report
                </button>
                <button onClick={() => setIncludeCharts(!includeCharts)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-bold">
                  {includeCharts ? "Hide Charts" : "Show Charts"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 sm:p-6 print:p-8 print:pt-16">
        {ai?.run && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 mb-8 print:hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" /> AI Executive Summary
                </h3>
                <p className="text-xs text-slate-500 mt-1">Generates a narrative summary + highlights from the current report metrics.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <AiToneLanguageControls
                  tone={aiTone}
                  setTone={setAiTone}
                  language={aiLanguage}
                  setLanguage={setAiLanguage}
                  disabled={aiBusy}
                  compact
                />
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={async () => {
                    setAiBusy(true);
                    setAiError("");
                    try {
                      const metrics = {
                        reportType: type,
                        timeframe: selectedTimeframe,
                        monthlyTarget,
                        totalLeads: reportData.totalLeads,
                        closedLeads: reportData.closedLeads,
                        activeLeads: reportData.activeLeads,
                        rejectedLeads: reportData.rejectedLeads,
                        totalVolume: reportData.totalVolume,
                        closedVolume: reportData.closedVolume,
                        conversionRate: reportData.conversionRate,
                        rejectionRate: reportData.rejectionRate,
                        avgDealSize: reportData.avgDealSize,
                        avgTAT: reportData.avgTAT,
                        clientVisits: reportData.clientVisits,
                        commercialVisits: reportData.commercialVisits,
                        newMediatorsAdded: reportData.newMediatorsAdded,
                        mediatorsCollected: reportData.mediatorsCollected,
                        directClients: reportData.directLeads?.length || 0,
                        directVolume: reportData.directVolume || 0,
                      };
                      const textOut = await ai.run("report_summary", { metrics }, { tone: aiTone, language: aiLanguage });
                      setAiSummary(textOut);
                    } catch (err) {
                      setAiError(err?.message || "AI summary failed");
                    } finally {
                      setAiBusy(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-extrabold text-sm ${
                    aiBusy ? "bg-slate-200 text-slate-500" : "bg-slate-900 hover:bg-black text-white"
                  }`}
                >
                  {aiBusy ? "Generating…" : aiSummary ? "Refresh" : "Generate"}
                </button>
              </div>
            </div>

            {aiError && <div className="mt-3 text-sm font-bold text-red-600">{aiError}</div>}

            {aiSummary && (
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{aiSummary}</div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(aiSummary);
                      if (!ok) alert("Could not copy. Please select and copy manually.");
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl border border-slate-200 p-6 mb-8 print:break-inside-avoid">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Award className="text-blue-600" /> Executive Summary
              </h2>
              <p className="text-slate-600">Key performance indicators and business overview</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-sm text-slate-500">Reporting Period</div>
              <div className="text-lg font-bold text-slate-900">{reportingPeriodLabel}</div>
            </div>
          </div>

          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-6 print:flex-row">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monthly Sales Target</div>
              <div className="text-2xl font-extrabold text-slate-900">{formatCompactCurrency(monthlyTarget)}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Achieved Volume</div>
              <div className="text-2xl font-extrabold text-emerald-600">{formatCompactCurrency(achievedThisMonth)}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending to Goal</div>
              <div className={`text-2xl font-extrabold ${monthlyTarget - achievedThisMonth > 0 ? "text-orange-600" : "text-green-600"}`}>
                {monthlyTarget - achievedThisMonth > 0 ? formatCompactCurrency(monthlyTarget - achievedThisMonth) : "Goal Reached!"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-lg">
              <div className="text-blue-200 text-xs font-bold uppercase mb-1">Total Volume</div>
              <div className="text-xl font-bold">{formatCompactCurrency(reportData.totalVolume)}</div>
              <div className="text-blue-200 text-xs mt-1">{reportData.totalLeads} leads</div>
            </div>
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4 rounded-xl shadow-lg">
              <div className="text-emerald-200 text-xs font-bold uppercase mb-1">Closed Volume</div>
              <div className="text-xl font-bold">{formatCompactCurrency(reportData.closedVolume)}</div>
              <div className="text-emerald-200 text-xs mt-1">{reportData.closedLeads} deals</div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl shadow-lg">
              <div className="text-purple-200 text-xs font-bold uppercase mb-1">Conversion Rate</div>
              <div className="text-xl font-bold">{reportData.conversionRate}%</div>
              <div className="text-purple-200 text-xs mt-1">Win Rate</div>
            </div>
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-xl shadow-lg">
              <div className="text-amber-200 text-xs font-bold uppercase mb-1">Avg Deal Size</div>
              <div className="text-xl font-bold">{formatCompactCurrency(reportData.avgDealSize)}</div>
              <div className="text-amber-200 text-xs mt-1">Per transaction</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-700 font-bold">Pipeline Health</span>
                <span className="text-blue-600 font-bold">{reportData.activeLeads} active</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full" style={{ width: `${(reportData.activeLeads / Math.max(1, reportData.totalLeads)) * 100}%` }}></div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-700 font-bold">Avg Time to Close</span>
                <span className="text-emerald-600 font-bold">{reportData.avgTAT} hours</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 h-2 rounded-full" style={{ width: `${Math.min(100, reportData.avgTAT)}%` }}></div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-700 font-bold">Quality Ratio</span>
                <span className="text-purple-600 font-bold">{reportData.rejectionRate}% reject</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full" style={{ width: `${reportData.rejectionRate}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8 print:break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
            <Users className="text-indigo-600" /> Field Operations & Partner Growth
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6">
            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-3">
                <MapPin size={16} /> Visit Activity
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                  <span className="text-sm text-slate-600 font-medium">Total Client Visited</span>
                  <span className="text-lg font-bold text-indigo-700">{reportData.clientVisits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 font-medium">Commercial Client Visited</span>
                  <span className="text-lg font-bold text-teal-700">{reportData.commercialVisits}</span>
                </div>
              </div>
            </div>
            <div className="bg-teal-50 p-5 rounded-xl border border-teal-100">
              <h4 className="font-bold text-teal-900 flex items-center gap-2 mb-3">
                <UserPlus size={16} /> Expansion Metrics
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-teal-200 pb-2">
                  <span className="text-sm text-slate-600 font-medium">New Mediators Added</span>
                  <span className="text-lg font-bold text-teal-700">{reportData.newMediatorsAdded}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 font-medium">Mediator Contacts Collected</span>
                  <span className="text-lg font-bold text-teal-700">{reportData.mediatorsCollected}</span>
                </div>
              </div>
            </div>
          </div>

          {reportData.staffClosures.length > 0 && (
            <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Briefcase size={16} /> Staff Delegated Collections (Included in Total)
              </h4>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase font-bold text-slate-500 bg-slate-100">
                    <tr>
                      <th className="p-2">Client Name</th>
                      <th className="p-2">Assigned Staff</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportData.staffClosures.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{item.client}</td>
                        <td className="p-2 text-indigo-700 font-bold">{item.staff}</td>
                        <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {reportData.staffClosures.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="font-bold text-slate-900">{item.client}</div>
                    <div className="mt-1 text-sm text-indigo-700 font-bold">{item.staff}</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Amount</span>
                      <span className="font-mono font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Briefcase size={16} /> Direct Client Details
            </h4>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="text-sm text-slate-600">
                Total Direct Clients in Pipeline: <span className="font-bold text-slate-900">{reportData.directLeads.length}</span>
              </div>
              <div className="text-sm text-slate-600">
                Volume: <span className="font-bold text-slate-900">{formatCurrency(reportData.directVolume)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {reportData.directLeads.length === 0 ? (
                <div className="text-sm italic text-slate-500">No direct clients in this reporting period.</div>
              ) : (
                reportData.directLeads
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((lead) => (
                    <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900">{lead.name}</div>
                          <div className="mt-1 text-sm text-slate-500">{lead.status || "Open"}</div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="font-mono font-bold text-slate-900">{formatCurrency(lead.loanAmount)}</div>
                          <div className="text-xs text-slate-500">{formatDate(lead.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8 print:break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
            <PieChart className="text-amber-500" /> Portfolio Composition & Business Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">Ticket Size Distribution (Closed Deals)</div>
              <div className="space-y-3">
                {Object.values(reportData.ticketSizes).map((bucket) => (
                  <div key={bucket.label} className="flex justify-between items-center">
                    <span className="text-sm text-slate-700">{bucket.label}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-900">{bucket.count} deals</span>
                      <div className="text-xs text-amber-700">{formatCompactCurrency(bucket.volume)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Portfolio Concentration</div>
              <div className="flex items-center gap-2 mb-1">
                <div className="text-xl font-extrabold text-blue-900">{reportData.dependencyRatio.toFixed(1)}%</div>
                <span className="text-sm text-blue-700">from Top Partner</span>
              </div>
              <div className="text-sm text-slate-600 mb-2">
                Largest Contributor: <strong>{reportData.topPartnerName}</strong> ({formatCompactCurrency(reportData.topPartnerVolume)})
              </div>
              <div className="text-xs text-slate-500 italic border-t border-blue-200 pt-2 mt-2">This metric highlights reliance on your single largest source of business.</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8 print:break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
            <Banknote className="text-emerald-600" /> Financial & Profitability Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Interest Earnings</div>
                <div className="text-xl font-extrabold text-emerald-800">{formatCompactCurrency(reportData.totalInterestEarned)}</div>
                <div className="text-xs text-emerald-600 mt-1">Generated from {reportData.closedLeads} closed deals</div>
              </div>
              <div className="bg-white p-3 rounded-full shadow-sm text-emerald-600">
                <DollarSign size={24} />
              </div>
            </div>
            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Average Corporate Rate</div>
                <div className="text-xl font-extrabold text-indigo-800">{reportData.avgInterestRate.toFixed(2)}%</div>
                <div className="text-xs text-indigo-600 mt-1">Mean monthly return rate</div>
              </div>
              <div className="bg-white p-3 rounded-full shadow-sm text-indigo-600">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
            <CheckCircle className="text-emerald-600" size={20} /> Confirmed Disbursements Registry
          </h3>
          <div className="hidden md:block overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm text-left table-fixed">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="p-3">Client Name</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Partner / Staff</th>
                  <th className="p-3">Terms</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3 text-right">Disbursed Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.closedLeadRows
                  .slice()
                  .sort((a, b) => new Date(b.loanDetails?.paymentDate || b.createdAt) - new Date(a.loanDetails?.paymentDate || a.createdAt))
                  .map((lead) => {
                    const mediator = mediators.find((m) => m.id === lead.mediatorId);
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800">{lead.name}</td>
                        <td className="p-3 text-slate-500 text-xs font-mono">
                          {new Date(lead.loanDetails?.paymentDate || lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="text-slate-700 font-medium">{mediator?.name || "Direct"}</div>
                          {lead.assignedStaff && <div className="text-indigo-600 font-bold text-[10px]">By: {lead.assignedStaff}</div>}
                        </td>
                        <td className="p-3 text-xs text-slate-700">
                          {lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months
                            ? `${lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months} ${lead.loanDetails?.frequency || "Monthly"}`
                            : "—"}
                        </td>
                        <td className="p-3 text-xs font-bold text-indigo-700">{lead.loanDetails?.rate ? `${lead.loanDetails.rate}%` : "—"}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700">{formatCurrency(lead.loanAmount)}</td>
                      </tr>
                    );
                  })}
                {reportData.closedLeads === 0 && (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-slate-400 italic">
                      No closed deals in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                <tr>
                  <td colSpan="5" className="p-3 text-right font-bold text-slate-900 uppercase text-xs tracking-wider">
                    Total Disbursed Volume
                  </td>
                  <td className="p-3 text-right font-extrabold text-emerald-700 text-lg">{formatCurrency(reportData.closedVolume)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {reportData.closedLeadRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm italic text-slate-500">
                No closed deals in this period.
              </div>
            ) : (
              reportData.closedLeadRows
                .slice()
                .sort((a, b) => new Date(b.loanDetails?.paymentDate || b.createdAt) - new Date(a.loanDetails?.paymentDate || a.createdAt))
                .map((lead) => {
                  const mediator = mediators.find((m) => m.id === lead.mediatorId);
                  return (
                    <div key={lead.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900">{lead.name}</div>
                          <div className="mt-1 text-sm text-slate-500">{mediator?.name || "Direct"}</div>
                          {lead.assignedStaff && <div className="mt-1 text-xs font-bold text-indigo-600">By: {lead.assignedStaff}</div>}
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-white px-3 py-2 border border-slate-200">
                              <div className="uppercase tracking-wider text-slate-400 font-bold">Terms</div>
                              <div className="mt-1 font-bold text-slate-700">
                                {lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months
                                  ? `${lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months} ${lead.loanDetails?.frequency || "Monthly"}`
                                  : "—"}
                              </div>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2 border border-slate-200">
                              <div className="uppercase tracking-wider text-slate-400 font-bold">Rate</div>
                              <div className="mt-1 font-bold text-indigo-700">{lead.loanDetails?.rate ? `${lead.loanDetails.rate}%` : "—"}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-700">{formatCurrency(lead.loanAmount)}</div>
                          <div className="text-xs text-slate-500">{new Date(lead.loanDetails?.paymentDate || lead.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Total Disbursed Volume</span>
              <span className="text-lg font-extrabold text-emerald-700">{formatCurrency(reportData.closedVolume)}</span>
            </div>
          </div>
        </div>

        {includeCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:break-inside-avoid">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="text-blue-600" /> Top Performers Analysis
              </h3>
              <div className="h-64">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <PieChart className="text-emerald-600" /> Status Distribution
              </h3>
              <div className="space-y-4">
                {Object.entries(reportData.statusData).map(([status, data]) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status]?.color?.split(" ")[0] || "bg-slate-300"}`}></div>
                      <span className="font-medium text-slate-700">{status}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{data.count} leads</div>
                      <div className="text-sm text-slate-500">{formatCompactCurrency(data.volume)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-8 print:break-inside-avoid">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Users className="text-blue-400" /> Partner Engagement Overview
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr className="text-left text-slate-600 font-bold">
                  <th className="p-4">Partner Name</th>
                  <th className="p-4 text-center">Face-to-Face Meetings</th>
                  <th className="p-4 text-center">Calls / Digital Connects</th>
                  <th className="p-4 text-center">Total Interactions</th>
                  <th className="p-4">Engagement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData.mediatorPerformance.map((mediator) => (
                  <tr key={mediator.name} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-800">{mediator.name}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${mediator.meetingsCount > 0 ? "bg-purple-100 text-purple-700" : "text-slate-400"}`}>
                        {mediator.meetingsCount}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${mediator.connectsCount > 0 ? "bg-blue-100 text-blue-700" : "text-slate-400"}`}>
                        {mediator.connectsCount}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-900">{mediator.meetingsCount + mediator.connectsCount}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${mediator.impressionColor}`}>{mediator.impression}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:break-before-page">
          <div className="bg-slate-900 text-white p-4 border-b border-slate-800">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <FileText size={20} className="text-slate-400" /> Detailed Activity Report
            </h3>
            <p className="text-xs text-slate-400 mt-1">Complete list of all leads processed during this period.</p>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left table-fixed">
              <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Client Name</th>
                  <th className="p-4">Partner</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Terms / Rate</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.filteredLeads
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((lead) => {
                    const mediatorName = mediators.find((m) => m.id === lead.mediatorId)?.name || "Unknown";
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50 print:break-inside-avoid">
                        <td className="p-4 font-mono text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 font-bold text-slate-800">{lead.name}</td>
                        <td className="p-4 text-slate-600 font-medium">{mediatorName}</td>
                        <td className="p-4">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${STATUS_CONFIG[lead.status]?.color?.replace("text", "border") || "border-slate-200 text-slate-500"}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {["Payment Done", "Deal Closed"].includes(lead.status)
                            ? `${lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months || "—"} ${
                                lead.loanDetails?.frequency || ""
                              }${lead.loanDetails?.rate ? ` • ${lead.loanDetails.rate}%` : ""}`
                            : "—"}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700">{formatCurrency(lead.loanAmount)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden divide-y divide-slate-100">
            {reportData.filteredLeads
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((lead) => {
                const mediatorName = mediators.find((m) => m.id === lead.mediatorId)?.name || "Unknown";
                const termsLabel =
                  ["Payment Done", "Deal Closed"].includes(lead.status)
                    ? `${lead.loanDetails?.tenure || lead.loanDetails?.tenureMonths || lead.loanDetails?.tenor_months || "—"} ${
                        lead.loanDetails?.frequency || ""
                      }${lead.loanDetails?.rate ? ` • ${lead.loanDetails.rate}%` : ""}`
                    : "—";
                return (
                  <div key={lead.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 break-words">{lead.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{mediatorName}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-800">{formatCurrency(lead.loanAmount)}</div>
                        <div className="text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${STATUS_CONFIG[lead.status]?.color?.replace("text", "border") || "border-slate-200 text-slate-500"}`}>
                        {lead.status}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">{termsLabel}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="text-center text-slate-500 text-sm py-6 border-t border-slate-200 print:break-inside-avoid">
          <p>Generated by LIRAS v4.06 Enterprise Intelligence System</p>
          <p className="mt-1 font-bold text-slate-700">CONFIDENTIAL BUSINESS DOCUMENT • INTENDED FOR PARTNERS ONLY</p>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} {BRAND.name}.</p>
        </div>
      </div>
    </div>
  );
};

const parseBriefingLedgerNote = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return { raw: "", tag: "NOTE", body: "", prose: [], fields: [] };
  const bracketMatch = raw.match(/^\s*\[([^\]]+)\]\s*:?\s*(.*)$/);
  const tag = (bracketMatch?.[1] || "NOTE").trim().toUpperCase();
  const body = String(bracketMatch ? bracketMatch[2] : raw).trim();
  const parts = body
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  const fields = [];
  const prose = [];
  (parts.length ? parts : [body]).forEach((part) => {
    const m = part.match(/^([A-Za-z][A-Za-z\s]{1,30})\s*=\s*(.+)$/);
    if (m) fields.push({ key: m[1].trim(), value: m[2].trim() });
    else if (part) prose.push(part);
  });
  return { raw, tag, body, prose, fields };
};

const briefingLedgerNoteTone = (tag) => {
  const t = String(tag || "").toUpperCase();
  if (t.includes("REJECTION")) return { badge: "bg-rose-50 text-rose-700 border-rose-200", card: "bg-rose-50/50 border-rose-100" };
  if (t.includes("TRIAGE")) return { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", card: "bg-indigo-50/40 border-indigo-100" };
  if (t.includes("PHONE PD")) return { badge: "bg-amber-50 text-amber-700 border-amber-200", card: "bg-amber-50/40 border-amber-100" };
  if (t.includes("STATEMENT")) return { badge: "bg-cyan-50 text-cyan-700 border-cyan-200", card: "bg-cyan-50/40 border-cyan-100" };
  if (t.includes("PAYMENT")) return { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", card: "bg-emerald-50/40 border-emerald-100" };
  return { badge: "bg-slate-100 text-slate-700 border-slate-200", card: "bg-white border-slate-200" };
};

const BriefingLedgerNotePreview = ({ note }) => {
  if (!note?.text) return <span className="text-slate-400 italic">No notes</span>;
  const parsed = parseBriefingLedgerNote(note.text);
  const tone = briefingLedgerNoteTone(parsed.tag);
  return (
    <div className={`rounded-xl border p-3 ${tone.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider ${tone.badge}`}>
          {parsed.tag.replace(/_/g, " ")}
        </span>
      </div>
      {parsed.prose?.length > 0 && (
        <div className="mt-2 space-y-1">
          {parsed.prose.map((line, idx) => (
            <div key={idx} className="text-xs text-slate-800 leading-relaxed font-semibold">
              {line}
            </div>
          ))}
        </div>
      )}
      {parsed.fields?.length > 0 && (
        <div className="mt-2 grid gap-1">
          {parsed.fields.map((f, idx) => (
            <div key={`${f.key}-${idx}`} className="text-xs leading-relaxed">
              <span className="font-extrabold text-slate-800 uppercase tracking-wide">{f.key}: </span>
              <span className={`font-semibold ${/reason|strategy|competitor/i.test(f.key) ? "text-slate-900" : "text-slate-700"}`}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OwnerDailyPartnerReportView = ({ leads, mediators, staffUsers = [], onBack, backendEnabled = false, authUser = null, currentUser = "User" }) => {
  const todayYmd = toYmdIST(new Date());
  const closedStatuses = new Set([
    "Payment Done",
    "Deal Closed",
    "Not Eligible",
    "Not Reliable",
    "Lost to Competitor",
    "Not Interested",
    "Not Interested (Temp)",
  ]);
  const rejectedStatuses = new Set(["Not Eligible", "Not Reliable", "Lost to Competitor"]);

  const isMineLead = (lead) => {
    if (!lead) return false;
    if (!backendEnabled || !authUser?.id) return true;
    const owner = String(lead.ownerId || lead.createdBy || "");
    if (!owner) return true;
    return owner === String(authUser.id);
  };

  const isMineMediator = (medi) => {
    if (!medi) return false;
    if (!backendEnabled || !authUser?.id) return true;
    const owner = String(medi.ownerId || medi.createdBy || "");
    if (!owner) return true;
    return owner === String(authUser.id);
  };

  const mineLeads = useMemo(() => (leads || []).filter((l) => isMineLead(l)), [leads, backendEnabled, authUser?.id]);
  const openLeads = useMemo(() => mineLeads.filter((l) => !closedStatuses.has(l.status)), [mineLeads]);
  const mediatorNameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(mediators) ? mediators : []).forEach((m) => {
      const key = String(m?.id || "");
      if (!key) return;
      map.set(key, String(m?.name || "").trim() || "Mediator");
    });
    return map;
  }, [mediators]);

  const resolveLeadMediatorName = (lead) => {
    const mediatorId = String(lead?.mediatorId || "");
    if (mediatorId === "3") return "Direct Client";
    if (mediatorId && mediatorNameById.has(mediatorId)) return mediatorNameById.get(mediatorId);
    return "Unassigned Mediator";
  };

  const staffNameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(staffUsers) ? staffUsers : []).forEach((u) => {
      const key = String(u?.userId || "");
      if (!key) return;
      const base = String(u?.label || u?.email || "").trim();
      const normalized = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
      map.set(key, normalized || base || key);
    });
    return map;
  }, [staffUsers]);

  const resolveMeetingBy = (lead) => {
    const assigned = String(lead?.assignedStaff || "").trim();
    if (assigned) return assigned;
    const ownerId = String(lead?.ownerId || lead?.createdBy || "");
    if (ownerId && staffNameById.has(ownerId)) return staffNameById.get(ownerId);
    return String(currentUser || "").trim() || "Unassigned";
  };

  const getLastNote = (lead) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    return notes.length ? notes[notes.length - 1] : null;
  };

  const getLatestNoteMatching = (lead, pattern) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const t = String(notes[i]?.text || "");
      if (pattern.test(t)) return notes[i];
    }
    return null;
  };

  const getClosedAt = (lead) => {
    if (!lead) return null;
    if (lead.status === "Payment Done" || lead.status === "Deal Closed") {
      if (lead?.loanDetails?.paymentDate) return lead.loanDetails.paymentDate;
      const paymentNote = getLatestNoteMatching(lead, /PAYMENT DONE|PAYMENT|DEAL CLOSED|CLOSED/i);
      return paymentNote?.date || null;
    }
    if (rejectedStatuses.has(lead.status)) {
      const rejectionNote = getLatestNoteMatching(lead, /\[REJECTION\]|\[REJECTION REASON\]|NOT ELIGIBLE|NOT RELIABLE|LOST TO COMPETITOR/i);
      return rejectionNote?.date || null;
    }
    return null;
  };

  const isLeadTouchedToday = (lead) => {
    if (!lead) return false;
    if (isOnYmdIST(lead.createdAt, todayYmd)) return true;
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    return notes.some((n) => isOnYmdIST(n?.date, todayYmd));
  };

  const openLeadsTouchedToday = useMemo(() => openLeads.filter((l) => isLeadTouchedToday(l)), [openLeads, todayYmd]);
  const leadsAddedToday = useMemo(() => openLeads.filter((l) => isOnYmdIST(l.createdAt, todayYmd)), [openLeads, todayYmd]);
  const addedStillOpenEod = useMemo(() => leadsAddedToday.filter((l) => !closedStatuses.has(l.status)), [leadsAddedToday]);

  const paymentDoneToday = useMemo(() => {
    return mineLeads.filter((l) => {
      if (!(l.status === "Payment Done" || l.status === "Deal Closed")) return false;
      const closedAt = getClosedAt(l);
      return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
    });
  }, [mineLeads, todayYmd]);

  const rejectedToday = useMemo(() => {
    return mineLeads.filter((l) => {
      if (!rejectedStatuses.has(l.status)) return false;
      const closedAt = getClosedAt(l);
      return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
    });
  }, [mineLeads, todayYmd]);

  const metToday = useMemo(() => {
    return mineLeads.filter((l) => {
      const notes = Array.isArray(l.notes) ? l.notes : [];
      return notes.some((n) => isOnYmdIST(n?.date, todayYmd) && isMeetingDoneNoteText(n?.text));
    });
  }, [mineLeads, todayYmd]);

  const lifecycleRows = useMemo(() => {
    return openLeadsTouchedToday
      .map((l) => {
        const lastNote = getLastNote(l);
        return {
          id: l.id,
          name: l.name,
          company: l.company,
          mediatorName: resolveLeadMediatorName(l),
          status: l.status,
          amount: Number(l.loanAmount) || 0,
          entryAt: l.createdAt || null,
          lastActionAt: lastNote?.date || l.createdAt || null,
          nextFollowUp: l.nextFollowUp || null,
          lastNoteText: lastNote?.text || "—",
        };
      })
      .sort((a, b) => new Date(b.lastActionAt || 0) - new Date(a.lastActionAt || 0));
  }, [openLeadsTouchedToday]);

  const mediatorTouches = useMemo(() => {
    return (mediators || [])
      .filter((m) => String(m?.id || "") !== "3" && isMineMediator(m))
      .map((m) => {
        const history = (Array.isArray(m.followUpHistory) ? m.followUpHistory : [])
          .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
          .filter((h) => h && typeof h === "object");
        const todayEntries = history.filter((h) => {
          const ts = h.ts || h.endedAt || h.date;
          return ts ? isOnYmdIST(ts, todayYmd) : false;
        });
        const callCount = todayEntries.filter((h) => String(h.type || "").toLowerCase().includes("call")).length;
        const waCount = todayEntries.filter((h) => String(h.type || "").toLowerCase().includes("whatsapp")).length;
        const total = todayEntries.length;
        const latest = todayEntries.sort((a, b) => new Date(b.ts || b.endedAt || b.date || 0) - new Date(a.ts || a.endedAt || a.date || 0))[0] || null;
        return {
          id: m.id,
          name: m.name,
          phone: m.phone,
          total,
          callCount,
          waCount,
          latestAt: latest ? latest.ts || latest.endedAt || latest.date : null,
          latestOutcome: latest ? String(latest.outcome || latest.type || "logged").replace(/_/g, " ") : "—",
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
  }, [mediators, todayYmd, backendEnabled, authUser?.id]);

  const openValue = useMemo(() => openLeads.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0), [openLeads]);
  const allOpenLeadRows = useMemo(
    () =>
      [...openLeads].sort((a, b) => {
        const aTs = parseIsoOrNull(a?.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTs = parseIsoOrNull(b?.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aTs - bTs;
      }),
    [openLeads]
  );
  const meetingTodayClients = useMemo(
    () => openLeads.filter((l) => l?.status === "Meeting Scheduled" && l?.nextFollowUp && isTodayIST(l.nextFollowUp)),
    [openLeads]
  );
  const staleOpenClients = useMemo(() => openLeads.filter((l) => isStaleLead(l)), [openLeads]);
  const stalePartnerStatuses = new Set(["Partner Follow-Up", "Statements Not Received", "Contact Details Not Received", "Interest Rate Issue"]);
  const staleInternalStatuses = new Set(["Follow-Up Required", "No Appointment", "Commercial Client", "New"]);
  const stalePartnerFollowUp = useMemo(
    () => staleOpenClients.filter((l) => stalePartnerStatuses.has(String(l?.status || ""))),
    [staleOpenClients]
  );
  const staleOwnFollowUp = useMemo(() => {
    return staleOpenClients.filter((l) => {
      const status = String(l?.status || "");
      if (stalePartnerStatuses.has(status)) return false;
      if (staleInternalStatuses.has(status)) return true;
      return true; // default bucket = internal follow-up
    });
  }, [staleOpenClients]);
  const openClientsByMediator = useMemo(() => {
    const counts = new Map();
    openLeads.forEach((l) => {
      const name = resolveLeadMediatorName(l);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
  }, [openLeads, mediatorNameById]);
  const partnerUpdateStorageKey = useMemo(() => {
    const ownerKey = String(authUser?.id || currentUser || "local")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 80);
    return `liras_partner_manual_updates_${ownerKey}_${todayYmd}`;
  }, [authUser?.id, currentUser, todayYmd]);
  const [partnerUpdateDraft, setPartnerUpdateDraft] = useState("");
  const [partnerManualUpdates, setPartnerManualUpdates] = useState([]);

  useEffect(() => {
    setPartnerManualUpdates(parseJson(safeLocalStorage.getItem(partnerUpdateStorageKey), []));
  }, [partnerUpdateStorageKey]);

  useEffect(() => {
    safeLocalStorage.setItem(partnerUpdateStorageKey, JSON.stringify(Array.isArray(partnerManualUpdates) ? partnerManualUpdates : []));
  }, [partnerUpdateStorageKey, partnerManualUpdates]);

  const addPartnerManualUpdate = () => {
    const text = String(partnerUpdateDraft || "").trim();
    if (!text) return;
    setPartnerManualUpdates((prev) => [
      {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text,
        createdAt: new Date().toISOString(),
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setPartnerUpdateDraft("");
  };

  const removePartnerManualUpdate = (id) => {
    setPartnerManualUpdates((prev) => (Array.isArray(prev) ? prev.filter((u) => String(u?.id) !== String(id)) : []));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Daily_Activity_Report_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 print:p-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 sm:p-6 print:shadow-none print:border-0 print:p-4">
          <ReportBrandHeader
            title="Daily Activity Report"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{currentUser}</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">Open leads + today activity only</span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Open Leads (Current)</div>
                <div className="text-slate-900 font-extrabold">{openLeads.length}</div>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-3">
            <div className="surface-solid p-3 border border-indigo-100 bg-indigo-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Mediators Spoken</div>
              <div className="text-xl font-extrabold text-indigo-700 mt-1">{mediatorTouches.length}</div>
            </div>
            <div className="surface-solid p-3 border border-cyan-100 bg-cyan-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Leads Dealt Today</div>
              <div className="text-xl font-extrabold text-cyan-700 mt-1">{lifecycleRows.length}</div>
            </div>
            <div className="surface-solid p-3 border border-violet-100 bg-violet-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Added Today</div>
              <div className="text-xl font-extrabold text-violet-700 mt-1">{leadsAddedToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-teal-100 bg-teal-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Met Today</div>
              <div className="text-xl font-extrabold text-teal-700 mt-1">{metToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-emerald-100 bg-emerald-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Payment Done</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">{paymentDoneToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-rose-100 bg-rose-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Rejected</div>
              <div className="text-xl font-extrabold text-rose-700 mt-1">{rejectedToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-amber-100 bg-amber-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Added but Open EOD</div>
              <div className="text-xl font-extrabold text-amber-700 mt-1">{addedStillOpenEod.length}</div>
            </div>
            <div className="surface-solid p-3 border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Open Value</div>
              <div className="text-base font-extrabold text-slate-900 mt-1">{formatCompactCurrency(openValue)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="surface-solid p-3 border border-blue-100 bg-blue-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">All Open Leads</div>
              <div className="text-2xl font-extrabold text-blue-700 mt-1">{allOpenLeadRows.length}</div>
            </div>
            <div className="surface-solid p-3 border border-purple-100 bg-purple-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Meeting Today Clients</div>
              <div className="text-2xl font-extrabold text-purple-700 mt-1">{meetingTodayClients.length}</div>
            </div>
            <div className="surface-solid p-3 border border-rose-100 bg-rose-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Stale Clients (Open)</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">{staleOpenClients.length}</div>
              <div className="text-[10px] text-slate-600 font-bold mt-1">
                Partner: {stalePartnerFollowUp.length} • Own: {staleOwnFollowUp.length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-fuchsia-900 text-white flex items-center justify-between">
              <div className="font-extrabold text-sm">Partner / Owner Manual Updates</div>
              <div className="text-xs text-fuchsia-200 font-bold">{partnerManualUpdates.length} notes</div>
            </div>
            <div className="p-3 bg-white space-y-2">
              <div className="print:hidden rounded-xl border border-fuchsia-100 bg-fuchsia-50/20 p-3 space-y-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-fuchsia-700 block">
                  Add update to share with partners / owners
                </label>
                <textarea
                  value={partnerUpdateDraft}
                  onChange={(e) => setPartnerUpdateDraft(e.target.value)}
                  className="w-full min-h-[92px] p-3 text-sm bg-white border border-fuchsia-200 rounded-xl focus:ring-2 focus:ring-fuchsia-300 outline-none"
                  placeholder="Example: Spoke to Aashish at 10:45 AM; Hotel Sudha Inn confirmed statement by 4 PM; follow-up set for tomorrow."
                />
                <div className="flex gap-2">
                  <button type="button" className="btn-primary px-4 py-2" onClick={addPartnerManualUpdate}>
                    Add Note
                  </button>
                  <button type="button" className="btn-secondary px-4 py-2" onClick={() => setPartnerUpdateDraft("")}>
                    Clear Draft
                  </button>
                </div>
              </div>
              {partnerManualUpdates.length === 0 ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">
                  No manual updates added yet.
                </div>
              ) : (
                partnerManualUpdates.map((u) => (
                  <div key={`manual-update-${u.id}`} className="rounded-xl border border-fuchsia-100 p-3 bg-fuchsia-50/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-fuchsia-700">Manual Update</div>
                      <div className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{formatDateTime(u.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap">{u.text}</div>
                    <div className="mt-2 print:hidden">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => removePartnerManualUpdate(u.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-violet-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Open Leads Activity Today</div>
                <div className="text-xs text-violet-200 font-bold">{lifecycleRows.length} leads</div>
              </div>
              <div className="hidden lg:block overflow-x-auto bg-white print:hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold">
                    <tr>
                      <th className="px-3 py-2 text-left">Lead</th>
                      <th className="px-3 py-2 text-left">Entry</th>
                      <th className="px-3 py-2 text-left">Last Update</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lifecycleRows.slice(0, 18).map((r) => (
                      <tr key={`lc-${r.id}`}>
                        <td className="px-3 py-2">
                          <div className="font-extrabold text-slate-800">{r.name}</div>
                          <div className="text-[10px] text-slate-500">{r.company || "—"}</div>
                          <div className="text-[10px] text-violet-700 font-bold mt-0.5">Mediator: {r.mediatorName}</div>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">{r.entryAt ? formatDateTime(r.entryAt) : "—"}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{r.lastActionAt ? formatDateTime(r.lastActionAt) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase ${STATUS_CONFIG[r.status]?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {lifecycleRows.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-slate-500 italic text-center">
                          No open lead activity captured today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="block lg:hidden p-3 space-y-2 bg-white print:hidden">
                {lifecycleRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">
                    No open lead activity captured today.
                  </div>
                ) : (
                  lifecycleRows.slice(0, 18).map((r) => (
                    <article key={`mobile-lc-${r.id}`} className="rounded-xl border border-violet-100 p-3 bg-violet-50/20">
                      <div className="text-sm font-extrabold text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.company || "—"}</div>
                      <div className="text-[11px] text-violet-700 font-bold mt-1">Mediator: {r.mediatorName}</div>
                      <div className="mt-2 text-[11px] text-slate-700 font-semibold">
                        Entry: {r.entryAt ? formatDateTime(r.entryAt) : "—"}
                      </div>
                      <div className="text-[11px] text-slate-700 font-semibold">
                        Last update: {r.lastActionAt ? formatDateTime(r.lastActionAt) : "—"}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase ${STATUS_CONFIG[r.status]?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          {r.status}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
              <div className="hidden print:block p-3 space-y-2 bg-white">
                {lifecycleRows.slice(0, 18).map((r) => (
                  <div key={`print-lc-${r.id}`} className="rounded-lg border border-slate-200 p-2 print:break-inside-avoid">
                    <div className="text-sm font-extrabold text-slate-900">{r.name}</div>
                    <div className="text-[11px] text-violet-700 font-bold">Mediator: {r.mediatorName}</div>
                    <div className="text-[11px] text-slate-600 mt-1">Entry: {r.entryAt ? formatDateTime(r.entryAt) : "—"}</div>
                    <div className="text-[11px] text-slate-600">Last: {r.lastActionAt ? formatDateTime(r.lastActionAt) : "—"}</div>
                    <div className="text-[11px] text-slate-600">Status: {r.status}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-cyan-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Open Clients by Mediator</div>
                <div className="text-xs text-cyan-200 font-bold">{openClientsByMediator.length} mediators</div>
              </div>
              <div className="p-3 bg-white space-y-2">
                {openClientsByMediator.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">No open clients mapped to mediators.</div>
                ) : (
                  openClientsByMediator.map((m, idx) => (
                    <div key={`open-med-${m.name}-${idx}`} className="rounded-xl border border-cyan-100 p-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{m.name}</div>
                      <div className="text-xs font-extrabold text-cyan-700 whitespace-nowrap">{m.count} open clients</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-blue-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-blue-100 text-blue-800 font-extrabold text-sm">All Open Leads</div>
              <div className="p-3 bg-white space-y-2">
                {allOpenLeadRows.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No open leads.</div>
                ) : (
                  allOpenLeadRows.slice(0, 12).map((l) => (
                    <div key={`open-${l.id}`} className="rounded-lg border border-blue-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-[11px] text-blue-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">
                        Next: {l.nextFollowUp ? formatDateTime(l.nextFollowUp) : "Not set"} • {l.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-purple-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-purple-100 text-purple-800 font-extrabold text-sm">Meeting Today Clients</div>
              <div className="p-3 bg-white space-y-2">
                {meetingTodayClients.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No clients scheduled for meeting today.</div>
                ) : (
                  meetingTodayClients.map((l) => (
                    <div key={`meetToday-${l.id}`} className="rounded-lg border border-purple-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-[11px] text-purple-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">
                        Meeting: {l.nextFollowUp ? formatDateTime(l.nextFollowUp) : "Not set"} • {l.status}
                      </div>
                      <div className="text-[11px] text-purple-700 font-extrabold mt-1">
                        Meeting by: {resolveMeetingBy(l)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-rose-100 text-rose-800 font-extrabold text-sm">Stale Clients (Open)</div>
              <div className="p-3 bg-white space-y-2">
                {staleOpenClients.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No stale open leads.</div>
                ) : (
                  <>
                    <div className="rounded-lg border border-rose-100 p-2 bg-rose-50/40">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-rose-700">
                        Partner Follow-up Stale ({stalePartnerFollowUp.length})
                      </div>
                    </div>
                    {stalePartnerFollowUp.length === 0 ? (
                      <div className="text-xs text-slate-500 italic px-1">No partner-follow-up stale leads.</div>
                    ) : (
                      stalePartnerFollowUp.map((l) => (
                        <div key={`stale-partner-${l.id}`} className="rounded-lg border border-rose-100 p-2">
                          <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                          <div className="text-[11px] text-rose-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                          <div className="text-xs text-slate-600 font-bold mt-1">
                            Reason: Partner follow-up pending • Last activity: {formatDateTime(getLeadLastActivityIso(l))}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">Status: {l.status}</div>
                        </div>
                      ))
                    )}

                    <div className="rounded-lg border border-amber-100 p-2 bg-amber-50/40 mt-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                        Own/Internal Follow-up Stale ({staleOwnFollowUp.length})
                      </div>
                    </div>
                    {staleOwnFollowUp.length === 0 ? (
                      <div className="text-xs text-slate-500 italic px-1">No internal-follow-up stale leads.</div>
                    ) : (
                      staleOwnFollowUp.map((l) => (
                        <div key={`stale-own-${l.id}`} className="rounded-lg border border-amber-100 p-2">
                          <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                          <div className="text-[11px] text-amber-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                          <div className="text-xs text-slate-600 font-bold mt-1">
                            Reason: Own follow-up pending • Last activity: {formatDateTime(getLeadLastActivityIso(l))}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">Status: {l.status}</div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-2">
            <div className="rounded-2xl border border-emerald-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-100 text-emerald-800 font-extrabold text-sm">Payment Done Today</div>
              <div className="p-3 bg-white space-y-2">
                {paymentDoneToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No payment closures today.</div>
                ) : (
                  paymentDoneToday.map((l) => (
                    <div key={`pay-${l.id}`} className="rounded-lg border border-emerald-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-[11px] text-emerald-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">Closed: {formatDateTime(getClosedAt(l) || l.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-rose-100 text-rose-800 font-extrabold text-sm">Rejected Today</div>
              <div className="p-3 bg-white space-y-2">
                {rejectedToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No rejection updates today.</div>
                ) : (
                  rejectedToday.map((l) => (
                    <div key={`rej-${l.id}`} className="rounded-lg border border-rose-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-[11px] text-rose-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">{l.status} • {formatDateTime(getClosedAt(l) || l.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-teal-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-teal-100 text-teal-800 font-extrabold text-sm">Clients Met Today</div>
              <div className="p-3 bg-white space-y-2">
                {metToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No meeting/visit logs captured today.</div>
                ) : (
                  metToday.map((l) => {
                    const notes = Array.isArray(l.notes) ? l.notes : [];
                    const note =
                      [...notes].reverse().find((n) => isOnYmdIST(n?.date, todayYmd) && isMeetingDoneNoteText(n?.text)) ||
                      notes[notes.length - 1];
                    return (
                      <div key={`met-${l.id}`} className="rounded-lg border border-teal-100 p-2">
                        <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                        <div className="text-[11px] text-teal-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                        <div className="text-xs text-slate-600 font-bold mt-1">{note?.date ? formatDateTime(note.date) : "Today"} • {l.status}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-100 text-amber-800 font-extrabold text-sm">Added Today but Open (EOD)</div>
              <div className="p-3 bg-white space-y-2">
                {addedStillOpenEod.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No leads added today are pending open at EOD.</div>
                ) : (
                  addedStillOpenEod.map((l) => (
                    <div key={`eod-${l.id}`} className="rounded-lg border border-amber-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-[11px] text-amber-700 font-bold mt-0.5">Mediator: {resolveLeadMediatorName(l)}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">Entry: {formatDateTime(l.createdAt)} • Status: {l.status}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const DailyWorkUpdatePlanReportView = ({
  leads,
  mediators,
  staffUsers = [],
  onBack,
  backendEnabled = false,
  authUser = null,
  currentUser = "User",
}) => {
  const today = new Date();
  const todayYmd = toYmdIST(today);
  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowYmd = toYmdIST(tomorrow);
  const closedStatuses = new Set([
    "Payment Done",
    "Deal Closed",
    "Not Eligible",
    "Not Reliable",
    "Lost to Competitor",
    "Not Interested",
    "Not Interested (Temp)",
  ]);
  const rejectedStatuses = new Set(["Not Eligible", "Not Reliable", "Lost to Competitor"]);

  const isMineLead = (lead) => {
    if (!lead) return false;
    if (!backendEnabled || !authUser?.id) return true;
    const owner = String(lead.ownerId || lead.createdBy || "");
    if (!owner) return true;
    return owner === String(authUser.id);
  };

  const isMineMediator = (medi) => {
    if (!medi) return false;
    if (!backendEnabled || !authUser?.id) return true;
    const owner = String(medi.ownerId || medi.createdBy || "");
    if (!owner) return true;
    return owner === String(authUser.id);
  };

  const mineLeads = useMemo(() => (leads || []).filter((l) => isMineLead(l)), [leads, backendEnabled, authUser?.id]);
  const openLeads = useMemo(() => mineLeads.filter((l) => !closedStatuses.has(String(l?.status || ""))), [mineLeads]);

  const mediatorNameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(mediators) ? mediators : []).forEach((m) => {
      const key = String(m?.id || "");
      if (!key) return;
      map.set(key, String(m?.name || "").trim() || "Mediator");
    });
    return map;
  }, [mediators]);

  const staffNameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(staffUsers) ? staffUsers : []).forEach((u) => {
      const key = String(u?.userId || "");
      if (!key) return;
      const base = String(u?.label || u?.email || "").trim();
      const normalized = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
      map.set(key, normalized || base || key);
    });
    return map;
  }, [staffUsers]);

  const resolveLeadMediatorName = (lead) => {
    const mediatorId = String(lead?.mediatorId || "");
    if (mediatorId === "3") return "Direct Client";
    if (mediatorId && mediatorNameById.has(mediatorId)) return mediatorNameById.get(mediatorId);
    return "Unassigned Mediator";
  };

  const resolveMeetingBy = (lead) => {
    const assigned = String(lead?.assignedStaff || "").trim();
    if (assigned) return assigned;
    const ownerId = String(lead?.ownerId || lead?.createdBy || "");
    if (ownerId && staffNameById.has(ownerId)) return staffNameById.get(ownerId);
    return String(currentUser || "").trim() || "Unassigned";
  };

  const getLastNote = (lead) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    return notes.length ? notes[notes.length - 1] : null;
  };

  const getLatestNoteMatching = (lead, pattern) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const text = String(notes[i]?.text || "");
      if (pattern.test(text)) return notes[i];
    }
    return null;
  };

  const getClosedAt = (lead) => {
    if (!lead) return null;
    if (lead.status === "Payment Done" || lead.status === "Deal Closed") {
      if (lead?.loanDetails?.paymentDate) return lead.loanDetails.paymentDate;
      const paymentNote = getLatestNoteMatching(lead, /PAYMENT DONE|PAYMENT|DEAL CLOSED|CLOSED/i);
      return paymentNote?.date || null;
    }
    if (rejectedStatuses.has(lead.status)) {
      const rejectionNote = getLatestNoteMatching(lead, /\[REJECTION\]|\[REJECTION REASON\]|NOT ELIGIBLE|NOT RELIABLE|LOST TO COMPETITOR/i);
      return rejectionNote?.date || null;
    }
    return null;
  };

  const isLeadTouchedToday = (lead) => {
    if (!lead) return false;
    if (isOnYmdIST(lead.createdAt, todayYmd)) return true;
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    return notes.some((n) => isOnYmdIST(n?.date, todayYmd));
  };

  const workRowsToday = useMemo(() => {
    return mineLeads
      .filter((l) => isLeadTouchedToday(l))
      .map((l) => {
        const lastNote = getLastNote(l);
        const latestText = String(lastNote?.text || "").trim();
        return {
          id: l.id,
          name: l.name,
          status: String(l.status || "New"),
          mediatorName: resolveLeadMediatorName(l),
          amount: Number(l.loanAmount) || 0,
          lastActionAt: lastNote?.date || l.createdAt || null,
          latestUpdate: latestText || "Activity updated",
          nextFollowUp: l.nextFollowUp || null,
          meetingBy: resolveMeetingBy(l),
        };
      })
      .sort((a, b) => new Date(b.lastActionAt || 0) - new Date(a.lastActionAt || 0));
  }, [mineLeads, todayYmd, mediators, staffUsers, currentUser]);

  const mediatorTouches = useMemo(() => {
    return (mediators || [])
      .filter((m) => String(m?.id || "") !== "3" && isMineMediator(m))
      .map((m) => {
        const history = (Array.isArray(m.followUpHistory) ? m.followUpHistory : [])
          .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
          .filter((h) => h && typeof h === "object");
        const todayEntries = history.filter((h) => {
          const ts = h.ts || h.endedAt || h.date;
          return ts ? isOnYmdIST(ts, todayYmd) : false;
        });
        return {
          id: m.id,
          name: m.name,
          count: todayEntries.length,
        };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [mediators, todayYmd, backendEnabled, authUser?.id]);

  const addedToday = useMemo(() => mineLeads.filter((l) => isOnYmdIST(l.createdAt, todayYmd)), [mineLeads, todayYmd]);
  const metToday = useMemo(
    () =>
      mineLeads.filter((l) => {
        const notes = Array.isArray(l.notes) ? l.notes : [];
        return notes.some((n) => isOnYmdIST(n?.date, todayYmd) && isMeetingDoneNoteText(n?.text));
      }),
    [mineLeads, todayYmd]
  );
  const paymentDoneToday = useMemo(
    () =>
      mineLeads.filter((l) => {
        if (!(l.status === "Payment Done" || l.status === "Deal Closed")) return false;
        const closedAt = getClosedAt(l);
        return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
      }),
    [mineLeads, todayYmd]
  );
  const rejectedToday = useMemo(
    () =>
      mineLeads.filter((l) => {
        if (!rejectedStatuses.has(l.status)) return false;
        const closedAt = getClosedAt(l);
        return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
      }),
    [mineLeads, todayYmd]
  );
  const addedStillOpenEod = useMemo(() => addedToday.filter((l) => !closedStatuses.has(l.status)), [addedToday]);
  const [planDateYmd, setPlanDateYmd] = useState(tomorrowYmd);

  const scheduledTomorrowRows = useMemo(() => {
    return openLeads
      .filter((l) => {
        const next = l?.nextFollowUp;
        if (!next || !planDateYmd) return false;
        return isOnYmdIST(next, planDateYmd);
      })
      .map((l) => ({
        id: l.id,
        name: l.name,
        status: String(l.status || "New"),
        mediatorName: resolveLeadMediatorName(l),
        nextFollowUp: l.nextFollowUp || null,
        lastActionAt: getLeadLastActivityIso(l),
        amount: Number(l.loanAmount) || 0,
        meetingBy: resolveMeetingBy(l),
        planType: "Scheduled",
      }))
      .sort((a, b) => {
        const aTs = parseIsoOrNull(a?.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTs = parseIsoOrNull(b?.nextFollowUp)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aTs - bTs;
      });
  }, [openLeads, mediators, staffUsers, currentUser, planDateYmd]);
  const planStorageKey = useMemo(() => {
    const ownerKey = String(authUser?.id || currentUser || "local")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 80);
    return `liras_daily_group_update_${ownerKey}_${todayYmd}`;
  }, [authUser?.id, currentUser, todayYmd]);
  const [todayUpdateDraft, setTodayUpdateDraft] = useState("");
  const [tomorrowPlanDraft, setTomorrowPlanDraft] = useState("");
  const [groupTitleDraft, setGroupTitleDraft] = useState("Daily Group Update");
  const reportRef = useRef(null);
  const squareExportRefs = useRef([]);
  const portraitExportRefs = useRef([]);
  const eodSquareExportRefs = useRef([]);
  const eodPortraitExportRefs = useRef([]);
  const headerExportRef = useRef(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  useEffect(() => {
    const stored = parseJson(safeLocalStorage.getItem(planStorageKey), {});
    setTodayUpdateDraft(String(stored?.todayUpdate || ""));
    setTomorrowPlanDraft(String(stored?.tomorrowPlan || ""));
    setGroupTitleDraft(String(stored?.groupTitle || "Daily Group Update"));
    setPlanDateYmd(String(stored?.planDateYmd || tomorrowYmd));
  }, [planStorageKey, tomorrowYmd]);

  useEffect(() => {
    safeLocalStorage.setItem(
      planStorageKey,
      JSON.stringify({
        todayUpdate: todayUpdateDraft,
        tomorrowPlan: tomorrowPlanDraft,
        groupTitle: groupTitleDraft,
        planDateYmd,
      })
    );
  }, [planStorageKey, todayUpdateDraft, tomorrowPlanDraft, groupTitleDraft, planDateYmd]);

  const scheduledQueueCount = scheduledTomorrowRows.length;
  const workloadStatus = useMemo(() => {
    if (scheduledQueueCount >= 8 || workRowsToday.length >= 14) {
      return {
        label: "Critical Attention",
        tone: "bg-rose-100 text-rose-700 border-rose-200",
        accent: "text-rose-600",
      };
    }
    if (scheduledQueueCount >= 4 || workRowsToday.length >= 8) {
      return {
        label: "Watch Closely",
        tone: "bg-amber-100 text-amber-700 border-amber-200",
        accent: "text-amber-600",
      };
    }
    return {
      label: "On Track",
      tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
      accent: "text-emerald-600",
    };
  }, [scheduledQueueCount, workRowsToday.length]);

  const summaryMetrics = [
    { label: "Mediators", value: mediatorTouches.length, tone: "text-indigo-700 border-indigo-200 bg-indigo-50/70" },
    { label: "Added Today", value: addedToday.length, tone: "text-violet-700 border-violet-200 bg-violet-50/70" },
    { label: "Leads Worked", value: workRowsToday.length, tone: "text-cyan-700 border-cyan-200 bg-cyan-50/70" },
    { label: "Met", value: metToday.length, tone: "text-teal-700 border-teal-200 bg-teal-50/70" },
    { label: "Paid", value: paymentDoneToday.length, tone: "text-emerald-700 border-emerald-200 bg-emerald-50/70" },
    { label: "Rejected", value: rejectedToday.length, tone: "text-rose-700 border-rose-200 bg-rose-50/70" },
    { label: "Scheduled", value: scheduledQueueCount, tone: "text-amber-700 border-amber-200 bg-amber-50/70" },
  ];
  const exportSummaryMetrics = [
    summaryMetrics[0],
    summaryMetrics[1],
    summaryMetrics[3],
    summaryMetrics[4],
    summaryMetrics[5],
    summaryMetrics[6],
  ];
  const eodSummaryMetrics = [
    { label: "Mediators", value: mediatorTouches.length, tone: "text-indigo-700 border-indigo-200 bg-indigo-50/70" },
    { label: "Leads Worked", value: workRowsToday.length, tone: "text-cyan-700 border-cyan-200 bg-cyan-50/70" },
    { label: "Added Today", value: addedToday.length, tone: "text-violet-700 border-violet-200 bg-violet-50/70" },
    { label: "Met", value: metToday.length, tone: "text-teal-700 border-teal-200 bg-teal-50/70" },
    { label: "Paid", value: paymentDoneToday.length, tone: "text-emerald-700 border-emerald-200 bg-emerald-50/70" },
    { label: "Rejected", value: rejectedToday.length, tone: "text-rose-700 border-rose-200 bg-rose-50/70" },
    { label: "Open at EOD", value: addedStillOpenEod.length, tone: "text-amber-700 border-amber-200 bg-amber-50/70" },
  ];
  const chunkArray = (rows, size) => {
    const source = Array.isArray(rows) ? rows : [];
    if (!source.length) return [[]];
    const out = [];
    for (let i = 0; i < source.length; i += size) out.push(source.slice(i, i + size));
    return out;
  };
  const chunkText = (text, maxChars) => {
    const value = String(text || "").trim();
    if (!value) return [""];
    const words = value.split(/\s+/);
    const chunks = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks.length ? chunks : [value];
  };
  const squareAddedChunks = useMemo(() => chunkArray(addedToday, 2), [addedToday]);
  const squarePaidChunks = useMemo(() => chunkArray(paymentDoneToday, 2), [paymentDoneToday]);
  const squareMetChunks = useMemo(() => chunkArray(metToday, 2), [metToday]);
  const squareScheduledChunks = useMemo(() => chunkArray(scheduledTomorrowRows, 3), [scheduledTomorrowRows]);
  const squareMediatorChunks = useMemo(() => chunkArray(mediatorTouches, 6), [mediatorTouches]);
  const squareUpdatePreview = useMemo(() => chunkText(todayUpdateDraft, 220)[0] || "", [todayUpdateDraft]);
  const squarePlanPreview = useMemo(() => chunkText(tomorrowPlanDraft, 180)[0] || "", [tomorrowPlanDraft]);
  const portraitAddedChunks = useMemo(() => chunkArray(addedToday, 3), [addedToday]);
  const portraitPaidChunks = useMemo(() => chunkArray(paymentDoneToday, 3), [paymentDoneToday]);
  const portraitMetChunks = useMemo(() => chunkArray(metToday, 3), [metToday]);
  const portraitScheduledChunks = useMemo(() => chunkArray(scheduledTomorrowRows, 3), [scheduledTomorrowRows]);
  const portraitMediatorChunks = useMemo(() => chunkArray(mediatorTouches, 6), [mediatorTouches]);
  const portraitUpdatePreview = useMemo(() => chunkText(todayUpdateDraft, 420)[0] || "", [todayUpdateDraft]);
  const portraitPlanPreview = useMemo(() => chunkText(tomorrowPlanDraft, 360)[0] || "", [tomorrowPlanDraft]);

  const renderExportSectionHeader = (title, tone = "indigo") => {
    const toneMap = {
      violet: "from-violet-600 to-violet-500",
      emerald: "from-emerald-600 to-emerald-500",
      teal: "from-teal-600 to-teal-500",
      amber: "from-amber-500 to-orange-500",
      indigo: "from-indigo-600 to-indigo-500",
    };
    return (
      <div className={`rounded-2xl bg-gradient-to-r ${toneMap[tone] || toneMap.indigo} px-4 py-3 text-white shadow-sm`}>
        <div className="text-sm uppercase tracking-[0.28em] font-black">{title}</div>
      </div>
    );
  };

  function renderLeadExportCard(lead, tone = "slate") {
    const toneClasses =
      tone === "violet"
        ? "border-violet-100 bg-violet-50/60 text-violet-700"
        : tone === "emerald"
          ? "border-emerald-100 bg-emerald-50/60 text-emerald-700"
          : tone === "teal"
            ? "border-teal-100 bg-teal-50/60 text-teal-700"
            : "border-amber-100 bg-amber-50/60 text-amber-700";
    return (
      <div key={`${tone}-${lead.id}`} className={`rounded-2xl border px-4 py-3 overflow-hidden ${toneClasses}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight">{lead.name}</div>
            <div className="text-[13px] font-bold mt-1">{resolveLeadMediatorName(lead)}</div>
          </div>
          <div className="text-[11px] font-black uppercase text-slate-500 text-right">{String(lead.status || "New")}</div>
        </div>
        <div className="mt-2 text-[13px] font-bold text-slate-700 leading-snug">
          {lead.nextFollowUp ? formatDateTime(lead.nextFollowUp) : formatDateTime(getClosedAt(lead) || getLeadLastActivityIso(lead) || lead.createdAt)}
        </div>
      </div>
    );
  }

  function renderMediatorTouchCard(row, prefix) {
    return (
      <div key={`${prefix}-${row.id}`} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 overflow-hidden">
        <div className="text-lg font-black text-slate-900 leading-tight">{row.name}</div>
        <div className="mt-2 text-[13px] font-bold text-indigo-700">{row.count} call{row.count === 1 ? "" : "s"} today</div>
      </div>
    );
  }

  const buildDetailPages = useCallback((sections) => {
    const pages = [];
    sections.forEach((section) => {
      section.chunks.forEach((rows, chunkIndex) => {
        if (!rows?.length) return;
        pages.push({
          sectionKey: section.key,
          title: section.title,
          tone: section.tone,
          rows,
          totalCount: section.totalCount,
          chunkIndex,
          chunkCount: section.chunks.length,
          renderer: section.renderer,
        });
      });
    });
    return pages;
  }, []);

  const squareDetailPages = useMemo(
    () =>
      buildDetailPages([
        {
          key: "added",
          title: "Added Today",
          tone: "violet",
          chunks: squareAddedChunks,
          totalCount: addedToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")),
        },
        {
          key: "paid",
          title: "Payment Done",
          tone: "emerald",
          chunks: squarePaidChunks,
          totalCount: paymentDoneToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "emerald")),
        },
        {
          key: "met",
          title: "Clients Met",
          tone: "teal",
          chunks: squareMetChunks,
          totalCount: metToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "teal")),
        },
        {
          key: "scheduled",
          title: "Scheduled for Plan Date",
          tone: "amber",
          chunks: squareScheduledChunks,
          totalCount: scheduledTomorrowRows.length,
          renderer: (rows) =>
            rows.map((row) => (
              <div key={`sq-scheduled-${row.id}`} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-slate-900 leading-tight">{row.name}</div>
                    <div className="text-[13px] font-bold text-amber-700 mt-1">{row.mediatorName}</div>
                  </div>
                  <div className="rounded-xl px-3 py-1 text-[11px] font-black uppercase bg-amber-100 text-amber-700">
                    Scheduled
                  </div>
                </div>
                <div className="mt-2 text-[13px] font-bold text-slate-700 leading-snug">
                  {row.nextFollowUp ? formatDateTime(row.nextFollowUp) : "Not set"} • {row.status}
                </div>
              </div>
            )),
        },
        {
          key: "mediators",
          title: "Mediators Spoken Today",
          tone: "indigo",
          chunks: squareMediatorChunks,
          totalCount: mediatorTouches.length,
          renderer: (rows) => rows.map((row) => renderMediatorTouchCard(row, "sq-med")),
        },
      ]),
    [
      addedToday.length,
      buildDetailPages,
      mediatorTouches.length,
      metToday.length,
      paymentDoneToday.length,
      renderLeadExportCard,
      scheduledTomorrowRows.length,
      squareAddedChunks,
      squareMediatorChunks,
      squareMetChunks,
      squarePaidChunks,
      squareScheduledChunks,
    ]
  );

  const portraitDetailPages = useMemo(
    () =>
      buildDetailPages([
        {
          key: "added",
          title: "Added Today",
          tone: "violet",
          chunks: portraitAddedChunks,
          totalCount: addedToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")),
        },
        {
          key: "paid",
          title: "Payment Done",
          tone: "emerald",
          chunks: portraitPaidChunks,
          totalCount: paymentDoneToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "emerald")),
        },
        {
          key: "met",
          title: "Clients Met",
          tone: "teal",
          chunks: portraitMetChunks,
          totalCount: metToday.length,
          renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "teal")),
        },
        {
          key: "scheduled",
          title: "Scheduled for Plan Date",
          tone: "amber",
          chunks: portraitScheduledChunks,
          totalCount: scheduledTomorrowRows.length,
          renderer: (rows) =>
            rows.map((row) => (
              <div key={`pt-scheduled-${row.id}`} className="rounded-[24px] border border-amber-100 bg-amber-50/60 px-5 py-4 overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[28px] font-black text-slate-900">{row.name}</div>
                    <div className="text-lg font-bold text-amber-700 mt-1">{row.mediatorName}</div>
                  </div>
                  <div className="rounded-xl px-3 py-1 text-sm font-black uppercase bg-amber-100 text-amber-700">
                    Scheduled
                  </div>
                </div>
                <div className="mt-3 text-lg font-bold text-slate-700">
                  {row.nextFollowUp ? formatDateTime(row.nextFollowUp) : "Not set"} • {row.status}
                </div>
              </div>
            )),
        },
        {
          key: "mediators",
          title: "Mediators Spoken Today",
          tone: "indigo",
          chunks: portraitMediatorChunks,
          totalCount: mediatorTouches.length,
          renderer: (rows) => rows.map((row) => renderMediatorTouchCard(row, "pt-med")),
        },
      ]),
    [
      addedToday.length,
      buildDetailPages,
      mediatorTouches.length,
      metToday.length,
      paymentDoneToday.length,
      portraitAddedChunks,
      portraitMediatorChunks,
      portraitMetChunks,
      portraitPaidChunks,
      portraitScheduledChunks,
      renderLeadExportCard,
      scheduledTomorrowRows.length,
    ]
  );

  const squarePageCount = 1 + squareDetailPages.length;
  const portraitPageCount = 1 + portraitDetailPages.length;
  const eodSquareAddedChunks = useMemo(() => chunkArray(addedToday, 2), [addedToday]);
  const eodSquarePaidChunks = useMemo(() => chunkArray(paymentDoneToday, 2), [paymentDoneToday]);
  const eodSquareMetChunks = useMemo(() => chunkArray(metToday, 2), [metToday]);
  const eodSquareRejectedChunks = useMemo(() => chunkArray(rejectedToday, 2), [rejectedToday]);
  const eodSquareOpenChunks = useMemo(() => chunkArray(addedStillOpenEod, 2), [addedStillOpenEod]);
  const eodSquareMediatorChunks = useMemo(() => chunkArray(mediatorTouches, 6), [mediatorTouches]);
  const eodPortraitAddedChunks = useMemo(() => chunkArray(addedToday, 3), [addedToday]);
  const eodPortraitPaidChunks = useMemo(() => chunkArray(paymentDoneToday, 3), [paymentDoneToday]);
  const eodPortraitMetChunks = useMemo(() => chunkArray(metToday, 3), [metToday]);
  const eodPortraitRejectedChunks = useMemo(() => chunkArray(rejectedToday, 3), [rejectedToday]);
  const eodPortraitOpenChunks = useMemo(() => chunkArray(addedStillOpenEod, 3), [addedStillOpenEod]);
  const eodPortraitMediatorChunks = useMemo(() => chunkArray(mediatorTouches, 6), [mediatorTouches]);

  const eodSquareDetailPages = useMemo(
    () =>
      buildDetailPages([
        { key: "added", title: "Added Today", tone: "violet", chunks: eodSquareAddedChunks, totalCount: addedToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")) },
        { key: "paid", title: "Payment Done", tone: "emerald", chunks: eodSquarePaidChunks, totalCount: paymentDoneToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "emerald")) },
        { key: "met", title: "Clients Met", tone: "teal", chunks: eodSquareMetChunks, totalCount: metToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "teal")) },
        { key: "rejected", title: "Rejected Today", tone: "violet", chunks: eodSquareRejectedChunks, totalCount: rejectedToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")) },
        { key: "openEod", title: "Added but Open EOD", tone: "amber", chunks: eodSquareOpenChunks, totalCount: addedStillOpenEod.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "amber")) },
        { key: "mediators", title: "Mediators Spoken Today", tone: "indigo", chunks: eodSquareMediatorChunks, totalCount: mediatorTouches.length, renderer: (rows) => rows.map((row) => renderMediatorTouchCard(row, "eod-sq-med")) },
      ]),
    [addedStillOpenEod.length, addedToday.length, buildDetailPages, eodSquareAddedChunks, eodSquareMediatorChunks, eodSquareMetChunks, eodSquareOpenChunks, eodSquarePaidChunks, eodSquareRejectedChunks, mediatorTouches.length, metToday.length, paymentDoneToday.length, rejectedToday.length]
  );

  const eodPortraitDetailPages = useMemo(
    () =>
      buildDetailPages([
        { key: "added", title: "Added Today", tone: "violet", chunks: eodPortraitAddedChunks, totalCount: addedToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")) },
        { key: "paid", title: "Payment Done", tone: "emerald", chunks: eodPortraitPaidChunks, totalCount: paymentDoneToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "emerald")) },
        { key: "met", title: "Clients Met", tone: "teal", chunks: eodPortraitMetChunks, totalCount: metToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "teal")) },
        { key: "rejected", title: "Rejected Today", tone: "violet", chunks: eodPortraitRejectedChunks, totalCount: rejectedToday.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "violet")) },
        { key: "openEod", title: "Added but Open EOD", tone: "amber", chunks: eodPortraitOpenChunks, totalCount: addedStillOpenEod.length, renderer: (rows) => rows.map((lead) => renderLeadExportCard(lead, "amber")) },
        { key: "mediators", title: "Mediators Spoken Today", tone: "indigo", chunks: eodPortraitMediatorChunks, totalCount: mediatorTouches.length, renderer: (rows) => rows.map((row) => renderMediatorTouchCard(row, "eod-pt-med")) },
      ]),
    [addedStillOpenEod.length, addedToday.length, buildDetailPages, eodPortraitAddedChunks, eodPortraitMediatorChunks, eodPortraitMetChunks, eodPortraitOpenChunks, eodPortraitPaidChunks, eodPortraitRejectedChunks, mediatorTouches.length, metToday.length, paymentDoneToday.length, rejectedToday.length]
  );
  const eodSquarePageCount = 1 + eodSquareDetailPages.length;
  const eodPortraitPageCount = 1 + eodPortraitDetailPages.length;

  const renderExportFooter = (pageNumber, totalPages, sectionName = "") => (
    <div className="mt-auto pt-4 text-right text-sm font-bold tracking-wide text-slate-500">
      Page {pageNumber}{sectionName ? ` • ${sectionName}` : ""}{totalPages > 1 ? ` • ${totalPages} total` : ""}
    </div>
  );

  const handleDownloadImage = async (mode = "square") => {
    const targets =
      mode === "portrait"
        ? portraitExportRefs.current.filter(Boolean)
        : mode === "eod-square"
          ? eodSquareExportRefs.current.filter(Boolean)
          : mode === "eod-portrait"
            ? eodPortraitExportRefs.current.filter(Boolean)
        : mode === "header"
          ? [headerExportRef.current].filter(Boolean)
          : mode === "full"
            ? [reportRef.current].filter(Boolean)
            : squareExportRefs.current.filter(Boolean);
    if (!targets.length || isExportingImage) return;
    try {
      setIsExportingImage(true);
      for (let index = 0; index < targets.length; index += 1) {
        const canvas = await html2canvas(targets[index], {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          ignoreElements: (element) => element?.dataset?.exportIgnore === "true",
        });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
        if (!blob) throw new Error("image_export_failed");
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `Daily_Work_Update_${mode}_${todayYmd}${targets.length > 1 ? `_page_${index + 1}` : ""}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        if (targets.length > 1 && index < targets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => handleDownloadImage("header")} className="btn-secondary px-4 py-2" disabled={isExportingImage}>
            <Download size={16} /> Header Image
          </button>
          <button onClick={() => handleDownloadImage("square")} className="btn-primary px-4 py-2" disabled={isExportingImage}>
            <Download size={16} /> {isExportingImage ? "Preparing..." : "Square Image"}
          </button>
          <button onClick={() => handleDownloadImage("portrait")} className="btn-secondary px-4 py-2" disabled={isExportingImage}>
            <Download size={16} /> Story Image
          </button>
          <button onClick={() => handleDownloadImage("eod-square")} className="btn-secondary px-4 py-2" disabled={isExportingImage}>
            <Download size={16} /> EOD Square
          </button>
          <button onClick={() => handleDownloadImage("eod-portrait")} className="btn-secondary px-4 py-2" disabled={isExportingImage}>
            <Download size={16} /> EOD Story
          </button>
          <button
            onClick={() => {
              document.title = `Daily_Work_Update_${todayYmd}`;
              window.print();
            }}
            className="btn-secondary px-4 py-2"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 print:p-5">
        <div className="fixed -left-[20000px] top-0 pointer-events-none">
          <div
            ref={headerExportRef}
            className="w-[1600px] h-[900px] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(135deg,#0f172a_0%,#111827_48%,#1e293b_100%)] text-white p-14 flex flex-col"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-[28px] bg-white/10 border border-white/15 shadow-lg flex items-center justify-center backdrop-blur-sm">
                  <BrandMark size={52} className="opacity-95" />
                </div>
                <div>
                  <div className="text-[18px] tracking-[0.34em] uppercase font-extrabold text-slate-300">{BRAND.name}</div>
                  <div className="text-6xl font-black mt-3">{groupTitleDraft.trim() || "Daily Group Update"}</div>
                  <div className="text-3xl font-semibold text-slate-200 mt-3">{currentUser} • {todayYmd}</div>
                </div>
              </div>
              <div className={`rounded-[26px] border px-6 py-4 ${workloadStatus.tone} bg-white`}>
                <div className="text-xs uppercase tracking-[0.3em] font-black opacity-80">Load Status</div>
                <div className="text-3xl font-black mt-2">{workloadStatus.label}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-10">
              {summaryMetrics.slice(0, 4).map((item) => (
                <div key={`hd-metric-${item.label}`} className="rounded-[28px] border border-white/10 bg-white/8 px-5 py-5 backdrop-blur-sm">
                  <div className="text-sm uppercase tracking-[0.24em] font-black text-slate-300">{item.label}</div>
                  <div className="text-6xl font-black mt-4">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1.1fr_0.9fr] gap-6 mt-8 flex-1">
              <div className="rounded-[32px] border border-white/10 bg-white/8 p-7 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.3em] font-black text-indigo-300">Today Update</div>
                <div className="mt-4 text-[32px] leading-[1.35] font-bold text-white whitespace-pre-wrap">
                  {todayUpdateDraft.trim() || "No manual update added yet."}
                </div>
              </div>
              <div className="rounded-[32px] border border-white/10 bg-white/8 p-7 backdrop-blur-sm flex flex-col">
                <div className="text-xs uppercase tracking-[0.3em] font-black text-emerald-300">Tomorrow Plan</div>
                <div className="mt-4 text-[28px] leading-[1.38] font-bold text-white whitespace-pre-wrap">
                  {tomorrowPlanDraft.trim() || "No next-day plan added yet."}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-4 pt-6">
                  <div className="rounded-[22px] bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] font-black text-slate-300">Scheduled Leads</div>
                    <div className={`text-5xl font-black mt-3 ${workloadStatus.accent}`}>{scheduledQueueCount}</div>
                  </div>
                  <div className="rounded-[22px] bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] font-black text-slate-300">Leads Worked</div>
                    <div className="text-5xl font-black mt-3 text-amber-300">{workRowsToday.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {Array.from({ length: squarePageCount }).map((_, pageIndex) => {
            const detailPage = pageIndex > 0 ? squareDetailPages[pageIndex - 1] : null;
            return (
              <div
                key={`square-export-page-${pageIndex}`}
                ref={(el) => {
                  squareExportRefs.current[pageIndex] = el;
                }}
                className="w-[1080px] h-[1080px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_36%,#f8fafc_100%)] text-slate-900 p-12 flex flex-col"
              >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-[28px] bg-slate-900 shadow-lg flex items-center justify-center">
                  <BrandMark size={52} className="opacity-95" />
                </div>
                <div>
                  <div className="text-[18px] tracking-[0.32em] uppercase font-extrabold text-slate-500">{BRAND.name}</div>
                  <div className="text-5xl font-black text-slate-950 mt-2">{groupTitleDraft.trim() || "Daily Work Update"}</div>
                  <div className="text-2xl font-semibold text-slate-600 mt-2">
                    {currentUser} • {todayYmd}{squarePageCount > 1 ? ` • Page ${pageIndex + 1}/${squarePageCount}` : ""}
                  </div>
                </div>
              </div>
              <div className={`rounded-[28px] border px-6 py-4 ${workloadStatus.tone}`}>
                <div className="text-xs uppercase tracking-[0.3em] font-black opacity-80">Load Status</div>
                <div className="text-3xl font-black mt-2">{workloadStatus.label}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-7">
              {exportSummaryMetrics.map((item) => (
                <div key={`sq-metric-${item.label}`} className={`rounded-[24px] border px-5 py-4 ${item.tone}`}>
                  <div className="text-xs uppercase tracking-[0.24em] font-black opacity-80">{item.label}</div>
                  <div className="text-4xl font-black mt-2">{item.value}</div>
                </div>
              ))}
            </div>

            {pageIndex === 0 ? (
              <div className="grid grid-cols-[1.02fr_0.98fr] gap-4 mt-5 flex-1 min-h-0">
                <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm p-5 flex flex-col min-h-0 overflow-hidden">
                  {renderExportSectionHeader("Today Update", "indigo")}
                  <div className="mt-4 text-[22px] leading-[1.28] font-bold text-slate-900 whitespace-pre-wrap">
                    {squareUpdatePreview || "No manual update yet."}
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.28em] font-black text-slate-500">Page Summary</div>
                      <div className="mt-2 text-lg font-bold text-slate-700">
                        {addedToday.length} added • {paymentDoneToday.length} paid • {metToday.length} met • {scheduledQueueCount} scheduled
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-h-0">
                  <div className="rounded-[28px] border border-emerald-200 bg-white/90 shadow-sm p-5">
                    {renderExportSectionHeader("Tomorrow Plan", "emerald")}
                    <div className="mt-4 text-[18px] leading-[1.28] font-bold text-slate-900 whitespace-pre-wrap min-h-[120px]">
                      {squarePlanPreview || "No next-day plan yet."}
                    </div>
                  </div>
                  <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm p-5 flex-1">
                    {renderExportSectionHeader("Included In Detail Pages", "amber")}
                    <div className="mt-4 space-y-3 text-base font-bold text-slate-700">
                      <div>• Added Today</div>
                      <div>• Payment Done</div>
                      <div>• Clients Met</div>
                      <div>• Scheduled for Plan Date</div>
                      <div>• Mediators Spoken Today</div>
                    </div>
                  </div>
                </div>
                {renderExportFooter(pageIndex + 1, squarePageCount, "Summary")}
              </div>
            ) : (
              <div className="mt-5 flex-1 min-h-0 flex flex-col">
                <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm p-5 flex-1 min-h-0 overflow-hidden">
                  {renderExportSectionHeader(
                    `${detailPage?.title || "Detail"} • ${detailPage?.totalCount || 0}`,
                    detailPage?.tone || "indigo"
                  )}
                  <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-500">
                    <div>{detailPage?.chunkCount > 1 ? `Part ${detailPage.chunkIndex + 1} of ${detailPage.chunkCount}` : "Single page section"}</div>
                    <div>{detailPage?.totalCount || 0} item{detailPage?.totalCount === 1 ? "" : "s"}</div>
                  </div>
                  <div className="mt-4 space-y-3 overflow-hidden">
                    {detailPage?.renderer(detailPage.rows)}
                  </div>
                </div>
                {renderExportFooter(pageIndex + 1, squarePageCount, detailPage?.title || "Detail")}
              </div>
            )}
              </div>
            );
          })}

          {Array.from({ length: portraitPageCount }).map((_, pageIndex) => {
            const detailPage = pageIndex > 0 ? portraitDetailPages[pageIndex - 1] : null;
            return (
              <div
                key={`portrait-export-page-${pageIndex}`}
                ref={(el) => {
                  portraitExportRefs.current[pageIndex] = el;
                }}
                className="w-[1080px] h-[1920px] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_38%,#ffffff_100%)] text-slate-900 p-16 flex flex-col"
              >
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-[28px] bg-slate-900 shadow-lg flex items-center justify-center">
                <BrandMark size={52} className="opacity-95" />
              </div>
              <div>
                <div className="text-[18px] tracking-[0.32em] uppercase font-extrabold text-slate-500">{BRAND.name}</div>
                <div className="text-6xl font-black text-slate-950 mt-2">{groupTitleDraft.trim() || "Daily Work Update"}</div>
                <div className="text-3xl font-semibold text-slate-600 mt-2">
                  {currentUser}{portraitPageCount > 1 ? ` • Page ${pageIndex + 1}/${portraitPageCount}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] font-black text-slate-500">Report Date</div>
                  <div className="text-4xl font-black text-slate-950 mt-2">{todayYmd}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] font-black text-emerald-500">Load Status</div>
                  <div className={`text-4xl font-black mt-2 ${workloadStatus.accent}`}>{workloadStatus.label}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-7">
                {exportSummaryMetrics.map((item) => (
                  <div key={`pt-metric-${item.label}`} className={`rounded-[24px] border p-5 ${item.tone}`}>
                    <div className="text-sm uppercase tracking-[0.24em] font-black opacity-80">{item.label}</div>
                    <div className="text-5xl font-black mt-3">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {pageIndex === 0 ? (
              <>
                <div className="mt-8 rounded-[32px] border border-indigo-200 bg-white/90 shadow-sm p-8">
                  {renderExportSectionHeader("Today Update", "indigo")}
                  <div className="mt-5 text-[31px] leading-[1.42] font-bold text-slate-900 whitespace-pre-wrap min-h-[250px]">
                    {portraitUpdatePreview || "No manual update added yet."}
                  </div>
                </div>

                <div className="mt-6 rounded-[32px] border border-emerald-200 bg-white/90 shadow-sm p-8">
                  {renderExportSectionHeader("Day Plan", "emerald")}
                  <div className="mt-5 text-[29px] leading-[1.42] font-bold text-slate-900 whitespace-pre-wrap min-h-[240px]">
                    {portraitPlanPreview || "No next-day plan added yet."}
                  </div>
                </div>

                <div className="mt-6 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8 flex-1">
                  {renderExportSectionHeader("Detail Pages Include", "amber")}
                  <div className="mt-5 grid grid-cols-2 gap-4 text-xl font-bold text-slate-700">
                    <div>Added Today</div>
                    <div>Payment Done</div>
                    <div>Clients Met</div>
                    <div>Scheduled for Plan Date</div>
                    <div>Mediators Spoken Today</div>
                  </div>
                </div>
                {renderExportFooter(pageIndex + 1, portraitPageCount, "Summary")}
              </>
            ) : (
              <div className="mt-6 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8 flex-1 flex flex-col">
                {renderExportSectionHeader(
                  `${detailPage?.title || "Detail"} • ${detailPage?.totalCount || 0}`,
                  detailPage?.tone || "indigo"
                )}
                <div className="mt-5 flex items-center justify-between text-lg font-bold text-slate-500">
                  <div>{detailPage?.chunkCount > 1 ? `Part ${detailPage.chunkIndex + 1} of ${detailPage.chunkCount}` : "Single page section"}</div>
                  <div>{detailPage?.totalCount || 0} item{detailPage?.totalCount === 1 ? "" : "s"}</div>
                </div>
                <div className="mt-5 space-y-4 overflow-hidden">
                  {detailPage?.renderer(detailPage.rows)}
                </div>
                {renderExportFooter(pageIndex + 1, portraitPageCount, detailPage?.title || "Detail")}
              </div>
            )}
              </div>
            );
          })}

          {Array.from({ length: eodSquarePageCount }).map((_, pageIndex) => {
            const detailPage = pageIndex > 0 ? eodSquareDetailPages[pageIndex - 1] : null;
            return (
              <div
                key={`eod-square-export-page-${pageIndex}`}
                ref={(el) => {
                  eodSquareExportRefs.current[pageIndex] = el;
                }}
                className="w-[1080px] h-[1080px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#ecfeff_36%,#f8fafc_100%)] text-slate-900 p-12 flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-24 h-24 rounded-[28px] bg-slate-900 shadow-lg flex items-center justify-center">
                      <BrandMark size={52} className="opacity-95" />
                    </div>
                    <div>
                      <div className="text-[18px] tracking-[0.32em] uppercase font-extrabold text-slate-500">{BRAND.name}</div>
                      <div className="text-5xl font-black text-slate-950 mt-2">End of Day Update</div>
                      <div className="text-2xl font-semibold text-slate-600 mt-2">
                        {currentUser} • {todayYmd}{eodSquarePageCount > 1 ? ` • Page ${pageIndex + 1}/${eodSquarePageCount}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-[28px] border px-6 py-4 ${workloadStatus.tone}`}>
                    <div className="text-xs uppercase tracking-[0.3em] font-black opacity-80">EOD Status</div>
                    <div className="text-3xl font-black mt-2">{workloadStatus.label}</div>
                  </div>
                </div>
                {pageIndex === 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mt-7">
                      {eodSummaryMetrics.slice(0, 6).map((item) => (
                        <div key={`eod-sq-metric-${item.label}`} className={`rounded-[24px] border px-5 py-4 ${item.tone}`}>
                          <div className="text-xs uppercase tracking-[0.24em] font-black opacity-80">{item.label}</div>
                          <div className="text-4xl font-black mt-2">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-[28px] border border-slate-200 bg-white/90 shadow-sm p-5">
                      {renderExportSectionHeader("EOD Summary", "amber")}
                      <div className="mt-4 text-[20px] leading-[1.35] font-bold text-slate-900">
                        {addedToday.length} added • {paymentDoneToday.length} paid • {metToday.length} met • {rejectedToday.length} rejected • {addedStillOpenEod.length} still open at EOD
                      </div>
                      <div className="mt-4 text-sm font-semibold text-slate-600">
                        Detail pages include added today, payment done, clients met, rejected today, still open at EOD, and mediators spoken today.
                      </div>
                    </div>
                    {renderExportFooter(pageIndex + 1, eodSquarePageCount, "Summary")}
                  </>
                ) : (
                  <div className="mt-5 flex-1 min-h-0 flex flex-col">
                    <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm p-5 flex-1 min-h-0 overflow-hidden">
                      {renderExportSectionHeader(`${detailPage?.title || "Detail"} • ${detailPage?.totalCount || 0}`, detailPage?.tone || "indigo")}
                      <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-500">
                        <div>{detailPage?.chunkCount > 1 ? `Part ${detailPage.chunkIndex + 1} of ${detailPage.chunkCount}` : "Single page section"}</div>
                        <div>{detailPage?.totalCount || 0} item{detailPage?.totalCount === 1 ? "" : "s"}</div>
                      </div>
                      <div className="mt-4 space-y-3 overflow-hidden">{detailPage?.renderer(detailPage.rows)}</div>
                    </div>
                    {renderExportFooter(pageIndex + 1, eodSquarePageCount, detailPage?.title || "Detail")}
                  </div>
                )}
              </div>
            );
          })}

          {Array.from({ length: eodPortraitPageCount }).map((_, pageIndex) => {
            const detailPage = pageIndex > 0 ? eodPortraitDetailPages[pageIndex - 1] : null;
            return (
              <div
                key={`eod-portrait-export-page-${pageIndex}`}
                ref={(el) => {
                  eodPortraitExportRefs.current[pageIndex] = el;
                }}
                className="w-[1080px] h-[1920px] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#f0fdfa_38%,#ffffff_100%)] text-slate-900 p-16 flex flex-col"
              >
                <div className="flex items-center gap-5">
                  <div className="w-24 h-24 rounded-[28px] bg-slate-900 shadow-lg flex items-center justify-center">
                    <BrandMark size={52} className="opacity-95" />
                  </div>
                  <div>
                    <div className="text-[18px] tracking-[0.32em] uppercase font-extrabold text-slate-500">{BRAND.name}</div>
                    <div className="text-6xl font-black text-slate-950 mt-2">End of Day Update</div>
                    <div className="text-3xl font-semibold text-slate-600 mt-2">
                      {currentUser}{eodPortraitPageCount > 1 ? ` • Page ${pageIndex + 1}/${eodPortraitPageCount}` : ""}
                    </div>
                  </div>
                </div>
                {pageIndex === 0 ? (
                  <>
                    <div className="mt-8 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] font-black text-slate-500">Report Date</div>
                          <div className="text-4xl font-black text-slate-950 mt-2">{todayYmd}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] font-black text-emerald-500">EOD Status</div>
                          <div className={`text-4xl font-black mt-2 ${workloadStatus.accent}`}>{workloadStatus.label}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-7">
                        {eodSummaryMetrics.map((item) => (
                          <div key={`eod-pt-metric-${item.label}`} className={`rounded-[24px] border p-5 ${item.tone}`}>
                            <div className="text-sm uppercase tracking-[0.24em] font-black opacity-80">{item.label}</div>
                            <div className="text-5xl font-black mt-3">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8 flex-1">
                      {renderExportSectionHeader("Detail Pages Include", "amber")}
                      <div className="mt-5 grid grid-cols-2 gap-4 text-xl font-bold text-slate-700">
                        <div>Added Today</div>
                        <div>Payment Done</div>
                        <div>Clients Met</div>
                        <div>Rejected Today</div>
                        <div>Added but Open EOD</div>
                        <div>Mediators Spoken Today</div>
                      </div>
                    </div>
                    {renderExportFooter(pageIndex + 1, eodPortraitPageCount, "Summary")}
                  </>
                ) : (
                  <div className="mt-6 rounded-[32px] border border-slate-200 bg-white/90 shadow-sm p-8 flex-1 flex flex-col">
                    {renderExportSectionHeader(`${detailPage?.title || "Detail"} • ${detailPage?.totalCount || 0}`, detailPage?.tone || "indigo")}
                    <div className="mt-5 flex items-center justify-between text-lg font-bold text-slate-500">
                      <div>{detailPage?.chunkCount > 1 ? `Part ${detailPage.chunkIndex + 1} of ${detailPage.chunkCount}` : "Single page section"}</div>
                      <div>{detailPage?.totalCount || 0} item{detailPage?.totalCount === 1 ? "" : "s"}</div>
                    </div>
                    <div className="mt-5 space-y-4 overflow-hidden">{detailPage?.renderer(detailPage.rows)}</div>
                    {renderExportFooter(pageIndex + 1, eodPortraitPageCount, detailPage?.title || "Detail")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div ref={reportRef} className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 sm:p-6 print:shadow-none print:border-0 print:p-4">
          <ReportBrandHeader
            title="Daily Work Update + Day Plan"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{currentUser}</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">{groupTitleDraft.trim() || "Daily execution summary for group update"}</span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Plan Date (IST)</div>
                <div className="text-slate-900">{planDateYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Load Status</div>
                <div className={`inline-flex rounded-lg border px-2 py-1 text-xs font-extrabold ${workloadStatus.tone}`}>{workloadStatus.label}</div>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <div className="surface-solid p-3 border border-indigo-100 bg-indigo-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Mediators Spoken</div>
              <div className="text-xl font-extrabold text-indigo-700 mt-1">{mediatorTouches.length}</div>
            </div>
            <div className="surface-solid p-3 border border-cyan-100 bg-cyan-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Leads Worked</div>
              <div className="text-xl font-extrabold text-cyan-700 mt-1">{workRowsToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-violet-100 bg-violet-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Added Today</div>
              <div className="text-xl font-extrabold text-violet-700 mt-1">{addedToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-teal-100 bg-teal-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Met Today</div>
              <div className="text-xl font-extrabold text-teal-700 mt-1">{metToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-emerald-100 bg-emerald-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Payment Done</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">{paymentDoneToday.length}</div>
            </div>
            <div className="surface-solid p-3 border border-rose-100 bg-rose-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Rejected</div>
              <div className="text-xl font-extrabold text-rose-700 mt-1">{rejectedToday.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Update for Today</div>
                <div className="text-xs text-indigo-200 font-bold">{groupTitleDraft.trim() || "For daily group message"}</div>
              </div>
              <div className="p-3 bg-white space-y-2">
                <div data-export-ignore="true" className="print:hidden rounded-xl border border-indigo-100 bg-indigo-50/20 p-3 space-y-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">Header / Group Title</label>
                  <input
                    value={groupTitleDraft}
                    onChange={(e) => setGroupTitleDraft(e.target.value)}
                    className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-300 outline-none"
                    placeholder="Example: Daily Update to Partners Group"
                  />
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 block">Today work update</label>
                  <textarea
                    value={todayUpdateDraft}
                    onChange={(e) => setTodayUpdateDraft(e.target.value)}
                    className="w-full min-h-[120px] p-3 text-sm bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none"
                    placeholder="Example: Spoke to 3 mediators, handled 6 active leads, 1 client met, 1 payment completed, 2 follow-ups moved to tomorrow."
                  />
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Final update text</div>
                  <div className="mt-2 text-sm text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap">
                    {todayUpdateDraft.trim() || "No custom update added yet."}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-emerald-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Day Plan</div>
                <div className="text-xs text-emerald-200 font-bold">{planDateYmd}</div>
              </div>
              <div className="p-3 bg-white space-y-2">
                <div data-export-ignore="true" className="print:hidden rounded-xl border border-emerald-100 bg-emerald-50/20 p-3 space-y-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block">Plan for next day</label>
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">Plan date (IST)</label>
                    <input
                      type="date"
                      value={planDateYmd}
                      onChange={(e) => setPlanDateYmd(e.target.value || tomorrowYmd)}
                      className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none"
                    />
                  </div>
                  <textarea
                    value={tomorrowPlanDraft}
                    onChange={(e) => setTomorrowPlanDraft(e.target.value)}
                    className="w-full min-h-[120px] p-3 text-sm bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-300 outline-none"
                    placeholder="Example: Complete planned meetings, close pending statement follow-ups, and finish the leads scheduled for the selected plan date."
                  />
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">Plan text</div>
                  <div className="mt-2 text-sm text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap">
                    {tomorrowPlanDraft.trim() || "No next-day plan added yet."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-cyan-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Work Completed Today</div>
                <div className="text-xs text-cyan-200 font-bold">{workRowsToday.length} items</div>
              </div>
              <div className="p-3 bg-white space-y-2">
                {workRowsToday.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">No lead work captured today.</div>
                ) : (
                  workRowsToday.slice(0, 18).map((row) => (
                    <div key={`daily-work-${row.id}`} className="rounded-xl border border-cyan-100 p-3 bg-cyan-50/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{row.name}</div>
                          <div className="text-[11px] text-cyan-700 font-bold mt-0.5">Mediator: {row.mediatorName}</div>
                        </div>
                        <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase ${STATUS_CONFIG[row.status]?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-slate-700 font-semibold">{row.latestUpdate}</div>
                      <div className="mt-2 text-[11px] text-slate-500 font-semibold">
                        Last action: {row.lastActionAt ? formatDateTime(row.lastActionAt) : "—"}
                        {row.nextFollowUp ? ` • Next: ${formatDateTime(row.nextFollowUp)}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-amber-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Scheduled for Plan Date</div>
                <div className="text-xs text-amber-200 font-bold">{scheduledTomorrowRows.length} items</div>
              </div>
              <div className="p-3 bg-white space-y-2">
                {scheduledTomorrowRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">No leads scheduled for the selected plan date.</div>
                ) : (
                  scheduledTomorrowRows.slice(0, 12).map((row) => (
                    <div key={`scheduled-plan-${row.id}`} className="rounded-xl border border-amber-100 p-3 bg-amber-50/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{row.name}</div>
                          <div className="text-[11px] text-amber-700 font-bold mt-0.5">Mediator: {row.mediatorName}</div>
                        </div>
                        <span className="inline-flex px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border-amber-200">
                          Scheduled
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-slate-700 font-semibold">
                        Next action: {row.nextFollowUp ? formatDateTime(row.nextFollowUp) : "Not set"} • {row.status}
                      </div>
                      {row.status === "Meeting Scheduled" && (
                        <div className="mt-1 text-[11px] text-amber-700 font-extrabold">Meeting by: {row.meetingBy}</div>
                      )}
                      <div className="mt-1 text-[11px] text-slate-500 font-semibold">
                        Last activity: {row.lastActionAt ? formatDateTime(row.lastActionAt) : "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const MidDayUpdateView = ({ mediator, leads, onBack }) => {
  const todayYmd = toYmdIST(new Date());
  const now = new Date();
  const closedStatuses = new Set([
    "Payment Done",
    "Deal Closed",
    "Not Eligible",
    "Not Reliable",
    "Lost to Competitor",
    "Not Interested",
    "Not Interested (Temp)",
  ]);
  const rejectedStatuses = new Set(["Not Eligible", "Not Reliable", "Lost to Competitor"]);

  const mediatorLeads = useMemo(() => (leads || []).filter((l) => l && l.mediatorId === mediator.id), [leads, mediator.id]);

  const activeLeads = useMemo(() => {
    return mediatorLeads
      .filter((l) => {
        const actionable = new Set([
          "Meeting Scheduled",
          "Follow-Up Required",
          "Partner Follow-Up",
          "Interest Rate Issue",
          "No Appointment",
          "Statements Not Received",
          "Contact Details Not Received",
          "Payment Done",
          "Not Eligible",
          "Lost to Competitor",
        ]);
        const lastNoteTs = l.notes?.length ? l.notes[l.notes.length - 1]?.date : null;
        const updatedToday = lastNoteTs ? isOnYmdIST(lastNoteTs, todayYmd) : isOnYmdIST(l.createdAt, todayYmd);
        return actionable.has(l.status) || updatedToday;
      })
      .sort((a, b) => {
        const priority = {
          "Meeting Scheduled": 1,
          "Payment Done": 2,
          "Follow-Up Required": 3,
          "Partner Follow-Up": 4,
          "Interest Rate Issue": 5,
          "Statements Not Received": 6,
          "Contact Details Not Received": 7,
          "No Appointment": 8,
          "Not Eligible": 20,
          "Lost to Competitor": 21,
        };
        return (priority[a.status] || 99) - (priority[b.status] || 99);
      });
  }, [mediatorLeads, todayYmd]);

  const getLastNote = (lead) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    return notes.length ? notes[notes.length - 1] : null;
  };

  const getLatestNoteMatching = (lead, pattern) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const t = String(notes[i]?.text || "");
      if (pattern.test(t)) return notes[i];
    }
    return null;
  };

  const getClosedAt = (lead) => {
    if (!lead) return null;
    if (lead.status === "Payment Done" || lead.status === "Deal Closed") {
      if (lead?.loanDetails?.paymentDate) return lead.loanDetails.paymentDate;
      const paymentNote = getLatestNoteMatching(lead, /PAYMENT DONE|PAYMENT|DEAL CLOSED|CLOSED/i);
      return paymentNote?.date || null;
    }
    if (rejectedStatuses.has(lead.status)) {
      const rejectionNote = getLatestNoteMatching(lead, /\[REJECTION\]|\[REJECTION REASON\]|NOT ELIGIBLE|NOT RELIABLE|LOST TO COMPETITOR/i);
      return rejectionNote?.date || null;
    }
    return null;
  };

  const isLeadTouchedToday = (lead) => {
    if (!lead) return false;
    if (isOnYmdIST(lead.createdAt, todayYmd)) return true;
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    return notes.some((n) => isOnYmdIST(n?.date, todayYmd));
  };

  const lifecycleToday = useMemo(() => {
    return mediatorLeads
      .filter((l) => isLeadTouchedToday(l))
      .map((l) => {
        const lastNote = getLastNote(l);
        const closedAt = getClosedAt(l);
        const actionTag = parseBriefingLedgerNote(lastNote?.text || "").tag;
        return {
          ...l,
          entryAt: l.createdAt || null,
          lastActionAt: lastNote?.date || l.createdAt || null,
          closedAt,
          actionTag,
        };
      })
      .sort((a, b) => new Date(b.lastActionAt || b.createdAt || 0) - new Date(a.lastActionAt || a.createdAt || 0));
  }, [mediatorLeads, todayYmd]);

  const paymentDoneToday = useMemo(() => {
    return mediatorLeads.filter((l) => {
      if (!(l.status === "Payment Done" || l.status === "Deal Closed")) return false;
      const closedAt = getClosedAt(l);
      return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
    });
  }, [mediatorLeads, todayYmd]);

  const rejectedToday = useMemo(() => {
    return mediatorLeads.filter((l) => {
      if (!rejectedStatuses.has(l.status)) return false;
      const closedAt = getClosedAt(l);
      return closedAt ? isOnYmdIST(closedAt, todayYmd) : false;
    });
  }, [mediatorLeads, todayYmd]);

  const metToday = useMemo(() => {
    return mediatorLeads.filter((l) => {
      const notes = Array.isArray(l.notes) ? l.notes : [];
      return notes.some((n) => isOnYmdIST(n?.date, todayYmd) && isMeetingDoneNoteText(n?.text));
    });
  }, [mediatorLeads, todayYmd]);

  const leadsAddedToday = useMemo(() => mediatorLeads.filter((l) => isOnYmdIST(l.createdAt, todayYmd)), [mediatorLeads, todayYmd]);

  const openEodFromAddedToday = useMemo(() => leadsAddedToday.filter((l) => !closedStatuses.has(l.status)), [leadsAddedToday]);

  const callLogToday = useMemo(() => {
    const history = (Array.isArray(mediator?.followUpHistory) ? mediator.followUpHistory : [])
      .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
      .filter((h) => h && typeof h === "object");
    return history
      .filter((h) => {
        const ts = h.ts || h.endedAt || h.date;
        return ts ? isOnYmdIST(ts, todayYmd) : false;
      })
      .sort((a, b) => new Date(b.ts || b.endedAt || b.date || 0) - new Date(a.ts || a.endedAt || a.date || 0));
  }, [mediator, todayYmd]);

  const metrics = useMemo(() => {
    const meetings = activeLeads.filter((l) => l.status === "Meeting Scheduled").length;
    const overdueMeetings = activeLeads.filter((l) => l.status === "Meeting Scheduled" && l.nextFollowUp && new Date(l.nextFollowUp) < now).length;
    const payments = activeLeads.filter((l) => l.status === "Payment Done" && l.loanDetails?.paymentDate && isOnYmdIST(l.loanDetails.paymentDate, todayYmd)).length;
    const issues = activeLeads.filter((l) => ["Interest Rate Issue", "Statements Not Received", "Contact Details Not Received"].includes(l.status)).length;
    const followups = activeLeads.filter((l) => ["Follow-Up Required", "Partner Follow-Up", "No Appointment"].includes(l.status)).length;
    const value = activeLeads.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0);
    return {
      meetings,
      overdueMeetings,
      payments,
      issues,
      followups,
      value,
      dealtToday: lifecycleToday.length,
      callsToday: callLogToday.length,
      addedToday: leadsAddedToday.length,
      closedToday: paymentDoneToday.length + rejectedToday.length,
      openEodFromAddedToday: openEodFromAddedToday.length,
      metToday: metToday.length,
      rejectedToday: rejectedToday.length,
    };
  }, [activeLeads, now, todayYmd, lifecycleToday.length, callLogToday.length, leadsAddedToday.length, paymentDoneToday.length, rejectedToday.length, openEodFromAddedToday.length, metToday.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Partner_Daily_Brief_${mediator.name}_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 print:p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-7 print:shadow-none print:border-0">
          <ReportBrandHeader
            title="Partner Daily Briefing"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{mediator.name}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                  <Phone size={14} /> {mediator.phone || "—"}
                </span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Active Items</div>
                <div className="text-slate-900">{activeLeads.length}</div>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Pipeline Value</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{formatCompactCurrency(metrics.value)}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Meetings</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{metrics.meetings}</div>
              {metrics.overdueMeetings > 0 && <div className="text-[10px] text-rose-700 font-bold mt-1">Overdue: {metrics.overdueMeetings}</div>}
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Follow-ups</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{metrics.followups}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Issues</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">{metrics.issues}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Payments Today</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{metrics.payments}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
            <div className="surface-solid p-3 border border-indigo-100 bg-indigo-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Calls with Mediator</div>
              <div className="text-xl font-extrabold text-indigo-700 mt-1">{metrics.callsToday}</div>
            </div>
            <div className="surface-solid p-3 border border-cyan-100 bg-cyan-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Leads Dealt</div>
              <div className="text-xl font-extrabold text-cyan-700 mt-1">{metrics.dealtToday}</div>
            </div>
            <div className="surface-solid p-3 border border-violet-100 bg-violet-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Leads Added</div>
              <div className="text-xl font-extrabold text-violet-700 mt-1">{metrics.addedToday}</div>
            </div>
            <div className="surface-solid p-3 border border-teal-100 bg-teal-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Met Today</div>
              <div className="text-xl font-extrabold text-teal-700 mt-1">{metrics.metToday}</div>
            </div>
            <div className="surface-solid p-3 border border-emerald-100 bg-emerald-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Payment Done</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">{metrics.payments}</div>
            </div>
            <div className="surface-solid p-3 border border-rose-100 bg-rose-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Rejected</div>
              <div className="text-xl font-extrabold text-rose-700 mt-1">{metrics.rejectedToday}</div>
            </div>
            <div className="surface-solid p-3 border border-amber-100 bg-amber-50/50">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Added but Open (EOD)</div>
              <div className="text-xl font-extrabold text-amber-700 mt-1">{metrics.openEodFromAddedToday}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Mediator Call Log (Today)</div>
                <div className="text-xs text-indigo-200 font-bold">{callLogToday.length} calls/logs</div>
              </div>
              <div className="p-3 bg-white">
                {callLogToday.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 italic">No mediator calls/logs captured today.</div>
                ) : (
                  <div className="space-y-2">
                    {callLogToday.map((h, idx) => {
                      const at = h.endedAt || h.ts || `${h.date}T${h.time || "00:00"}`;
                      return (
                        <div key={`${h.ts || h.endedAt || h.date}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{String(h.type || "call").replace(/_/g, " ")}</div>
                            <div className="text-xs text-slate-500 font-bold">{formatDateTime(at)}</div>
                          </div>
                          <div className="text-xs text-slate-700 mt-1 leading-relaxed">
                            Outcome: <span className="font-bold">{String(h.outcome || "logged").replace(/_/g, " ")}</span>
                            {h.notes ? <span> • Note: <span className="font-bold">{String(h.notes)}</span></span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-violet-900 text-white flex items-center justify-between">
                <div className="font-extrabold text-sm">Lead Lifecycle (Today)</div>
                <div className="text-xs text-violet-200 font-bold">{lifecycleToday.length} leads touched</div>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold">
                    <tr>
                      <th className="px-3 py-2 text-left">Lead</th>
                      <th className="px-3 py-2 text-left">Entry</th>
                      <th className="px-3 py-2 text-left">Last Action</th>
                      <th className="px-3 py-2 text-left">Close Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lifecycleToday.slice(0, 12).map((l) => (
                      <tr key={`lc-${l.id}`}>
                        <td className="px-3 py-2 align-top">
                          <div className="font-bold text-slate-800">{l.name}</div>
                          <div className="text-[10px] text-slate-500">{l.status}</div>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">{l.entryAt ? formatDateTime(l.entryAt) : "—"}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{l.lastActionAt ? formatDateTime(l.lastActionAt) : "—"}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{l.closedAt ? formatDateTime(l.closedAt) : "Open"}</td>
                      </tr>
                    ))}
                    {lifecycleToday.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-slate-500 italic text-center">
                          No lead lifecycle movement captured today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border border-emerald-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-100 text-emerald-800 font-extrabold text-sm">Payment Done Today</div>
              <div className="p-3 bg-white space-y-2">
                {paymentDoneToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No payment closures today.</div>
                ) : (
                  paymentDoneToday.map((l) => (
                    <div key={`pay-${l.id}`} className="rounded-lg border border-emerald-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">Closed: {formatDateTime(getClosedAt(l) || l.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-rose-100 text-rose-800 font-extrabold text-sm">Rejected Today</div>
              <div className="p-3 bg-white space-y-2">
                {rejectedToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No rejection updates today.</div>
                ) : (
                  rejectedToday.map((l) => (
                    <div key={`rej-${l.id}`} className="rounded-lg border border-rose-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">{l.status} • {formatDateTime(getClosedAt(l) || l.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-teal-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-teal-100 text-teal-800 font-extrabold text-sm">Clients Met Today</div>
              <div className="p-3 bg-white space-y-2">
                {metToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No meeting/visit logs captured today.</div>
                ) : (
                  metToday.map((l) => {
                    const notes = Array.isArray(l.notes) ? l.notes : [];
                    const note =
                      [...notes].reverse().find((n) => isOnYmdIST(n?.date, todayYmd) && isMeetingDoneNoteText(n?.text)) ||
                      notes[notes.length - 1];
                    return (
                      <div key={`met-${l.id}`} className="rounded-lg border border-teal-100 p-2">
                        <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                        <div className="text-xs text-slate-600 font-bold mt-1">{note?.date ? formatDateTime(note.date) : "Today"} • {l.status}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-100 text-amber-800 font-extrabold text-sm">Added Today but Open (EOD)</div>
              <div className="p-3 bg-white space-y-2">
                {openEodFromAddedToday.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No leads added today are pending open at EOD.</div>
                ) : (
                  openEodFromAddedToday.map((l) => (
                    <div key={`eod-${l.id}`} className="rounded-lg border border-amber-100 p-2">
                      <div className="text-sm font-extrabold text-slate-900">{l.name}</div>
                      <div className="text-xs text-slate-600 font-bold mt-1">Entry: {formatDateTime(l.createdAt)} • Status: {l.status}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="font-extrabold text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-600" /> Briefing Ledger
              </div>
              <div className="text-[11px] text-slate-500 font-bold">Sorted by priority • Latest note shown</div>
            </div>

            <div className="overflow-x-auto print:hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Next Action</th>
                    <th className="p-4">Last Update</th>
                    <th className="p-4">Latest Note</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLeads.map((l) => {
                    const lastNote = l.notes?.length ? l.notes[l.notes.length - 1] : null;
                    const lastUpdate = lastNote?.date || l.createdAt;
                    const nextAction = l.nextFollowUp ? formatDateTime(l.nextFollowUp) : "—";
                    return (
                      <tr key={l.id} className="hover:bg-slate-50 print:break-inside-avoid">
                        <td className="p-4 align-top">
                          <div className="font-extrabold text-slate-900">{l.name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            {l.company ? (
                              <span className="inline-flex items-center gap-1">
                                <Briefcase size={12} /> {l.company}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            {l.location ? (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} /> {l.location}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <span className={`chip border ${STATUS_CONFIG[l.status]?.color?.replace("text", "text").replace("bg", "bg")}`}>{l.status}</span>
                        </td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold">{nextAction}</td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold">{lastUpdate ? formatDateTime(lastUpdate) : "—"}</td>
                        <td className="p-4 align-top text-xs text-slate-700 max-w-[420px]">
                          <BriefingLedgerNotePreview note={lastNote} />
                        </td>
                        <td className="p-4 align-top text-right font-mono font-extrabold text-slate-800">{formatCurrency(l.loanAmount)}</td>
                      </tr>
                    );
                  })}
                  {activeLeads.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 italic">
                        No active items for this partner today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hidden print:block p-4 space-y-3 bg-white">
              {activeLeads.map((l) => {
                const lastNote = l.notes?.length ? l.notes[l.notes.length - 1] : null;
                const lastUpdate = lastNote?.date || l.createdAt;
                const nextAction = l.nextFollowUp ? formatDateTime(l.nextFollowUp) : "—";
                return (
                  <div key={`print-${l.id}`} className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-base leading-tight">{l.name}</div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          {l.company ? (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase size={11} /> {l.company}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                          {l.location ? (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} /> {l.location}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-extrabold text-slate-900">{formatCurrency(l.loanAmount)}</div>
                        <div className="mt-1">
                          <span className={`chip border ${STATUS_CONFIG[l.status]?.color?.replace("text", "text").replace("bg", "bg")}`}>{l.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">Next Action</div>
                        <div className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">{nextAction}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">Last Update</div>
                        <div className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">{lastUpdate ? formatDateTime(lastUpdate) : "—"}</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-extrabold mb-1">Latest Note</div>
                      <BriefingLedgerNotePreview note={lastNote} />
                    </div>
                  </div>
                );
              })}
              {activeLeads.length === 0 && (
                <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-500 italic">
                  No active items for this partner today.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const MediatorPendingReportViewLegacy = ({ mediator, leads, onBack, onUpdateLead }) => {
  const [updates, setUpdates] = useState({});
  const pendingLeads = leads
    .filter((l) => l.mediatorId === mediator.id && !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status))
    .sort((a, b) => {
      const partnerActionStatuses = ["Partner Follow-Up", "Statements Not Received", "Contact Details Not Received", "Interest Rate Issue"];
      const aIsPartner = partnerActionStatuses.includes(a.status);
      const bIsPartner = partnerActionStatuses.includes(b.status);
      if (aIsPartner && !bIsPartner) return -1;
      if (!aIsPartner && bIsPartner) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  const handleSaveUpdate = (leadId) => {
    const text = updates[leadId];
    if (!text) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    onUpdateLead(leadId, {
      notes: [...(lead.notes || []), { text: `[Action Required]: ${text}`, date: new Date().toISOString() }],
    });
    setUpdates((prev) => ({ ...prev, [leadId]: "" }));
  };

  const metrics = {
    volume: pendingLeads.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0),
    count: pendingLeads.length,
    critical: pendingLeads.filter((l) => Math.abs(getDaysDiff(l.createdAt)) > 15).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8 flex flex-col items-center">
      <div className="print:hidden w-full max-w-6xl flex justify-between mb-8 sticky top-4 z-20">
        <button onClick={onBack} className="flex items-center gap-2 font-bold text-sm text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-lg shadow-sm">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Audit_Report_${mediator.name}`;
            window.print();
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
        >
          <Printer size={16} /> Print Audit Report
        </button>
      </div>

      <div className="bg-white w-full max-w-6xl min-h-[297mm] shadow-2xl rounded-xl overflow-hidden print:shadow-none print:w-full print:m-0">
        <div className="p-10 border-b-4 border-slate-900 bg-slate-900 text-white flex justify-between items-end">
          <div>
            <div className="text-yellow-400 font-bold uppercase tracking-[0.2em] text-xs mb-2">Leakage Prevention & Pipeline Audit</div>
            <h1 className="text-4xl font-extrabold tracking-tight">Partner Action Report</h1>
            <div className="flex items-center gap-4 mt-3 text-slate-300 font-medium">
              <span className="flex items-center gap-2">
                <Users size={16} /> {mediator.name}
              </span>
              <span className="flex items-center gap-2">
                <Phone size={16} /> {mediator.phone}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-white">{metrics.count}</div>
            <div className="text-xs uppercase font-bold text-slate-400 tracking-widest mt-1">Pending Cases</div>
          </div>
        </div>

        <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200">
          <div className="p-6 border-r border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Pipeline Value</div>
            <div className="text-2xl font-bold text-slate-800">{formatCurrency(metrics.volume)}</div>
          </div>
          <div className="p-6 border-r border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Stagnant (&gt;15 Days)</div>
            <div className="text-2xl font-bold text-red-600">{metrics.critical}</div>
            <p className="text-[10px] text-red-400 mt-1">Immediate action required</p>
          </div>
          <div className="p-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Date</div>
            <div className="text-lg font-bold text-slate-800">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        <div className="p-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-4 pl-2 w-[25%]">Client Profile</th>
                <th className="pb-4 w-[15%]">Status</th>
                <th className="pb-4 w-[40%]">Financier&apos;s Instruction / Query</th>
                <th className="pb-4 w-[5%] text-center">Age</th>
                <th className="pb-4 w-[15%] text-right print:block hidden">Partner Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingLeads.map((l) => {
                const lastNote =
                  [...(l.notes || [])].reverse().find((n) => n.text.includes("[Action Required]") || n.text.includes("[Carry Forward]")) ||
                  (l.notes || [])[l.notes?.length - 1];
                const isPartnerAction = ["Partner Follow-Up", "Statements Not Received", "Contact Details Not Received", "Interest Rate Issue"].includes(l.status);

                return (
                  <tr key={l.id} className="group hover:bg-slate-50 transition-colors page-break-inside-avoid">
                    <td className="py-5 pl-2 align-top">
                      <div className="font-bold text-slate-900 text-lg">{l.name}</div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                        <Briefcase size={12} /> {l.company}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin size={12} /> {l.location || "N/A"}
                      </div>
                      <div className="mt-2 inline-block bg-slate-100 text-slate-600 text-xs font-mono font-bold px-2 py-1 rounded border border-slate-200">
                        Req: {formatCurrency(l.loanAmount)}
                      </div>
                    </td>
                    <td className="py-5 align-top">
                      <span
                        className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          STATUS_CONFIG[l.status]?.color?.replace("text", "border") || "border-slate-200 text-slate-500"
                        }`}
                      >
                        {l.status}
                      </span>
                      {isPartnerAction && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                          <AlertCircle size={10} /> Action Pending
                        </div>
                      )}
                    </td>
                    <td className="py-5 align-top">
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg shadow-sm">
                        <div className="text-[10px] font-bold text-yellow-800 uppercase mb-1 flex items-center gap-1">
                          <MessageCircle size={12} /> Financier&apos;s Update
                        </div>
                        <div className="text-sm text-slate-800 font-medium leading-relaxed">
                          {lastNote ? lastNote.text.replace(/\[.*?\]:?/, "").trim() : "Please provide status update."}
                        </div>
                        <div className="mt-2 text-[10px] text-slate-400 font-mono text-right border-t border-yellow-100 pt-1">
                          Sent: {lastNote ? formatDateTime(lastNote.date) : ""}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2 print:hidden opacity-60 group-hover:opacity-100 transition-opacity">
                        <input
                          className="flex-1 text-xs border border-slate-300 rounded px-2 py-2 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          placeholder="Type new instruction for partner..."
                          value={updates[l.id] || ""}
                          onChange={(e) => setUpdates((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveUpdate(l.id)}
                        />
                        <button onClick={() => handleSaveUpdate(l.id)} className="bg-slate-900 text-white text-xs px-3 py-1 rounded font-bold hover:bg-black shadow-sm">
                          Update
                        </button>
                      </div>
                    </td>
                    <td className="py-5 align-top text-center">
                      <div className="text-xl font-bold text-slate-700">{Math.abs(getDaysDiff(l.createdAt))}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Days</div>
                    </td>
                    <td className="py-5 align-top text-right print:block hidden">
                      <div className="h-full border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-2 min-h-[80px] min-w-[120px]">
                        <span className="text-[10px] text-slate-300 font-bold uppercase text-center mb-1">
                          Partner
                          <br />
                          Remarks
                        </span>
                        <div className="w-full h-px bg-slate-100 mt-4"></div>
                        <div className="w-full h-px bg-slate-100 mt-2"></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingLeads.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 italic">
                    No pending cases.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MediatorPendingReportView = ({ mediator, leads, onBack }) => {
  const todayYmd = toYmdIST(new Date());
  const partnerActionStatuses = ["Partner Follow-Up", "Statements Not Received", "Contact Details Not Received", "Interest Rate Issue"];

  const pendingLeads = useMemo(() => {
    return (leads || [])
      .filter((l) => l && l.mediatorId === mediator.id && !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [leads, mediator.id]);

  const getAgeDays = (lead) => Math.abs(getDaysDiff(lead.createdAt));

  const getLastInstruction = (lead) => {
    const notes = Array.isArray(lead?.notes) ? lead.notes : [];
    const last =
      [...notes].reverse().find((n) => String(n?.text || "").includes("[Action Required]") || String(n?.text || "").includes("[Carry Forward]")) ||
      notes[notes.length - 1];
    if (!last?.text) return { text: "No instruction logged yet.", ts: "" };
    const text = String(last.text).replace(/^\s*\[[^\]]+\]\s*:?/i, "").trim();
    return { text: text || String(last.text), ts: last.date || "" };
  };

  const getSlaMeta = (lead) => {
    const age = getAgeDays(lead);
    const isPartnerBlocked = partnerActionStatuses.includes(lead.status);
    if (isPartnerBlocked || age >= 14) {
      return {
        band: "Critical",
        badge: "bg-rose-100 text-rose-700 border-rose-200",
        row: "bg-rose-50/60",
        line: "border-l-4 border-rose-500",
        score: Math.min(100, 65 + age * 2),
      };
    }
    if (age >= 7) {
      return {
        band: "Attention",
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        row: "bg-amber-50/50",
        line: "border-l-4 border-amber-500",
        score: Math.min(100, 40 + age * 2),
      };
    }
    return {
      band: "On Track",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      row: "bg-emerald-50/40",
      line: "border-l-4 border-emerald-500",
      score: Math.min(100, 20 + age * 2),
    };
  };

  const metrics = useMemo(() => {
    const exposure = pendingLeads.reduce((sum, lead) => sum + (Number(lead.loanAmount) || 0), 0);
    const avgAge = pendingLeads.length ? Math.round(pendingLeads.reduce((sum, lead) => sum + getAgeDays(lead), 0) / pendingLeads.length) : 0;
    let critical = 0;
    let attention = 0;
    let onTrack = 0;
    pendingLeads.forEach((lead) => {
      const band = getSlaMeta(lead).band;
      if (band === "Critical") critical += 1;
      else if (band === "Attention") attention += 1;
      else onTrack += 1;
    });
    const partnerBlocked = pendingLeads.filter((lead) => partnerActionStatuses.includes(lead.status)).length;
    return { exposure, avgAge, total: pendingLeads.length, critical, attention, onTrack, partnerBlocked };
  }, [pendingLeads]);

  const groupedBySla = useMemo(() => {
    const groups = { Critical: [], Attention: [], "On Track": [] };
    pendingLeads.forEach((lead) => {
      const band = getSlaMeta(lead).band;
      groups[band].push(lead);
    });
    Object.values(groups).forEach((list) => list.sort((a, b) => getAgeDays(b) - getAgeDays(a)));
    return groups;
  }, [pendingLeads]);

  const slaSections = [
    { key: "Critical", title: "Critical Leads", subtitle: "Immediate closure required", box: "border-rose-200", head: "bg-rose-100 text-rose-800", empty: "No critical leads." },
    { key: "Attention", title: "Attention Leads", subtitle: "Needs follow-up this week", box: "border-amber-200", head: "bg-amber-100 text-amber-800", empty: "No attention leads." },
    { key: "On Track", title: "On Track Leads", subtitle: "Within acceptable SLA", box: "border-emerald-200", head: "bg-emerald-100 text-emerald-800", empty: "No on-track leads." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/50 to-slate-100 text-slate-900">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Partner_Action_Dossier_${mediator.name}_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 print:p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 print:shadow-none print:border-0 print:rounded-none">
          <ReportBrandHeader
            title="Partner Pending Action Matrix"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{mediator.name}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                  <Phone size={14} /> {mediator.phone || "—"}
                </span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Open Pending Leads</div>
                <div className="text-slate-900 font-extrabold">{metrics.total}</div>
              </div>
            }
          />

          <div className="rounded-2xl border border-slate-900 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white p-5 mb-5">
            <div className="text-[10px] uppercase tracking-[0.24em] font-extrabold text-slate-300">Executive Snapshot</div>
            <div className="mt-2 text-sm md:text-base font-semibold leading-relaxed">
              {metrics.critical > 0 ? `${metrics.critical} lead(s) are in critical SLA breach.` : "No critical SLA breach right now."}{" "}
              {metrics.partnerBlocked > 0
                ? `${metrics.partnerBlocked} lead(s) need partner-side confirmation to proceed.`
                : "No direct partner blocker in current queue."}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
            <div className="col-span-2 md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Queue Exposure</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{formatCompactCurrency(metrics.exposure)}</div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Avg Pending</div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1">{metrics.avgAge}d</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Critical</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">{metrics.critical}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Attention</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">{metrics.attention}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">On Track</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{metrics.onTrack}</div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold tracking-wide">Action Tracker Grid</div>
                <div className="text-xs text-indigo-200">Clear SLA-based view with latest update, pending age, and next follow-up.</div>
              </div>
              <div className="text-xs text-slate-300 font-bold">Sorted by highest pending days first</div>
            </div>

            <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-800">Critical SLA</span>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Attention</span>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">On Track</span>
              </div>
            </div>

            {pendingLeads.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 italic bg-white">No open pending leads for this partner.</div>
            ) : (
              <div className="space-y-4 p-4 bg-white">
                {slaSections.map((sec) => {
                  const items = groupedBySla[sec.key] || [];
                  return (
                    <div key={sec.key} className={`rounded-xl border overflow-hidden ${sec.box}`}>
                      <div className={`px-4 py-2.5 flex items-center justify-between ${sec.head}`}>
                        <div className="font-extrabold text-sm">{sec.title}</div>
                        <div className="text-xs font-bold">{items.length} lead(s) • {sec.subtitle}</div>
                      </div>
                      {items.length === 0 ? (
                        <div className="px-4 py-3 text-xs italic text-slate-500 bg-white">{sec.empty}</div>
                      ) : (
                        <>
                          <div className="overflow-x-auto print:hidden bg-white">
                            <table className="w-full min-w-[820px] text-left">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-extrabold text-slate-500">Client</th>
                                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-extrabold text-slate-500">Pending</th>
                                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-extrabold text-slate-500">Latest Note</th>
                                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-extrabold text-slate-500">Next Follow-up</th>
                                  <th className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-extrabold text-slate-500 text-right">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((lead) => {
                                  const ageDays = getAgeDays(lead);
                                  const instruction = getLastInstruction(lead);
                                  const nextFollowUp = lead.nextFollowUp ? formatDateTime(lead.nextFollowUp) : "Not set";
                                  return (
                                    <tr key={lead.id} className="border-b border-slate-100 align-top">
                                      <td className="px-4 py-4">
                                        <div className="font-extrabold text-slate-900 text-[15px]">{lead.name}</div>
                                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                                          {lead.company ? <span className="inline-flex items-center gap-1"><Briefcase size={12} /> {lead.company}</span> : null}
                                          {lead.location ? <span className="inline-flex items-center gap-1"><MapPin size={12} /> {lead.location}</span> : null}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="text-2xl font-extrabold text-slate-900 leading-none">{ageDays}</div>
                                        <div className="text-[11px] text-slate-500 font-bold mt-1">days open</div>
                                        <div className="text-[11px] text-slate-400 mt-2">Since {formatDate(lead.createdAt)}</div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="mb-2">
                                          <span className={`text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase border ${STATUS_CONFIG[lead.status]?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                            {lead.status}
                                          </span>
                                        </div>
                                        <div className="text-[12px] font-bold text-slate-700 leading-relaxed max-w-[260px] break-words">{instruction.text}</div>
                                        <div className="text-[10px] text-slate-400 font-bold mt-2">{instruction.ts ? formatDateTime(instruction.ts) : "—"}</div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="text-[13px] font-extrabold text-slate-900">{nextFollowUp}</div>
                                      </td>
                                      <td className="px-4 py-4 text-right">
                                        <div className="font-mono text-[16px] font-extrabold text-slate-900">{formatCurrency(lead.loanAmount)}</div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="hidden print:block p-3 space-y-2 bg-white">
                            {items.map((lead) => {
                              const ageDays = getAgeDays(lead);
                              const instruction = getLastInstruction(lead);
                              const nextFollowUp = lead.nextFollowUp ? formatDateTime(lead.nextFollowUp) : "Not set";
                              const sla = getSlaMeta(lead);
                              return (
                                <article key={`print-${sec.key}-${lead.id}`} className={`rounded-xl border border-slate-200 p-3 bg-white ${sla.line} print:break-inside-avoid`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-[15px] font-extrabold text-slate-900 leading-tight">{lead.name}</div>
                                      <div className="text-[11px] text-slate-500 mt-1 break-words">{lead.company || "Company not set"} {lead.location ? `• ${lead.location}` : ""}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="font-mono text-[14px] font-extrabold text-slate-900">{formatCurrency(lead.loanAmount)}</div>
                                      <div className="text-[10px] font-bold text-slate-500 mt-1">Pending {ageDays} days</div>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sla.badge}`}>{sla.band}</span>
                                    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_CONFIG[lead.status]?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                      {lead.status}
                                    </span>
                                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-700">
                                      Next {nextFollowUp}
                                    </span>
                                  </div>
                                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-1">Latest Note</div>
                                    <div className="text-[11px] text-slate-800 font-bold leading-relaxed break-words">{instruction.text}</div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const MediatorRejectionReportViewLegacy = ({ mediator, leads, onBack }) => {
  const rejectedLeads = leads
    .filter((l) => l.mediatorId === mediator.id && ["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="p-12 bg-white min-h-screen text-slate-900 font-sans">
      <div className="print:hidden flex justify-between mb-8 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
        <button onClick={onBack} className="flex items-center gap-2 font-bold text-sm">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Rejection_Report_${mediator.name}`;
            window.print();
          }}
          className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
        >
          <Printer size={16} /> Print Report
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900 text-white p-8 border-l-8 border-red-600 flex justify-between items-start mb-10 no-break">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Submission Quality Report</h1>
            <p className="text-slate-400 text-sm uppercase tracking-widest font-bold">{BRAND.name} | Partner Report</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">{mediator.name}</h2>
            <p className="text-slate-400 text-sm">Partner ID: {mediator.id}</p>
            <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10 no-break">
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Total Rejected</div>
            <div className="text-4xl font-bold text-red-600">{rejectedLeads.length}</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Common Reason</div>
            <div className="text-lg font-bold text-slate-800">Policy Criteria</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Review Date</div>
            <div className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="no-break">
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4 border-b border-slate-200">Applicant Details</th>
                  <th className="p-4 border-b border-slate-200">Date Submitted</th>
                  <th className="p-4 border-b border-slate-200 w-1/2">Strategic Analysis & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rejectedLeads.map((l) => {
                  const rejectionData = l.rejectionDetails || {};
                  const rejectReason =
                    rejectionData.reason
                      ? `${rejectionData.strategy}: ${rejectionData.reason}`
                      : (l.notes || [])
                          .slice()
                          .reverse()
                          .find((n) => n.text.includes("[REJECTION REASON]"))
                          ?.text.replace("[REJECTION REASON]:", "")
                          .trim() || "Does not meet criteria.";
                  return (
                    <tr key={l.id} className="hover:bg-red-50/10">
                      <td className="p-4 align-top">
                        <div className="font-bold text-slate-800 text-base">{l.name}</div>
                        <div className="text-slate-500">{l.company}</div>
                        <div className="text-xs text-slate-400 mt-1">{l.location}</div>
                      </td>
                      <td className="p-4 align-top font-mono text-slate-600">{formatDate(l.createdAt)}</td>
                      <td className="p-4 align-top">
                        <div
                          className={`p-3 rounded-r text-sm border-l-4 ${
                            rejectionData.strategy === "Competitor" ? "bg-orange-50 border-orange-500 text-orange-900" : "bg-red-50 border-red-500 text-red-900"
                          }`}
                        >
                          <div className="font-bold mb-1">{rejectionData.strategy ? rejectionData.strategy.toUpperCase() : "DECLINED"}</div>
                          <div>{rejectReason}</div>
                          {rejectionData.competitor && <div className="mt-2 text-xs font-bold text-slate-600">Won by: {rejectionData.competitor}</div>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rejectedLeads.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-slate-400 italic">
                      No rejected leads for this partner.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const MediatorRejectionReportView = ({ mediator, leads, onBack }) => {
  const todayYmd = toYmdIST(new Date());
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const allLeadsForMediator = useMemo(() => (leads || []).filter((l) => l && l.mediatorId === mediator.id), [leads, mediator.id]);
  const rejectedLeads = useMemo(
    () =>
      allLeadsForMediator
        .filter((l) => ["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [allLeadsForMediator]
  );

  const analytics = useMemo(() => {
    const byStrategy = new Map();
    const byReason = new Map();
    let competitorLost = 0;
    let policyRejected = 0;

    const getReason = (l) => {
      const r = l?.rejectionDetails || {};
      if (r?.reason) return String(r.reason);
      const note = (l?.notes || []).slice().reverse().find((n) => String(n?.text || "").includes("[REJECTION REASON]"));
      if (note?.text) return String(note.text).replace("[REJECTION REASON]:", "").trim();
      const structured = (l?.notes || []).slice().reverse().find((n) => String(n?.text || "").startsWith("[REJECTION]:"));
      if (structured?.text) {
        const m = String(structured.text).match(/Reason=([^|]+)/i);
        if (m?.[1]) return String(m[1]).trim();
      }
      return "Unspecified";
    };

    const getStrategy = (l) => {
      const r = l?.rejectionDetails || {};
      if (r?.strategy) return String(r.strategy);
      if (l?.status === "Lost to Competitor") return "Competitor";
      return "Risk";
    };

    rejectedLeads.forEach((l) => {
      const strategy = getStrategy(l);
      const reason = getReason(l);

      byStrategy.set(strategy, (byStrategy.get(strategy) || 0) + 1);
      byReason.set(reason, (byReason.get(reason) || 0) + 1);

      if (l.status === "Lost to Competitor") competitorLost += 1;
      if (["Not Eligible", "Not Reliable"].includes(l.status)) policyRejected += 1;
    });

    const topReasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = allLeadsForMediator.length;
    const rejected = rejectedLeads.length;
    const rejectionRate = total ? Math.round((rejected / total) * 100) : 0;

    return {
      total,
      rejected,
      rejectionRate,
      competitorLost,
      policyRejected,
      byStrategy,
      topReasons,
    };
  }, [allLeadsForMediator.length, rejectedLeads]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const labels = [...analytics.byStrategy.keys()];
    const values = labels.map((k) => analytics.byStrategy.get(k) || 0);
    const ctx = chartRef.current.getContext("2d");
    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#64748b"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "right",
            labels: { font: { family: "Inter", size: 11 }, boxWidth: 12 },
          },
        },
        cutout: "70%",
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [analytics.byStrategy]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Partner_Rejection_Audit_${mediator.name}_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 print:p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-7 min-h-[297mm] print:shadow-none print:border-0">
          <ReportBrandHeader
            title="Submission Quality • Rejection Audit"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{mediator.name}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                  <Phone size={14} /> {mediator.phone || "—"}
                </span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Review Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Rejection Rate</div>
                <div className="text-slate-900">{analytics.rejectionRate}%</div>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Total Submissions</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{analytics.total}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Total Rejected</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">{analytics.rejected}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Policy Reject</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{analytics.policyRejected}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Lost to Competitor</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">{analytics.competitorLost}</div>
            </div>
            <div className="surface-solid p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Focus Area</div>
              <div className="text-[11px] text-slate-700 font-bold mt-2">{analytics.topReasons[0]?.[0] || "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 surface-solid p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="font-extrabold text-slate-900 flex items-center gap-2">
                  <PieChart size={18} className="text-indigo-600" /> Strategy Mix
                </div>
                <div className="text-[11px] text-slate-500 font-bold">Counts by strategy</div>
              </div>
              <div className="h-48 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            <div className="surface-solid p-5">
              <div className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                <FileWarning size={18} className="text-amber-600" /> Top Rejection Reasons
              </div>
              <div className="space-y-2">
                {analytics.topReasons.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No reasons recorded yet.</div>
                ) : (
                  analytics.topReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                      <div className="text-xs font-bold text-slate-700 truncate">{reason}</div>
                      <div className="chip">{count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="font-extrabold text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-rose-600" /> Rejections Ledger
              </div>
              <div className="text-[11px] text-slate-500 font-bold">Latest first • Includes competitor context when available</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Outcome</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Competitor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rejectedLeads.map((l) => {
                    const r = l.rejectionDetails || {};
                    const strategy = r.strategy ? String(r.strategy) : l.status === "Lost to Competitor" ? "Competitor" : "Risk";
                    const reason =
                      r.reason ||
                      (l.notes || [])
                        .slice()
                        .reverse()
                        .find((n) => String(n?.text || "").includes("[REJECTION REASON]"))
                        ?.text.replace("[REJECTION REASON]:", "")
                        .trim() ||
                      "Unspecified";
                    const competitor = r.competitor ? String(r.competitor) : "";
                    const outcomeClass =
                      l.status === "Lost to Competitor"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-rose-50 text-rose-800 border-rose-200";

                    return (
                      <tr key={l.id} className="hover:bg-slate-50 print:break-inside-avoid">
                        <td className="p-4 align-top font-mono text-xs text-slate-600">{formatDate(l.createdAt)}</td>
                        <td className="p-4 align-top">
                          <div className="font-extrabold text-slate-900">{l.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{l.company || l.location || "—"}</div>
                        </td>
                        <td className="p-4 align-top">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-extrabold uppercase ${outcomeClass}`}>
                            {strategy}
                          </div>
                          <div className="text-[11px] text-slate-500 font-bold mt-2">{l.status}</div>
                        </td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold leading-relaxed max-w-[520px]">{reason}</td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold">{competitor || <span className="text-slate-400">—</span>}</td>
                      </tr>
                    );
                  })}
                  {rejectedLeads.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 italic">
                        No rejected leads for this partner.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const InternalRejectionMasterReportView = ({ leads, mediators, onBack }) => {
  const todayYmd = toYmdIST(new Date());
  const rejectedStatuses = useMemo(
    () => new Set(["Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)", "Rejected"]),
    []
  );

  const mediatorNameById = useMemo(() => {
    const map = new Map();
    (mediators || []).forEach((m) => {
      if (!m?.id) return;
      map.set(String(m.id), String(m.name || "Unknown"));
    });
    return map;
  }, [mediators]);

  const rows = useMemo(() => {
    return (leads || [])
      .filter((l) => rejectedStatuses.has(String(l?.status || "").trim()))
      .map((lead) => {
        const rejection = extractLeadRejectionContext(lead);
        const decisionTs = rejection?.decisionTs || lead?.updatedAt || lead?.createdAt;
        return {
          lead,
          rejection,
          decisionTs,
          mediatorName: mediatorNameById.get(String(lead?.mediatorId || "")) || "Direct/None",
        };
      })
      .sort((a, b) => new Date(b.decisionTs).getTime() - new Date(a.decisionTs).getTime());
  }, [leads, rejectedStatuses, mediatorNameById]);

  const analytics = useMemo(() => {
    const byStatus = new Map();
    const byStrategy = new Map();
    const byReason = new Map();
    const byMediator = new Map();

    rows.forEach((row) => {
      const status = String(row?.lead?.status || "Rejected");
      const strategy = String(row?.rejection?.strategy || "Risk");
      const reason = String(row?.rejection?.reason || "Unspecified");
      const mediatorName = String(row?.mediatorName || "Direct/None");

      byStatus.set(status, (byStatus.get(status) || 0) + 1);
      byStrategy.set(strategy, (byStrategy.get(strategy) || 0) + 1);
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
      byMediator.set(mediatorName, (byMediator.get(mediatorName) || 0) + 1);
    });

    const topReasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topMediators = [...byMediator.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const statusEntries = [...byStatus.entries()].sort((a, b) => b[1] - a[1]);
    const strategyEntries = [...byStrategy.entries()].sort((a, b) => b[1] - a[1]);

    return {
      totalRejected: rows.length,
      uniqueClients: new Set(rows.map((r) => String(r?.lead?.id || ""))).size,
      uniqueMediators: byMediator.size,
      totalVolume: rows.reduce((sum, r) => sum + (Number(r?.lead?.loanAmount) || 0), 0),
      topReasons,
      topMediators,
      statusEntries,
      strategyEntries,
    };
  }, [rows]);

  const strategyTone = (strategy) => {
    const s = String(strategy || "").toLowerCase();
    if (s.includes("competitor")) return "bg-amber-50 text-amber-800 border-amber-200";
    if (s.includes("internal")) return "bg-violet-50 text-violet-800 border-violet-200";
    if (s.includes("client")) return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-rose-50 text-rose-800 border-rose-200";
  };

  const statusTone = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("competitor")) return "bg-amber-50 text-amber-800 border-amber-200";
    if (s.includes("interested")) return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-rose-50 text-rose-800 border-rose-200";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Detailed_Rejection_List_Internal_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-3 md:p-6 print:p-4 print:max-w-[190mm]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 md:p-7 min-h-[297mm] print:shadow-none print:border-0">
          <ReportBrandHeader
            title="Detailed Rejection List (Internal)"
            subtitle="Combined rejection register for office verification"
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Rows</div>
                <div className="text-slate-900">{analytics.totalRejected}</div>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-1 gap-3 mb-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-rose-700">Total Rejected</div>
              <div className="text-2xl font-extrabold text-rose-900 mt-1">{analytics.totalRejected}</div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-700">Unique Clients</div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-1">{analytics.uniqueClients}</div>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-violet-700">Contributors</div>
              <div className="text-2xl font-extrabold text-violet-900 mt-1">{analytics.uniqueMediators}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600">Rejected Volume</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{formatCompactCurrency(analytics.totalVolume)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-1 gap-4 mb-6">
            <div className="surface-solid p-5">
              <div className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                <FileWarning size={17} className="text-amber-600" /> Top Rejection Reasons
              </div>
              <div className="space-y-2">
                {analytics.topReasons.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No reasons logged.</div>
                ) : (
                  analytics.topReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="text-xs font-bold text-slate-700 truncate">{reason}</div>
                      <span className="chip">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface-solid p-5">
              <div className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                <Users size={17} className="text-indigo-600" /> Rejection by Contributor
              </div>
              <div className="space-y-2">
                {analytics.topMediators.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No contributor mapping.</div>
                ) : (
                  analytics.topMediators.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="text-xs font-bold text-slate-700 truncate">{name}</div>
                      <span className="chip bg-indigo-50 border-indigo-200 text-indigo-700">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface-solid p-5">
              <div className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={17} className="text-rose-600" /> Status / Strategy Mix
              </div>
              <div className="space-y-2">
                {analytics.statusEntries.map(([status, count]) => (
                  <div key={`status_${status}`} className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${statusTone(status)}`}>{status}</span>
                    <span className="chip">{count}</span>
                  </div>
                ))}
                <div className="h-px bg-slate-200 my-2"></div>
                {analytics.strategyEntries.map(([strategy, count]) => (
                  <div key={`strategy_${strategy}`} className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${strategyTone(strategy)}`}>{strategy}</span>
                    <span className="chip">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="font-extrabold text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-rose-600" /> Detailed Combined Rejection Ledger
              </div>
              <div className="text-[11px] text-slate-500 font-bold">Latest decision first • Internal office use only</div>
            </div>

            <div className="md:hidden print:hidden p-3 space-y-3 bg-slate-50/40">
              {rows.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-500 italic">
                  No rejected clients available in current data.
                </div>
              ) : (
                rows.map((row) => {
                  const lead = row.lead;
                  const rejection = row.rejection;
                  return (
                    <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-slate-900 truncate">{lead.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{lead.company || lead.location || "—"}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Amount</div>
                          <div className="text-sm font-extrabold text-slate-900">{formatCompactCurrency(lead.loanAmount)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Decision</div>
                          <div className="text-xs font-mono text-slate-700 mt-1">{formatDateTime(row.decisionTs)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Contributor</div>
                          <div className="text-xs font-bold text-slate-700 mt-1 truncate">{row.mediatorName}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${statusTone(lead.status)}`}>{lead.status}</span>
                        <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${strategyTone(rejection.strategy)}`}>{rejection.strategy}</span>
                      </div>

                      <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/50 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Reason</div>
                        <div className="text-xs text-slate-800 font-bold mt-1 leading-relaxed">{rejection.reason || "Unspecified"}</div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Observation</div>
                          <div className="text-xs text-slate-700 mt-1 leading-relaxed">{rejection.note || "—"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Competitor</div>
                          <div className="text-xs text-slate-700 mt-1">{rejection.competitor || "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block print:hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-4">Decision</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Contributor</th>
                    <th className="p-4">Outcome</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Observation</th>
                    <th className="p-4">Competitor</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const lead = row.lead;
                    const rejection = row.rejection;
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50 print:break-inside-avoid">
                        <td className="p-4 align-top font-mono text-xs text-slate-600 whitespace-nowrap">{formatDateTime(row.decisionTs)}</td>
                        <td className="p-4 align-top">
                          <div className="font-extrabold text-slate-900">{lead.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{lead.company || lead.location || "—"}</div>
                        </td>
                        <td className="p-4 align-top text-xs font-bold text-slate-700">{row.mediatorName}</td>
                        <td className="p-4 align-top">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-extrabold uppercase ${statusTone(lead.status)}`}>
                            {lead.status}
                          </div>
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-extrabold uppercase mt-2 ${strategyTone(rejection.strategy)}`}>
                            {rejection.strategy}
                          </div>
                        </td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold leading-relaxed max-w-[360px]">{rejection.reason || "Unspecified"}</td>
                        <td className="p-4 align-top text-xs text-slate-700 leading-relaxed max-w-[320px]">{rejection.note || <span className="text-slate-400">—</span>}</td>
                        <td className="p-4 align-top text-xs text-slate-700 font-bold">{rejection.competitor || <span className="text-slate-400">—</span>}</td>
                        <td className="p-4 align-top text-right font-mono font-extrabold text-slate-800">{formatCompactCurrency(lead.loanAmount)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500 italic">
                        No rejected clients available in current data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hidden print:block p-4 space-y-3 bg-white">
              {rows.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-500 italic">
                  No rejected clients available in current data.
                </div>
              ) : (
                rows.map((row) => {
                  const lead = row.lead;
                  const rejection = row.rejection;
                  return (
                    <div
                      key={`print_${lead.id}`}
                      className="rounded-xl border border-slate-200 p-4"
                      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold text-slate-900">{lead.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{lead.company || lead.location || "—"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Amount</div>
                          <div className="text-sm font-extrabold text-slate-900">{formatCompactCurrency(lead.loanAmount)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Decision</div>
                          <div className="text-xs font-mono text-slate-700 mt-1">{formatDateTime(row.decisionTs)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Contributor</div>
                          <div className="text-xs font-bold text-slate-700 mt-1">{row.mediatorName}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${statusTone(lead.status)}`}>{lead.status}</span>
                        <span className={`text-[10px] px-2 py-1 rounded border font-extrabold uppercase ${strategyTone(rejection.strategy)}`}>{rejection.strategy}</span>
                      </div>

                      <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/50 p-2">
                        <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Reason</div>
                        <div className="text-xs text-slate-800 font-bold mt-1 leading-relaxed">{rejection.reason || "Unspecified"}</div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Observation</div>
                          <div className="text-xs text-slate-700 mt-1 leading-relaxed">{rejection.note || "—"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Competitor</div>
                          <div className="text-xs text-slate-700 mt-1">{rejection.competitor || "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Internal Verification Copy • Generated by {BRAND.product}
          </div>
        </div>
      </div>
    </div>
  );
};

const extractLeadRejectionContext = (lead) => {
  const r = lead?.rejectionDetails || {};
  const notes = Array.isArray(lead?.notes) ? [...lead.notes].slice().reverse() : [];
  const rejectionStructured = notes.find((n) => String(n?.text || "").includes("[REJECTION]"))?.text || "";
  const rejectionReasonTagged = notes.find((n) => String(n?.text || "").includes("[REJECTION REASON]"))?.text || "";

  const kvMap = {};
  String(rejectionStructured)
    .replace(/^\s*\[REJECTION\]\s*:?\s*/i, "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((part) => {
      const m = part.match(/^([A-Za-z][A-Za-z\s]{1,30})\s*=\s*(.+)$/);
      if (m) kvMap[m[1].trim().toLowerCase()] = m[2].trim();
    });

  const strategy = String(r.strategy || kvMap.strategy || (lead?.status === "Lost to Competitor" ? "Competitor" : "Risk") || "Risk");
  const reason = String(r.reason || kvMap.reason || rejectionReasonTagged.replace("[REJECTION REASON]:", "").trim() || "Not eligible according to current policy criteria.");
  const note = String(r.defense || kvMap.note || kvMap.notes || "").trim();
  const competitor = String(r.competitor || kvMap.competitor || "").trim();
  const decisionTs =
    r.date ||
    notes.find((n) => /\[REJECTION\]|\[REJECTION REASON\]/i.test(String(n?.text || "")))?.date ||
    lead?.updatedAt ||
    lead?.createdAt;

  const reasons = [
    { label: "Decision Outcome", value: lead?.status || "Not Eligible" },
    { label: "Strategy", value: strategy },
    { label: "Primary Reason", value: reason },
    note ? { label: "Detailed Observation", value: note } : null,
    competitor ? { label: "Competitor (if shared)", value: competitor } : null,
  ].filter(Boolean);

  return { strategy, reason, note, competitor, decisionTs, reasons };
};

const RejectReportView = ({ lead, onBack }) => {
  const rejection = extractLeadRejectionContext(lead);

  return (
    <div className="min-h-screen bg-gray-100 font-serif text-slate-900 p-8 flex flex-col items-center">
      <div className="print:hidden w-full max-w-[210mm] flex justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 font-bold text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Mediator_Rejection_Letter_${lead.name}`;
            window.print();
          }}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
        >
          <Printer size={16} /> Print Mediator Letter
        </button>
      </div>

      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl print:shadow-none">
        <ReportBrandHeader
          title="Mediator Rejection Decision Letter"
          subtitle="Detailed rejection reason summary"
          metaRight={
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Date (IST)</div>
              <div className="text-slate-900">
                {new Date().toLocaleDateString("en-IN", { timeZone: BRAND.tz, year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          }
        />

        <div className="flex justify-between mb-12 text-sm font-sans">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Client</p>
            <p className="font-bold text-slate-800 text-lg">{lead.name}</p>
            <p className="text-slate-600">{lead.company}</p>
            <p className="text-slate-600">{lead.location}</p>
            {lead.phone ? <p className="text-slate-600">Phone: {lead.phone}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Reference ID</p>
            <p className="font-mono font-bold text-slate-800">{lead.id}</p>
            <div className="mt-4">
              <span className="bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                Status: {lead.status || "Not Eligible"}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-10 text-base leading-relaxed font-sans">
          <p className="text-slate-700 mb-6">Dear Partner / Mediator,</p>
          <p className="text-slate-700 mb-6 text-justify">
            We have completed the review of the above client file and are unable to proceed with this case at present. This letter provides a clear rejection summary that can be shared with your team/client for closure and follow-up clarity.
          </p>

          <div className="my-8 p-6 border border-slate-200 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 border-b border-slate-300 pb-2">Detailed Rejection Reasons</h3>
            <div className="space-y-3">
              {rejection.reasons.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">{item.label}</div>
                  <div className="text-slate-900 text-base font-bold leading-relaxed mt-1">{item.value}</div>
                </div>
              ))}
            </div>
            {rejection.decisionTs ? (
              <div className="mt-3 text-xs text-slate-500 font-bold">
                Decision recorded on: {formatDateTime(rejection.decisionTs)}
              </div>
            ) : null}
          </div>

          <div className="my-8 p-6 border border-slate-200 bg-white rounded-lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">Recent Activity Timeline</h3>
            <div className="space-y-3">
              {(Array.isArray(lead.notes) ? [...lead.notes].slice(-6).reverse() : []).map((n, idx) => (
                <div key={idx} className="border border-slate-100 rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">{n?.date ? formatDateTime(n.date) : "—"}</div>
                  <div className="text-sm text-slate-800 font-semibold mt-1 leading-relaxed">{String(n?.text || "").trim()}</div>
                </div>
              ))}
              {(!lead.notes || lead.notes.length === 0) && <div className="text-sm text-slate-500 italic">No activity timeline available.</div>}
            </div>
          </div>

          <p className="text-slate-700 mb-6 text-justify">
            Please use the above rejection details when updating the client status and share revised information only if the client profile/documents materially change.
          </p>
        </div>

        <div className="mt-20 font-sans">
          <p className="text-slate-900 font-bold">Credit Underwriting Team</p>
          <p className="text-slate-500 text-sm">{BRAND.name}</p>
          <div className="mt-8 border-t border-slate-200 pt-2 flex justify-between text-[10px] text-slate-400">
            <p>Generated via LIRAS System</p>
            <p>Confidential & Proprietary</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const roundRectCanvas = (ctx, x, y, w, h, r, fill = true, stroke = false) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
};

const wrapCanvasText = (ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((ln, idx) => ctx.fillText(ln, x, y + idx * lineHeight));
  return lines.length;
};

const drawPillCanvas = (ctx, text, x, y, tone = "#10b981") => {
  ctx.font = "700 20px ui-sans-serif, system-ui, -apple-system";
  const label = String(text || "");
  const width = Math.max(120, Math.ceil(ctx.measureText(label).width) + 34);
  ctx.fillStyle = `${tone}22`;
  roundRectCanvas(ctx, x, y, width, 44, 14, true, false);
  ctx.strokeStyle = `${tone}88`;
  ctx.lineWidth = 2;
  roundRectCanvas(ctx, x, y, width, 44, 14, false, true);
  ctx.fillStyle = tone;
  ctx.fillText(label, x + 17, y + 29);
};

const drawMetricCardCanvas = (ctx, { x, y, w, h, title, value, sub = "", tone = "slate" }) => {
  const tones = {
    emerald: { border: "#1d5b4f", fill: "#0d1d1f", accent: "#34d399" },
    amber: { border: "#5b4220", fill: "#1b1410", accent: "#f59e0b" },
    rose: { border: "#5b2530", fill: "#1b1116", accent: "#fb7185" },
    slate: { border: "#23344f", fill: "#101a2b", accent: "#cbd5e1" },
  };
  const t = tones[tone] || tones.slate;
  ctx.fillStyle = t.fill;
  roundRectCanvas(ctx, x, y, w, h, 18, true, false);
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  roundRectCanvas(ctx, x, y, w, h, 18, false, true);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 16px ui-sans-serif, system-ui, -apple-system";
  ctx.fillText(String(title || "").toUpperCase(), x + 18, y + 30);
  ctx.fillStyle = t.accent;
  ctx.font = "800 27px ui-sans-serif, system-ui, -apple-system";
  wrapCanvasText(ctx, value || "—", x + 18, y + 68, w - 36, 30, 2);
  if (sub) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 16px ui-sans-serif, system-ui, -apple-system";
    wrapCanvasText(ctx, sub, x + 18, y + h - 22, w - 36, 20, 2);
  }
};

const LeadPartnerStatusRequestPdfView = ({ lead, mediator, includeTimeline = false, onBack }) => {
  if (!lead) return null;

  const todayYmd = toYmdIST(new Date());
  const mediatorLabel = mediator?.name || "Direct/None";
  const mediatorPhone = mediator?.phone || "";
  const leadPhone = String(lead.phone || "").trim();
  const contactMissing = !leadPhone || leadPhone.length < 8;
  const docs = lead.documents || {};
  const docsMissing = ["kyc", "itr", "bank"].filter((k) => !docs?.[k]);
  const triage = (docs && typeof docs.triage === "object" && docs.triage) || {};
  const nextAction = lead?.nextFollowUp ? `${toYmdIST(lead.nextFollowUp)}${formatTimeIST(lead.nextFollowUp) ? ` • ${formatTimeIST(lead.nextFollowUp)}` : ""}` : "—";
  const isClosed = ["Payment Done", "Deal Closed"].includes(lead.status);
  const isRejected = isClosedOrRejectedLeadStatus(lead.status) && !isClosed;

  const timelineRows = useMemo(() => {
    const out = [];
    if (lead.createdAt) {
      out.push({
        ts: lead.createdAt,
        tag: "Lead Created",
        text: `Lead created${lead.createdBy ? ` by ${lead.createdBy}` : ""}.`,
      });
    }
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    for (const n of notes) {
      if (!n) continue;
      if (typeof n === "string") {
        out.push({ ts: "", tag: "Note", text: n });
        continue;
      }
      const text = String(n.text || "").trim();
      if (!text) continue;
      const tagMatch = text.match(/^\s*\[([^\]]+)\]/);
      out.push({
        ts: n.date || "",
        tag: tagMatch ? tagMatch[1] : "Note",
        text,
      });
    }
    return out.sort((a, b) => {
      const at = parseIsoOrNull(a.ts)?.getTime?.() || 0;
      const bt = parseIsoOrNull(b.ts)?.getTime?.() || 0;
      return bt - at;
    });
  }, [lead]);

  const timelineTone = (tag) => {
    const t = String(tag || "").toLowerCase();
    if (t.includes("payment") || t.includes("closed")) return "emerald";
    if (t.includes("reject")) return "rose";
    if (t.includes("follow")) return "indigo";
    if (t.includes("meeting") || t.includes("reschedule")) return "violet";
    if (t.includes("call")) return "sky";
    if (t.includes("check")) return "teal";
    return "slate";
  };

  const toneClasses = (tone) =>
    ({
      emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
      rose: "border-rose-200 bg-rose-50 text-rose-700",
      indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
      violet: "border-violet-200 bg-violet-50 text-violet-700",
      sky: "border-sky-200 bg-sky-50 text-sky-700",
      teal: "border-teal-200 bg-teal-50 text-teal-700",
      slate: "border-slate-200 bg-slate-50 text-slate-700",
    }[tone] || "border-slate-200 bg-slate-50 text-slate-700");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center gap-3">
        <button onClick={onBack} className="btn-secondary px-3 py-2">
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Partner_Status_Request_${String(lead.name || "Lead").replace(/[^\w]+/g, "_")}_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-4 py-2"
        >
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 print:p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-7 min-h-[297mm] print:shadow-none print:border-0">
          <ReportBrandHeader
            title="Partner / Mediator Status Follow-up"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{lead.name}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-700">{lead.company || "—"}</span>
              </span>
            }
            metaRight={
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Generated (IST)</div>
                <div className="text-slate-900">{todayYmd}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Timeline</div>
                <div className="text-slate-900">{includeTimeline ? "Included" : "Summary only"}</div>
              </div>
            }
          />

          <div className="mb-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Lead Snapshot</div>
              <div className="mt-1 text-3xl md:text-4xl font-black tracking-tight text-slate-900">{lead.name || "—"}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-extrabold border ${STATUS_CONFIG[lead.status]?.color?.replace("bg-", "bg-").replace("text-", "text-") || "bg-slate-100 text-slate-700"} border-slate-200`}>
                  {lead.status || "Unknown"}
                </span>
                {lead.company ? <span className="text-slate-600 font-semibold">{lead.company}</span> : null}
                {lead.location ? <span className="text-slate-400">•</span> : null}
                {lead.location ? <span className="text-slate-600">{lead.location}</span> : null}
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`rounded-2xl border p-5 ${contactMissing || triage?.contactUpdated === false ? "border-rose-200 bg-rose-50/50" : "border-emerald-200 bg-emerald-50/40"}`}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Contact Details</div>
                <div className={`text-lg font-black ${contactMissing || triage?.contactUpdated === false ? "text-rose-700" : "text-emerald-700"}`}>
                  {contactMissing || triage?.contactUpdated === false ? "Pending / Not Updated" : "Available"}
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Client Phone: <span className="font-extrabold">{leadPhone || "Not updated"}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Partner/Mediator: <span className="font-bold text-slate-700">{mediatorLabel}</span>{mediatorPhone ? ` • ${mediatorPhone}` : ""}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Current Pending Status</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Phone PD</div>
                    <div className={`mt-1 text-base font-extrabold ${triage?.phonePdDone ? "text-emerald-700" : "text-amber-700"}`}>
                      {triage?.phonePdDone ? "Done" : "Pending"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Statement</div>
                    <div className={`mt-1 text-base font-extrabold ${triage?.statementCollected ? "text-emerald-700" : "text-amber-700"}`}>
                      {triage?.statementCollected ? "Collected" : "Pending"}
                    </div>
                    {!triage?.statementCollected && triage?.statementReason ? (
                      <div className="mt-1 text-[10px] text-slate-500 truncate">{triage.statementReason}</div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Statement Working</div>
                    <div className={`mt-1 text-base font-extrabold ${triage?.perfiosDone ? "text-emerald-700" : "text-amber-700"}`}>
                      {triage?.perfiosDone ? "Done" : "Pending"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Docs Pending</div>
                    <div className={`mt-1 text-base font-extrabold ${docsMissing.length ? "text-rose-700" : "text-emerald-700"}`}>
                      {docsMissing.length ? docsMissing.map((d) => d.toUpperCase()).join(", ") : "None"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Next Action (IST)</div>
                <div className="text-xl font-black text-slate-900">{nextAction}</div>
                <div className="mt-2 text-xs text-slate-500">Lead Value: <span className="font-bold text-slate-700">{formatCompactCurrency(Number(lead.loanAmount) || 0)}</span></div>
              </div>

              {(isClosed || isRejected) && (
                <div className={`rounded-2xl border p-5 ${isClosed ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Outcome</div>
                  <div className={`text-xl font-black ${isClosed ? "text-emerald-700" : "text-rose-700"}`}>{lead.status}</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {isClosed ? "Closed / payment completed case." : "Rejected / dropped case."}
                  </div>
                </div>
              )}
            </div>
          </div>

          {includeTimeline && (
            <div className="mb-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-violet-50 via-indigo-50 to-sky-50 border-b border-slate-200 flex items-center justify-between">
                <div className="font-extrabold text-slate-900">Lead Action Timeline</div>
                <div className="text-[11px] text-slate-500 font-bold">{timelineRows.length} entries</div>
              </div>
              <div className="p-5 bg-white">
                {timelineRows.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 italic rounded-xl border border-dashed border-slate-200">
                    No timeline entries recorded.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timelineRows.slice(0, 30).map((row, idx) => {
                      const tone = timelineTone(row.tag);
                      return (
                        <div key={`${row.ts || "na"}-${idx}`} className="relative pl-6">
                          <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />
                          <div className={`absolute left-0 top-3 w-4 h-4 rounded-full border-2 ${toneClasses(tone).replace("bg-", "bg-").split(" ").slice(0, 2).join(" ")} bg-white`} />
                          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-2 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${toneClasses(tone)}`}>
                                {row.tag || "Note"}
                              </div>
                              <div className="text-[11px] font-bold text-slate-500">
                                {row.ts ? `${toYmdIST(row.ts)}${formatTimeIST(row.ts) ? ` • ${formatTimeIST(row.ts)}` : ""}` : "Time not recorded"}
                              </div>
                            </div>
                            <div className="px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {row.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-[11px] text-slate-400">
            Confidential • Generated by {BRAND.product} • {BRAND.name}
          </div>
        </div>
      </div>
    </div>
  );
};

const EnhancedMediatorReport = ({ mediator, leads, onBack }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const mLeads = leads.filter((l) => l.mediatorId === mediator.id);
  const metrics = useMemo(() => {
    let totalTAT = 0;
    let closedCount = 0;
    let activeCount = 0;
    let rejectedCount = 0;
    let closedVolume = 0;
    let activeVolume = 0;
    let tatEntries = 0;
    mLeads.forEach((l) => {
      const amount = parseInt(l.loanAmount) || 0;
      const tat = calculateTAT(l);
      if (["Payment Done", "Deal Closed"].includes(l.status)) {
        closedCount += 1;
        closedVolume += amount;
        if (tat !== null) {
          totalTAT += tat;
          tatEntries += 1;
        }
      } else if (["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status)) {
        rejectedCount += 1;
      } else {
        activeCount += 1;
        activeVolume += amount;
      }
    });
    return {
      total: mLeads.length,
      closed: closedCount,
      active: activeCount,
      rejected: rejectedCount,
      closedVolume,
      activeVolume,
      avgTAT: tatEntries ? Math.round(totalTAT / tatEntries) : 0,
      conversion: mLeads.length ? Math.round((closedCount / mLeads.length) * 100) : 0,
    };
  }, [mLeads]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext("2d");
    const statusCounts = {};
    mLeads.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });
    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(statusCounts),
        datasets: [
          {
            data: Object.values(statusCounts),
            backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "right",
            labels: { font: { family: "Inter", size: 11 }, boxWidth: 12 },
          },
        },
        cutout: "70%",
      },
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [mLeads]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="print:hidden p-4 bg-white border-b sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-900">
          <ArrowLeft size={18} /> Dashboard
        </button>
        <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800">
          <Printer size={16} /> Print Report
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-8 bg-white shadow-2xl my-8 min-h-[297mm] print:shadow-none print:m-0 print:w-full">
        <ReportBrandHeader
          title="Partner Full Analysis"
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{mediator.name}</span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                <Phone size={14} /> {mediator.phone || "—"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                <UserCircle size={14} /> Partner ID: {mediator.id}
              </span>
            </span>
          }
          metaRight={
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Report Date (IST)</div>
              <div className="text-slate-900">{toYmdIST(new Date())}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Conversion</div>
              <div className="text-slate-900">{metrics.conversion}%</div>
            </div>
          }
        />

        <div className="grid grid-cols-4 gap-6 mb-10">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Conversion Rate</div>
            <div className="text-3xl font-extrabold text-indigo-700">{metrics.conversion}%</div>
            <div className="text-[10px] text-indigo-400 mt-1">Industry Avg: 15%</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Closed Volume</div>
            <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(metrics.closedVolume)}</div>
            <div className="text-[10px] text-emerald-500 mt-1">{metrics.closed} Deals Closed</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
            <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Pipeline Value</div>
            <div className="text-2xl font-extrabold text-amber-700">{formatCurrency(metrics.activeVolume)}</div>
            <div className="text-[10px] text-amber-500 mt-1">{metrics.active} Active Deals</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Turnaround</div>
            <div className="text-3xl font-extrabold text-slate-700">{metrics.avgTAT}h</div>
            <div className="text-[10px] text-slate-400 mt-1">Processing Speed</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-10">
          <div className="col-span-2 border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity size={18} /> Lead Status Distribution
            </h3>
            <div className="h-48 relative">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Star className="text-yellow-400" size={18} /> Why Partner With Us?
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3">
                <div className="bg-white/20 p-1 rounded mt-0.5">
                  <Zap size={12} />
                </div>
                <div>
                  <div className="font-bold text-white">Rapid Processing</div>
                  <div className="text-slate-400 text-xs">Our average TAT of {metrics.avgTAT}h ensures your clients don&apos;t wait.</div>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="bg-white/20 p-1 rounded mt-0.5">
                  <ShieldAlert size={12} />
                </div>
                <div>
                  <div className="font-bold text-white">Transparent Policy</div>
                  <div className="text-slate-400 text-xs">Clear rejection reasons provided to help you qualify better.</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b">
            <FileText size={18} /> Detailed Lead Ledger
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
                <th className="p-3 text-left rounded-l-lg">Client Details</th>
                <th className="p-3 text-left">Timeline</th>
                <th className="p-3 text-left">Status Analysis</th>
                <th className="p-3 text-left rounded-r-lg w-1/3">Last Corporate Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mLeads
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((l) => (
                  <tr key={l.id} className="group hover:bg-slate-50">
                    <td className="p-3 align-top">
                      <div className="font-bold text-slate-900">{l.name}</div>
                      <div className="text-xs text-slate-500">{l.company}</div>
                      <div className="text-xs font-mono text-slate-400 mt-1">{formatCurrency(l.loanAmount)}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs font-bold text-slate-700">In: {formatDate(l.createdAt)}</div>
                      <div className="text-xs text-slate-500 mt-1">Age: {getDaysDiff(l.createdAt)} days</div>
                    </td>
                    <td className="p-3 align-top">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${STATUS_CONFIG[l.status]?.color?.replace("text", "border")}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-2 rounded border border-slate-100">
                        {l.notes?.length ? l.notes[l.notes.length - 1].text.replace(/\[.*?\]/g, "").trim() : "No remarks recorded."}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ClearancePrintReport = ({ leads, mediators, onBack }) => {
  const now = new Date();
  const todayYmd = toYmdIST(now);

  const pendingReviews = useMemo(() => {
    return (leads || []).filter((l) => l?.status === "Meeting Scheduled" && l?.nextFollowUp && new Date(l.nextFollowUp) <= now);
  }, [leads, now]);

  const dailyPending = useMemo(() => {
    return (leads || []).filter(
      (l) =>
        l &&
        !isClosedOrRejectedLeadStatus(l.status) &&
        l.status !== "Meeting Scheduled" &&
        !(parseIsoOrNull(l?.nextFollowUp) && getDaysDiff(l.nextFollowUp) > 0) &&
        (!l.notes?.length || !isTodayIST(l.notes[l.notes.length - 1].date))
    );
  }, [leads]);

  const fmtIst = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: BRAND.tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  const resolveMediatorName = (lead) => {
    const id = lead?.mediatorId;
    if (!id) return "—";
    return mediators?.find?.((m) => m.id === id)?.name || "—";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
      <div className="print:hidden flex justify-between items-center gap-3 mb-6">
        <button onClick={onBack} className="btn-secondary px-4 py-2">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `Clearance_Report_${todayYmd}`;
            window.print();
          }}
          className="btn-primary px-5 py-2"
        >
          <Printer size={16} /> Print PDF
        </button>
      </div>

      <div className="surface-solid p-7 md:p-9 shadow-elevated min-h-[297mm] print:shadow-none print:border-0">
        <ReportBrandHeader
          title="Clearance Report"
          subtitle="Meetings completed + End-of-day pending updates (IST)"
          metaRight={
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Date (IST)</div>
              <div className="text-slate-900">{todayYmd}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">Generated</div>
              <div className="text-slate-900">{new Date().toLocaleString("en-IN", { timeZone: BRAND.tz })}</div>
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="surface-solid p-4">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Past Meetings</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{pendingReviews.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">EOD Pending</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{dailyPending.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Total Open Items</div>
            <div className="text-3xl font-extrabold text-indigo-700 mt-1">{pendingReviews.length + dailyPending.length}</div>
          </div>
          <div className="surface-solid p-4">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Priority</div>
            <div className="text-[11px] text-slate-700 font-bold mt-2">Meetings → EOD updates</div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600" /> Meetings: Action Required
              </div>
              <div className="chip">{pendingReviews.length}</div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Partner</th>
                    <th className="p-4">Scheduled</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingReviews.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-500 italic">
                        No past meetings pending.
                      </td>
                    </tr>
                  ) : (
                    pendingReviews
                      .slice()
                      .sort((a, b) => new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime())
                      .map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50 print:break-inside-avoid">
                          <td className="p-4">
                            <div className="font-extrabold text-slate-900">{l.name}</div>
                            <div className="text-xs text-slate-500 mt-1">{l.company || l.location || "—"}</div>
                          </td>
                          <td className="p-4 text-slate-700 font-bold">{resolveMediatorName(l)}</td>
                          <td className="p-4 font-mono text-xs text-slate-600 whitespace-nowrap">{fmtIst(l.nextFollowUp)}</td>
                          <td className="p-4">
                            <span className={`text-[10px] px-2 py-1 rounded font-extrabold uppercase ${STATUS_CONFIG[l.status]?.color || "bg-slate-100 text-slate-700"}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-extrabold text-slate-800">{formatCompactCurrency(l.loanAmount)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Clock size={16} className="text-orange-600" /> End of Day Pending Updates
              </div>
              <div className="chip">{dailyPending.length}</div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Next Action</th>
                    <th className="p-4">Last Update</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyPending.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-500 italic">
                        All good — no pending updates for today.
                      </td>
                    </tr>
                  ) : (
                    dailyPending
                      .slice()
                      .sort((a, b) => new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime())
                      .map((l) => {
                        const last = l.notes?.length ? l.notes[l.notes.length - 1] : null;
                        return (
                          <tr key={l.id} className="hover:bg-slate-50 print:break-inside-avoid">
                            <td className="p-4">
                              <div className="font-extrabold text-slate-900">{l.name}</div>
                              <div className="text-xs text-slate-500 mt-1">{l.company || l.location || "—"}</div>
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] px-2 py-1 rounded font-extrabold uppercase ${STATUS_CONFIG[l.status]?.color || "bg-slate-100 text-slate-700"}`}>
                                {l.status}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs text-slate-600 whitespace-nowrap">{fmtIst(l.nextFollowUp)}</td>
                            <td className="p-4 text-xs text-slate-600">
                              <div className="font-mono whitespace-nowrap">{last?.date ? fmtIst(last.date) : "—"}</div>
                              {last?.text ? <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[360px]">{String(last.text).replace(/\s+/g, " ").trim()}</div> : null}
                            </td>
                            <td className="p-4 text-right font-mono font-extrabold text-slate-800">{formatCompactCurrency(l.loanAmount)}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-[11px] text-slate-400 print:mt-12">
          Confidential • {BRAND.name} • {BRAND.product}
        </div>
      </div>
    </div>
  );
};

const EodActivityReport = ({ leads, mediators, staffUsers, onBack, mode = "eod" }) => {
  const [dateYmd, setDateYmd] = useState(() => toYmdIST(new Date()));
  const [userFilter, setUserFilter] = useState("all"); // userId | "all"

  const reportTitle = mode === "daily" ? "Daily Activity Report" : "End of Day Activity Report";
  const getLeadOwnerId = (l) => String(l?.ownerId || l?.createdBy || "");
  const getMediatorOwnerId = (m) => String(m?.ownerId || m?.createdBy || "");

  const allOwnerIds = useMemo(() => {
    const set = new Set();
    (leads || []).forEach((l) => {
      const id = getLeadOwnerId(l);
      if (id) set.add(id);
    });
    (mediators || []).forEach((m) => {
      const id = getMediatorOwnerId(m);
      if (id) set.add(id);
    });
    return Array.from(set);
  }, [leads, mediators]);

  const usersForReport = useMemo(() => {
    const base = Array.isArray(staffUsers) ? staffUsers : [];
    const map = new Map();
    base.forEach((u) => {
      if (!u?.userId) return;
      map.set(String(u.userId), {
        userId: String(u.userId),
        email: String(u.email || u.userId),
        role: String(u.role || "staff"),
        label: String(u.label || u.email || u.userId),
      });
    });
    allOwnerIds.forEach((id) => {
      if (!map.has(id)) {
        map.set(id, { userId: id, email: id, role: "staff", label: id });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [staffUsers, allOwnerIds]);

  const staffList = useMemo(() => {
    const activeOwnerIds = new Set(allOwnerIds.map(String));
    const nonAdmin = usersForReport.filter((u) => u.role !== "admin");
    const activeAdmins = usersForReport.filter((u) => u.role === "admin" && activeOwnerIds.has(String(u.userId || "")));
    const base = nonAdmin.length ? nonAdmin : usersForReport;
    const merged = [...base];
    activeAdmins.forEach((u) => {
      if (!merged.some((x) => String(x.userId) === String(u.userId))) merged.push(u);
    });
    return merged;
  }, [usersForReport, allOwnerIds]);

  const computeReportForUser = (user) => {
    const uid = String(user.userId);
    const leadsOwned = (leads || []).filter((l) => getLeadOwnerId(l) === uid);
    const mediatorsOwned = (mediators || []).filter((m) => getMediatorOwnerId(m) === uid && String(m?.id || "") !== "3");

    const endDay = endOfIstDay(dateYmd);
    const activeExclude = new Set(["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"]);
    const isOnReportYmd = (value) => {
      const parsed = parseIsoOrNull(value);
      return parsed ? toYmdIST(parsed) === dateYmd : false;
    };
    const parseTs = (value) => parseIsoOrNull(value);

    const newLeads = leadsOwned.filter((l) => isOnReportYmd(l.createdAt));
    const payments = leadsOwned.filter((l) => l?.loanDetails?.paymentDate && isOnReportYmd(l.loanDetails.paymentDate));
    const paymentVolume = payments.reduce((sum, l) => sum + (Number(l.loanDetails?.netDisbursed) || Number(l.loanAmount) || 0), 0);

    const leadsTouched = new Set();
    const events = [];
    const MAX_EVENTS_STORED = 900; // keeps the UI/print stable on large datasets (mobile WebView friendly)
    const MAX_NOTES_SCAN = 260; // scan tail only (notes are appended chronologically)
    const MAX_ATTACHMENTS_SCAN = 160; // attachments are stored newest-first
    let eventsTotal = 0;
    let eventsDropped = 0;

    const pushEvent = (evt) => {
      eventsTotal += 1;
      if (events.length < MAX_EVENTS_STORED) events.push(evt);
      else eventsDropped += 1;
    };

    const noteKind = (text) => {
      const raw = String(text || "").trim();
      const m = raw.match(/^\s*\[([^\]]+)\]/);
      const tag = (m?.[1] || "").trim();
      const tagUpper = tag.toUpperCase();
      if (tagUpper.startsWith("CALL")) return { kind: "call", label: "Call" };
      if (tagUpper.startsWith("WHATSAPP")) return { kind: "whatsapp", label: "WhatsApp" };
      if (tagUpper.startsWith("PAYMENT DONE")) return { kind: "payment", label: "Payment Done" };
      if (tagUpper.startsWith("REJECTION")) return { kind: "rejection", label: "Rejection" };
      if (tagUpper.startsWith("CHECK-IN")) return { kind: "checkin", label: "Check-in" };
      if (tagUpper.startsWith("FOLLOW-UP")) return { kind: "followup", label: "Follow-up" };
      if (tagUpper.startsWith("STAFF ASSIGNED")) return { kind: "assign", label: "Assigned" };
      if (tagUpper.startsWith("TRIAGE")) return { kind: "triage", label: "Triage" };
      if (tagUpper.startsWith("STATUS CHANGE")) return { kind: "status", label: "Status" };
      if (tagUpper.startsWith("OUTCOME")) return { kind: "outcome", label: "Outcome" };
      return { kind: "note", label: tag || "Note" };
    };

    const trimPrefix = (text) => String(text || "").replace(/^\s*\[[^\]]+\]\s*:?/i, "").trim();
    const truncate = (s, n = 160) => {
      const str = String(s || "");
      return str.length > n ? `${str.slice(0, n - 1)}…` : str;
    };
    const formatBytes = (n) => {
      const num = Number(n) || 0;
      if (num < 1024) return `${num} B`;
      if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
      if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
      return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    let callsCount = 0;
    let whatsappCount = 0;
    let meetingsCount = 0;
    let checkinsCount = 0;
    let rejectionsCount = 0;
    let attachmentsCount = 0;

    leadsOwned.forEach((l) => {
      if (!l?.id) return;

      if (isOnReportYmd(l.createdAt)) {
        pushEvent({
          ts: l.createdAt,
          type: "new_lead",
          label: "New Lead",
          subject: l.name || "Lead",
          detail: truncate(`${l.company || "—"} • ${formatCurrency(l.loanAmount)} • ${l.status || "New"}`),
        });
      }

      const notesAll = Array.isArray(l.notes) ? l.notes : [];
      const notes = notesAll.length > MAX_NOTES_SCAN ? notesAll.slice(notesAll.length - MAX_NOTES_SCAN) : notesAll;
      notes.forEach((n) => {
        if (!n?.date || !isOnReportYmd(n.date)) return;
        leadsTouched.add(l.id);
        const meta = noteKind(n.text);
        if (meta.kind === "call") callsCount += 1;
        if (meta.kind === "whatsapp") whatsappCount += 1;
        if (meta.kind === "checkin") checkinsCount += 1;
        if (meta.kind === "rejection") rejectionsCount += 1;
        pushEvent({
          ts: n.date,
          type: meta.kind,
          label: meta.label,
          subject: l.name || "Lead",
          detail: truncate(trimPrefix(n.text) || n.text || ""),
        });
      });

      const attachmentsAll = Array.isArray(l.documents?.attachments) ? l.documents.attachments : [];
      const attachments = attachmentsAll.length > MAX_ATTACHMENTS_SCAN ? attachmentsAll.slice(0, MAX_ATTACHMENTS_SCAN) : attachmentsAll;
      attachments.forEach((a) => {
        if (!a?.createdAt || !isOnReportYmd(a.createdAt)) return;
        leadsTouched.add(l.id);
        attachmentsCount += 1;
        pushEvent({
          ts: a.createdAt,
          type: "attachment",
          label: "Attachment",
          subject: l.name || "Lead",
          detail: truncate(`${String(a.kind || "file").toUpperCase()} • ${a.name || "file"} • ${formatBytes(a.size || 0)}`),
        });
      });

      // If payment was recorded without a note, add an event.
      if (l?.loanDetails?.paymentDate && isOnReportYmd(l.loanDetails.paymentDate)) {
        const hasNote = notesAll.some((n) => isOnReportYmd(n?.date) && String(n?.text || "").toUpperCase().includes("PAYMENT DONE"));
        if (!hasNote) {
          pushEvent({
            ts: l.loanDetails.paymentDate,
            type: "payment",
            label: "Payment Done",
            subject: l.name || "Lead",
            detail: truncate(`Net: ${formatCurrency(l.loanDetails?.netDisbursed || l.loanAmount)} • Terms: ${l.loanDetails?.tenure || "-"}m`),
          });
        }
      }
    });

    mediatorsOwned.forEach((m) => {
      const history = Array.isArray(m.followUpHistory) ? m.followUpHistory : [];
      history
        .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
        .filter((h) => h && typeof h === "object" && (typeof h.date === "string" || typeof h.ts === "string"))
        .forEach((h) => {
          const ts = h.ts || (h.date ? `${h.date}T00:00:00` : "");
          const parsedTs = parseTs(ts);
          if (!parsedTs || toYmdIST(parsedTs) !== dateYmd) return;
          const t = String(h.type || "legacy");
          const label = t === "call" ? "Partner Call" : t === "whatsapp" ? "Partner WhatsApp" : t === "meeting" ? "Partner Meeting" : "Partner";
          const outcome = h.outcome ? ` • ${String(h.outcome).replace(/_/g, " ")}` : "";
          const notes = h.notes ? ` • ${String(h.notes).trim()}` : "";
          if (t === "call") callsCount += 1;
          if (t === "whatsapp") whatsappCount += 1;
          if (t === "meeting") meetingsCount += 1;
          pushEvent({
            ts: parsedTs.toISOString(),
            type: t,
            label,
            subject: m.name || "Mediator",
            detail: truncate(`${m.phone || ""}${outcome}${notes}`.trim() || "—"),
          });
        });
    });

    const leadsUpdated = leadsTouched.size;

    const pendingEod = leadsOwned.filter((l) => {
      if (!l) return false;
      if (activeExclude.has(l.status)) return false;
      const notes = Array.isArray(l.notes) ? l.notes : [];
      const last = notes.length ? notes[notes.length - 1] : null;
      return !last?.date || !isOnYmdIST(last.date, dateYmd);
    }).length;

    const pendingMeetings = leadsOwned.filter((l) => {
      if (!l || l.status !== "Meeting Scheduled" || !l.nextFollowUp) return false;
      const when = parseTs(l.nextFollowUp);
      if (!when) return false;
      return when <= endDay;
    }).length;

    events.sort((a, b) => {
      const aMs = parseTs(a.ts)?.getTime() ?? 0;
      const bMs = parseTs(b.ts)?.getTime() ?? 0;
      return aMs - bMs;
    });

    return {
      user,
      newLeadsCount: newLeads.length,
      leadsUpdated,
      paymentsCount: payments.length,
      paymentVolume,
      calls: callsCount,
      whatsapp: whatsappCount,
      partnerMeetings: meetingsCount,
      checkins: checkinsCount,
      rejections: rejectionsCount,
      attachmentsAdded: attachmentsCount,
      pendingEod,
      pendingMeetings,
      events,
      eventsTotal,
      eventsDropped,
    };
  };

  const reports = useMemo(() => {
    return staffList.map((u) => {
      try {
        return computeReportForUser(u);
      } catch (err) {
        const message = String(err?.message || err || "Report generation failed");
        return {
          user: u,
          error: message,
          newLeadsCount: 0,
          leadsUpdated: 0,
          paymentsCount: 0,
          paymentVolume: 0,
          calls: 0,
          whatsapp: 0,
          partnerMeetings: 0,
          checkins: 0,
          rejections: 0,
          attachmentsAdded: 0,
          pendingEod: 0,
          pendingMeetings: 0,
          events: [],
          eventsTotal: 0,
          eventsDropped: 0,
        };
      }
    });
  }, [staffList, leads, mediators, dateYmd]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleReports = useMemo(() => {
    if (userFilter === "all") return reports;
    return reports.filter((r) => r.user.userId === userFilter);
  }, [reports, userFilter]);

  const totals = useMemo(() => {
    return visibleReports.reduce(
      (acc, r) => {
        acc.newLeads += r.newLeadsCount;
        acc.leadsUpdated += r.leadsUpdated;
        acc.payments += r.paymentsCount;
        acc.paymentVolume += r.paymentVolume;
        acc.calls += r.calls;
        acc.whatsapp += r.whatsapp;
        acc.partnerMeetings += r.partnerMeetings;
        acc.checkins += r.checkins;
        acc.rejections += r.rejections;
        acc.attachments += r.attachmentsAdded;
        acc.pendingEod += r.pendingEod;
        acc.pendingMeetings += r.pendingMeetings;
        return acc;
      },
      {
        newLeads: 0,
        leadsUpdated: 0,
        payments: 0,
        paymentVolume: 0,
        calls: 0,
        whatsapp: 0,
        partnerMeetings: 0,
        checkins: 0,
        rejections: 0,
        attachments: 0,
        pendingEod: 0,
        pendingMeetings: 0,
      }
    );
  }, [visibleReports]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
      <div className="print:hidden flex justify-between items-center gap-3 mb-6">
        <button onClick={onBack} className="btn-secondary px-4 py-2">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => {
            document.title = `${mode === "daily" ? "Daily_Activity" : "EOD_Activity"}_${dateYmd}`;
            window.print();
          }}
          className="btn-primary px-5 py-2"
        >
          <Printer size={16} /> Print PDF
        </button>
      </div>

      <div className="surface-solid p-6 md:p-8 shadow-elevated no-break">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size={40} />
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{BRAND.name}</div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">{reportTitle}</div>
            <div className="text-sm text-slate-600 mt-2">
              Date: <span className="font-bold text-slate-900">{dateYmd}</span> • Generated:{" "}
              <span className="font-medium">{new Date().toLocaleString("en-IN", { timeZone: BRAND.tz })}</span>
            </div>
          </div>

          <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Report Date</label>
              <input value={dateYmd} onChange={(e) => setDateYmd(e.target.value)} type="date" className="w-full py-3" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">User</label>
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="w-full py-3">
                <option value="all">All staff</option>
                {staffList.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">New Leads</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.newLeads}</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Leads Updated</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.leadsUpdated}</div>
          </div>
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Payments</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.payments}</div>
            <div className="text-[11px] text-emerald-700 mt-1">{formatCompactCurrency(totals.paymentVolume)}</div>
          </div>
          <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Calls</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.calls}</div>
          </div>
          <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">WhatsApp</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.whatsapp}</div>
          </div>
          <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Meetings</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.partnerMeetings}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Check-ins</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.checkins}</div>
          </div>
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Rejections</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.rejections}</div>
          </div>
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Attachments</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totals.attachments}</div>
          </div>
          {mode === "eod" && (
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-soft">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Loose Ends (EOD)</div>
              <div className="mt-2 text-xs text-slate-200 flex flex-col gap-1">
                <span>
                  Meetings pending update: <span className="font-extrabold">{totals.pendingMeetings}</span>
                </span>
                <span>
                  EOD pending updates: <span className="font-extrabold">{totals.pendingEod}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {visibleReports.map((r) => (
          <div key={r.user.userId} className="surface-solid p-6 md:p-8 no-break">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">User</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">{r.user.label}</div>
                <div className="text-sm text-slate-600 mt-1">{r.user.email}</div>
              </div>
              <div className="text-right">
                <div className="chip bg-indigo-50 border-indigo-200 text-indigo-700">{r.user.role}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">New Leads</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.newLeadsCount}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Leads Updated</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.leadsUpdated}</div>
              </div>
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Payments</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.paymentsCount}</div>
                <div className="text-[11px] text-emerald-700 mt-1">{formatCompactCurrency(r.paymentVolume)}</div>
              </div>
              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Calls</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.calls}</div>
              </div>
              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">WhatsApp</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.whatsapp}</div>
              </div>
              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Meetings</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.partnerMeetings}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Check-ins</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.checkins}</div>
              </div>
              <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Rejections</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.rejections}</div>
              </div>
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Attachments</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{r.attachmentsAdded}</div>
              </div>
              {mode === "eod" && (
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-soft">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Loose Ends</div>
                  <div className="mt-2 text-xs text-slate-200 flex flex-col gap-1">
                    <span>
                      Meetings pending update: <span className="font-extrabold">{r.pendingMeetings}</span>
                    </span>
                    <span>
                      EOD pending updates: <span className="font-extrabold">{r.pendingEod}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History size={16} className="text-indigo-600" /> Activity Timeline
                </div>
                <div className="chip bg-white/60">
                  {r.eventsTotal || r.events.length}
                  {r.eventsDropped ? ` (+${r.eventsDropped} capped)` : ""}
                </div>
              </div>

              {r.error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 font-bold">
                  Report generation failed for this staff: {r.error}
                </div>
              ) : null}

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/70">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-3 text-left w-[110px]">Time</th>
                      <th className="p-3 text-left w-[140px]">Type</th>
                      <th className="p-3 text-left w-[220px]">Subject</th>
                      <th className="p-3 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.error ? (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-slate-500">
                          Fix the error and try again.
                        </td>
                      </tr>
                    ) : r.events.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-slate-400 italic">
                          No activity recorded for this date.
                        </td>
                      </tr>
                    ) : (
                      r.events.slice(0, 220).map((e, idx) => (
                        <tr key={`${e.ts}-${idx}`} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs text-slate-500 whitespace-nowrap">{formatTimeIST(e.ts)}</td>
                          <td className="p-3">
                            <span className="chip">{e.label}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-800">{e.subject}</td>
                          <td className="p-3 text-slate-600">{e.detail}</td>
                        </tr>
                      ))
                    )}
                    {r.events.length > 220 && (
                      <tr>
                        <td colSpan="4" className="p-3 text-xs text-slate-500">
                          Showing first 220 events (PDF-friendly). Refine to a single staff to print the full day.
                          {r.eventsDropped ? ` (Report capped: ${r.eventsDropped} additional events not stored to keep mobile stable.)` : ""}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-slate-400 print:block hidden">
        <p>Generated by LIRAS v4.06 Enterprise</p>
        <p>Confidential • Internal Use</p>
      </div>
    </div>
  );
};

const isAashishPilotPartner = (name) => /aashish/i.test(String(name || ""));

const PARTNER_SIMPLE_STATUS_OPTIONS = [
  "Meeting Scheduled",
  "Partner Follow-Up",
  "Follow-Up Required",
  "Contact Details Not Received",
  "Statements Not Received",
  "Payment Done",
  "Not Eligible",
  "Not Interested (Temp)",
];

const PARTNER_NEXT_ACTION_REQUIRED = new Set([
  "Meeting Scheduled",
  "Partner Follow-Up",
  "Follow-Up Required",
  "Contact Details Not Received",
  "Statements Not Received",
]);

const PartnerSimpleStatusPortal = ({ mediator, leads, onUpdateLead, onLogout }) => {
  const [query, setQuery] = useState("");
  const [draftByLeadId, setDraftByLeadId] = useState({});

  const mappedLeads = useMemo(() => {
    const source = (leads || []).filter((l) => String(l?.mediatorId || "") === String(mediator?.id || ""));
    const q = String(query || "").trim().toLowerCase();
    const filtered = !q
      ? source
      : source.filter((l) => {
          const hay = `${l?.name || ""} ${l?.company || ""} ${l?.phone || ""}`.toLowerCase();
          return hay.includes(q);
        });
    return filtered
      .slice()
      .sort((a, b) => {
        const at = parseIsoOrNull(a?.nextFollowUp)?.getTime?.() || Number.MAX_SAFE_INTEGER;
        const bt = parseIsoOrNull(b?.nextFollowUp)?.getTime?.() || Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
  }, [leads, mediator?.id, query]);

  const openCount = useMemo(
    () => mappedLeads.filter((l) => !isClosedOrRejectedLeadStatus(l?.status)).length,
    [mappedLeads]
  );
  const paymentDoneCount = useMemo(
    () => mappedLeads.filter((l) => ["Payment Done", "Deal Closed"].includes(String(l?.status || ""))).length,
    [mappedLeads]
  );
  const rejectedCount = useMemo(
    () => mappedLeads.filter((l) => ["Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)", "Rejected"].includes(String(l?.status || ""))).length,
    [mappedLeads]
  );

  const getDraft = (lead) => {
    const fallbackDate = lead?.nextFollowUp ? toYmdIST(lead.nextFollowUp) : toYmdIST(new Date(Date.now() + 86400000));
    const fallbackTime = lead?.nextFollowUp ? formatTimeIST(lead.nextFollowUp) : "10:00";
    return (
      draftByLeadId[lead.id] || {
        status: String(lead?.status || "Partner Follow-Up"),
        note: "",
        nextDate: fallbackDate,
        nextTime: fallbackTime || "10:00",
      }
    );
  };

  const updateDraft = (leadId, patch) => {
    setDraftByLeadId((prev) => {
      const current = prev[leadId] || {};
      return { ...prev, [leadId]: { ...current, ...patch } };
    });
  };

  const submitUpdate = (lead) => {
    const draft = getDraft(lead);
    const nextStatus = String(draft.status || lead?.status || "Partner Follow-Up").trim();
    const nowIso = new Date().toISOString();
    const noteLine = String(draft.note || "").trim();
    const noteText = noteLine
      ? `[PARTNER UPDATE]: ${noteLine}`
      : `[PARTNER UPDATE]: Status updated to ${nextStatus}.`;
    const nextNotes = [...(Array.isArray(lead?.notes) ? lead.notes : []), { text: noteText, date: nowIso }];

    const patch = { status: nextStatus, notes: nextNotes };
    if (PARTNER_NEXT_ACTION_REQUIRED.has(nextStatus)) {
      const ymd = String(draft.nextDate || "").trim() || toYmdIST(new Date(Date.now() + 86400000));
      const hm = String(draft.nextTime || "").trim() || "10:00";
      patch.nextFollowUp = `${ymd}T${hm}:00+05:30`;
    }
    onUpdateLead?.(lead.id, patch);
    updateDraft(lead.id, { note: "" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="surface p-4 md:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">Partner Portal</div>
              <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Client Status Board</div>
              <div className="text-sm text-slate-600 mt-1">
                {mediator?.name || "Partner"} • mapped clients only
              </div>
            </div>
            {onLogout ? (
              <button type="button" className="btn-secondary px-4 py-2" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Open</div>
              <div className="text-xl font-extrabold text-slate-900">{openCount}</div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-700">Payment Done</div>
              <div className="text-xl font-extrabold text-indigo-900">{paymentDoneCount}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-rose-700">Rejected</div>
              <div className="text-xl font-extrabold text-rose-900">{rejectedCount}</div>
            </div>
          </div>

          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client / company / phone"
              className="w-full py-3"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {mappedLeads.length === 0 ? (
            <div className="surface p-5 text-sm text-slate-500 italic">No mapped clients found.</div>
          ) : (
            mappedLeads.map((lead) => {
              const draft = getDraft(lead);
              const statusColor = STATUS_CONFIG[lead?.status]?.color || "bg-slate-100 text-slate-700";
              return (
                <div key={lead.id} className="surface p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold text-slate-900 truncate">{lead?.name || "—"}</div>
                      <div className="text-sm text-slate-600 truncate">{lead?.company || "No company"}</div>
                      <div className="text-xs text-slate-500 mt-1">{lead?.phone || "No phone"}</div>
                    </div>
                    <div className={`text-[11px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${statusColor}`}>
                      {lead?.status || "New"}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 mt-2">
                    Next action:{" "}
                    <span className="font-bold text-slate-700">
                      {lead?.nextFollowUp
                        ? `${toYmdIST(lead.nextFollowUp)}${formatTimeIST(lead.nextFollowUp) ? ` • ${formatTimeIST(lead.nextFollowUp)}` : ""}`
                        : "Not scheduled"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-3">
                    <div className="md:col-span-4">
                      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-1">Status</label>
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft(lead.id, { status: e.target.value })}
                        className="w-full py-2"
                      >
                        {PARTNER_SIMPLE_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-1">Next Date</label>
                      <input
                        type="date"
                        value={draft.nextDate}
                        onChange={(e) => updateDraft(lead.id, { nextDate: e.target.value })}
                        className="w-full py-2"
                        disabled={!PARTNER_NEXT_ACTION_REQUIRED.has(draft.status)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-1">Time</label>
                      <input
                        type="time"
                        value={draft.nextTime}
                        onChange={(e) => updateDraft(lead.id, { nextTime: e.target.value })}
                        className="w-full py-2"
                        disabled={!PARTNER_NEXT_ACTION_REQUIRED.has(draft.status)}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-1">Note</label>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) => updateDraft(lead.id, { note: e.target.value })}
                        className="w-full py-2"
                        placeholder="Short update"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button type="button" className="btn-primary px-4 py-2" onClick={() => submitUpdate(lead)}>
                      Save Update
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const MediatorQuickUpdateView = ({ mediator, leads, onBack, onUpdateLead, onOpenLead }) => {
  const [activeTab, setActiveTab] = useState("today");
  const rejectedStatuses = useMemo(() => new Set(["Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)", "Rejected"]), []);
  const paymentStatuses = useMemo(() => new Set(["Payment Done", "Deal Closed"]), []);

  const partnerLeads = useMemo(() => {
    return (leads || []).filter((l) => l && String(l.mediatorId || "") === String(mediator?.id || ""));
  }, [leads, mediator?.id]);

  const openLeads = useMemo(() => partnerLeads.filter((l) => !isClosedOrRejectedLeadStatus(l?.status)), [partnerLeads]);
  const rejectedLeads = useMemo(
    () => partnerLeads.filter((l) => rejectedStatuses.has(String(l?.status || "").trim()) && !paymentStatuses.has(String(l?.status || "").trim())),
    [partnerLeads, rejectedStatuses, paymentStatuses]
  );
  const paymentDoneLeads = useMemo(
    () => partnerLeads.filter((l) => paymentStatuses.has(String(l?.status || "").trim())),
    [partnerLeads, paymentStatuses]
  );

  const openVolume = useMemo(() => openLeads.reduce((sum, l) => sum + (Number(l?.loanAmount) || 0), 0), [openLeads]);
  const paymentVolume = useMemo(() => paymentDoneLeads.reduce((sum, l) => sum + (Number(l?.loanAmount) || 0), 0), [paymentDoneLeads]);

  const todayLeads = useMemo(() => openLeads.filter((l) => isTodayIST(l?.nextFollowUp)), [openLeads]);
  const overdueLeads = useMemo(
    () => openLeads.filter((l) => getDaysDiff(l?.nextFollowUp) < 0 && !isTodayIST(l?.nextFollowUp)),
    [openLeads]
  );
  const upcomingLeads = useMemo(() => openLeads.filter((l) => getDaysDiff(l?.nextFollowUp) > 0), [openLeads]);

  const queueList = activeTab === "overdue" ? overdueLeads : activeTab === "upcoming" ? upcomingLeads : todayLeads;

  const monthlyPerformance = useMemo(() => {
    const anchor = new Date(`${toYmIST(new Date())}-01T00:00:00+05:30`);
    const keys = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(anchor.getTime());
      d.setMonth(d.getMonth() - i);
      keys.push(toYmIST(d));
    }
    return keys.map((ym) => {
      const newClients = partnerLeads.filter((l) => toYmIST(l?.createdAt) === ym).length;
      const doneRows = paymentDoneLeads.filter((l) => toYmIST(getLeadLastActivityIso(l)) === ym);
      const rejectedRows = rejectedLeads.filter((l) => toYmIST(getLeadLastActivityIso(l)) === ym);
      const doneVolume = doneRows.reduce((sum, l) => sum + (Number(l?.loanAmount) || 0), 0);
      return {
        ym,
        newClients,
        paymentDone: doneRows.length,
        rejected: rejectedRows.length,
        doneVolume,
      };
    });
  }, [partnerLeads, paymentDoneLeads, rejectedLeads]);

  const appendNote = (lead, text, patch = {}) => {
    if (!lead?.id) return;
    const nowIso = new Date().toISOString();
    const nextNotes = [...(Array.isArray(lead.notes) ? lead.notes : []), { text, date: nowIso }];
    onUpdateLead(lead.id, { ...patch, notes: nextNotes });
  };

  const onMarkContactUpdated = (lead) => {
    const currentPhone = String(lead?.phone || "").trim();
    let nextPhone = currentPhone;
    if (!nextPhone) {
      const entered = prompt("Enter updated client phone number:", "");
      if (!entered) return;
      nextPhone = String(entered).replace(/[^\d+]/g, "").trim();
      if (!nextPhone) return;
    }
    appendNote(lead, `[PARTNER UPDATE]: Contact details updated${nextPhone ? ` (${nextPhone})` : ""}.`, {
      phone: nextPhone,
      status: "Partner Follow-Up",
    });
  };

  const onMarkStatementShared = (lead) => {
    appendNote(lead, "[PARTNER UPDATE]: Statement shared and sent for internal processing.", {
      status: "Follow-Up Required",
    });
  };

  const onMeetingDone = (lead) => {
    const nextActionIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    appendNote(lead, "[PARTNER UPDATE]: Meeting completed.", {
      status: "Follow-Up Required",
      nextFollowUp: nextActionIso,
    });
  };

  const onReschedule = (lead) => {
    const ymd = prompt("Reschedule date (YYYY-MM-DD):", toYmdIST(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    if (!ymd) return;
    const hm = prompt("Time (HH:MM, 24h):", "10:00");
    if (!hm) return;
    const iso = `${ymd}T${hm}:00+05:30`;
    appendNote(lead, `[PARTNER UPDATE]: Meeting rescheduled to ${ymd} ${hm} IST.`, {
      status: "Meeting Scheduled",
      nextFollowUp: iso,
    });
  };

  const onNotInterested = (lead) => {
    const reason = prompt("Reason from client (short):", "") || "Client not interested currently.";
    appendNote(lead, `[PARTNER UPDATE]: Not interested. ${reason}`, {
      status: "Not Interested (Temp)",
    });
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden animate-fade-in">
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onBack} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">Partner Workspace</div>
              <div className="text-lg md:text-2xl font-extrabold text-slate-900 truncate">Sunrays 🤝 Jubilant</div>
              <div className="text-xs text-slate-500">{mediator?.name || "Aashish"} • {mediator?.phone || "No phone number"}</div>
            </div>
          </div>
          <div className="chip bg-slate-100 border-slate-200 text-slate-700">{partnerLeads.length} total clients</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`rounded-xl border px-3 py-2 text-left ${activeTab === "today" ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Today</div>
            <div className="text-xl font-extrabold text-slate-900">{todayLeads.length}</div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={`rounded-xl border px-3 py-2 text-left ${activeTab === "overdue" ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Overdue</div>
            <div className="text-xl font-extrabold text-rose-700">{overdueLeads.length}</div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`rounded-xl border px-3 py-2 text-left ${activeTab === "upcoming" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Upcoming</div>
            <div className="text-xl font-extrabold text-indigo-700">{upcomingLeads.length}</div>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-700">Open</div>
            <div className="text-xl font-extrabold text-emerald-900">{openLeads.length}</div>
            <div className="text-xs text-emerald-700 mt-0.5">Volume {formatCurrency(openVolume)}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-rose-700">Rejected</div>
            <div className="text-xl font-extrabold text-rose-900">{rejectedLeads.length}</div>
            <div className="text-xs text-rose-700 mt-0.5">Closed out of pipeline</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-700">Payment Done</div>
            <div className="text-xl font-extrabold text-indigo-900">{paymentDoneLeads.length}</div>
            <div className="text-xs text-indigo-700 mt-0.5">Total {formatCurrency(paymentVolume)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-slate-900">Open Queue</div>
            <div className="text-xs text-slate-500">One-tap updates</div>
          </div>
          {queueList.length === 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 italic">No leads in this queue.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {queueList
                .slice()
                .sort((a, b) => {
                  const at = parseIsoOrNull(a?.nextFollowUp)?.getTime?.() || Number.MAX_SAFE_INTEGER;
                  const bt = parseIsoOrNull(b?.nextFollowUp)?.getTime?.() || Number.MAX_SAFE_INTEGER;
                  return at - bt;
                })
                .map((lead) => {
                  const leadNotes = Array.isArray(lead?.notes) ? lead.notes : [];
                  const lastNote = leadNotes[leadNotes.length - 1]?.text || "";
                  const nextActionLabel = lead?.nextFollowUp
                    ? `${toYmdIST(lead.nextFollowUp)}${formatTimeIST(lead.nextFollowUp) ? ` • ${formatTimeIST(lead.nextFollowUp)}` : ""}`
                    : "Not scheduled";
                  return (
                    <div key={lead.id} className="surface p-4 border border-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenLead?.(lead)}
                          className="text-left min-w-0 flex-1"
                        >
                          <div className="text-lg font-extrabold text-slate-900 truncate">{lead?.name || "—"}</div>
                          <div className="text-sm text-slate-500 truncate">{lead?.company || "No company"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_CONFIG[lead?.status]?.color || "bg-slate-100 text-slate-700"}`}>
                              {lead?.status || "New"}
                            </span>
                            <span className="text-[11px] text-slate-600">Next: {nextActionLabel}</span>
                          </div>
                        </button>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-500">Amount</div>
                          <div className="text-base font-extrabold text-slate-900">{formatCurrency(lead?.loanAmount || 0)}</div>
                        </div>
                      </div>
                      {lastNote ? (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 line-clamp-2">
                          {lastNote}
                        </div>
                      ) : null}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                        <button type="button" onClick={() => onMarkContactUpdated(lead)} className="btn-secondary px-3 py-2 text-xs font-bold">
                          Contact Updated
                        </button>
                        <button type="button" onClick={() => onMarkStatementShared(lead)} className="btn-secondary px-3 py-2 text-xs font-bold">
                          Statement Shared
                        </button>
                        <button type="button" onClick={() => onMeetingDone(lead)} className="btn-secondary px-3 py-2 text-xs font-bold">
                          Meeting Done
                        </button>
                        <button type="button" onClick={() => onReschedule(lead)} className="btn-secondary px-3 py-2 text-xs font-bold">
                          Reschedule
                        </button>
                        <button type="button" onClick={() => onNotInterested(lead)} className="btn-secondary px-3 py-2 text-xs font-bold text-rose-700 border-rose-200">
                          Not Interested
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-slate-900">Monthly Performance</div>
            <div className="text-xs text-slate-500">No interest-rate details shown</div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                <tr>
                  <th className="p-3 text-left">Month</th>
                  <th className="p-3 text-right">New</th>
                  <th className="p-3 text-right">Payment Done</th>
                  <th className="p-3 text-right">Rejected</th>
                  <th className="p-3 text-right">Payment Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyPerformance.map((row) => (
                  <tr key={row.ym}>
                    <td className="p-3 font-bold text-slate-900">{monthKeyLabel(row.ym)}</td>
                    <td className="p-3 text-right text-slate-700">{row.newClients}</td>
                    <td className="p-3 text-right text-indigo-700 font-bold">{row.paymentDone}</td>
                    <td className="p-3 text-right text-rose-700 font-bold">{row.rejected}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(row.doneVolume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="surface p-4">
            <div className="text-sm font-extrabold text-slate-900">Open Clients</div>
            <div className="mt-3 space-y-2">
              {openLeads.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No open clients.</div>
              ) : (
                openLeads.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))).map((lead) => (
                  <button key={lead.id} type="button" onClick={() => onOpenLead?.(lead)} className="w-full text-left rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="font-bold text-slate-900 truncate">{lead?.name || "—"}</div>
                    <div className="text-xs text-slate-500 truncate">{lead?.company || "No company"}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="surface p-4">
            <div className="text-sm font-extrabold text-slate-900">Rejected Clients</div>
            <div className="mt-3 space-y-2">
              {rejectedLeads.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No rejected clients.</div>
              ) : (
                rejectedLeads.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))).map((lead) => (
                  <button key={lead.id} type="button" onClick={() => onOpenLead?.(lead)} className="w-full text-left rounded-lg border border-rose-200 bg-rose-50/50 p-3 hover:bg-rose-50">
                    <div className="font-bold text-slate-900 truncate">{lead?.name || "—"}</div>
                    <div className="text-xs text-rose-700 truncate">{lead?.status || "Rejected"}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="surface p-4">
            <div className="text-sm font-extrabold text-slate-900">Payment Done Clients</div>
            <div className="mt-3 space-y-2">
              {paymentDoneLeads.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No payment done clients.</div>
              ) : (
                paymentDoneLeads.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))).map((lead) => (
                  <button key={lead.id} type="button" onClick={() => onOpenLead?.(lead)} className="w-full text-left rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 hover:bg-indigo-50">
                    <div className="font-bold text-slate-900 truncate">{lead?.name || "—"}</div>
                    <div className="text-xs text-indigo-700 flex items-center justify-between gap-2">
                      <span>{lead?.status || "Payment Done"}</span>
                      <span className="font-bold">{formatCurrency(lead?.loanAmount || 0)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MediatorProfile = ({
  mediator,
  leads,
  onBack,
  onReport,
  onUpdateReport,
  onRejectionReport,
  onEdit,
  onDelete,
  onPendingReport,
  onFollowUp,
  onOpenQuickUpdate,
}) => {
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const mLeads = leads.filter((l) => l.mediatorId === mediator.id);
  const isPilotPartner = useMemo(() => isAashishPilotPartner(mediator?.name), [mediator?.name]);

  const metrics = useMemo(() => {
    let totalTAT = 0;
    let acts = 0;
    let slow = 0;
    let vol = 0;
    let closed = 0;
    let rej = 0;
    mLeads.forEach((l) => {
      if (["Payment Done", "Deal Closed"].includes(l.status)) {
        closed += 1;
        vol += parseInt(l.loanAmount) || 0;
      }
      if (["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status)) rej += 1;
      const tat = calculateTAT(l);
      if (tat !== null) {
        totalTAT += tat;
        acts += 1;
        if (tat > 24) slow += 1;
      }
    });
    return {
      avgTAT: acts ? Math.round(totalTAT / acts) : 0,
      slow,
      vol,
      closed,
      rej,
      total: mLeads.length,
      conversion: mLeads.length ? Math.round((closed / mLeads.length) * 100) : 0,
    };
  }, [mLeads]);

  const rejectionBreakdown = useMemo(() => {
    const breakdown = {};
    mLeads.forEach((l) => {
      if (["Not Eligible", "Not Reliable", "Lost to Competitor"].includes(l.status)) {
        const reasonNote = (l.notes || []).find((n) => n.text.includes("[REJECTION REASON]"));
        const reason = reasonNote ? reasonNote.text.split("]:")[1]?.trim() : "Unspecified";
        breakdown[reason] = (breakdown[reason] || 0) + 1;
      }
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  }, [mLeads]);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden animate-fade-in">
      <div className="bg-white border-b px-6 py-4 shadow-sm z-10 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{mediator.name}</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Phone size={12} />
                {mediator.phone}
              </p>
            </div>
          </div>

          <div className="flex gap-2 relative">
            <button
              onClick={() => {
                if (!mediator.phone) {
                  alert("No phone number for this mediator.");
                  return;
                }
                const startedAt = new Date().toISOString();
                onFollowUp?.(mediator.id, "call", { ts: startedAt });
                try {
                  localStorage.setItem(
                    "liras_pending_call_v1",
                    JSON.stringify({
                      kind: "mediator",
                      mediatorId: mediator.id,
                      phone: mediator.phone,
                      startedAt,
                      ts: startedAt,
                    })
                  );
                } catch {
                  // ignore
                }
                window.location.href = `tel:${String(mediator.phone).replace(/[^\d+]/g, "")}`;
              }}
              className={`btn-secondary px-4 py-2 ${mediator.phone ? "" : "opacity-60 cursor-not-allowed"}`}
              title={mediator.phone ? "Call + auto-log" : "No phone number"}
              type="button"
            >
              <Phone size={16} className="text-slate-700" />
              <span className="hidden sm:inline">Call</span>
            </button>
            {isPilotPartner && (
              <>
                <button
                  onClick={() => onOpenQuickUpdate?.(mediator.id)}
                  className="btn-secondary px-4 py-2"
                  type="button"
                  title="Open one-touch mobile-friendly partner board"
                >
                  <Layout size={16} className="text-slate-700" />
                  <span className="hidden sm:inline">One-Touch Mode</span>
                </button>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}${window.location.pathname}?mode=mediator-lite&mid=${encodeURIComponent(String(mediator.id || ""))}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      alert("Partner one-touch link copied.");
                    } catch {
                      alert(url);
                    }
                  }}
                  className="btn-secondary px-4 py-2"
                  type="button"
                  title="Copy direct link to one-touch partner board"
                >
                  <LinkIcon size={16} className="text-slate-700" />
                  <span className="hidden sm:inline">Copy Link</span>
                </button>
              </>
            )}
            <button
              onClick={() => setShowReportMenu(!showReportMenu)}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all"
            >
              <FileText size={16} /> Generate Report <ChevronRight size={14} className={`transition-transform ${showReportMenu ? "rotate-90" : ""}`} />
            </button>
            {showReportMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in flex flex-col gap-1">
                <button
                  onClick={() => {
                    onPendingReport(mediator.id);
                    setShowReportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-yellow-50 hover:text-yellow-700 rounded-lg flex items-center gap-2 font-medium"
                >
                  <ClipboardList size={16} /> Status / Pending
                </button>
                <button
                  onClick={() => {
                    onUpdateReport(mediator.id);
                    setShowReportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg flex items-center gap-2 font-medium"
                >
                  <FileCheck size={16} /> Daily Briefing
                </button>
                <button
                  onClick={() => {
                    onRejectionReport(mediator.id);
                    setShowReportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-2 font-medium"
                >
                  <XCircle size={16} /> Rejection Audit
                </button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button
                  onClick={() => {
                    onReport(mediator.id);
                    setShowReportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2 font-bold"
                >
                  <PieChart size={16} /> Full Analysis
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 border-b border-slate-100 text-sm font-medium text-slate-500">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors ${activeTab === "overview" ? "border-slate-900 text-slate-900" : "border-transparent hover:text-slate-700"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 border-b-2 transition-colors ${activeTab === "history" ? "border-slate-900 text-slate-900" : "border-transparent hover:text-slate-700"}`}
          >
            History & Logs
          </button>
          <button onClick={() => onEdit(mediator)} className="pb-3 border-b-2 border-transparent hover:text-slate-700 ml-auto flex items-center gap-1">
            <Edit2 size={12} /> Edit Details
          </button>
          <button onClick={() => onDelete(mediator.id)} className="pb-3 border-b-2 border-transparent hover:text-red-700 text-red-500 flex items-center gap-1">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {activeTab === "overview" ? (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard title="Conversion Rate" value={`${metrics.conversion}%`} icon={Target} color="bg-blue-500" />
              <StatCard title="Total Volume" value={formatCurrency(metrics.vol)} icon={DollarSign} color="bg-green-500" />
              <StatCard title="Active Pipeline" value={metrics.total - metrics.closed - metrics.rej} icon={Activity} color="bg-purple-500" />
              <StatCard title="Total Closures" value={metrics.closed} icon={CheckCircle} color="bg-emerald-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <XCircle className="text-red-500" /> Missed Opportunities
                </h3>
                <div className="space-y-3">
                  {rejectionBreakdown.length > 0 ? (
                    rejectionBreakdown.map(([reason, count]) => (
                      <div key={reason} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                        <span className="text-slate-600">{reason}</span>
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 rounded">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-sm">No rejections recorded yet.</div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <History className="text-slate-500" /> Activity Snapshot
                </h3>
                <div className="text-sm text-slate-600">Total Leads: {metrics.total}</div>
                <div className="text-sm text-slate-600 mt-1">Avg TAT: {metrics.avgTAT}h</div>
                <div className="text-sm text-slate-600 mt-1">Slow Actions (&gt;24h): {metrics.slow}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b font-bold text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mLeads
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{l.name}</div>
                        <div className="text-xs text-slate-500">{l.company}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_CONFIG[l.status]?.color}`}>{l.status}</span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 max-w-xs truncate">{l.notes?.[l.notes.length - 1]?.text}</td>
                    </tr>
                  ))}
                {mLeads.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                      No history for this mediator yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Lead/Report Components (from original app) ---

const formatOverdueMinutesShort = (mins) => {
  const value = Number(mins);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 60) return `${Math.round(value)}m`;
  if (value < 1440) return `${Math.round(value / 60)}h`;
  return `${Math.round(value / 1440)}d`;
};

const normalizeLeadAutomationIndicators = (lead, automation) => {
  const closedStatuses = new Set(["Deal Closed", "Payment Done", "Not Eligible", "Not Reliable", "Lost to Competitor"]);
  const docs = lead?.documents || {};
  const fallbackDocsMissing = ["kyc", "itr", "bank"].filter((k) => !docs?.[k]).map((k) => k.toUpperCase());
  const docsMissingRaw = automation?.docs_missing;
  const docsMissing = Array.isArray(docsMissingRaw)
    ? docsMissingRaw.map((d) => String(d || "").trim().toUpperCase()).filter(Boolean)
    : fallbackDocsMissing;

  const overdueByMinutes = Number(automation?.overdue_by_minutes || 0);
  const slaStatus = String(automation?.sla_status || "").trim().toUpperCase();
  const localDaysDiff = getDaysDiff(lead?.nextFollowUp);
  const localIsOverdue = localDaysDiff < 0 && !closedStatuses.has(String(lead?.status || ""));
  const slaOverdue = slaStatus === "OVERDUE" || overdueByMinutes > 0 || localIsOverdue;
  const overdueLabel = overdueByMinutes > 0 ? formatOverdueMinutesShort(overdueByMinutes) : localIsOverdue ? `${Math.abs(localDaysDiff)}d` : "";

  let nextBestAction = String(automation?.next_best_action || "").trim();
  let nextBestReason = String(automation?.next_best_reason || "").trim();
  if (!nextBestAction) {
    if (docsMissing.length > 0) {
      nextBestAction = "Collect Docs";
      nextBestReason = docsMissing.slice(0, 2).join(", ");
    } else if (String(lead?.status || "") === "New") {
      nextBestAction = "First Call";
      nextBestReason = "New lead";
    } else if (localIsOverdue) {
      nextBestAction = "Follow Up";
      nextBestReason = "Overdue next action";
    } else {
      nextBestAction = "Update Lead";
      nextBestReason = "Log latest activity";
    }
  }

  return {
    slaStatus,
    slaOverdue,
    overdueByMinutes,
    overdueLabel,
    duplicateAlertCount: Math.max(0, Number(automation?.duplicate_alert_count || 0)),
    nextBestAction,
    nextBestReason,
    priorityLabel: String(automation?.priority_label || "").trim(),
    openTaskCount: Math.max(0, Number(automation?.open_task_count || 0)),
    overdueTaskCount: Math.max(0, Number(automation?.overdue_task_count || 0)),
    docsMissing,
  };
};

const LeadCard = ({ lead, onClick, mediators, onUpdateLead, automation = null }) => {
  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.New;
  const score = calculateLeadScore(lead);
  const daysDiff = getDaysDiff(lead.nextFollowUp);
  const isOverdue = daysDiff < 0 && !["Deal Closed", "Payment Done", "Not Eligible", "Not Reliable"].includes(lead.status);
  const mediator = mediators.find((m) => m.id === lead.mediatorId);
  const isActive = !["Deal Closed", "Payment Done", "Not Eligible", "Not Reliable"].includes(lead.status);
  const tags = Array.isArray(lead.documents?.tags) ? lead.documents.tags : [];
  const auto = normalizeLeadAutomationIndicators(lead, automation);

  const logNote = (text) => {
    if (!lead?.id) return;
    if (typeof onUpdateLead !== "function") return;
    const nowIso = new Date().toISOString();
    onUpdateLead(lead.id, { notes: [...(lead.notes || []), { text, date: nowIso }] });
  };

  return (
    <div
      onClick={() => onClick(lead)}
      className={`surface p-4 cursor-pointer flex flex-col relative overflow-hidden transition-all hover:shadow-elevated hover:ring-1 hover:ring-indigo-200 group ${
        isOverdue ? "border-red-200/80" : ""
      }`}
    >
      {isOverdue && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-500 to-rose-500"></div>}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-900 truncate group-hover:text-indigo-700">{lead.name}</h3>
            {lead.isHighPotential && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            {lead.company && (
              <span className="font-medium flex items-center gap-1">
                <Briefcase size={10} /> {lead.company}
              </span>
            )}
            <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              <Users size={10} /> {mediator?.name || "Unknown"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {lead.status === "Payment Done" ? (
              <span className="text-[10px] flex items-center gap-1 font-bold text-emerald-700">
                <DollarSign size={10} /> {formatCurrency(lead.loanDetails?.netDisbursed || lead.loanAmount)}
              </span>
            ) : (
              <span className={`text-[10px] flex items-center gap-1 font-medium ${isOverdue ? "text-red-600" : "text-slate-400"}`}>
                <Clock size={10} /> {isOverdue ? `Overdue ${Math.abs(daysDiff)} days` : formatDate(lead.nextFollowUp)}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              {tags.length > 3 && <span className="chip">+{tags.length - 3}</span>}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {auto.slaOverdue ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-rose-100 text-rose-700 border border-rose-200">
                SLA Overdue{auto.overdueLabel ? ` • ${auto.overdueLabel}` : ""}
              </span>
            ) : auto.slaStatus ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                SLA {auto.slaStatus}
              </span>
            ) : null}
            {auto.nextBestAction ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 max-w-full truncate">
                Next: {auto.nextBestAction}
              </span>
            ) : null}
            {auto.duplicateAlertCount > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Duplicates: {auto.duplicateAlertCount}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 pl-2 border-l border-slate-100">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${getScoreColor(score)}`}>
            {score}
          </div>
          <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
        </div>
      </div>
      {isActive && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
          <a
            href={lead.phone ? `https://wa.me/${lead.phone}?text=${encodeURIComponent(`Hello ${lead.name}, regarding your loan requirement: Any updates for us today?`)}` : "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              if (!lead.phone) alert("No phone number for this client");
              if (lead.phone) logNote("[WHATSAPP]: Opened client chat");
            }}
            className={`flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs py-1.5 rounded-xl flex items-center justify-center gap-1 transition-colors font-medium border border-emerald-200 ${
              !lead.phone && "opacity-50 cursor-not-allowed"
            }`}
          >
            <MessageCircle size={12} /> Ask Client
          </a>
          {mediator && mediator.phone && (
            <a
              href={`https://wa.me/${mediator.phone}?text=${encodeURIComponent(`Hello ${mediator.name}, regarding your client ${lead.name}: Is there any update on the requirement today?`)}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                logNote(`[WHATSAPP]: Opened partner chat (${mediator.name})`);
              }}
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs py-1.5 rounded-xl flex items-center justify-center gap-1 transition-colors font-medium border border-indigo-200"
            >
              <Users size={12} /> Ask Partner
            </a>
          )}
        </div>
      )}
    </div>
  );
};

const NewLeadTriageCard = ({ lead, onUpdate, onPaymentDone }) => {
  const handleAction = (action) => {
    let status = "New";
    let nextFollowUp = new Date(Date.now() + 86400000).toISOString();
    let noteText = "";

    if (action === "meeting") {
      status = "Meeting Scheduled";
      const date = prompt(
        "Enter Meeting Date (YYYY-MM-DD HH:MM):",
        new Date().toISOString().slice(0, 16).replace("T", " ")
      );
      if (date) nextFollowUp = new Date(date).toISOString();
      noteText = "Meeting Scheduled";
    } else if (action === "internal_fu") {
      status = "Follow-Up Required";
      noteText = prompt("What is the internal update/remark?");
    } else if (action === "partner_fu") {
      status = "Partner Follow-Up";
      noteText = prompt("What specific update do we need from the partner?");
    } else if (action === "interest") {
      status = "Interest Rate Issue";
      noteText = "Client has interest rate issues.";
    } else if (action === "no_appt") {
      status = "No Appointment";
      noteText = "Could not get appointment.";
    } else if (action === "lost") {
      status = "Not Interested (Temp)";
      noteText = "Client obtained finance elsewhere.";
      nextFollowUp = new Date(Date.now() + 60 * 86400000).toISOString();
    } else if (action === "rejected") {
      status = "Not Eligible";
      const reason = prompt("Rejection Reason:");
      noteText = `[REJECTION REASON]: ${reason || "Not specified"}`;
      nextFollowUp = new Date(Date.now() + 365 * 86400000).toISOString();
    } else if (action === "commercial") {
      status = "Commercial Client";
      noteText = "Lead marked as Commercial Client. Field visit pending.";
    } else if (action === "assign_staff") {
      const staffName = prompt("Enter Staff Name for assignment:");
      if (staffName) {
        const newStatus = lead.status === "New" ? "Follow-Up Required" : lead.status;
        onUpdate(lead.id, {
          assignedStaff: staffName,
          status: newStatus,
          notes: [...(lead.notes || []), { text: `[STAFF ASSIGNED]: Assigned to ${staffName} for visit/funding.`, date: new Date().toISOString() }],
        });
      }
      return;
    } else if (action === "payment_done") {
      if (typeof onPaymentDone === "function") {
        onPaymentDone(lead);
        return;
      }
      // Fallback: previous quick-mark behavior (no terms). Prefer using onPaymentDone to capture terms.
      onUpdate(lead.id, { status: "Payment Done" });
      return;
    }

    if (status !== "New" && noteText !== null) {
      onUpdate(lead.id, {
        status,
        nextFollowUp,
        notes: [...(lead.notes || []), { text: `[Triage]: ${noteText || "Status updated"}`, date: new Date().toISOString() }],
      });
    }
  };

  return (
    <div className="surface border-l-4 border-indigo-500 p-5 mb-4 animate-fade-in relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 opacity-70" />
      <div className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full border border-indigo-200">
        ACTION REQUIRED
      </div>
      <div className="flex justify-between items-start mb-4 pr-16">
        <div>
          <h3 className="font-bold text-lg text-slate-800">{lead.name}</h3>
          <div className="text-sm text-slate-500 flex gap-2">
            <span>{lead.company}</span>
            <span>•</span>
            <span className="font-mono text-slate-700">{formatCurrency(lead.loanAmount)}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          onClick={() => handleAction("meeting")}
          className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Calendar size={14} /> Meeting
        </button>
        <button
          onClick={() => handleAction("internal_fu")}
          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Clock size={14} /> Follow-Up
        </button>
        <button
          onClick={() => handleAction("partner_fu")}
          className="p-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Users size={14} /> Partner FU
        </button>
        <button
          onClick={() => handleAction("assign_staff")}
          className="p-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <UserPlus size={14} /> Assign Staff
        </button>
        <button
          onClick={() => handleAction("commercial")}
          className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Briefcase size={14} /> Commercial
        </button>
        <button
          onClick={() => handleAction("interest")}
          className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <HelpCircle size={14} /> Rate Issue
        </button>
        <button
          onClick={() => handleAction("no_appt")}
          className="p-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Ban size={14} /> No Appt
        </button>
        <button
          onClick={() => handleAction("payment_done")}
          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <DollarSign size={14} /> Payment Done
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={() => handleAction("lost")}
          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <XCircle size={14} /> Not Interested
        </button>
        <button
          onClick={() => handleAction("rejected")}
          className="p-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <Ban size={14} /> Reject
        </button>
      </div>
    </div>
  );
};

const LoanDetailsEditor = ({ lead, onUpdate }) => {
  const storedPrincipal = Number(lead.loanDetails?.principal ?? lead.loanAmount ?? 0);
  const storedInterest = Number(lead.loanDetails?.interest ?? 0);
  const storedNet = lead.loanDetails?.netDisbursed;
  // Backward compatible default:
  // - old logic stored principal=given and netDisbursed=principal-interest (smaller than principal)
  // - new logic stores principal=(given+interest) and netDisbursed=principal
  const initialGiven =
    storedNet != null && Number(storedNet) >= 0 && Number(storedNet) < storedPrincipal
      ? storedPrincipal
      : Math.max(0, storedPrincipal - storedInterest);

  const [givenAmount, setGivenAmount] = useState(initialGiven);
  const [interest, setInterest] = useState(storedInterest);
  const [tenure, setTenure] = useState(lead.loanDetails?.tenure || 1);
  const [frequency, setFrequency] = useState(lead.loanDetails?.frequency || "Monthly");

  const computedPrincipal = (Number(givenAmount) || 0) + (Number(interest) || 0);
  const netCashOut = computedPrincipal;

  useEffect(() => {
    const current = lead.loanDetails || {};
    const changed =
      computedPrincipal !== Number(current.principal ?? 0) ||
      Number(interest) !== Number(current.interest ?? 0) ||
      tenure !== current.tenure ||
      frequency !== current.frequency ||
      netCashOut !== Number(current.netDisbursed ?? 0);
    if (!changed) return;
    onUpdate({
      loanDetails: {
        ...current,
        principal: computedPrincipal,
        interest: Number(interest) || 0,
        // Business rule: Net Cash Out is Principal (= Given + Upfront interest)
        netDisbursed: netCashOut,
        tenure,
        frequency,
        paymentDate: current.paymentDate || new Date().toISOString(),
      },
      loanAmount: computedPrincipal,
    });
  }, [givenAmount, interest, tenure, frequency]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="surface p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-3 border-b border-slate-200/60 pb-2">
        <h4 className="font-extrabold text-slate-900 flex items-center gap-2">
          <Banknote size={18} className="text-emerald-600" /> Finance Details
        </h4>
        <span className="chip bg-emerald-50 border-emerald-200 text-emerald-700">Auto-saving</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Given Amount (₹)</label>
          <input
            type="number"
            value={givenAmount}
            onChange={(e) => setGivenAmount(Number(e.target.value))}
            className="w-full py-2 font-bold"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Upfront Interest (₹)</label>
          <input
            type="number"
            value={interest}
            onChange={(e) => setInterest(Number(e.target.value))}
            className="w-full py-2 font-bold text-red-600"
          />
        </div>

        <div className="col-span-2 bg-white/70 p-3 rounded-xl border border-slate-200/70 flex justify-between items-center shadow-sm">
          <span className="text-sm font-bold text-slate-500">Net Cash Out (Principal):</span>
          <span className="text-xl font-extrabold text-emerald-700 font-mono">{formatCurrency(netCashOut)}</span>
        </div>
        <div className="col-span-2 text-xs text-slate-500 font-bold -mt-2">
          Principal is saved as: Given + Upfront Interest = {formatCurrency(computedPrincipal)}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Tenure</label>
          <select value={tenure} onChange={(e) => setTenure(Number(e.target.value))} className="w-full py-2 font-medium">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {m} Months
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full py-2 font-medium">
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Bi-Weekly">Bi-Weekly</option>
            <option value="Bi-Monthly">Bi-Monthly (15 days)</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const RejectionStrategyPanel = ({ onConfirm, onCancel, leadId = null, ai = null }) => {
  const [strategy, setStrategy] = useState("Risk");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [aiTone, setAiTone] = useState(ai?.tone || "partner");
  const [aiLanguage, setAiLanguage] = useState(ai?.language || "English");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  const handleSubmit = () => {
    if (!reason) return alert("Please select a specific Root Cause. Vague rejections are not allowed.");
    onConfirm({ strategy, reason, notes, competitor });
  };

  return (
    <div className="surface p-5 animate-slide-up">
      <div className="flex justify-between items-start mb-4 border-b border-slate-200/60 pb-3">
        <div>
          <h4 className="font-extrabold text-slate-900 flex items-center gap-2 text-lg">
            <ShieldAlert size={20} className="text-red-600" /> Corporate Rejection Protocol
          </h4>
          <p className="text-xs text-slate-500 mt-1">Every lead is gold. Classify strictly to maintain partner trust.</p>
        </div>
        <button onClick={onCancel} className="btn-secondary px-3 py-2">
          <X size={18} className="text-slate-700" />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase block mb-2 tracking-wider">Step 1: Strategic Category</label>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(REJECTION_STRATEGIES).map(([key, data]) => (
              <button
                key={key}
                onClick={() => {
                  setStrategy(key);
                  setReason("");
                }}
                className={`p-3 rounded-lg text-xs font-bold border-2 transition-all flex flex-col items-center gap-1 ${
                  strategy === key ? data.color : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className={`text-sm ${strategy === key ? "text-slate-900" : ""}`}>{data.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="animate-fade-in">
          <label className="text-xs font-bold text-slate-700 uppercase block mb-2 tracking-wider">Step 2: Root Cause Analysis</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm bg-white focus:border-blue-500 focus:ring-0 outline-none font-medium text-slate-700 transition-colors"
          >
            <option value="">-- Select Specific Reason --</option>
            {REJECTION_STRATEGIES[strategy].reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {strategy === "Competitor" && (
          <div className="animate-fade-in bg-orange-50 p-3 rounded-lg border border-orange-200">
            <label className="text-xs font-bold text-orange-800 uppercase block mb-1">Market Intelligence (Crucial)</label>
            <input
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Who won this deal? (e.g. Bajaj, HDFC, Pvt Lender)"
              className="w-full p-2 border border-orange-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        )}

        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Step 3: Defense / Justification</label>
            {ai?.run && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <AiToneLanguageControls
                  tone={aiTone}
                  setTone={setAiTone}
                  language={aiLanguage}
                  setLanguage={setAiLanguage}
                  disabled={aiBusy}
                  compact
                />
                <button
                  type="button"
                  disabled={aiBusy || !reason}
                  onClick={async () => {
                    if (!ai?.run) return;
                    if (!reason) return setAiError("Select a Root Cause first.");
                    setAiError("");
                    setAiBusy(true);
                    try {
                      const draft = await ai.run(
                        "rejection_draft",
                        { leadId, strategy, reason, competitor, extraNotes: notes },
                        { tone: aiTone, language: aiLanguage }
                      );
                      setNotes(draft);
                    } catch (err) {
                      setAiError(err?.message || "AI draft failed");
                    } finally {
                      setAiBusy(false);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                    aiBusy || !reason
                      ? "bg-slate-200 text-slate-500"
                      : "text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-soft"
                  }`}
                  title={!reason ? "Select a Root Cause first" : "Generate a 2–3 line rejection draft"}
                >
                  <Sparkles size={14} /> {aiBusy ? "Drafting…" : "AI Draft"}
                </button>
              </div>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write explanation..."
            className="w-full p-3 text-sm h-24 resize-none mt-2"
          />
          {aiError && <div className="text-xs text-red-700 font-bold mt-2">{aiError}</div>}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 py-3 btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 btn-danger">
            <Ban size={16} /> Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentProcessingPanel = ({ lead, onConfirm, onCancel }) => {
  const [givenAmount, setGivenAmount] = useState(lead.loanAmount || 0);
  const [interest, setInterest] = useState(0);
  const [months, setMonths] = useState(12);
  const [frequency, setFrequency] = useState("monthly");

  const computedPrincipal = (Number(givenAmount) || 0) + (Number(interest) || 0);

  const rate = useMemo(() => {
    const given = Number(givenAmount);
    const weeks = Number(months); // keep variable name `weeks` for non-monthly formulas
    const f = String(frequency || "monthly").toLowerCase();

    // Preserved monthly logic (do not change).
    if (f === "monthly") {
      if (!(given > 0) || !(weeks > 0)) return "0.00";
      const result = (Number(interest) / given) / ((weeks + 1) / 2) * 100;
      return isFinite(result) ? result.toFixed(2) : "0.00";
    }

    if (!(given > 0) || !(weeks > 0)) return "0.00";

    const daysMap = {
      weekly: 7,
      biweekly: 14,
      bimonthly: 15, // every 15 days (two EMIs per month)
    };
    const DAYS = daysMap[f];
    if (!DAYS) return "0.00";

    const result = (Number(interest) / given) / ((weeks + 1) / 2) / DAYS * 3000;
    return isFinite(result) ? result.toFixed(2) : "0.00";
  }, [givenAmount, interest, months, frequency]);

  // Business rule: Net Cash Out is Principal (= Given + Upfront interest)
  const netCashOut = computedPrincipal;

  const handleSubmit = () => {
    if (Number(givenAmount) <= 0) return alert("Given amount required.");
    const frequencyLabel = (() => {
      const f = String(frequency || "monthly").toLowerCase();
      if (f === "weekly") return "Weekly";
      if (f === "biweekly") return "Bi-Weekly";
      if (f === "bimonthly") return "Bi-Monthly";
      return "Monthly";
    })();
    onConfirm({
      givenAmount: Number(givenAmount),
      principal: Number(computedPrincipal),
      interest: Number(interest),
      months: Number(months),
      frequency: frequencyLabel,
      netDisbursed: Number(netCashOut),
      rate,
    });
  };

  return (
    <div className="surface p-5 animate-slide-up">
      <div className="flex justify-between items-start mb-4 border-b border-slate-200/60 pb-3">
        <div>
          <h4 className="font-extrabold text-slate-900 flex items-center gap-2 text-lg">
            <DollarSign size={20} className="text-emerald-600" /> Payment Disbursement
          </h4>
          <p className="text-xs text-slate-500 mt-1">Enter terms to calculate Corporate Interest Rate automatically.</p>
        </div>
        <button onClick={onCancel} className="btn-secondary px-3 py-2">
          <X size={18} className="text-slate-700" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Given Amount</label>
            <input
              type="number"
              value={givenAmount}
              onChange={(e) => setGivenAmount(e.target.value)}
              className="w-full py-2 text-lg font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Upfront Interest</label>
            <input
              type="number"
              value={interest}
              onChange={(e) => setInterest(Number(e.target.value))}
              className="w-full py-2 text-lg font-bold text-red-600"
            />
          </div>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Principal (Given + interest): <span className="font-extrabold text-slate-800">{formatCurrency(computedPrincipal)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full py-2 font-bold">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="bimonthly">Bi-Monthly (15 days)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Duration (Months)</label>
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full py-2 text-lg font-bold"
            />
          </div>
        </div>

        <div className="surface-solid p-4 flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Our Interest Rate</div>
            <div className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              {rate}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-bold uppercase">Net Cash Out</div>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(netCashOut)}</div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-soft transition active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
        >
          <CheckCircle size={16} /> Confirm & Disburse
        </button>
      </div>
    </div>
  );
};

const LeadAiTools = ({ lead, mediators, ai, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [tone, setTone] = useState(ai?.tone || "partner");
  const [language, setLanguage] = useState(ai?.language || "English");

  const mediator = mediators?.find?.((m) => m.id === lead?.mediatorId) || null;

  const run = async (action, payload) => {
    if (!ai?.run) return;
    setBusy(true);
    setError("");
    setLastAction(action);
    try {
      const textOut = await ai.run(action, payload, { tone, language });
      setOutput(textOut);
    } catch (err) {
      setError(err?.message || "AI request failed");
    } finally {
      setBusy(false);
    }
  };

  const saveToNotes = () => {
    if (!output) return;
    const now = new Date().toISOString();
    const label =
      lastAction === "lead_summary"
        ? "Summary"
        : lastAction === "whatsapp_draft"
          ? "WhatsApp Draft"
          : lastAction === "meeting_brief"
            ? "Meeting Brief"
            : lastAction === "missing_docs"
              ? "Missing Docs"
              : lastAction === "translate"
                ? "Translation"
                : "AI";

    const nextNotes = [...(lead.notes || []), { text: `[AI ${label}]:\n${output}`, date: now }];
    onUpdate(lead.id, { notes: nextNotes });
  };

  const openWhatsApp = () => {
    if (!output) return;
    const phone = lead.phone ? String(lead.phone).replace(/\D/g, "") : "";
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(output)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openMediatorWhatsApp = () => {
    if (!output) return;
    const phone = mediator?.phone ? String(mediator.phone).replace(/\D/g, "") : "";
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(output)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!ai?.run) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <button type="button" onClick={() => setIsOpen((v) => !v)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          <div className="text-left">
            <div className="font-extrabold text-slate-900 text-sm">AI Tools</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Summary • WhatsApp • Briefing • Docs</div>
          </div>
        </div>
        <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3 animate-fade-in">
          <AiToneLanguageControls tone={tone} setTone={setTone} language={language} setLanguage={setLanguage} disabled={busy} compact />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run("lead_summary", { leadId: lead.id })}
              className={`p-2 rounded-lg text-xs font-bold border ${busy ? "bg-slate-100 text-slate-400" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"}`}
            >
              Summary + Next
            </button>
            <button
              type="button"
              disabled={busy || !lead.phone}
              onClick={() => run("whatsapp_draft", { leadId: lead.id, recipient: "client" })}
              className={`p-2 rounded-lg text-xs font-bold border ${
                busy || !lead.phone ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              }`}
              title={!lead.phone ? "No client phone number" : "Generate WhatsApp message for client"}
            >
              WhatsApp (Client)
            </button>
            <button
              type="button"
              disabled={busy || !(mediator && mediator.phone)}
              onClick={() => run("whatsapp_draft", { leadId: lead.id, recipient: "mediator" })}
              className={`p-2 rounded-lg text-xs font-bold border ${
                busy || !(mediator && mediator.phone)
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              }`}
              title={!(mediator && mediator.phone) ? "No partner phone number" : "Generate WhatsApp message for partner"}
            >
              WhatsApp (Partner)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run("meeting_brief", { leadId: lead.id })}
              className={`p-2 rounded-lg text-xs font-bold border ${busy ? "bg-slate-100 text-slate-400" : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"}`}
            >
              Meeting Brief
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run("missing_docs", { leadId: lead.id })}
              className={`p-2 rounded-lg text-xs font-bold border ${busy ? "bg-slate-100 text-slate-400" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"}`}
            >
              Missing Docs
            </button>
            <button
              type="button"
              disabled={busy || !output}
              onClick={() => run("translate", { text: output, targetLanguage: language })}
              className={`p-2 rounded-lg text-xs font-bold border ${
                busy || !output ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              }`}
              title={!output ? "Generate something first" : `Translate current output to ${language}`}
            >
              Translate Output
            </button>
          </div>

          {busy && <div className="text-xs text-slate-500 font-bold animate-pulse">Generating…</div>}
          {error && <div className="text-xs text-red-600 font-bold">{error}</div>}

          {output && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">AI Output</div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{output}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(output);
                    if (!ok) alert("Could not copy. Please select and copy manually.");
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={saveToNotes}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-black text-white"
                >
                  Save to Notes
                </button>
                {lastAction === "whatsapp_draft" && (
                  <>
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      disabled={!lead.phone}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${
                        lead.phone ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Open WhatsApp (Client)
                    </button>
                    <button
                      type="button"
                      onClick={openMediatorWhatsApp}
                      disabled={!(mediator && mediator.phone)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${
                        mediator && mediator.phone ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Open WhatsApp (Partner)
                    </button>
                  </>
                )}
              </div>
              <div className="mt-3 text-[10px] text-slate-400 leading-relaxed">
                AI is a drafting tool. Review before sending or saving.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LeadActionModal = ({
  lead,
  onUpdate,
  onDelete,
  mediators,
  automation = null,
  onOpenRejectionLetter,
  nativeApp = false,
  backendEnabled = false,
  supabase = null,
  ai = null,
  initialMode = null,
  onConsumeInitialMode,
  canReassignOwner = false,
  staffUsers = [],
  staffUsersError = "",
  onReassignOwner,
  onOpenPartnerStatusPdf,
}) => {
  const TRIAGE_STATEMENT_REASONS = [
    "Client not reachable",
    "Partner pending collection",
    "Client promised later",
    "Wrong/old contact details",
    "Statement shared but unreadable",
    "Client refused to share",
    "Waiting for bank app/netbanking access",
    "Other",
  ];
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState({});
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false);
  const [triagePanelOpen, setTriagePanelOpen] = useState(false);
  const [triageDraft, setTriageDraft] = useState({
    contactUpdated: null,
    phonePdDone: null,
    statementCollected: null,
    statementReason: "",
    perfiosDone: null,
  });
  const [includeStatusPdfTimeline, setIncludeStatusPdfTimeline] = useState(true);

  const allowManualOverride = !backendEnabled || canReassignOwner;

  const attachmentsInputGeneralRef = useRef(null);
  const attachmentsInputKycRef = useRef(null);
  const attachmentsInputItrRef = useRef(null);
  const attachmentsInputBankRef = useRef(null);

  const makeId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  };

  const formatBytes = (n) => {
    const num = Number(n) || 0;
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const normalizeAttachments = (docs) => {
    const arr = Array.isArray(docs?.attachments) ? docs.attachments : [];
    return arr.filter((a) => a && typeof a === "object" && a.id);
  };

  const updateAttachments = (next) => {
    onUpdate(lead.id, { documents: { ...(lead.documents || {}), attachments: next } });
  };

  const addAttachment = async (file, kind = "general") => {
    if (!file) return;
    const id = makeId();
    const createdAt = new Date().toISOString();
    const safeName = String(file.name || "file").replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
    const ownerPrefix = backendEnabled ? String(lead.ownerId || "unknown") : "offline";
    const path = `${ownerPrefix}/${lead.id}/${id}-${safeName}`;
    const bucket = "liras-attachments";

    const meta = {
      id,
      kind,
      name: safeName,
      mime: file.type || "application/octet-stream",
      size: file.size || 0,
      createdAt,
      local: true,
      bucket,
      path,
    };

    try {
      await putAttachmentBlob(id, file);
    } catch (err) {
      alert(err?.message || "Could not store attachment locally.");
      return;
    }

    const docs = lead.documents || {};
    const existing = normalizeAttachments(docs);
    const next = [meta, ...existing];
    const nextDocs = { ...docs, attachments: next };
    // Auto-mark doc types as collected when attaching.
    if (kind === "kyc") nextDocs.kyc = true;
    if (kind === "itr") nextDocs.itr = true;
    if (kind === "bank") nextDocs.bank = true;
    onUpdate(lead.id, { documents: nextDocs });

    // Auto-upload when backend is enabled and online.
    if (backendEnabled && supabase && navigator.onLine) {
      void uploadAttachment(meta);
    }
  };

  useEffect(() => {
    if (showRejectForm || showPaymentForm) setManualOverrideOpen(false);
  }, [showRejectForm, showPaymentForm]);

  const uploadAttachment = async (attachment) => {
    if (!backendEnabled || !supabase) return;
    if (!attachment?.id || !attachment?.path || !attachment?.bucket) return;
    if (!attachment.local) return;

    setAttachmentBusy((p) => ({ ...(p || {}), [attachment.id]: true }));
    try {
      const blob = await getAttachmentBlob(attachment.id);
      if (!blob) throw new Error("Local attachment data not found.");

      const { error } = await supabase.storage.from(attachment.bucket).upload(attachment.path, blob, {
        contentType: attachment.mime || "application/octet-stream",
        upsert: true,
      });
      if (error) throw error;

      // Drop local blob after successful upload to reduce device storage.
      await deleteAttachmentBlob(attachment.id);

      const docs = lead.documents || {};
      const existing = normalizeAttachments(docs);
      const base = existing.some((a) => a.id === attachment.id) ? existing : [attachment, ...existing];
      const next = base.map((a) => (a.id === attachment.id ? { ...a, local: false, uploadedAt: new Date().toISOString() } : a));
      updateAttachments(next);
    } catch (err) {
      alert(err?.message || "Upload failed. Make sure the Supabase Storage bucket and policies are set.");
    } finally {
      setAttachmentBusy((p) => ({ ...(p || {}), [attachment.id]: false }));
    }
  };

  const openAttachment = async (attachment) => {
    try {
      if (attachment.local) {
        const blob = await getAttachmentBlob(attachment.id);
        if (!blob) throw new Error("Local attachment not found.");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      if (!backendEnabled || !supabase) throw new Error("Cloud access is not available in offline mode.");
      const { data, error } = await supabase.storage.from(attachment.bucket || "liras-attachments").createSignedUrl(attachment.path, 60 * 15);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Could not create a download link.");
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      alert(err?.message || "Could not open attachment.");
    }
  };

  const removeAttachment = async (attachment) => {
    const ok = window.confirm(`Delete attachment "${attachment?.name || "file"}"?`);
    if (!ok) return;

    setAttachmentBusy((p) => ({ ...(p || {}), [attachment.id]: true }));
    try {
      if (attachment.local) {
        await deleteAttachmentBlob(attachment.id);
      } else if (backendEnabled && supabase && attachment.bucket && attachment.path) {
        const { error } = await supabase.storage.from(attachment.bucket).remove([attachment.path]);
        if (error) throw error;
      }

      const docs = lead.documents || {};
      const existing = normalizeAttachments(docs);
      const next = existing.filter((a) => a.id !== attachment.id);
      updateAttachments(next);
    } catch (err) {
      alert(err?.message || "Delete failed.");
    } finally {
      setAttachmentBusy((p) => ({ ...(p || {}), [attachment.id]: false }));
    }
  };

  useEffect(() => {
    if (initialMode === "payment") {
      setShowRejectForm(false);
      setShowPaymentForm(true);
      onConsumeInitialMode?.();
    }
  }, [initialMode, onConsumeInitialMode]);

  if (!lead) return null;
  const attachments = normalizeAttachments(lead.documents || {});
  const leadPhoneValue = String(lead.phone || "").trim();
  const mediatorName = mediators?.find?.((m) => m.id === lead.mediatorId)?.name || "Direct/None";
  const ownerLabel = staffUsers?.find?.((u) => String(u.userId) === String(lead.ownerId || ""))?.label || "";
  const lastActivityIso = getLeadLastActivityIso(lead);
  const lastActivityDays = daysSinceIST(lastActivityIso);
  const nextYmd = lead?.nextFollowUp ? toYmdIST(lead.nextFollowUp) : "";
  const nextTime = lead?.nextFollowUp ? formatTimeIST(lead.nextFollowUp) : "";
  const followUpDiffDays = (() => {
    if (!nextYmd) return 0;
    const todayStart = startOfIstDay(toYmdIST(new Date())).getTime();
    const followStart = startOfIstDay(nextYmd).getTime();
    if (!Number.isFinite(todayStart) || !Number.isFinite(followStart)) return 0;
    return Math.floor((followStart - todayStart) / 86400000);
  })();
  const isClosedStatus = ["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable", "Lost to Competitor"].includes(lead.status);
  const isOverdue = !isClosedStatus && followUpDiffDays < 0;
  const docsCount = ["kyc", "itr", "bank"].reduce((acc, k) => (lead?.documents?.[k] ? acc + 1 : acc), 0);
  const auto = normalizeLeadAutomationIndicators(lead, automation);
  const triage = (lead?.documents && typeof lead.documents.triage === "object" && lead.documents.triage) || {};
  const triagePerfiosPendingAge = (() => {
    const start = parseIsoOrNull(triage?.perfiosPendingSince);
    if (!start || triage?.perfiosDone) return "";
    const ms = Date.now() - start.getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h pending`;
    return `${hours}h pending`;
  })();
  const mediatorForLead = mediators?.find?.((m) => String(m.id) === String(lead.mediatorId)) || null;
  const docsMissingList = ["kyc", "itr", "bank"].filter((k) => !lead?.documents?.[k]);

  const buildLeadPendingWhatsappText = () => {
    const lines = [];
    lines.push(`Lead Status Update Request`);
    lines.push(`Client: ${lead.name || "-"}`);
    if (lead.company) lines.push(`Company: ${lead.company}`);
    lines.push(`Current Status: ${lead.status || "-"}`);
    lines.push(`Contact Details: ${!leadPhoneValue || triage?.contactUpdated === false ? "Pending / Not Updated" : "Available"}${leadPhoneValue ? ` (${leadPhoneValue})` : ""}`);
    lines.push(`Phone PD: ${triage?.phonePdDone ? "Done" : "Pending"}`);
    lines.push(`Statement: ${triage?.statementCollected ? "Collected" : "Pending"}${!triage?.statementCollected && triage?.statementReason ? ` (${triage.statementReason})` : ""}`);
    lines.push(`Statement Working: ${triage?.perfiosDone ? "Done" : "Pending"}${triagePerfiosPendingAge ? ` (${triagePerfiosPendingAge})` : ""}`);
    if (docsMissingList.length) lines.push(`Docs Pending: ${docsMissingList.map((d) => d.toUpperCase()).join(", ")}`);
    if (lead.nextFollowUp) lines.push(`Next Action (IST): ${toYmdIST(lead.nextFollowUp)}${formatTimeIST(lead.nextFollowUp) ? ` ${formatTimeIST(lead.nextFollowUp)}` : ""}`);
    lines.push("");
    lines.push("Please share latest update and pending items status.");
    return lines.join("\n");
  };

  const openPartnerPendingWhatsapp = () => {
    const targetPhone = String(mediatorForLead?.phone || "").replace(/[^\d+]/g, "");
    if (!targetPhone) {
      alert("Mediator/partner phone not available.");
      return;
    }
    const text = buildLeadPendingWhatsappText();
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const downloadLeadPendingWhatsappImage = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
      bg.addColorStop(0, "#050b18");
      bg.addColorStop(1, "#0b162a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1080, 1350);

      // Card container
      ctx.fillStyle = "#0f1d34";
      roundRectCanvas(ctx, 40, 40, 1000, 1270, 28, true, false);
      ctx.strokeStyle = "#23344f";
      ctx.lineWidth = 2;
      roundRectCanvas(ctx, 40, 40, 1000, 1270, 28, false, true);

      ctx.fillStyle = "#d7b56d";
      ctx.font = "700 28px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("JC", 78, 92);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 34px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("Partner / Mediator Status", 130, 92);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 20px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("WhatsApp summary (timeline excluded)", 130, 122);

      const statusTone = isClosedStatus ? "#10b981" : isClosedOrRejectedLeadStatus(lead.status) ? "#ef4444" : "#f59e0b";
      drawPillCanvas(ctx, `${lead.status || "Unknown"}`, 820, 64, statusTone);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 52px ui-sans-serif, system-ui, -apple-system";
      wrapCanvasText(ctx, lead.name || "—", 72, 205, 936, 58, 2);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 24px ui-sans-serif, system-ui, -apple-system";
      const sub = [lead.company, lead.location].filter(Boolean).join(" • ") || "Lead summary";
      wrapCanvasText(ctx, sub, 72, 272, 936, 30, 2);

      const contactStatus = !leadPhoneValue || triage?.contactUpdated === false ? "Pending / Not Updated" : "Available";
      const phonePdStatus = triage?.phonePdDone ? "Done" : "Pending";
      const statementStatus = triage?.statementCollected ? "Collected" : "Pending";
      const workingStatus = triage?.perfiosDone ? "Done" : "Pending";
      const nextActionLabel = lead.nextFollowUp ? `${toYmdIST(lead.nextFollowUp)}${formatTimeIST(lead.nextFollowUp) ? ` • ${formatTimeIST(lead.nextFollowUp)}` : ""}` : "Not scheduled";

      const blocks = [
        { title: "Contact Details", value: contactStatus, sub: leadPhoneValue || "Client phone not updated", tone: contactStatus.startsWith("Pending") ? "rose" : "emerald" },
        { title: "Phone PD", value: phonePdStatus, sub: "", tone: phonePdStatus === "Done" ? "emerald" : "amber" },
        { title: "Statement", value: statementStatus, sub: !triage?.statementCollected && triage?.statementReason ? triage.statementReason : "", tone: statementStatus === "Collected" ? "emerald" : "amber" },
        { title: "Statement Working", value: workingStatus, sub: triagePerfiosPendingAge || "", tone: workingStatus === "Done" ? "emerald" : "amber" },
        { title: "Docs Pending", value: docsMissingList.length ? docsMissingList.map((d) => d.toUpperCase()).join(", ") : "None", sub: `Collected ${docsCount}/3`, tone: docsMissingList.length ? "rose" : "emerald" },
        { title: "Next Action (IST)", value: nextActionLabel, sub: `Partner: ${mediatorName}`, tone: "slate" },
      ];

      const colW = 462;
      const rowH = 150;
      blocks.forEach((b, i) => {
        const x = 72 + (i % 2) * (colW + 12);
        const y = 335 + Math.floor(i / 2) * (rowH + 14);
        drawMetricCardCanvas(ctx, { x, y, w: colW, h: rowH, ...b });
      });

      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 24px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("Message to partner/mediator", 72, 848);
      ctx.fillStyle = "#0b1527";
      roundRectCanvas(ctx, 72, 872, 936, 255, 18, true, false);
      ctx.strokeStyle = "#253248";
      ctx.lineWidth = 2;
      roundRectCanvas(ctx, 72, 872, 936, 255, 18, false, true);
      ctx.fillStyle = "#dbeafe";
      ctx.font = "600 21px ui-sans-serif, system-ui, -apple-system";
      const msgPreview = [
        "Please share latest update for this client.",
        `Pending: ${[
          !leadPhoneValue || triage?.contactUpdated === false ? "Contact Details" : null,
          !triage?.phonePdDone ? "Phone PD" : null,
          !triage?.statementCollected ? "Statement" : null,
          triage?.statementCollected && !triage?.perfiosDone ? "Statement Working" : null,
          docsMissingList.length ? `Docs (${docsMissingList.map((d) => d.toUpperCase()).join(", ")})` : null,
        ]
          .filter(Boolean)
          .join(", ") || "No pending items"}.`,
        `Next action: ${nextActionLabel}.`,
      ].join(" ");
      wrapCanvasText(ctx, msgPreview, 98, 918, 884, 32, 6);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 18px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText(`Generated ${toYmdIST(new Date())} • Jubilant Capital`, 72, 1200);

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lead_Status_WhatsApp_${String(lead.name || "Lead").replace(/[^\w]+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err?.message || "Failed to generate image.");
    }
  };

  useEffect(() => {
    setTriageDraft({
      contactUpdated: typeof triage?.contactUpdated === "boolean" ? triage.contactUpdated : leadPhoneValue ? true : null,
      phonePdDone: typeof triage?.phonePdDone === "boolean" ? triage.phonePdDone : null,
      statementCollected: typeof triage?.statementCollected === "boolean" ? triage.statementCollected : null,
      statementReason: String(triage?.statementReason || ""),
      perfiosDone: typeof triage?.perfiosDone === "boolean" ? triage.perfiosDone : null,
    });
    // Only reset when changing leads or triage snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, triage?.contactUpdated, triage?.phonePdDone, triage?.statementCollected, triage?.statementReason, triage?.perfiosDone]);

  useEffect(() => {
    if (lead.status === "Meeting Scheduled" && !triage?.triageOpenedAt) {
      setTriagePanelOpen(true);
    }
  }, [lead.status, triage?.triageOpenedAt]);

  const saveTriageFlow = () => {
    const nowIso = new Date().toISOString();
    const docsCurrent = lead.documents || {};
    const existingTriage = (docsCurrent && typeof docsCurrent.triage === "object" && docsCurrent.triage) || {};
    const nextTriage = {
      ...existingTriage,
      triageOpenedAt: existingTriage.triageOpenedAt || nowIso,
      lastReviewedAt: nowIso,
      contactUpdated: triageDraft.contactUpdated,
      phonePdDone: triageDraft.phonePdDone,
      statementCollected: triageDraft.statementCollected,
      statementReason: triageDraft.statementCollected === false ? triageDraft.statementReason || "" : "",
      perfiosDone: triageDraft.statementCollected ? triageDraft.perfiosDone : null,
    };

    const notesAppend = [];
    const pushNote = (tag, text) => notesAppend.push({ text: `[${tag}]: ${text}`, date: nowIso });

    if (existingTriage.contactUpdated !== nextTriage.contactUpdated) {
      pushNote("TRIAGE", `Contact details ${nextTriage.contactUpdated ? "confirmed/updated" : "not updated by partner/mediator"}.`);
    }
    if (existingTriage.phonePdDone !== nextTriage.phonePdDone) {
      pushNote("PHONE PD", nextTriage.phonePdDone ? "Phone PD completed." : "Phone PD pending.");
      if (nextTriage.phonePdDone && !existingTriage.phonePdDoneAt) nextTriage.phonePdDoneAt = nowIso;
    }

    if (existingTriage.statementCollected !== nextTriage.statementCollected) {
      pushNote(
        "STATEMENT",
        nextTriage.statementCollected
          ? "Statement collected."
          : `Statement not received${nextTriage.statementReason ? ` (${nextTriage.statementReason})` : ""}.`
      );
      if (nextTriage.statementCollected && !existingTriage.statementCollectedAt) nextTriage.statementCollectedAt = nowIso;
    }

    if (nextTriage.statementCollected) {
      if (existingTriage.perfiosDone !== nextTriage.perfiosDone) {
        if (nextTriage.perfiosDone) {
          const pendingSince = parseIsoOrNull(existingTriage.perfiosPendingSince || nextTriage.perfiosPendingSince);
          const lagLabel =
            pendingSince && Number.isFinite(pendingSince.getTime())
              ? (() => {
                  const h = Math.max(0, Math.floor((Date.now() - pendingSince.getTime()) / 3600000));
                  const d = Math.floor(h / 24);
                  return d > 0 ? `${d}d ${h % 24}h` : `${h}h`;
                })()
              : "";
          pushNote("STATEMENT WORKING", `Statement working completed${lagLabel ? ` after ${lagLabel}` : ""}.`);
          nextTriage.perfiosDoneAt = nowIso;
        } else {
          pushNote("STATEMENT WORKING", "Statement working pending.");
        }
      }
      if (nextTriage.perfiosDone === false && !existingTriage.perfiosPendingSince) {
        nextTriage.perfiosPendingSince = nowIso;
      }
    } else {
      nextTriage.perfiosDone = null;
    }

    let nextStatus = lead.status;
    let routeNote = "";
    const phoneMissingOrNotUpdated = !leadPhoneValue || triageDraft.contactUpdated === false;
    const contactReadyForInternal = triageDraft.contactUpdated === true && !!leadPhoneValue;
    if (phoneMissingOrNotUpdated) {
      nextStatus = "Contact Details Not Received";
      routeNote = "Mapped to mediator pending list: contact details not updated.";
    } else if (contactReadyForInternal && (triageDraft.phonePdDone === false || triageDraft.phonePdDone == null)) {
      nextStatus = "Follow-Up Required";
      routeNote = "Mapped to internal follow-up: phone PD pending.";
    } else if (triageDraft.statementCollected === false || triageDraft.statementCollected == null) {
      nextStatus = "Statements Not Received";
      routeNote = `Mapped to mediator pending list: statements not received${triageDraft.statementReason ? ` (${triageDraft.statementReason})` : ""}.`;
    } else if (triageDraft.perfiosDone === false || triageDraft.perfiosDone == null) {
      nextStatus = "Statement Working Pending";
      routeNote = "Mapped to statement working pending: statement received but processing not completed.";
    } else if (triageDraft.perfiosDone === true) {
      routeNote = "Triage complete: phone PD, statement collection and statement working all marked done.";
    }
    if (routeNote) pushNote("TRIAGE ROUTE", routeNote);

    onUpdate(lead.id, {
      status: nextStatus,
      documents: { ...docsCurrent, triage: nextTriage },
      notes: [...(lead.notes || []), ...notesAppend],
    });
  };

  const handleOutcome = (type) => {
    const today = new Date().toISOString();
    const notes = [...(lead.notes || [])];

    if (type === "payment") {
      setShowPaymentForm(true);
      return;
    }
    if (type === "reject") {
      setShowRejectForm(true);
      return;
    }
    if (type === "commercial") {
      onUpdate(lead.id, { status: "Commercial Client", notes: [...notes, { text: "[Status Change] Marked as Commercial Client. Field visit pending.", date: today }] });
      return;
    }
    if (type === "assign_staff") {
      const staffName = prompt("Enter Staff Name for assignment:");
      if (!staffName) return;
      onUpdate(lead.id, { assignedStaff: staffName, notes: [...notes, { text: `[STAFF ASSIGNED]: Assigned to ${staffName} for visit/funding.`, date: today }] });
      return;
    }

    if (type === "followup" || type === "reschedule") {
      if (lead.status === "Commercial Client") {
        if (confirm("Did you collect any new mediator contact during this visit?")) {
          const contact = prompt("Enter Mediator Name & Phone (or details):");
          if (contact) notes.push({ text: `[MEDIATOR COLLECTED]: ${contact}`, date: today });
        }
        notes.push({ text: "[Commercial Visit] Meeting/Follow-up conducted.", date: today });
      }

      if (type === "followup") {
        const updateText = prompt("What is the latest update/remark for this follow-up?");
        if (!updateText) return;
        const date = prompt("Enter next Follow-Up Date (YYYY-MM-DD):", toYmdIST(new Date(Date.now() + 86400000)));
        if (!date) return;
        onUpdate(lead.id, {
          status: "Follow-Up Required",
          nextFollowUp: new Date(date).toISOString(),
          notes: [...notes, { text: `[Follow-Up Update]: ${updateText}`, date: today }],
        });
        return;
      }

      if (type === "reschedule") {
        const date = prompt("Enter New Meeting Date (YYYY-MM-DD HH:MM):");
        if (!date) return;
        onUpdate(lead.id, {
          status: "Meeting Scheduled",
          nextFollowUp: new Date(date).toISOString(),
          notes: [...notes, { text: `[Outcome] Meeting rescheduled to ${date}.`, date: today }],
        });
      }
    }
  };

  const handleStrategicRejection = (data) => {
    const today = new Date().toISOString();
    const notes = [...(lead.notes || [])];
    let newStatus = "Not Eligible";
    if (data.strategy === "Competitor") newStatus = "Lost to Competitor";
    else if (data.strategy === "Client") newStatus = "Not Interested (Temp)";

    const rejectionNote = `[REJECTION]: Strategy=${data.strategy} | Reason=${data.reason} | Note=${data.notes || "None"} ${
      data.competitor ? "| Competitor=" + data.competitor : ""
    }`;
    onUpdate(lead.id, {
      status: newStatus,
      rejectionDetails: { strategy: data.strategy, reason: data.reason, competitor: data.competitor, defense: data.notes, date: today },
      notes: [...notes, { text: rejectionNote, date: today }],
    });
    setShowRejectForm(false);
  };

  const handlePaymentConfirmation = (data) => {
    const today = new Date().toISOString();
    const notes = [...(lead.notes || [])];
    const followUpDate = addMonths(new Date(), data.months / 2).toISOString();
    const given = Number(data.givenAmount || 0);
    const principal = Number(data.principal || 0);
    const interest = Number(data.interest || 0);

    onUpdate(lead.id, {
      status: "Payment Done",
      loanAmount: principal,
      loanDetails: {
        principal: principal,
        interest: interest,
        // Business rule: Net Cash Out is Principal (= Given + Upfront interest)
        netDisbursed: principal,
        tenure: data.months,
        frequency: data.frequency || "Monthly",
        rate: data.rate,
        paymentDate: today,
      },
      nextFollowUp: followUpDate,
      notes: [
        ...notes,
        {
          text: `[PAYMENT DONE]: Given ${formatCurrency(given)}. Upfront Interest ${formatCurrency(
            interest
          )}. Principal ${formatCurrency(principal)}. Net Cash Out ${formatCurrency(principal)}. Terms: ${
            data.months
          }m (${data.frequency || "Monthly"}) @ ${data.rate}% rate. Follow-up set for 50% term (${new Date(followUpDate).toLocaleDateString()})`,
          date: today,
        },
      ],
    });
    setShowPaymentForm(false);
  };

  const exportNextActionToIcs = () => {
    if (!lead?.nextFollowUp) return;

    const escapeIcs = (text) =>
      String(text || "")
        .replace(/\\\\/g, "\\\\\\\\")
        .replace(/\\n/g, "\\\\n")
        .replace(/,/g, "\\\\,")
        .replace(/;/g, "\\\\;");

    const toIcsUtc = (dateLike) => {
      const d = new Date(dateLike);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };

    const makeIcsEvent = ({ uid, title, start, end, description = "", location = "" }) => {
      const safeUid = uid || `${Date.now()}@jubilant-liras`;
      const dtStamp = toIcsUtc(new Date());
      const dtStart = toIcsUtc(start);
      const dtEnd = toIcsUtc(end);
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Jubilant LIRAS//Lead Calendar//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${escapeIcs(safeUid)}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcs(title)}`,
        description ? `DESCRIPTION:${escapeIcs(description)}` : "",
        location ? `LOCATION:${escapeIcs(location)}` : "",
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\r\n");
    };

    const downloadTextFile = (filename, content, mime) => {
      const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const start = new Date(lead.nextFollowUp);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    const title = lead.status === "Meeting Scheduled" ? `Meeting: ${lead.name}` : `Follow-up: ${lead.name}`;
    const mediatorName = mediators?.find?.((m) => m.id === lead.mediatorId)?.name || "—";
    const description = `Lead: ${lead.name}\nCompany: ${lead.company || "-"}\nPhone: ${lead.phone || "-"}\nMediator: ${mediatorName}\nStatus: ${lead.status || "-"}`;
    const ics = makeIcsEvent({
      uid: `${lead.id}@liras-lead`,
      title,
      start,
      end,
      description,
      location: lead.location || "",
    });
    downloadTextFile(`LIRAS_${title.replace(/[^\w]+/g, "_")}.ics`, ics, "text/calendar;charset=utf-8");
  };

  const handleCheckIn = async () => {
    if (isCheckingIn) return;
    if (!confirm("Log a check-in for this lead now? (Optional GPS location)")) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const nowLocal = now.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const base = `[CHECK-IN]: ${nowLocal}`;

    const append = (text) => {
      onUpdate(lead.id, {
        notes: [...(lead.notes || []), { text, date: nowIso }],
      });
    };

    if (!navigator?.geolocation) {
      append(`${base} (GPS unavailable)`);
      return;
    }

    setIsCheckingIn(true);
    try {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos?.coords?.latitude;
            const lng = pos?.coords?.longitude;
            const acc = pos?.coords?.accuracy;
            if (typeof lat === "number" && typeof lng === "number") {
              const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
              append(`${base} • lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} • acc=${Math.round(Number(acc) || 0)}m • ${mapUrl}`);
            } else {
              append(`${base} (GPS captured, but coordinates unavailable)`);
            }
            resolve();
          },
          (err) => {
            append(`${base} (GPS error: ${err?.message || "permission denied"})`);
            resolve();
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
        );
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b pb-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <input
              className="text-2xl font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:outline-none bg-transparent w-full"
              value={lead.name}
              onChange={(e) => onUpdate(lead.id, { name: e.target.value })}
              placeholder="Client Name"
            />
            <button
              type="button"
              onClick={() => {
                if (!lead.phone) return;
                const startedAt = new Date().toISOString();
                onUpdate(lead.id, { notes: [...(lead.notes || []), { text: "[CALL]: Dialed client", date: startedAt }] });
                if (nativeApp) {
                  try {
                    safeLocalStorage.setItem(
                      "liras_pending_call_v1",
                      JSON.stringify({
                        kind: "lead",
                        leadId: lead.id,
                        phone: lead.phone,
                        startedAt,
                        ts: startedAt,
                      })
                    );
                  } catch {
                    // ignore
                  }
                }
                window.location.href = `tel:${String(lead.phone).replace(/[^\d+]/g, "")}`;
              }}
              className={`text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 p-2 rounded-full ${
                !lead.phone ? "opacity-50 pointer-events-none" : ""
              }`}
              title={lead.phone ? (nativeApp ? "Call (auto-log)" : "Call") : "No phone number"}
            >
              <Phone size={20} />
            </button>
            <a
              href={lead.phone ? `https://wa.me/${lead.phone}` : "#"}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (!lead.phone) return;
                const nowIso = new Date().toISOString();
                onUpdate(lead.id, { notes: [...(lead.notes || []), { text: "[WHATSAPP]: Opened client chat", date: nowIso }] });
              }}
              className={`text-green-500 hover:text-green-600 transition-colors bg-green-50 p-2 rounded-full ${!lead.phone ? "opacity-50 pointer-events-none" : ""}`}
            >
              <MessageCircle size={20} />
            </a>
          </div>
          <div className="flex gap-2 text-sm text-slate-500 flex-wrap">
            <input
              className="bg-transparent hover:text-slate-800 focus:outline-none"
              value={lead.company || ""}
              onChange={(e) => onUpdate(lead.id, { company: e.target.value })}
              placeholder="Company"
            />
            <span>•</span>
            <input
              className="bg-transparent hover:text-slate-800 focus:outline-none"
              value={lead.phone || ""}
              onChange={(e) => onUpdate(lead.id, { phone: e.target.value })}
              placeholder="Phone"
            />
            <span>•</span>
            <input
              className="bg-transparent hover:text-slate-800 focus:outline-none"
              value={lead.location || ""}
              onChange={(e) => onUpdate(lead.id, { location: e.target.value })}
              placeholder="City/Area"
            />
          </div>
        </div>

        <div className="text-right">
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_CONFIG[lead.status]?.color || "bg-gray-100"}`}>
            {lead.status}
          </div>
          <button onClick={() => onDelete(lead.id)} className="block mt-2 text-red-400 hover:text-red-600 text-xs flex items-center gap-1 ml-auto">
            <Trash2 size={10} /> Delete
          </button>
        </div>
      </div>

      <div className="surface-solid p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`rounded-2xl border p-3 bg-white/70 ${isOverdue ? "border-rose-200 bg-rose-50/70" : "border-slate-200/70"}`}>
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Next Action (IST)</div>
            <div className="mt-1 font-extrabold text-slate-900">{nextYmd ? `${nextYmd}${nextTime ? ` • ${nextTime}` : ""}` : "—"}</div>
            <div className={`text-[11px] font-bold mt-1 ${isOverdue ? "text-rose-700" : "text-slate-500"}`}>
              {nextYmd
                ? followUpDiffDays === 0
                  ? "Today"
                  : followUpDiffDays > 0
                    ? `In ${followUpDiffDays} day${followUpDiffDays === 1 ? "" : "s"}`
                    : `Overdue ${Math.abs(followUpDiffDays)} day${Math.abs(followUpDiffDays) === 1 ? "" : "s"}`
                : "No follow-up scheduled"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-3 bg-white/70">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Last Activity (IST)</div>
            <div className="mt-1 font-extrabold text-slate-900">{lastActivityIso ? `${toYmdIST(lastActivityIso)} • ${formatTimeIST(lastActivityIso)}` : "—"}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">{lastActivityDays} day{lastActivityDays === 1 ? "" : "s"} ago</div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-3 bg-white/70">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Partner</div>
            <div className="mt-1 font-extrabold text-slate-900 truncate">{mediatorName}</div>
            {backendEnabled && ownerLabel ? <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Owner: {ownerLabel}</div> : null}
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-3 bg-white/70">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Docs / Files</div>
            <div className="mt-1 font-extrabold text-slate-900">{docsCount}/3 collected</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">{attachments.length} attachment{attachments.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`rounded-2xl border p-3 ${auto.slaOverdue ? "border-rose-200 bg-rose-50/80" : "border-slate-200/70 bg-white/70"}`}>
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Automation SLA</div>
            <div className={`mt-1 font-extrabold ${auto.slaOverdue ? "text-rose-700" : "text-slate-900"}`}>
              {auto.slaOverdue ? "Overdue" : auto.slaStatus || "Tracked"}
              {auto.overdueLabel ? ` • ${auto.overdueLabel}` : ""}
            </div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">
              {auto.priorityLabel ? `Priority: ${auto.priorityLabel}` : "Priority not set"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 p-3 bg-white/70">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Next Best Action</div>
            <div className="mt-1 font-extrabold text-slate-900 truncate">{auto.nextBestAction || "—"}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">
              {auto.nextBestReason || (auto.docsMissing.length ? `Missing: ${auto.docsMissing.join(", ")}` : "No reason available")}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 p-3 bg-white/70">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Duplicate Alerts</div>
            <div className={`mt-1 font-extrabold ${auto.duplicateAlertCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{auto.duplicateAlertCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">
              Tasks: {auto.openTaskCount} open{auto.overdueTaskCount > 0 ? ` • ${auto.overdueTaskCount} overdue` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="surface-solid p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Partner / Mediator Status PDF</div>
            <div className="font-extrabold text-slate-900 mt-1">Generate status request sheet for this lead</div>
            <div className="text-[11px] text-slate-500 mt-1">
              PDF supports optional timeline. WhatsApp image is compact and excludes timeline.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary px-4 py-3 shrink-0" onClick={downloadLeadPendingWhatsappImage}>
              <Download size={14} /> WhatsApp Image
            </button>
            <button
              type="button"
              className={`btn-secondary px-4 py-3 shrink-0 ${!mediatorForLead?.phone ? "opacity-50 pointer-events-none" : ""}`}
              onClick={openPartnerPendingWhatsapp}
              title={mediatorForLead?.phone ? "Send pending summary to partner/mediator" : "Mediator phone not available"}
            >
              <MessageCircle size={14} /> Send Pending
            </button>
            <button
              type="button"
              className="btn-primary px-4 py-3 shrink-0"
              onClick={() => onOpenPartnerStatusPdf?.(lead, { includeTimeline: includeStatusPdfTimeline })}
            >
              <Printer size={14} /> Generate PDF
            </button>
          </div>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-indigo-600 w-4 h-4"
            checked={includeStatusPdfTimeline}
            onChange={(e) => setIncludeStatusPdfTimeline(!!e.target.checked)}
          />
          Include lead timeline (notes/history) in PDF
        </label>
      </div>

      <div className="surface-solid p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Post-Meeting Triage Flow</div>
              <div className="font-extrabold text-slate-900 mt-1">Track phone PD {"->"} statement {"->"} statement working and auto-route pending queues</div>
            <div className="text-[11px] text-slate-500 mt-1">
              This updates status mapping (mediator pending vs internal follow-up) and writes timeline notes.
            </div>
          </div>
          <button type="button" className="btn-secondary px-3 py-2 shrink-0" onClick={() => setTriagePanelOpen((p) => !p)}>
            {triagePanelOpen ? "Hide Triage" : "Open Triage"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {typeof triage?.contactUpdated === "boolean" && <span className="chip">Contact: {triage.contactUpdated ? "Updated" : "Missing"}</span>}
          {typeof triage?.phonePdDone === "boolean" && <span className="chip">Phone PD: {triage.phonePdDone ? "Done" : "Pending"}</span>}
          {typeof triage?.statementCollected === "boolean" && <span className="chip">Statement: {triage.statementCollected ? "Collected" : "Pending"}</span>}
          {typeof triage?.perfiosDone === "boolean" && <span className="chip">Statement Working: {triage.perfiosDone ? "Done" : "Pending"}</span>}
          {triagePerfiosPendingAge && <span className="chip bg-amber-50 border-amber-200 text-amber-700">Statement Working {triagePerfiosPendingAge}</span>}
        </div>

        {triagePanelOpen && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">Phone / Contact updated in app?</label>
                <select
                  value={triageDraft.contactUpdated === null ? "" : triageDraft.contactUpdated ? "yes" : "no"}
                  onChange={(e) =>
                    setTriageDraft((p) => ({
                      ...p,
                      contactUpdated: e.target.value === "" ? null : e.target.value === "yes",
                    }))
                  }
                  className="w-full py-2 text-sm"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No (Mediator pending)</option>
                </select>
                <div className="text-[10px] text-slate-500 mt-1">Current phone: {leadPhoneValue || "Not updated"}</div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">Phone PD done?</label>
                <select
                  value={triageDraft.phonePdDone === null ? "" : triageDraft.phonePdDone ? "yes" : "no"}
                  onChange={(e) =>
                    setTriageDraft((p) => ({
                      ...p,
                      phonePdDone: e.target.value === "" ? null : e.target.value === "yes",
                    }))
                  }
                  className="w-full py-2 text-sm"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No (Internal follow-up)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">Statement collected?</label>
                <select
                  value={triageDraft.statementCollected === null ? "" : triageDraft.statementCollected ? "yes" : "no"}
                  onChange={(e) =>
                    setTriageDraft((p) => ({
                      ...p,
                      statementCollected: e.target.value === "" ? null : e.target.value === "yes",
                      perfiosDone: e.target.value === "yes" ? p.perfiosDone : null,
                    }))
                  }
                  className="w-full py-2 text-sm"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No (Mediator pending)</option>
                </select>
                <div className="text-[10px] text-slate-500 mt-1">Statement can be tracked even if contact/Phone PD is still pending.</div>
              </div>

              {triageDraft.statementCollected === false ? (
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">Statement not received reason</label>
                  <select
                    value={triageDraft.statementReason || ""}
                    onChange={(e) => setTriageDraft((p) => ({ ...p, statementReason: e.target.value }))}
                    className="w-full py-2 text-sm"
                  >
                    <option value="">Select reason</option>
                    {TRIAGE_STATEMENT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">Statement working done?</label>
                  <select
                    value={triageDraft.perfiosDone === null ? "" : triageDraft.perfiosDone ? "yes" : "no"}
                    onChange={(e) =>
                      setTriageDraft((p) => ({
                        ...p,
                        perfiosDone: e.target.value === "" ? null : e.target.value === "yes",
                      }))
                    }
                    className="w-full py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes (mark timeline)</option>
                    <option value="no">No (track delay)</option>
                  </select>
                  <div className="text-[10px] text-slate-500 mt-1">Statement working completion gets logged in timeline with delay duration.</div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
              <div className="font-bold text-slate-800 mb-1">Routing logic</div>
              <ul className="space-y-1">
                  <li>Missing phone/contact update {"->"} <span className="font-bold">Contact Details Not Received</span> (partner/mediator pending)</li>
                  <li>Phone updated and Phone PD not done {"->"} <span className="font-bold">Internal Follow-Up</span> (status: Follow-Up Required)</li>
                  <li>Phone PD done but statement not received {"->"} <span className="font-bold">Statements Not Received</span> (partner/mediator pending)</li>
                  <li>Statement received but statement working not done {"->"} <span className="font-bold">Statement Working Pending</span></li>
                </ul>
              </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary px-4 py-2" onClick={saveTriageFlow}>
                <CheckCircle size={14} /> Save Triage & Route
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() =>
                  setTriageDraft((p) => ({
                    ...p,
                    perfiosDone: true,
                    phonePdDone: p.phonePdDone === null ? true : p.phonePdDone,
                    statementCollected: p.statementCollected === null ? true : p.statementCollected,
                  }))
                }
              >
                <Sparkles size={14} /> Mark Statement Working Done
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {showPaymentForm ? (
            <PaymentProcessingPanel lead={lead} onConfirm={handlePaymentConfirmation} onCancel={() => setShowPaymentForm(false)} />
          ) : showRejectForm ? (
            <RejectionStrategyPanel leadId={lead.id} ai={ai} onConfirm={handleStrategicRejection} onCancel={() => setShowRejectForm(false)} />
          ) : lead.status === "Payment Done" ? (
            <LoanDetailsEditor lead={lead} onUpdate={(data) => onUpdate(lead.id, data)} />
          ) : (
            <div className="surface p-4">
              <h4 className="font-extrabold text-slate-900 mb-3 text-sm uppercase tracking-wide">Update Status & Outcome</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleOutcome("payment")}
                  className="p-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-emerald-200 active:scale-[0.98]"
                >
                  <DollarSign size={20} /> Payment Done
                </button>
                <button
                  onClick={() => handleOutcome("reschedule")}
                  className="p-3 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-purple-200 active:scale-[0.98]"
                >
                  <Calendar size={20} /> Reschedule
                </button>
                <button
                  onClick={() => handleOutcome("followup")}
                  className="p-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-indigo-200 active:scale-[0.98]"
                >
                  <Clock size={20} /> Follow Up
                </button>
                {nativeApp && (
                  <button
                    onClick={handleCheckIn}
                    disabled={isCheckingIn}
                    className={`p-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border active:scale-[0.98] ${
                      isCheckingIn ? "bg-slate-100 text-slate-500 border-slate-200 cursor-wait" : "bg-sky-100 hover:bg-sky-200 text-sky-800 border-sky-200"
                    }`}
                    title="Log visit/check-in (optional GPS)"
                  >
                    <MapPin size={20} /> {isCheckingIn ? "Checking…" : "Check-in"}
                  </button>
                )}
                <button
                  onClick={() => handleOutcome("assign_staff")}
                  className="p-3 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-cyan-200 active:scale-[0.98]"
                >
                  <UserPlus size={20} /> Assign Staff
                </button>
                <button
                  onClick={() => handleOutcome("commercial")}
                  className="p-3 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-teal-200 active:scale-[0.98]"
                >
                  <Briefcase size={20} /> Commercial Client
                </button>
                <button
                  onClick={() => handleOutcome("reject")}
                  className="p-3 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-colors border border-red-200 active:scale-[0.98]"
                >
                  <Ban size={20} /> Reject Strategy
                </button>
              </div>

              {allowManualOverride && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    className="btn-secondary w-full py-2 text-xs"
                    onClick={() => setManualOverrideOpen((p) => !p)}
                  >
                    <Settings size={14} /> {manualOverrideOpen ? "Hide manual override" : "Manual override"}
                  </button>

                  {manualOverrideOpen && (
                    <div className="mt-3 surface-solid p-3">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Set Status</label>
                      <select
                        value={lead.status}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === "Payment Done") {
                            setShowRejectForm(false);
                            setShowPaymentForm(true);
                            return;
                          }
                          onUpdate(lead.id, { status: next });
                        }}
                        className="w-full py-2 text-sm"
                      >
                        {Object.keys(STATUS_CONFIG).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        Use only for exceptional cases. Prefer the action buttons above so notes and follow-up dates remain consistent.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!showRejectForm && !showPaymentForm && lead.status !== "Payment Done" && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Next Action Date</label>
              <input
                type="datetime-local"
                className="w-full py-3 font-medium text-slate-700"
                value={lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString().slice(0, 16) : ""}
                onChange={(e) => onUpdate(lead.id, { nextFollowUp: new Date(e.target.value).toISOString() })}
              />
              {lead.nextFollowUp && (
                <div className="mt-2">
                  <button type="button" className="btn-secondary w-full py-3 text-xs" onClick={exportNextActionToIcs}>
                    <Calendar size={14} /> Add to Calendar (.ics)
                  </button>
                </div>
              )}
            </div>
          )}

          {!showRejectForm && !showPaymentForm && (
            <div className="surface-solid p-3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Documents Collected</label>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-4 h-4"
                    checked={!!lead.documents?.kyc}
                    onChange={(e) => onUpdate(lead.id, { documents: { ...(lead.documents || {}), kyc: e.target.checked } })}
                  />{" "}
                  KYC
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-4 h-4"
                    checked={!!lead.documents?.itr}
                    onChange={(e) => onUpdate(lead.id, { documents: { ...(lead.documents || {}), itr: e.target.checked } })}
                  />{" "}
                  ITR
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-4 h-4"
                    checked={!!lead.documents?.bank}
                    onChange={(e) => onUpdate(lead.id, { documents: { ...(lead.documents || {}), bank: e.target.checked } })}
                  />{" "}
                  Bank
                </label>
              </div>
            </div>
          )}

          {!showRejectForm && !showPaymentForm && (
            <div className="surface-solid p-3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Tags</label>
              <input
                value={(Array.isArray(lead.documents?.tags) ? lead.documents.tags : []).join(", ")}
                onChange={(e) => {
                  const tags = String(e.target.value || "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 16);
                  onUpdate(lead.id, { documents: { ...(lead.documents || {}), tags } });
                }}
                className="w-full py-3"
                placeholder="hot, docs, visit, high-value…"
              />
              {Array.isArray(lead.documents?.tags) && lead.documents.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {lead.documents.tags.slice(0, 10).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  {lead.documents.tags.length > 10 && <span className="chip">+{lead.documents.tags.length - 10}</span>}
                </div>
              )}
              <div className="text-[10px] text-slate-400 mt-2">Comma-separated. Example: hot, docs-pending, visit-needed</div>
            </div>
          )}

          {!showRejectForm && !showPaymentForm && (
            <div className="surface-solid p-3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Attachments</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-secondary py-3 text-xs"
                  onClick={() => attachmentsInputGeneralRef.current?.click()}
                >
                  <Upload size={14} /> Add File
                </button>
                <button
                  type="button"
                  className="btn-secondary py-3 text-xs"
                  onClick={() => attachmentsInputKycRef.current?.click()}
                >
                  <FileText size={14} /> Add KYC
                </button>
                <button
                  type="button"
                  className="btn-secondary py-3 text-xs"
                  onClick={() => attachmentsInputItrRef.current?.click()}
                >
                  <FileCheck size={14} /> Add ITR
                </button>
                <button
                  type="button"
                  className="btn-secondary py-3 text-xs"
                  onClick={() => attachmentsInputBankRef.current?.click()}
                >
                  <Banknote size={14} /> Add Bank
                </button>
              </div>

              <input
                ref={attachmentsInputGeneralRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void addAttachment(file, "general");
                }}
              />
              <input
                ref={attachmentsInputKycRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void addAttachment(file, "kyc");
                }}
              />
              <input
                ref={attachmentsInputItrRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void addAttachment(file, "itr");
                }}
              />
              <input
                ref={attachmentsInputBankRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void addAttachment(file, "bank");
                }}
              />

              <div className="mt-3 space-y-2">
                {attachments.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No attachments yet. Add KYC/ITR/Bank photos or PDFs.</div>
                ) : (
                  attachments.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 border border-slate-200/60 rounded-xl p-3 bg-white/70">
                      <button type="button" onClick={() => void openAttachment(a)} className="text-left min-w-0">
                        <div className="font-bold text-slate-900 truncate">{a.name || "Attachment"}</div>
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          <span className="chip">{a.kind || "file"}</span>
                          <span className="chip">{formatBytes(a.size)}</span>
                          <span className={`chip ${a.local ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                            {a.local ? "local" : "cloud"}
                          </span>
                        </div>
                      </button>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => void openAttachment(a)}>
                          <Download size={14} /> Open
                        </button>
                        {backendEnabled && a.local && (
                          <button
                            type="button"
                            className="btn-primary px-3 py-2 text-xs"
                            disabled={!!attachmentBusy?.[a.id]}
                            onClick={() => void uploadAttachment(a)}
                          >
                            {attachmentBusy?.[a.id] ? "Uploading…" : (
                              <>
                                <UploadCloud size={14} /> Upload
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger px-3 py-2 text-xs"
                          disabled={!!attachmentBusy?.[a.id]}
                          onClick={() => void removeAttachment(a)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {attachments.length > 8 && <div className="text-[10px] text-slate-400">Showing 8 of {attachments.length}.</div>}
              </div>

              <div className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                Uploading requires a Supabase Storage bucket named <span className="font-mono">liras-attachments</span> with policies. If upload fails, the file stays on this device.
              </div>
            </div>
          )}

          {!showRejectForm && !showPaymentForm && (
            <div className="surface-solid p-3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Assigned Partner</label>
              <select
                value={lead.mediatorId || "3"}
                onChange={(e) => onUpdate(lead.id, { mediatorId: e.target.value })}
                className="w-full py-2 text-sm"
              >
                {mediators.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!showRejectForm && !showPaymentForm && canReassignOwner && (
            <div className="surface-solid p-3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Assigned To (Staff)</label>
              {(() => {
                const options = Array.isArray(staffUsers) ? [...staffUsers] : [];
                const currentOwnerId = lead.ownerId ? String(lead.ownerId) : "";
                if (currentOwnerId && !options.some((u) => String(u.userId) === currentOwnerId)) {
                  options.unshift({ userId: currentOwnerId, label: "Current owner (syncing…)" });
                }

                return (
                  <select
                    value={lead.ownerId || ""}
                    onChange={(e) => onReassignOwner?.(lead.id, e.target.value)}
                    className="w-full py-2 text-sm"
                  >
                    <option value="" disabled>
                      — Select staff —
                    </option>
                    {options.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                );
              })()}
              <div className="text-[10px] text-slate-400 mt-2 leading-relaxed">Reassigning moves the lead to that staff. The assigned partner will be copied if needed.</div>
              {staffUsersError ? (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-700 font-bold">
                  Could not load staff list: {staffUsersError}
                </div>
              ) : staffUsers.length === 0 ? (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white/70 p-2 text-[10px] text-slate-600 font-bold">
                  No staff accounts found yet. Create them from <span className="font-semibold">Data &amp; Settings → Admin: Manage Users</span>, then reopen this lead.
                </div>
              ) : (
                <div className="mt-2 text-[10px] text-slate-400">Note: the staff device may need a refresh/logout-login to see newly assigned leads.</div>
              )}
            </div>
          )}

          {!showRejectForm && !showPaymentForm && ai?.run && (
            <LeadAiTools lead={lead} mediators={mediators} ai={ai} onUpdate={onUpdate} />
          )}

          {!showRejectForm && !showPaymentForm && lead.status === "Not Eligible" && (
            <button
              onClick={() => onOpenRejectionLetter?.(lead)}
              className="w-full py-3 btn-primary"
            >
              <Printer size={16} /> Print Mediator Rejection Letter
            </button>
          )}
        </div>

        <div className="flex flex-col h-[400px] surface-solid overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-white font-extrabold text-sm text-slate-700 flex justify-between items-center">
            <span>Activity Log</span>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-400">{lead.notes?.length || 0} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {[...(lead.notes || [])]
              .slice()
              .reverse()
              .map((n, i) => (
                <div key={i} className="bg-white/70 p-3 rounded-xl text-sm border border-slate-200/60 shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold mb-1 flex justify-between">
                    <span>{formatDateTime(n.date)}</span>
                  </div>
                  <div className="text-slate-700 leading-snug">{n.text}</div>
                </div>
              ))}
          </div>
          <div className="p-3 bg-white border-t flex gap-2">
            <input
              className="flex-1 py-2 text-sm"
              placeholder="Type note..."
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !e.currentTarget.value) return;
                onUpdate(lead.id, { notes: [...(lead.notes || []), { text: e.currentTarget.value, date: new Date().toISOString() }] });
                e.currentTarget.value = "";
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling;
                if (!(input instanceof HTMLInputElement)) return;
                if (!input.value) return;
                onUpdate(lead.id, { notes: [...(lead.notes || []), { text: input.value, date: new Date().toISOString() }] });
                input.value = "";
              }}
              className="btn-primary px-3 py-2"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function LirasApp({ backend = null }) {
  const backendEnabled = Boolean(backend?.enabled && backend?.supabase && backend?.user?.id);
  const supabase = backend?.supabase || null;
  const authUser = backend?.user || null;
  const role = backend?.role || "staff";
  const partnerPortal = backend?.partnerPortal || null;
  const isPartnerPortal = Boolean(partnerPortal?.enabled);
  const isAdmin = backendEnabled && role === "admin";
  const currentUser = backendEnabled ? authUser?.email || "User" : "Admin";
  const onLogout = typeof backend?.onLogout === "function" ? backend.onLogout : null;
  const nativeApp = useMemo(() => Capacitor.isNativePlatform(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(backendEnabled);
  const [bootstrapError, setBootstrapError] = useState("");
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffUsersError, setStaffUsersError] = useState("");
  const [staffReloadNonce, setStaffReloadNonce] = useState(0);
  const [leadAutomationRows, setLeadAutomationRows] = useState([]);
  const [leadAutomationViewUnavailable, setLeadAutomationViewUnavailable] = useState(false);

  const uuidv4 = () => {
    const bytes = new Uint8Array(16);
    // crypto is available in modern browsers + Capacitor WebView
    (globalThis.crypto || window.crypto).getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const DIRECT_MEDIATOR = useMemo(() => ({ id: "3", name: "Direct/None", phone: "", followUpHistory: [] }), []);
  const [activeView, setActiveView] = useState("dashboard");
  const [leads, setLeads] = useState(() => {
    if (backendEnabled) return [];
    const stored = parseJson(safeLocalStorage.getItem("liras_leads_v3"), null);
    const list = Array.isArray(stored) ? stored : MOCK_LEADS;
    return (list || []).map(sanitizeLead);
  });
  const [mediators, setMediators] = useState(() => {
    if (backendEnabled) return [DIRECT_MEDIATOR];
    const stored = parseJson(safeLocalStorage.getItem("liras_mediators_v3"), null);
    const list = Array.isArray(stored) ? stored : INITIAL_MEDIATORS;
    const sanitized = (list || []).map(sanitizeMediator).filter((m) => m && m.id && m.name);
    return sanitized.some((m) => m.id === "3") ? sanitized : [...sanitized, DIRECT_MEDIATOR];
  });
  const [activeLead, setActiveLead] = useState(null);
  const [leadModalInitialMode, setLeadModalInitialMode] = useState(null); // "payment" | null
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddMediatorModalOpen, setIsAddMediatorModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEmiOpen, setIsEmiOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dayLeads, setDayLeads] = useState(null);
  const [pdApplicationId, setPdApplicationId] = useState(null);
  const [pdLeadId, setPdLeadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const tasksKey = useMemo(() => {
    const suffix = backendEnabled ? String(authUser?.id || "user") : "offline";
    return `liras_tasks_v1_${suffix}`;
  }, [backendEnabled, authUser?.id]);
  const [tasks, setTasks] = useState(() => {
    const stored = parseJson(safeLocalStorage.getItem(tasksKey), []);
    return Array.isArray(stored) ? stored : [];
  });
  useEffect(() => {
    const stored = parseJson(safeLocalStorage.getItem(tasksKey), []);
    setTasks(Array.isArray(stored) ? stored : []);
  }, [tasksKey]);
  useEffect(() => {
    safeLocalStorage.setItem(tasksKey, JSON.stringify(tasks || []));
  }, [tasksKey, tasks]);

  const announcementsStorageKey = useMemo(() => {
    const suffix = backendEnabled ? String(authUser?.id || "user") : "offline";
    return `liras_announcements_v1_${suffix}`;
  }, [backendEnabled, authUser?.id]);
  const [announcements, setAnnouncements] = useState(() => {
    if (backendEnabled) return [];
    const stored = parseJson(safeLocalStorage.getItem(announcementsStorageKey), []);
    return Array.isArray(stored) ? stored.map(sanitizeAnnouncement) : [];
  });
  const [announcementsError, setAnnouncementsError] = useState("");
  const [announcementsReloadNonce, setAnnouncementsReloadNonce] = useState(0);

  const dismissedAnnouncementsKey = useMemo(() => {
    const suffix = backendEnabled ? String(authUser?.id || "user") : "offline";
    return `liras_announcements_dismissed_v1_${suffix}`;
  }, [backendEnabled, authUser?.id]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState(() => {
    const stored = parseJson(safeLocalStorage.getItem(dismissedAnnouncementsKey), []);
    return Array.isArray(stored) ? stored.map(String) : [];
  });

  useEffect(() => {
    const stored = parseJson(safeLocalStorage.getItem(dismissedAnnouncementsKey), []);
    setDismissedAnnouncementIds(Array.isArray(stored) ? stored.map(String) : []);
  }, [dismissedAnnouncementsKey]);
  useEffect(() => {
    safeLocalStorage.setItem(dismissedAnnouncementsKey, JSON.stringify(dismissedAnnouncementIds || []));
  }, [dismissedAnnouncementsKey, dismissedAnnouncementIds]);

  useEffect(() => {
    if (backendEnabled) return;
    safeLocalStorage.setItem(announcementsStorageKey, JSON.stringify((announcements || []).map(sanitizeAnnouncement)));
  }, [backendEnabled, announcementsStorageKey, announcements]);

  const viewsKeyBase = useMemo(() => {
    const suffix = backendEnabled ? String(authUser?.id || "user") : "offline";
    return `liras_views_v1_${suffix}`;
  }, [backendEnabled, authUser?.id]);
  const [tagFilter, setTagFilter] = useState(() => safeLocalStorage.getItem(`${viewsKeyBase}_tag`) || "");
  const [savedViews, setSavedViews] = useState(() => {
    const stored = parseJson(safeLocalStorage.getItem(`${viewsKeyBase}_saved`), []);
    return Array.isArray(stored) ? stored : [];
  });
  const [activeSavedViewId, setActiveSavedViewId] = useState(() => safeLocalStorage.getItem(`${viewsKeyBase}_active`) || "");
  const [editingMediator, setEditingMediator] = useState(null);
  const [addLeadType, setAddLeadType] = useState("new");
  const [reportType, setReportType] = useState(null);
  const [mediatorReportId, setMediatorReportId] = useState(null);
  const [midDayUpdateId, setMidDayUpdateId] = useState(null);
  const [mediatorRejectionReportId, setMediatorRejectionReportId] = useState(null);
  const [mediatorPendingReportId, setMediatorPendingReportId] = useState(null);
  const [mediatorQuickUpdateId, setMediatorQuickUpdateId] = useState(null);
  const [rejectionReportLead, setRejectionReportLead] = useState(null);
  const [leadPartnerStatusReport, setLeadPartnerStatusReport] = useState(null); // { leadId, includeTimeline }
  const [aiTone, setAiTone] = useState(() => safeLocalStorage.getItem("liras_ai_tone") || "partner");
  const [aiLanguage, setAiLanguage] = useState(() => safeLocalStorage.getItem("liras_ai_language") || "English");
  const [pendingCall, setPendingCall] = useState(() => parseJson(safeLocalStorage.getItem("liras_pending_call_v1"), null));
  const [isCallOutcomeOpen, setIsCallOutcomeOpen] = useState(false);
  const [callOutcomeForm, setCallOutcomeForm] = useState({ outcome: "connected", notes: "" });
  const mediatorLiteDeepLinkHandledRef = useRef(false);

  useEffect(() => {
    safeLocalStorage.setItem("liras_ai_tone", aiTone);
  }, [aiTone]);
  useEffect(() => {
    safeLocalStorage.setItem("liras_ai_language", aiLanguage);
  }, [aiLanguage]);

  useEffect(() => {
    setTagFilter(safeLocalStorage.getItem(`${viewsKeyBase}_tag`) || "");
    const stored = parseJson(safeLocalStorage.getItem(`${viewsKeyBase}_saved`), []);
    setSavedViews(Array.isArray(stored) ? stored : []);
    setActiveSavedViewId(safeLocalStorage.getItem(`${viewsKeyBase}_active`) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewsKeyBase]);

  useEffect(() => {
    safeLocalStorage.setItem(`${viewsKeyBase}_tag`, tagFilter || "");
  }, [viewsKeyBase, tagFilter]);

  useEffect(() => {
    safeLocalStorage.setItem(`${viewsKeyBase}_saved`, JSON.stringify(savedViews || []));
  }, [viewsKeyBase, savedViews]);

  useEffect(() => {
    safeLocalStorage.setItem(`${viewsKeyBase}_active`, activeSavedViewId || "");
  }, [viewsKeyBase, activeSavedViewId]);

  // Native app: prompt for call outcome after returning from the dialer (Play Store–safe; no call-log permission).
  useEffect(() => {
    if (!nativeApp) return;

    const maybePrompt = () => {
      if (document.hidden) return;
      const stored = parseJson(safeLocalStorage.getItem("liras_pending_call_v1"), null);
      if (!stored || typeof stored !== "object") return;
      if (stored.completed) return;
      const startedAt = stored.startedAt || stored.ts;
      const startedMs = startedAt ? new Date(startedAt).getTime() : 0;
      if (!Number.isFinite(startedMs) || startedMs <= 0) return;
      // Avoid popping immediately when the dialer didn't actually take focus.
      if (Date.now() - startedMs < 4000) return;
      // Ignore stale entries (e.g., user never came back).
      if (Date.now() - startedMs > 2 * 60 * 60 * 1000) {
        safeLocalStorage.removeItem("liras_pending_call_v1");
        setPendingCall(null);
        return;
      }
      setPendingCall(stored);
      setCallOutcomeForm({ outcome: "connected", notes: "" });
      setIsCallOutcomeOpen(true);
    };

    document.addEventListener("visibilitychange", maybePrompt);
    window.addEventListener("focus", maybePrompt);
    return () => {
      document.removeEventListener("visibilitychange", maybePrompt);
      window.removeEventListener("focus", maybePrompt);
    };
  }, [nativeApp]);

  const ai = useMemo(() => {
    if (!backendEnabled || !supabase) return null;
    return {
      tone: aiTone,
      language: aiLanguage,
      run: (action, payload, opts = {}) =>
        callAiAction({
          supabase,
          action,
          payload,
          tone: opts.tone ?? aiTone,
          language: opts.language ?? aiLanguage,
        }),
    };
  }, [backendEnabled, supabase, aiTone, aiLanguage]);

  useEffect(() => {
    if (backendEnabled) return;
    safeLocalStorage.setItem("liras_leads_v3", JSON.stringify(leads));
  }, [leads, backendEnabled]);
  useEffect(() => {
    if (backendEnabled) return;
    safeLocalStorage.setItem("liras_mediators_v3", JSON.stringify(mediators));
  }, [mediators, backendEnabled]);

  const normalizeMediatorsWithDirect = (list) => {
    if ((list || []).some((m) => m.id === "3")) return list;
    return [...(list || []), DIRECT_MEDIATOR];
  };

  const dbMediatorToUi = (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    name: row.name,
    phone: row.phone || "",
    followUpHistory: row.follow_up_history || [],
  });

  const dbLeadToUi = (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    name: row.name || "",
    phone: row.phone || "",
    company: row.company || "",
    location: row.location || "",
    status: row.status || "New",
    loanAmount: Number(row.loan_amount || 0),
    nextFollowUp: row.next_follow_up || new Date(Date.now() + 86400000).toISOString(),
    mediatorId: row.mediator_id ? row.mediator_id : "3",
    isHighPotential: !!row.is_high_potential,
    notes: row.notes || [],
    documents: row.documents || { kyc: false, itr: false, bank: false },
    loanDetails: row.loan_details || undefined,
    rejectionDetails: row.rejection_details || undefined,
    assignedStaff: row.assigned_staff || undefined,
  });

  const uiMediatorToDbInsert = (m) => ({
    id: m.id,
    owner_id: m.ownerId,
    created_by: m.createdBy,
    name: m.name,
    phone: m.phone || "",
    follow_up_history: m.followUpHistory || [],
  });
  const uiMediatorToDbUpdate = (m) => ({
    owner_id: m.ownerId,
    name: m.name,
    phone: m.phone || "",
    follow_up_history: m.followUpHistory || [],
  });

  const uiLeadToDbInsert = (l) => ({
    id: l.id,
    owner_id: l.ownerId,
    created_by: l.createdBy,
    name: l.name,
    phone: l.phone || "",
    company: l.company || "",
    location: l.location || "",
    status: l.status || "New",
    loan_amount: Number(l.loanAmount) || 0,
    next_follow_up: l.nextFollowUp || null,
    mediator_id: l.mediatorId && l.mediatorId !== "3" ? l.mediatorId : null,
    is_high_potential: !!l.isHighPotential,
    notes: l.notes || [],
    documents: l.documents || { kyc: false, itr: false, bank: false },
    loan_details: l.loanDetails || null,
    rejection_details: l.rejectionDetails || null,
    assigned_staff: l.assignedStaff || null,
  });
  const uiLeadToDbUpdate = (l) => ({
    owner_id: l.ownerId,
    name: l.name,
    phone: l.phone || "",
    company: l.company || "",
    location: l.location || "",
    status: l.status || "New",
    loan_amount: Number(l.loanAmount) || 0,
    next_follow_up: l.nextFollowUp || null,
    mediator_id: l.mediatorId && l.mediatorId !== "3" ? l.mediatorId : null,
    is_high_potential: !!l.isHighPotential,
    notes: l.notes || [],
    documents: l.documents || { kyc: false, itr: false, bank: false },
    loan_details: l.loanDetails || null,
    rejection_details: l.rejectionDetails || null,
    assigned_staff: l.assignedStaff || null,
  });

  useEffect(() => {
    if (!backendEnabled) return;
    let cancelled = false;

    setIsBootstrapping(true);
    setBootstrapError("");

    const load = async () => {
      const [leadsRes, mediatorsRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("mediators").select("*").order("name", { ascending: true }),
      ]);

      if (cancelled) return;

      if (leadsRes.error) {
        setBootstrapError(leadsRes.error.message || "Failed to load leads");
        setIsBootstrapping(false);
        return;
      }
      if (mediatorsRes.error) {
        setBootstrapError(mediatorsRes.error.message || "Failed to load mediators");
        setIsBootstrapping(false);
        return;
      }

      setLeads((leadsRes.data || []).map(dbLeadToUi));
      setMediators(normalizeMediatorsWithDirect((mediatorsRes.data || []).map(dbMediatorToUi)));
      setIsBootstrapping(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [backendEnabled, supabase, authUser?.id]);

  useEffect(() => {
    if (mediatorLiteDeepLinkHandledRef.current) return;
    if (!Array.isArray(mediators) || mediators.length === 0) return;
    mediatorLiteDeepLinkHandledRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search || "");
      const mode = String(params.get("mode") || "").toLowerCase();
      const mid = String(params.get("mid") || "").trim();
      if (mode !== "mediator-lite" || !mid) return;
      const target = mediators.find((m) => String(m?.id || "") === mid);
      if (!target) return;
      if (!isAashishPilotPartner(target?.name)) return;
      setMediatorQuickUpdateId(mid);
      setActiveView("mediators");
    } catch {
      // ignore malformed URL params
    }
  }, [mediators]);

  useEffect(() => {
    if (!backendEnabled) return;
    let cancelled = false;

    const loadAnnouncements = async () => {
      setAnnouncementsError("");
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        setAnnouncementsError(error.message || "Failed to load announcements");
        return;
      }

      setAnnouncements((data || []).map(sanitizeAnnouncement));
    };

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [backendEnabled, supabase, authUser?.id, announcementsReloadNonce]);

  useEffect(() => {
    if (!backendEnabled || !supabase || !authUser?.id) {
      setLeadAutomationRows([]);
      setLeadAutomationViewUnavailable(false);
      return;
    }
    if (leadAutomationViewUnavailable) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("lead_management_automation_view")
        .select(
          "lead_id,priority_label,sla_status,overdue_by_minutes,next_best_action,next_best_reason,docs_missing,duplicate_alert_count,open_task_count,overdue_task_count"
        );

      if (cancelled) return;

      if (error) {
        const msg = String(error?.message || error?.details || "");
        const code = String(error?.code || "");
        if (
          code === "PGRST205" ||
          /lead_management_automation_view/i.test(msg) ||
          /schema cache/i.test(msg) ||
          /does not exist/i.test(msg)
        ) {
          setLeadAutomationRows([]);
          setLeadAutomationViewUnavailable(true);
          return;
        }
        console.warn("Lead automation view load failed", error);
        return;
      }

      setLeadAutomationRows(Array.isArray(data) ? data : []);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [backendEnabled, supabase, authUser?.id, leads.length, leadAutomationViewUnavailable]);

  useEffect(() => {
    if (!backendEnabled || !isAdmin) return;
    let cancelled = false;

    const loadStaff = async () => {
      setStaffUsersError("");
      const { data, error } = await supabase.from("profiles").select("user_id,email,full_name,role").order("email", { ascending: true });
      if (cancelled) return;
      if (error) {
        setStaffUsers([]);
        setStaffUsersError(error.message || "Failed to load staff list");
        return;
      }

      const users = (data || [])
        .filter((p) => p.user_id && p.email)
        .map((p) => ({
          userId: p.user_id,
          email: p.email,
          role: p.role || "staff",
          label: p.full_name ? `${p.full_name} (${p.email})` : p.email,
        }));

      setStaffUsers(users);
    };

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [backendEnabled, isAdmin, supabase, authUser?.id, staffReloadNonce]);

  const dismissAnnouncement = (id) => {
    const announcementId = String(id || "");
    if (!announcementId) return;
    setDismissedAnnouncementIds((prev) => (prev || []).includes(announcementId) ? prev : [...(prev || []), announcementId]);
  };

  const activeAnnouncement = useMemo(() => {
    const dismissed = new Set((dismissedAnnouncementIds || []).map(String));
    const now = Date.now();
    const list = (announcements || [])
      .map(sanitizeAnnouncement)
      .filter((a) => a && a.id && a.isActive)
      .filter((a) => !dismissed.has(String(a.id)))
      .filter((a) => {
        const audience = String(a.audienceRole || "all").toLowerCase();
        if (audience === "admin") return isAdmin || !backendEnabled;
        return true; // all + staff visible to everyone (admin sees too)
      })
      .filter((a) => {
        const startMs = a.startsAt ? new Date(a.startsAt).getTime() : Number.NEGATIVE_INFINITY;
        const endMs = a.endsAt ? new Date(a.endsAt).getTime() : Number.POSITIVE_INFINITY;
        if (Number.isFinite(startMs) && now < startMs) return false;
        if (Number.isFinite(endMs) && now > endMs) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return list[0] || null;
  }, [announcements, dismissedAnnouncementIds, isAdmin, backendEnabled]);

  const reloadAnnouncements = () => setAnnouncementsReloadNonce((n) => n + 1);

  const createAnnouncement = async (draft) => {
    const cleaned = sanitizeAnnouncement({ ...draft, isActive: true });
    if (!cleaned.title.trim()) throw new Error("Title is required.");
    if (!cleaned.body.trim()) throw new Error("Message is required.");

    if (!backendEnabled) {
      const local = {
        ...cleaned,
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        isActive: true,
      };
      setAnnouncements((prev) => [local, ...(prev || [])].map(sanitizeAnnouncement).slice(0, 80));
      return local;
    }

    const payload = {
      title: cleaned.title,
      body: cleaned.body,
      severity: cleaned.severity,
      audience_role: cleaned.audienceRole,
      starts_at: cleaned.startsAt || null,
      ends_at: cleaned.endsAt || null,
      is_active: true,
      created_by: authUser.id,
    };

    const { data, error } = await supabase.from("announcements").insert(payload).select("*").single();
    if (error) throw error;
    const ui = sanitizeAnnouncement(data);
    setAnnouncements((prev) => [ui, ...(prev || [])].map(sanitizeAnnouncement).slice(0, 80));
    return ui;
  };

  const deactivateAnnouncement = async (id) => {
    const announcementId = String(id || "");
    if (!announcementId) return;

    if (!backendEnabled) {
      setAnnouncements((prev) => (prev || []).map((a) => (String(a.id) === announcementId ? sanitizeAnnouncement({ ...a, isActive: false }) : a)));
      return;
    }

    const { data, error } = await supabase
      .from("announcements")
      .update({ is_active: false })
      .eq("id", announcementId)
      .select("*")
      .single();
    if (error) throw error;
    const ui = sanitizeAnnouncement(data);
    setAnnouncements((prev) => (prev || []).map((a) => (String(a.id) === announcementId ? ui : a)));
  };

  const deleteAnnouncement = async (id) => {
    const announcementId = String(id || "");
    if (!announcementId) return;

    if (!backendEnabled) {
      setAnnouncements((prev) => (prev || []).filter((a) => String(a.id) !== announcementId));
      return;
    }

    const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
    if (error) throw error;
    setAnnouncements((prev) => (prev || []).filter((a) => String(a.id) !== announcementId));
  };

  const stats = useMemo(
    () => {
      const monthKeys = [];
      const anchor = new Date(`${toYmIST(new Date())}-01T00:00:00+05:30`);
      for (let i = 0; i < 6; i += 1) {
        const d = new Date(anchor.getTime());
        d.setMonth(d.getMonth() + i);
        monthKeys.push(toYmIST(d));
      }
      const renewal = leads.filter((l) => {
        if (!isRenewalEligibleLead(l)) return false;
        const info = getRenewalTimelineInfo(l);
        const renewalMonth = info?.renewalDate ? toYmIST(info.renewalDate) : "";
        if (renewalMonth && monthKeys.includes(renewalMonth)) return true;
        const nextAction = parseIsoOrNull(l?.nextFollowUp);
        const nextActionMonth = nextAction ? toYmIST(nextAction) : "";
        return Boolean(nextActionMonth && monthKeys.includes(nextActionMonth));
      }).length;
      return {
        total: leads.length,
        today: leads.filter((l) => isTodayIST(l.nextFollowUp)).length,
        overdue: leads.filter((l) => getDaysDiff(l.nextFollowUp) < 0 && !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable"].includes(l.status)).length,
        stale: leads.filter((l) => isStaleLead(l)).length,
        watch: leads.filter((l) => l.isHighPotential).length,
        renewal,
      };
    },
    [leads]
  );

  const portfolioSummary = useMemo(() => {
    const closed = new Set(["Payment Done", "Deal Closed"]);
    const rejected = new Set(["Not Eligible", "Not Reliable", "Lost to Competitor"]);
    let activeCount = 0;
    let activeVolume = 0;
    let closedCount = 0;
    let closedVolume = 0;
    let rejectedCount = 0;

    (leads || []).forEach((l) => {
      if (!l) return;
      const status = String(l.status || "New").trim() || "New";
      const amount = Number(l.loanAmount) || 0;
      if (closed.has(status)) {
        closedCount += 1;
        closedVolume += amount;
      } else if (rejected.has(status)) {
        rejectedCount += 1;
      } else {
        activeCount += 1;
        activeVolume += amount;
      }
    });

    return { activeCount, activeVolume, closedCount, closedVolume, rejectedCount };
  }, [leads]);

  const pipelineStageCounts = useMemo(() => {
    const counts = {};
    (leads || []).forEach((l) => {
      const status = String(l?.status || "New").trim() || "New";
      counts[status] = (counts[status] || 0) + 1;
    });

    const stages = [
      "New",
      "Meeting Scheduled",
      "Follow-Up Required",
      "Partner Follow-Up",
      "Commercial Client",
      "Payment Done",
      "Deal Closed",
      "Not Eligible",
      "Lost to Competitor",
    ];

    return stages.map((s) => ({ status: s, count: counts[s] || 0 }));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    return leads.filter(
      (l) =>
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.phone || "").includes(searchQuery) ||
        l.company?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [leads, searchQuery]);

  const allTags = useMemo(() => {
    const set = new Set();
    (leads || []).forEach((l) => {
      const tags = Array.isArray(l.documents?.tags) ? l.documents.tags : [];
      tags.forEach((t) => {
        const s = String(t || "").trim();
        if (s) set.add(s);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const leadAutomationByLeadId = useMemo(() => {
    const map = {};
    (leadAutomationRows || []).forEach((row) => {
      const key = String(row?.lead_id || "");
      if (key) map[key] = row;
    });
    return map;
  }, [leadAutomationRows]);

  const activeMediatorForProfile = useMemo(() => mediators.find((m) => m.id === activeView), [mediators, activeView]);

  const leadSaveTimers = useRef(new Map());
  const leadsRef = useRef(leads);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  // Note: keep all hooks above any conditional returns to avoid React hook order errors.
  if (backendEnabled && isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Loading data…</div>
          <div className="text-sm text-slate-500 mt-1">Syncing leads and mediators</div>
        </div>
      </div>
    );
  }

  const normalizeBootstrapError = (message) => {
    const msg = String(message || "").trim();
    if (!msg) return msg;
    if (/stack depth limit exceeded/i.test(msg)) {
      return [
        "Supabase database policy recursion detected (stack depth limit exceeded).",
        "Fix: update your Supabase RLS helper function `public.is_admin()` to be SECURITY DEFINER (see SUPABASE_SETUP.md), then retry.",
      ].join(" ");
    }
    return msg;
  };

  if (backendEnabled && bootstrapError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="text-lg font-bold text-red-700">Couldn’t load data</div>
          <div className="text-sm text-slate-600 mt-2">{normalizeBootstrapError(bootstrapError)}</div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => window.location.reload()} className="flex-1 bg-slate-900 hover:bg-black text-white py-2 rounded-lg font-bold">
              Retry
            </button>
            {onLogout && (
              <button onClick={onLogout} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-2 rounded-lg font-bold">
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const scheduleLeadPersist = (leadId) => {
    if (!backendEnabled) return;
    const timers = leadSaveTimers.current;
    const existing = timers.get(leadId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(leadId);
      const lead = (leadsRef.current || []).find((l) => l.id === leadId);
      if (!lead) return;
      void (async () => {
        const { error } = await supabase.from("leads").update(uiLeadToDbUpdate(lead)).eq("id", leadId);
        if (error) console.error("Lead update failed", error);
      })();
    }, 600);

    timers.set(leadId, timer);
  };

  const addLead = (data) => {
    const normalizePhone = (v) => String(v || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    const incomingPhone = normalizePhone(data?.phone);
    if (incomingPhone) {
      const existing = leads.find((l) => normalizePhone(l.phone) === incomingPhone);
      if (existing) {
        const ok = window.confirm(
          `A lead with this phone already exists:\n\n${existing.name}${existing.company ? " (" + existing.company + ")" : ""}\n\nCreate another lead anyway?`
        );
        if (!ok) return;
      }
    }

    const newLead = {
      id: backendEnabled ? uuidv4() : Date.now().toString(),
      ...data,
      ...(backendEnabled ? { ownerId: authUser.id, createdBy: authUser.id } : {}),
      createdAt: new Date().toISOString(),
      nextFollowUp: data.nextFollowUp || new Date(Date.now() + 86400000).toISOString(),
      notes: [{ text: `Lead created by ${currentUser}`, date: new Date().toISOString() }, ...(data.notes || [])],
      loanAmount: Number(data.loanAmount) || 0,
      documents: {
        kyc: false,
        itr: false,
        bank: false,
        tags: [],
        attachments: [],
        ...(data.documents && typeof data.documents === "object" ? data.documents : {}),
      },
      loanDetails:
        data.loanDetails ||
        (data.status === "Payment Done"
          ? { principal: Number(data.loanAmount), interest: 0, netDisbursed: Number(data.loanAmount), tenure: 12, frequency: "Monthly", paymentDate: new Date().toISOString() }
          : undefined),
    };
    if (data.status === "Payment Done" && !data.loanDetails) {
      newLead.notes.push({ text: "Lead marked as Renewal/Existing Client", date: new Date().toISOString() });
    }
    setLeads((prev) => [newLead, ...prev]);
    setIsAddModalOpen(false);

    if (backendEnabled) {
      void (async () => {
        const { data: row, error } = await supabase.from("leads").insert(uiLeadToDbInsert(newLead)).select("*").single();
        if (error) {
          alert(`Backend save failed: ${error.message}`);
          return;
        }
        setLeads((prev) => prev.map((l) => (l.id === newLead.id ? dbLeadToUi(row) : l)));
      })();
    }
  };

  const updateLead = (id, updates, opts = {}) => {
    const skipBackend = !!opts.skipBackend;
    let prevLeadSnapshot = null;
    let nextLeadSnapshot = null;
    setLeads((prev) =>
      (prev || []).map((l) => {
        if (l.id !== id) return l;
        prevLeadSnapshot = l;
        nextLeadSnapshot = { ...l, ...updates };
        return nextLeadSnapshot;
      })
    );
    setActiveLead((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));

    if (!skipBackend && backendEnabled) {
      scheduleLeadPersist(id);
    }

    const followStatusChanged =
      nextLeadSnapshot &&
      isFollowUpStatusValue(nextLeadSnapshot.status) &&
      (
        !prevLeadSnapshot ||
        !isFollowUpStatusValue(prevLeadSnapshot.status) ||
        String(prevLeadSnapshot.nextFollowUp || "") !== String(nextLeadSnapshot.nextFollowUp || "")
      );

    if (followStatusChanged) {
      const ownerId = String(nextLeadSnapshot.ownerId || authUser?.id || "");
      const assignedTo = String(nextLeadSnapshot.ownerId || authUser?.id || "");
      const baseDueAt = nextLeadSnapshot.nextFollowUp ? ensureIsoString(nextLeadSnapshot.nextFollowUp, nextBusinessDay10AmIstIso()) : nextBusinessDay10AmIstIso();
      const dueYmd = toYmdIST(baseDueAt) || toYmdIST(new Date());
      const dedupeKey = `FOLLOW_UP:${nextLeadSnapshot.id}:${dueYmd}`;
      const localTaskId = `fu_${String(nextLeadSnapshot.id)}_${dueYmd}`;
      const title = `Follow up: ${nextLeadSnapshot.name || "Lead"}`;
      const taskNotes = `Auto-created from lead status (${String(nextLeadSnapshot.status || "")})`;

      setTasks((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((t) => String(t?.dedupeKey || "") === dedupeKey || String(t?.id || "") === localTaskId);
        const nextTask = {
          id: idx >= 0 ? String(list[idx].id || localTaskId) : localTaskId,
          title,
          dueAt: baseDueAt,
          priority: "medium",
          leadId: String(nextLeadSnapshot.id),
          notes: idx >= 0 && list[idx]?.notes ? String(list[idx].notes) : taskNotes,
          done: idx >= 0 ? Boolean(list[idx].done) : false,
          createdAt: idx >= 0 ? String(list[idx].createdAt || new Date().toISOString()) : new Date().toISOString(),
          dedupeKey,
          taskType: "FOLLOW_UP",
          source: "lead_status",
        };
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...nextTask };
          return list;
        }
        return [nextTask, ...list];
      });

      if (backendEnabled && supabase && ownerId) {
        void (async () => {
          try {
            const { data: existing, error: findErr } = await supabase
              .from("tasks")
              .select("id,status")
              .eq("dedupe_key", dedupeKey)
              .limit(1)
              .maybeSingle();
            if (findErr) throw findErr;

            const payload = {
              owner_id: ownerId,
              created_by: authUser?.id || null,
              assigned_to: assignedTo || null,
              lead_id: nextLeadSnapshot.id,
              task_type: "FOLLOW_UP",
              status: String(existing?.status || "OPEN") === "DONE" ? "DONE" : "OPEN",
              title,
              due_at: baseDueAt,
              due_window_end: new Date(new Date(baseDueAt).getTime() + 8 * 60 * 60 * 1000).toISOString(),
              dedupe_key: dedupeKey,
              payload_json: {
                lead_status: String(nextLeadSnapshot.status || ""),
                source: "web_lead_status_update",
              },
            };

            if (existing?.id) {
              const { error: updErr } = await supabase.from("tasks").update(payload).eq("id", existing.id);
              if (updErr) throw updErr;
            } else {
              const { error: insErr } = await supabase.from("tasks").insert(payload);
              if (insErr) throw insErr;
            }
          } catch {
            // The SQL migration / tasks table may not exist yet; local task is still created.
          }
        })();
      }
    }
  };

  const handleMediatorFollowUp = (mediatorId, actionType = "whatsapp", meta = null) => {
    const now = meta?.ts ? new Date(meta.ts) : new Date();
    const nowIso = now.toISOString();
    const today = toYmdIST(now);
    const time = formatTimeIST(now);
    let updatedMediator = null;
    setMediators((prev) =>
      prev.map((m) => {
        if (m.id === mediatorId) {
          let history = m.followUpHistory || [];
          history = history
            .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
            .filter((h) => h && typeof h === "object" && typeof h.date === "string");
          if (actionType === "undo") {
            const next = history.filter((h) => (h?.ts ? toYmdIST(h.ts) !== today : String(h.date || "") !== today));
            if (next.length === history.length) return m; // nothing to undo
            updatedMediator = { ...m, followUpHistory: next };
            return updatedMediator;
          } else {
            // Append (do not overwrite) so we can track multiple interactions per day.
            updatedMediator = { ...m, followUpHistory: [...history, { date: today, time, type: actionType, ts: nowIso }] };
            return updatedMediator;
          }
        }
        return m;
      })
    );

    if (backendEnabled && updatedMediator && updatedMediator.id !== "3") {
      void (async () => {
        const { error } = await supabase.from("mediators").update(uiMediatorToDbUpdate(updatedMediator)).eq("id", updatedMediator.id);
        if (error) alert(`Backend update failed: ${error.message}`);
      })();
    }
  };

  const dismissPendingCall = () => {
    try {
      safeLocalStorage.removeItem("liras_pending_call_v1");
    } catch {
      // ignore
    }
    setPendingCall(null);
    setIsCallOutcomeOpen(false);
  };

  const savePendingCallOutcome = () => {
    const pending = pendingCall && typeof pendingCall === "object" ? pendingCall : null;
    const kind = String(pending?.kind || (pending?.leadId ? "lead" : pending?.mediatorId ? "mediator" : "")).toLowerCase();

    const ts = pending?.ts || pending?.startedAt || null;
    const endedAt = new Date();
    const endedAtIso = endedAt.toISOString();
    const endedDate = toYmdIST(endedAt);
    const endedTime = formatTimeIST(endedAt);
    const outcome = String(callOutcomeForm.outcome || "connected");
    const notes = String(callOutcomeForm.notes || "").trim();

    if (kind === "lead") {
      const leadId = pending?.leadId ? String(pending.leadId) : "";
      if (!leadId) {
        dismissPendingCall();
        return;
      }
      const outcomeLabel = outcome.replace(/_/g, " ");
      const extra = notes ? ` • ${notes}` : "";
      const phone = pending?.phone ? ` • ${String(pending.phone).replace(/[^\d+]/g, "")}` : "";
      const text = `[CALL]: Outcome=${outcomeLabel}${phone}${extra}`;
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        updateLead(leadId, { notes: [...(lead.notes || []), { text, date: endedAtIso }] });
      }
      dismissPendingCall();
      return;
    }

    const mediatorId = pending?.mediatorId ? String(pending.mediatorId) : "";
    if (!mediatorId) {
      dismissPendingCall();
      return;
    }

    let updatedMediator = null;
    setMediators((prev) =>
      prev.map((m) => {
        if (m.id !== mediatorId) return m;
        const history = (Array.isArray(m.followUpHistory) ? m.followUpHistory : [])
          .map((h) => (typeof h === "string" ? { date: h, time: "00:00", type: "legacy" } : h))
          .filter((h) => h && typeof h === "object" && typeof h.date === "string");

        let updated = false;
        const nextHistory = history.map((h) => {
          if (ts && h.ts === ts && h.type === "call") {
            updated = true;
            return { ...h, outcome, notes, endedAt: endedAtIso };
          }
          return h;
        });

        if (!updated) {
          nextHistory.push({ date: endedDate, time: endedTime, type: "call", ts: ts || endedAtIso, outcome, notes, endedAt: endedAtIso });
        }

        updatedMediator = { ...m, followUpHistory: nextHistory };
        return updatedMediator;
      })
    );

    dismissPendingCall();

    if (backendEnabled && updatedMediator && updatedMediator.id !== "3") {
      void (async () => {
        const { error } = await supabase.from("mediators").update(uiMediatorToDbUpdate(updatedMediator)).eq("id", updatedMediator.id);
        if (error) alert(`Backend update failed: ${error.message}`);
      })();
    }
  };

  const deleteLead = (id) => {
    if (window.confirm("Delete lead?")) {
      const t = leadSaveTimers.current.get(id);
      if (t) {
        clearTimeout(t);
        leadSaveTimers.current.delete(id);
      }
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setActiveLead(null);

      if (backendEnabled) {
        void (async () => {
          const { error } = await supabase.from("leads").delete().eq("id", id);
          if (error) alert(`Backend delete failed: ${error.message}`);
        })();
      }
    }
  };

  const addMediator = (data) => {
    const newMediator = {
      id: backendEnabled ? uuidv4() : Date.now().toString(),
      ...data,
      ...(backendEnabled ? { ownerId: authUser.id, createdBy: authUser.id } : {}),
      followUpHistory: [],
    };
    setMediators((prev) => [...prev, newMediator]);
    setIsAddMediatorModalOpen(false);

    if (backendEnabled && newMediator.id !== "3") {
      void (async () => {
        const { data: row, error } = await supabase.from("mediators").insert(uiMediatorToDbInsert(newMediator)).select("*").single();
        if (error) {
          alert(`Backend save failed: ${error.message}`);
          return;
        }
        setMediators((prev) => normalizeMediatorsWithDirect(prev.map((m) => (m.id === newMediator.id ? dbMediatorToUi(row) : m))));
      })();
    }
  };
  const updateMediator = (id, updates) => {
    const existing = mediators.find((m) => m.id === id);
    const nextMediator = existing ? { ...existing, ...updates } : null;
    setMediators((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    setEditingMediator(null);

    if (backendEnabled && nextMediator && nextMediator.id !== "3") {
      void (async () => {
        const { error } = await supabase.from("mediators").update(uiMediatorToDbUpdate(nextMediator)).eq("id", id);
        if (error) alert(`Backend update failed: ${error.message}`);
      })();
    }
  };
  const deleteMediator = (id) => {
    if (!window.confirm("Delete mediator?")) return false;
    if (id === "3") return false;
    setMediators((prev) => prev.filter((m) => m.id !== id));
    setLeads((prev) => prev.map((l) => (l.mediatorId === id ? { ...l, mediatorId: "3" } : l)));

    if (backendEnabled) {
      void (async () => {
        const del = await supabase.from("mediators").delete().eq("id", id);
        if (del.error) {
          alert(`Backend delete failed: ${del.error.message}`);
          return;
        }
        const upd = await supabase.from("leads").update({ mediator_id: null }).eq("mediator_id", id);
        if (upd.error) alert(`Backend update failed: ${upd.error.message}`);
      })();
    }
    return true;
  };

  const reassignLeadOwner = async (leadId, newOwnerId) => {
    if (!backendEnabled || !isAdmin) return;
    const targetOwnerId = String(newOwnerId || "").trim();
    if (!targetOwnerId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const prevLead = lead;

    let nextMediatorId = lead.mediatorId || "3";

    // If lead had a partner mediator, clone/copy it into the new owner's private mediator list.
    if (lead.mediatorId && lead.mediatorId !== "3") {
      const currentMediator = mediators.find((m) => m.id === lead.mediatorId);
      if (!currentMediator) {
        nextMediatorId = "3";
      } else {
        const phone = currentMediator.phone || "";
        const existing = await supabase
          .from("mediators")
          .select("*")
          .eq("owner_id", targetOwnerId)
          .eq("name", currentMediator.name)
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();

        if (existing.error) {
          alert(`Could not check mediator for staff: ${existing.error.message}`);
          return;
        }

        if (existing.data?.id) {
          nextMediatorId = existing.data.id;
        } else {
          const clone = {
            id: uuidv4(),
            ownerId: targetOwnerId,
            createdBy: authUser.id,
            name: currentMediator.name,
            phone,
            followUpHistory: [],
          };

          const inserted = await supabase.from("mediators").insert(uiMediatorToDbInsert(clone)).select("*").single();
          if (inserted.error) {
            alert(`Could not copy mediator to staff: ${inserted.error.message}`);
            return;
          }

          const uiInserted = dbMediatorToUi(inserted.data);
          setMediators((prev) => normalizeMediatorsWithDirect([...(prev || []).filter((m) => m.id !== "3"), uiInserted]));
          nextMediatorId = uiInserted.id;
        }
      }
    }

    // Optimistically update UI first (skip debounced backend write) then commit immediately.
    updateLead(leadId, { ownerId: targetOwnerId, mediatorId: nextMediatorId }, { skipBackend: true });

    const { data: row, error } = await supabase
      .from("leads")
      .update({
        owner_id: targetOwnerId,
        mediator_id: nextMediatorId && nextMediatorId !== "3" ? nextMediatorId : null,
      })
      .eq("id", leadId)
      .select("*")
      .single();

    if (error) {
      setLeads((prev) => (prev || []).map((l) => (l.id === leadId ? prevLead : l)));
      setActiveLead((prev) => (prev && prev.id === leadId ? prevLead : prev));
      alert(`Could not reassign lead: ${error.message}`);
      return;
    }

    const updatedLead = dbLeadToUi(row);
    setLeads((prev) => (prev || []).map((l) => (l.id === leadId ? updatedLead : l)));
    setActiveLead((prev) => (prev && prev.id === leadId ? updatedLead : prev));
  };

  const exportCSV = () => {
    const escapeCsvCell = (value) => {
      const s = String(value ?? "");
      const needsQuotes = /[",\n\r]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const headers = ["ID", "Name", "Company", "Phone", "Mediator", "Status", "Loan Amount", "Date Created", "Last Note"];
    const rows = leads.map((l) => [
      l.id,
      l.name,
      l.company,
      l.phone,
      mediators.find((m) => m.id === l.mediatorId)?.name || "",
      l.status,
      l.loanAmount,
      new Date(l.createdAt).toLocaleDateString(),
      l.notes[l.notes.length - 1]?.text || "",
    ]);

    const csvText = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + csvText;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `LIRAS_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const parseCsv = (text) => {
      const rows = [];
      let row = [];
      let cell = "";
      let inQuotes = false;

      const pushCell = () => {
        row.push(cell);
        cell = "";
      };
      const pushRow = () => {
        // Ignore empty trailing row
        if (row.length === 1 && row[0] === "") return;
        rows.push(row);
        row = [];
      };

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inQuotes) {
          if (ch === '"') {
            const next = text[i + 1];
            if (next === '"') {
              cell += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cell += ch;
          }
          continue;
        }

        if (ch === '"') {
          inQuotes = true;
          continue;
        }

        if (ch === ",") {
          pushCell();
          continue;
        }

        if (ch === "\n") {
          pushCell();
          pushRow();
          continue;
        }

        if (ch === "\r") {
          continue;
        }

        cell += ch;
      }

      pushCell();
      pushRow();
      return rows;
    };

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCsv(text);
      const [headerRow, ...dataRows] = parsed;
      if (!headerRow || headerRow.length === 0) {
        alert("CSV has no header row.");
        return;
      }

      const headerIndex = new Map(headerRow.map((h, idx) => [String(h || "").trim().toLowerCase(), idx]));
      const idxName = headerIndex.get("name") ?? 1;
      const idxCompany = headerIndex.get("company") ?? 2;
      const idxPhone = headerIndex.get("phone") ?? 3;
      const idxStatus = headerIndex.get("status") ?? 5;
      const idxLoan = headerIndex.get("loan amount") ?? headerIndex.get("loan_amount") ?? 6;
      const idxNote = headerIndex.get("last note") ?? headerIndex.get("last_note") ?? 8;

      const nowIso = new Date().toISOString();
      const created = [];
      for (const cols of dataRows) {
        const name = String(cols[idxName] || "").trim();
        if (!name) continue;
        const company = String(cols[idxCompany] || "").trim();
        const phone = String(cols[idxPhone] || "").trim();
        const status = String(cols[idxStatus] || "New").trim() || "New";
        const loanAmountRaw = String(cols[idxLoan] || "0").replace(/[^\d]/g, "");
        const loanAmount = Number(loanAmountRaw || 0);
        const note = String(cols[idxNote] || "").trim();

        created.push({
          id: backendEnabled ? uuidv4() : Date.now() + Math.random().toString(),
          ...(backendEnabled ? { ownerId: authUser.id, createdBy: authUser.id } : {}),
          name,
          phone,
          company,
          location: "",
          status,
          loanAmount,
          nextFollowUp: new Date(Date.now() + 86400000).toISOString(),
          mediatorId: "3",
          isHighPotential: false,
          notes: [{ text: note ? `Imported via CSV: ${note}` : "Imported via CSV", date: nowIso }],
          documents: { kyc: false, itr: false, bank: false },
        });
      }

      if (created.length === 0) {
        alert("No leads found in CSV.");
        return;
      }

      if (!backendEnabled) {
        setLeads((prev) => [...created, ...prev]);
        alert(`Imported ${created.length} leads successfully.`);
        return;
      }

      if (!window.confirm(`Import ${created.length} leads into the backend?`)) return;

      void (async () => {
        const toInsert = created.map((l) => uiLeadToDbInsert(l));
        const { data: inserted, error } = await supabase.from("leads").insert(toInsert).select("*");
        if (error) {
          alert(`Backend import failed: ${error.message}`);
          return;
        }
        const uiInserted = (inserted || []).map(dbLeadToUi);
        setLeads((prev) => [...uiInserted, ...prev]);
        alert(`Imported ${uiInserted.length} leads successfully.`);
      })();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBackup = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      leads,
      mediators: (mediators || []).filter((m) => m.id !== "3"),
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LIRAS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const backup = parsed && parsed.leads && parsed.mediators ? parsed : null;
        if (!backup) {
          alert("Invalid backup file.");
          return;
        }

        if (!backendEnabled) {
          setLeads(Array.isArray(backup.leads) ? backup.leads : []);
          setMediators(normalizeMediatorsWithDirect((Array.isArray(backup.mediators) ? backup.mediators : []).filter((m) => m?.id !== "3")));
          alert("System restored successfully!");
          return;
        }

        if (!window.confirm("Import this backup into your backend account? (This will ADD records; it won’t delete existing data.)")) return;

        void (async () => {
          const backupMediators = (Array.isArray(backup.mediators) ? backup.mediators : []).filter((m) => m && m.id !== "3");
          const backupLeads = Array.isArray(backup.leads) ? backup.leads : [];

          const keyFor = (name, phone) => `${String(name || "").trim().toLowerCase()}|${String(phone || "").trim()}`;

          // Existing mediators in the importing user account
          // (RLS restricts staff automatically; admin must be explicitly scoped to avoid cross-owner matches)
          const existingRes = await supabase.from("mediators").select("id,name,phone").eq("owner_id", authUser.id);
          if (existingRes.error) {
            alert(`Could not load existing mediators: ${existingRes.error.message}`);
            return;
          }

          const existingByKey = new Map((existingRes.data || []).map((m) => [keyFor(m.name, m.phone), m.id]));
          const mediatorIdMap = new Map(); // oldId -> newId/existingId
          const mediatorsToInsert = [];

          for (const m of backupMediators) {
            const name = String(m.name || "").trim();
            if (!name) continue;
            const phone = String(m.phone || "");
            const k = keyFor(name, phone);
            const existingId = existingByKey.get(k);
            if (existingId) {
              mediatorIdMap.set(m.id, existingId);
              continue;
            }
            const newId = uuidv4();
            mediatorIdMap.set(m.id, newId);
            mediatorsToInsert.push({
              id: newId,
              ownerId: authUser.id,
              createdBy: authUser.id,
              name,
              phone,
              followUpHistory: Array.isArray(m.followUpHistory) ? m.followUpHistory : [],
            });
          }

          if (mediatorsToInsert.length > 0) {
            const ins = await supabase.from("mediators").insert(mediatorsToInsert.map(uiMediatorToDbInsert)).select("*");
            if (ins.error) {
              alert(`Mediator import failed: ${ins.error.message}`);
              return;
            }
            const uiInserted = (ins.data || []).map(dbMediatorToUi);
            setMediators((prev) => normalizeMediatorsWithDirect([...(prev || []).filter((m) => m.id !== "3"), ...uiInserted]));
          }

          const leadsToInsert = [];
          for (const l of backupLeads) {
            const name = String(l.name || "").trim();
            if (!name) continue;
            const newId = uuidv4();
            const oldMediatorId = l.mediatorId && l.mediatorId !== "3" ? l.mediatorId : null;
            const mappedMediatorId = oldMediatorId ? mediatorIdMap.get(oldMediatorId) || null : null;

            leadsToInsert.push({
              id: newId,
              ownerId: authUser.id,
              createdBy: authUser.id,
              createdAt: new Date().toISOString(),
              name,
              phone: String(l.phone || ""),
              company: String(l.company || ""),
              location: String(l.location || ""),
              status: String(l.status || "New") || "New",
              loanAmount: Number(l.loanAmount || 0),
              nextFollowUp: l.nextFollowUp || new Date(Date.now() + 86400000).toISOString(),
              mediatorId: mappedMediatorId ? mappedMediatorId : "3",
              isHighPotential: !!l.isHighPotential,
              notes: Array.isArray(l.notes) ? l.notes : [],
              documents: l.documents || { kyc: false, itr: false, bank: false },
              loanDetails: l.loanDetails || null,
              rejectionDetails: l.rejectionDetails || null,
              assignedStaff: l.assignedStaff || null,
            });
          }

          if (leadsToInsert.length === 0) {
            alert("Backup contained no leads to import.");
            return;
          }

          const insLeads = await supabase.from("leads").insert(leadsToInsert.map(uiLeadToDbInsert)).select("*");
          if (insLeads.error) {
            alert(`Lead import failed: ${insLeads.error.message}`);
            return;
          }
          const uiLeads = (insLeads.data || []).map(dbLeadToUi);
          setLeads((prev) => [...uiLeads, ...prev]);
          alert(`Imported ${uiLeads.length} leads successfully.`);
        })();
      } catch {
        alert("Error parsing backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- Full-screen reports ---
  if (rejectionReportLead) {
    return <RejectReportView lead={rejectionReportLead} onBack={() => setRejectionReportLead(null)} />;
  }
  if (leadPartnerStatusReport?.leadId) {
    const lead = leads.find((l) => String(l.id) === String(leadPartnerStatusReport.leadId));
    if (!lead) return null;
    const mediator = mediators.find((m) => String(m.id) === String(lead.mediatorId));
    return (
      <LeadPartnerStatusRequestPdfView
        lead={lead}
        mediator={mediator}
        includeTimeline={!!leadPartnerStatusReport.includeTimeline}
        onBack={() => setLeadPartnerStatusReport(null)}
      />
    );
  }
  if (reportType === "eod") {
    return <EodActivityReport leads={leads} mediators={mediators} staffUsers={staffUsers} onBack={() => setReportType(null)} />;
  }
  if (reportType === "daily_activity") {
    return (
      <EodActivityReport mode="daily" leads={leads} mediators={mediators} staffUsers={staffUsers} onBack={() => setReportType(null)} />
    );
  }
  if (reportType === "clearance_pdf") {
    return <ClearancePrintReport leads={leads} mediators={mediators} onBack={() => setReportType(null)} />;
  }
  if (reportType === "rejection_internal") {
    return <InternalRejectionMasterReportView leads={leads} mediators={mediators} onBack={() => setReportType(null)} />;
  }
  if (reportType === "owner_daily_partner") {
    return (
      <OwnerDailyPartnerReportView
        leads={leads}
        mediators={mediators}
        staffUsers={staffUsers}
        backendEnabled={backendEnabled}
        authUser={authUser}
        currentUser={currentUser}
        onBack={() => setReportType(null)}
      />
    );
  }
  if (reportType === "daily_work_plan") {
    return (
      <DailyWorkUpdatePlanReportView
        leads={leads}
        mediators={mediators}
        staffUsers={staffUsers}
        backendEnabled={backendEnabled}
        authUser={authUser}
        currentUser={currentUser}
        onBack={() => setReportType(null)}
      />
    );
  }
  if (reportType && ["daily", "monthly", "quarterly"].includes(reportType)) {
    return <EnhancedProfessionalReport type={reportType} leads={leads} mediators={mediators} ai={ai} onBack={() => setReportType(null)} />;
  }
  if (mediatorReportId) {
    const mediator = mediators.find((m) => m.id === mediatorReportId);
    if (!mediator) return null;
    return <EnhancedMediatorReport mediator={mediator} leads={leads} onBack={() => setMediatorReportId(null)} />;
  }
  if (midDayUpdateId) {
    const mediator = mediators.find((m) => m.id === midDayUpdateId);
    if (!mediator) return null;
    return <MidDayUpdateView mediator={mediator} leads={leads} onBack={() => setMidDayUpdateId(null)} />;
  }
  if (mediatorRejectionReportId) {
    const mediator = mediators.find((m) => m.id === mediatorRejectionReportId);
    if (!mediator) return null;
    return <MediatorRejectionReportView mediator={mediator} leads={leads} onBack={() => setMediatorRejectionReportId(null)} />;
  }
  if (mediatorPendingReportId) {
    const mediator = mediators.find((m) => m.id === mediatorPendingReportId);
    if (!mediator) return null;
    return (
      <MediatorPendingReportView
        mediator={mediator}
        leads={leads}
        onBack={() => setMediatorPendingReportId(null)}
        onUpdateLead={updateLead}
      />
    );
  }
  if (isPartnerPortal) {
    const sessionEmail = String(authUser?.email || "").trim().toLowerCase();
    const emailMap = partnerPortal?.emailMediatorMap && typeof partnerPortal.emailMediatorMap === "object" ? partnerPortal.emailMediatorMap : {};
    const mappedHintRaw = String(emailMap[sessionEmail] || "").trim();
    const mappedHint = mappedHintRaw.toLowerCase();

    let portalMediator = null;
    if (mappedHint) {
      portalMediator =
        mediators.find((m) => String(m?.id || "").toLowerCase() === mappedHint) ||
        mediators.find((m) => String(m?.name || "").toLowerCase() === mappedHint) ||
        mediators.find((m) => String(m?.name || "").toLowerCase().includes(mappedHint));
    }
    if (!portalMediator) {
      portalMediator = mediators.find((m) => isAashishPilotPartner(m?.name));
    }
    if (!portalMediator) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="surface p-6 max-w-md w-full text-center">
            <div className="text-lg font-extrabold text-slate-900">Portal setup incomplete</div>
            <div className="text-sm text-slate-500 mt-2">Aashish partner profile is not available in this account.</div>
            {onLogout ? (
              <button type="button" className="btn-primary mt-4" onClick={onLogout}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <PartnerSimpleStatusPortal
        mediator={portalMediator}
        leads={leads}
        onUpdateLead={updateLead}
        onLogout={onLogout}
      />
    );
  }
  if (mediatorQuickUpdateId) {
    const mediator = mediators.find((m) => String(m.id) === String(mediatorQuickUpdateId));
    if (!mediator || !isAashishPilotPartner(mediator?.name)) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="surface p-6 max-w-md w-full text-center">
            <div className="text-lg font-extrabold text-slate-900">Partner board unavailable</div>
            <div className="text-sm text-slate-500 mt-2">This pilot board is currently enabled only for Aashish.</div>
            <button type="button" className="btn-primary mt-4" onClick={() => setMediatorQuickUpdateId(null)}>
              Back to app
            </button>
          </div>
        </div>
      );
    }
    return (
      <MediatorQuickUpdateView
        mediator={mediator}
        leads={leads}
        onBack={() => setMediatorQuickUpdateId(null)}
        onUpdateLead={updateLead}
        onOpenLead={(lead) => {
          setMediatorQuickUpdateId(null);
          setActiveLead(lead);
        }}
      />
    );
  }

  let displayLeads = filteredLeads;
  if (activeView === "today") displayLeads = filteredLeads.filter((l) => isTodayIST(l.nextFollowUp));
  else if (activeView === "overdue")
    displayLeads = filteredLeads.filter(
      (l) => getDaysDiff(l.nextFollowUp) < 0 && !["Payment Done", "Deal Closed", "Not Eligible", "Not Reliable"].includes(l.status)
    );
  else if (activeView === "stale")
    displayLeads = filteredLeads.filter((l) => isStaleLead(l));
  else if (activeView === "watchlist") displayLeads = filteredLeads.filter((l) => l.isHighPotential);
  else if (activeView === "renewal_watch")
    displayLeads = filteredLeads.filter((l) => isRenewalEligibleLead(l));
  if (activeView === "all" && tagFilter) {
    displayLeads = displayLeads.filter((l) => (Array.isArray(l.documents?.tags) ? l.documents.tags : []).includes(tagFilter));
  }

  const newLeads = leads.filter((l) => l.status === "New");
  // Meetings whose scheduled time has already passed (including earlier today).
  const pendingReviews = leads.filter((l) => l.status === "Meeting Scheduled" && l.nextFollowUp && new Date(l.nextFollowUp) <= new Date());
  const dailyPending = leads.filter(
    (l) =>
      !isClosedOrRejectedLeadStatus(l.status) &&
      l.status !== "Meeting Scheduled" &&
      !(parseIsoOrNull(l?.nextFollowUp) && getDaysDiff(l.nextFollowUp) > 0) &&
      (!l.notes.length || !isTodayIST(l.notes[l.notes.length - 1].date))
  );
  const clearanceCount = pendingReviews.length + dailyPending.length;

  const isLeadsSection = ["all", "kanban", "calendar", "watchlist", "stale"].includes(activeView);
  const isCollectionsSection = ["today", "overdue", "renewal_watch", "clearance"].includes(activeView);
  const isCrmSection =
    ["android_myday", "android_tasks", "android_partners", "mediators"].includes(activeView) || Boolean(activeMediatorForProfile);
  const isReportsSection = ["reports", "analytics"].includes(activeView);
  const isUnderwritingSection = ["underwriting", "pd"].includes(activeView);
  const isSettingsSection = activeView === "settings";
  const collectionsBadge = clearanceCount > 0 ? clearanceCount : stats.overdue > 0 ? stats.overdue : undefined;

  return (
    <div className="flex h-full safe-bottom">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-10 md:hidden print:hidden"
        />
      )}

      <div
        className={`fixed md:relative inset-y-0 left-0 w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200 transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform z-20 flex flex-col shadow-2xl border-r border-white/10 print:hidden`}
      >
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 mt-0.5">
              <BrandMark size={34} className="opacity-95" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white tracking-tight truncate">
                {BRAND.name.split(" ")[0]} <span className="text-indigo-400">{BRAND.name.split(" ").slice(1).join(" ")}</span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="chip bg-white/10 border-white/10 text-slate-200/80">{BRAND.product}</span>
                <span className={`chip bg-white/10 border-white/10 ${backendEnabled ? "text-emerald-200/90" : "text-slate-200/80"}`}>
                  {backendEnabled ? "Cloud" : "Offline"}
                </span>
                {isAdmin && <span className="chip bg-white/10 border-white/10 text-indigo-200/90">Admin</span>}
              </div>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-2 -m-2 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem
            icon={TrendingUp}
            label="Dashboard"
            active={activeView === "dashboard"}
            onClick={() => {
              setActiveView("dashboard");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={FileText}
            label="Leads"
            active={["all", "kanban", "calendar", "watchlist", "stale"].includes(activeView)}
            onClick={() => {
              setActiveView("all");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={ShieldAlert}
            label="Underwriting"
            active={isUnderwritingSection}
            onClick={() => {
              setActiveView("underwriting");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={BookOpen}
            label="Loan Book"
            active={activeView === "loan_book"}
            onClick={() => {
              setActiveView("loan_book");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={ClipboardList}
            label="Lead Management"
            active={["today", "overdue", "renewal_watch", "clearance"].includes(activeView)}
            count={collectionsBadge}
            alert={clearanceCount > 0 || stats.overdue > 0}
            onClick={() => {
              setActiveView(clearanceCount > 0 ? "clearance" : stats.overdue > 0 ? "overdue" : "today");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={FileBarChart}
            label="Reports"
            active={isReportsSection}
            onClick={() => {
              setActiveView("reports");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={Users}
            label="CRM / Network"
            active={isCrmSection}
            onClick={() => {
              setActiveView("android_myday");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={activeView === "settings"}
            onClick={() => {
              setActiveView("settings");
              setIsSidebarOpen(false);
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="safe-top bg-white/70 backdrop-blur border-b border-slate-200/60 h-16 flex items-center justify-between px-6 shadow-soft z-10 print:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden btn-secondary px-3 py-2">
            <Menu className="text-slate-700" />
          </button>
          <div className="flex-1 max-w-xl mx-4 relative hidden md:block">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/70"
              placeholder="Global Search (Client, Company, Phone)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {backendEnabled && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur shadow-sm">
                <UserCircle size={18} className="text-slate-600" />
                <span className="text-sm font-bold text-slate-800 max-w-[240px] truncate">{currentUser}</span>
                {isAdmin && <span className="chip bg-indigo-50 border-indigo-200 text-indigo-700">Admin</span>}
              </div>
            )}
            {backendEnabled && onLogout && (
              <button
                onClick={onLogout}
                className="btn-secondary px-3 py-2"
                title="Log out"
              >
                <LogOut size={18} className="text-slate-700" />
                <span className="hidden md:inline">Logout</span>
              </button>
            )}
            {activeView === "mediators" && (
              <button
                onClick={() => setIsAddMediatorModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-soft hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] transition focus:outline-none focus:ring-4 focus:ring-emerald-200"
              >
                <UserPlus size={18} /> Add Mediator
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={18} /> Add Lead
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {isCrmSection && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeMediatorForProfile ? "mediators" : activeView}
                tabs={[
                  { value: "android_myday", label: "Activities" },
                  { value: "android_tasks", label: "Tasks" },
                  { value: "android_partners", label: "Partners" },
                  { value: "mediators", label: "Mediators" },
                ]}
                onChange={(next) => {
                  setReportType(null);
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="flex-1 overflow-hidden">
                {activeMediatorForProfile ? (
                  <MediatorProfile
                    mediator={activeMediatorForProfile}
                    leads={leads}
                    onBack={() => setActiveView("mediators")}
                    onReport={setMediatorReportId}
                    onUpdateReport={setMidDayUpdateId}
                    onRejectionReport={setMediatorRejectionReportId}
                    onPendingReport={setMediatorPendingReportId}
                    onFollowUp={handleMediatorFollowUp}
                    onOpenQuickUpdate={setMediatorQuickUpdateId}
                    onEdit={setEditingMediator}
                    onDelete={(id) => {
                      if (deleteMediator(id)) setActiveView("mediators");
                    }}
                  />
                ) : activeView === "mediators" ? (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in overflow-y-auto h-full">
                    {activeAnnouncement && (
                      <div className="md:col-span-2">
                        <AnnouncementBanner
                          announcement={activeAnnouncement}
                          onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                          canManage={isAdmin}
                          onManage={() => setIsSettingsOpen(true)}
                        />
                      </div>
                    )}
                    {mediators.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all flex justify-between items-center group cursor-pointer"
                        onClick={() => setActiveView(m.id)}
                      >
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{m.name}</h3>
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <Phone size={12} /> {m.phone || "No Phone"}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold border border-slate-200">
                              {leads.filter((l) => l.mediatorId === m.id).length} Leads
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMediator(m);
                            }}
                            className="bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 p-3 rounded-full transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMediator(m.id);
                            }}
                            className="bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 p-3 rounded-full transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    {activeAnnouncement && (
                      <div className="p-4 pb-0">
                        <AnnouncementBanner
                          announcement={activeAnnouncement}
                          onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                          canManage={isAdmin}
                          onManage={() => setIsSettingsOpen(true)}
                        />
                      </div>
                    )}
                    <AndroidCrm
                      route={activeView === "android_tasks" ? "tasks" : activeView === "android_partners" ? "partners" : "myday"}
                      leads={leads}
                      mediators={mediators}
                      tasks={tasks}
                      onTasksChange={setTasks}
                      storageKey={tasksKey}
                      onFollowUp={handleMediatorFollowUp}
                      onOpenLead={(l) => setActiveLead(l)}
                      onNavigate={(next) => setActiveView(String(next || "android_myday"))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {isUnderwritingSection && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "underwriting", label: "Underwriting" },
                  { value: "pd", label: "PD" },
                ]}
                onChange={(next) => {
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="flex-1 overflow-y-auto">
                {activeView === "underwriting" && (
                  <UnderwritingView
                    backend={backend}
                    leads={leads}
                    onProceedToPd={(appId, leadId) => {
                      setPdApplicationId(String(appId));
                      setPdLeadId(String(leadId));
                      setActiveView("pd");
                      setIsSidebarOpen(false);
                    }}
                  />
                )}
                {activeView === "pd" && pdApplicationId && (
                  <PdView
                    backend={backend}
                    applicationId={pdApplicationId}
                    lead={leads.find((l) => String(l.id) === String(pdLeadId)) || null}
                    isAdmin={isAdmin}
                    onBack={() => {
                      setActiveView("underwriting");
                      setPdApplicationId(null);
                      setPdLeadId(null);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {activeView === "clearance" && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "today", label: "Action Today" },
                  { value: "overdue", label: "Overdue" },
                  { value: "renewal_watch", label: "Renewals" },
                  { value: "clearance", label: "Clearance" },
                ]}
                onChange={(next) => {
                  setReportType(null);
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 space-y-6 overflow-y-auto flex-1 pb-20 animate-fade-in">
              {activeAnnouncement && (
                <AnnouncementBanner
                  announcement={activeAnnouncement}
                  onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                  canManage={isAdmin}
                  onManage={() => setIsSettingsOpen(true)}
                />
              )}
              <div className="surface p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Operations</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-2">Clearance Center</div>
                    <div className="text-sm text-slate-600 mt-1">
                      Close loose ends: meetings that already happened, plus leads that need an update today.
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Date (IST): <span className="font-bold text-slate-900">{toYmdIST(new Date())}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-sm"
                        onClick={() => setReportType("clearance_pdf")}
                      >
                        <Printer size={16} /> Print Clearance PDF
                      </button>
                      {backendEnabled && isAdmin && (
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setReportType("daily_activity")}>
                          <History size={16} /> Daily Activity
                        </button>
                      )}
                    </div>
                    <div className="hidden md:flex gap-2">
                      <div className="surface-solid px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Past Meetings</div>
                        <div className="text-2xl font-extrabold text-slate-900 mt-1">{pendingReviews.length}</div>
                      </div>
                      <div className="surface-solid px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">EOD Pending</div>
                        <div className="text-2xl font-extrabold text-slate-900 mt-1">{dailyPending.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="surface p-5">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-600" /> Meetings: Action Required
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Scheduled meeting time has passed — update status or reschedule.</div>
                    </div>
                    <div className="chip bg-white/60">{pendingReviews.length}</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {pendingReviews.length === 0 ? (
                      <div className="text-sm text-slate-500 italic">No past meetings pending.</div>
                    ) : (
                      pendingReviews.slice(0, 12).map((l) => (
                        <div key={l.id} className="surface-solid p-4 flex items-center justify-between gap-3">
                          <button type="button" onClick={() => setActiveLead(l)} className="text-left min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{l.name}</div>
                            <div className="text-xs text-slate-500 mt-1 truncate">{l.company || l.location || "—"}</div>
                            <div className="text-[11px] text-slate-500 mt-2">Meeting: {formatDateTime(l.nextFollowUp)}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveLead(l)}
                            className="btn-primary px-3 py-2 text-xs shrink-0"
                          >
                            Update
                          </button>
                        </div>
                      ))
                    )}
                    {pendingReviews.length > 12 && (
                      <div className="text-xs text-slate-500">Showing 12 of {pendingReviews.length}. Use search to find others.</div>
                    )}
                  </div>
                </div>

                <div className="surface p-5">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Clock size={18} className="text-orange-600" /> End of Day Pending Updates
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Active leads that haven’t received an update today.</div>
                    </div>
                    <div className="chip bg-white/60">{dailyPending.length}</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dailyPending.length === 0 ? (
                      <div className="text-sm text-slate-500 italic">All good — nothing pending.</div>
                    ) : (
                      dailyPending.slice(0, 12).map((l) => (
                        <div key={l.id} className="surface-solid p-4 flex items-center justify-between gap-3">
                          <button type="button" onClick={() => setActiveLead(l)} className="text-left min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{l.name}</div>
                            <div className="text-xs text-slate-500 mt-1 truncate">{l.company || l.location || "—"}</div>
                            <div className="text-[11px] text-slate-500 mt-2">Next: {formatDateTime(l.nextFollowUp)}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveLead(l)}
                            className="btn-primary px-3 py-2 text-xs shrink-0"
                          >
                            Update
                          </button>
                        </div>
                      ))
                    )}
                    {dailyPending.length > 12 && (
                      <div className="text-xs text-slate-500">Showing 12 of {dailyPending.length}. Use search to find others.</div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {activeView === "dashboard" && (
            <div className="p-6 space-y-6 overflow-y-auto h-full pb-20 animate-fade-in">
              {activeAnnouncement && (
                <AnnouncementBanner
                  announcement={activeAnnouncement}
                  onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                  canManage={isAdmin}
                  onManage={() => setIsSettingsOpen(true)}
                />
              )}
              {newLeads.length > 0 && (
                <div id="dashboard_new_leads" className="mb-2">
                  <h3 className="font-extrabold text-slate-900 mb-3 flex items-center gap-2 text-lg">
                    <Zap className="text-yellow-500" /> Action Required ({newLeads.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {newLeads.map((l) => (
                      <NewLeadTriageCard
                        key={l.id}
                        lead={l}
                        onUpdate={updateLead}
                        onPaymentDone={(lead) => {
                          setLeadModalInitialMode("payment");
                          setActiveLead(lead);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pendingReviews.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2.5 rounded-full text-red-600">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-red-900 text-lg">Action Required: Meetings</h3>
                      <p className="text-sm text-red-700">
                        You have <strong>{pendingReviews.length}</strong> meetings pending a status update.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView("clearance")}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-transform active:scale-95 whitespace-nowrap"
                  >
                    Open Clearance Center
                  </button>
                </div>
              )}

              {dailyPending.length > 0 && (
                <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-xl p-4 shadow-md animate-slide-up">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-orange-900 text-lg flex items-center gap-2">
                        <Clock size={20} /> End of Day Clearance
                      </h3>
                      <p className="text-sm text-orange-800 mt-1">
                        You have <strong>{dailyPending.length}</strong> active leads that require an update before the day ends.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView("clearance")}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                      Open Clearance Center
                    </button>
                  </div>
                </div>
              )}

              {stats.stale > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-4 shadow-md animate-slide-up">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-extrabold text-amber-900 text-lg flex items-center gap-2">
                        <History size={20} /> Stale Leads
                      </h3>
                      <p className="text-sm text-amber-800 mt-1">
                        You have <strong>{stats.stale}</strong> leads with no updates for {STALE_AFTER_DAYS}+ days.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView("stale")}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
                    >
                      Review Stale
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveView("all")}
                  className="surface-solid p-4 text-left cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Leads</p>
                      <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-blue-700">{stats.total}</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <FileText size={20} />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("today")}
                  className="surface-solid p-4 text-left cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Action Today</p>
                      <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-emerald-700">{stats.today}</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                      <Calendar size={20} />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("overdue")}
                  className="surface-solid p-4 text-left cursor-pointer hover:shadow-md hover:border-red-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Overdue</p>
                      <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-red-700">{stats.overdue}</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-red-50 text-red-600 group-hover:bg-red-100 transition-colors">
                      <AlertCircle size={20} />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("renewal_watch")}
                  className="surface-solid p-4 text-left cursor-pointer hover:shadow-md hover:border-orange-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Renewal Watch</p>
                      <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-orange-700">{stats.renewal}</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-100 transition-colors">
                      <RefreshCw size={20} />
                    </div>
                  </div>
                </button>
              </div>

              <EnhancedDashboardSummary leads={leads} />

              <div className="grid md:grid-cols-2 gap-6">
                <MediatorFollowUpWidget mediators={mediators} onFollowUp={handleMediatorFollowUp} />
                <MonthlyPerformanceWidget leads={leads} />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="surface p-5">
                  <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <Calendar className="text-indigo-600" size={18} /> Upcoming Meetings
                  </h3>
                  <div className="space-y-3">
                    {leads.filter((l) => l.status === "Meeting Scheduled" && (isTodayIST(l.nextFollowUp) || isTomorrowIST(l.nextFollowUp))).length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic text-sm">No meetings scheduled.</div>
                    ) : (
                      leads
                        .filter((l) => l.status === "Meeting Scheduled" && (isTodayIST(l.nextFollowUp) || isTomorrowIST(l.nextFollowUp)))
                        .map((l) => (
                          <LeadCard
                            key={l.id}
                            lead={l}
                            automation={leadAutomationByLeadId[String(l.id)] || null}
                            mediators={mediators}
                            onClick={setActiveLead}
                            onUpdateLead={updateLead}
                          />
                        ))
                    )}
                  </div>
                </div>
                <div className="surface p-5">
                  <h3 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <Clock className="text-slate-600" size={18} /> Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {leads.slice(0, 5).map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        automation={leadAutomationByLeadId[String(l.id)] || null}
                        mediators={mediators}
                        onClick={setActiveLead}
                        onUpdateLead={updateLead}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "loan_book" && <LoanBookView leads={leads} mediators={mediators} />}
          {activeView === "calendar" && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "all", label: "All" },
                  { value: "kanban", label: "Kanban" },
                  { value: "calendar", label: "Calendar" },
                  { value: "watchlist", label: "Watchlist" },
                  { value: "stale", label: "Stale" },
                ]}
                onChange={(next) => {
                  setReportType(null);
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 flex-1 overflow-hidden">
                <CalendarView leads={leads} onDateClick={setDayLeads} />
              </div>
            </div>
          )}

          {["all", "today", "overdue", "stale", "watchlist", "renewal_watch"].includes(activeView) && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={
                  ["today", "overdue", "renewal_watch"].includes(activeView)
                    ? [
                        { value: "today", label: "Action Today" },
                        { value: "overdue", label: "Overdue" },
                        { value: "renewal_watch", label: "Renewals" },
                        { value: "clearance", label: "Clearance" },
                      ]
                    : [
                        { value: "all", label: "All" },
                        { value: "kanban", label: "Kanban" },
                        { value: "calendar", label: "Calendar" },
                        { value: "watchlist", label: "Watchlist" },
                        { value: "stale", label: "Stale" },
                      ]
                }
                onChange={(next) => {
                  setReportType(null);
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 overflow-y-auto flex-1 animate-fade-in space-y-2">
                {activeAnnouncement && (
                  <AnnouncementBanner
                    announcement={activeAnnouncement}
                    onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                    canManage={isAdmin}
                    onManage={() => setIsSettingsOpen(true)}
                  />
                )}
                {activeView === "all" && (
                <div className="surface p-4">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Saved Views</div>
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <select
                          value={activeSavedViewId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setActiveSavedViewId(id);
                            const view = (savedViews || []).find((v) => v.id === id);
                            setTagFilter(view?.tag || "");
                          }}
                          className="flex-1 py-3"
                        >
                          <option value="">— Default —</option>
                          {(savedViews || []).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary py-3"
                          onClick={() => {
                            const name = prompt("Save view name:", tagFilter ? `Tag: ${tagFilter}` : "All leads");
                            if (!name) return;
                            const id = String(Date.now());
                            const view = { id, name: String(name).trim().slice(0, 40), tag: tagFilter || "" };
                            setSavedViews((prev) => [view, ...(Array.isArray(prev) ? prev : [])]);
                            setActiveSavedViewId(id);
                          }}
                        >
                          Save View
                        </button>
                        <button
                          type="button"
                          className="btn-secondary py-3"
                          onClick={() => {
                            setActiveSavedViewId("");
                            setTagFilter("");
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-2">Views currently save your tag filter (more filters can be added later).</div>
                    </div>

                    <div className="w-full lg:w-[320px]">
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Tag Filter</div>
                      <select
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        className="w-full py-3 mt-2"
                      >
                        <option value="">All tags</option>
                        {allTags.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {activeView === "renewal_watch" ? (
                <RenewalWatchTimeline leads={displayLeads} onOpenLead={setActiveLead} />
              ) : (
                displayLeads.map((l) => (
                  <LeadCard
                    key={l.id}
                    lead={l}
                    automation={leadAutomationByLeadId[String(l.id)] || null}
                    mediators={mediators}
                    onClick={setActiveLead}
                    onUpdateLead={updateLead}
                  />
                ))
              )}
              </div>
            </div>
          )}

          {activeView === "kanban" && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "all", label: "All" },
                  { value: "kanban", label: "Kanban" },
                  { value: "calendar", label: "Calendar" },
                  { value: "watchlist", label: "Watchlist" },
                  { value: "stale", label: "Stale" },
                ]}
                onChange={(next) => {
                  setReportType(null);
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 flex flex-1 gap-4 overflow-x-auto pb-4 animate-fade-in">
                {["New", "Meeting Scheduled", "Follow-Up Required", "Payment Done"].map((status) => (
                  <div key={status} className="min-w-[300px] w-80 flex flex-col bg-slate-100 rounded-xl h-full border border-slate-200">
                    <div className="p-3 font-bold text-slate-700 border-b bg-white rounded-t-xl sticky top-0 flex justify-between">
                      {status}{" "}
                      <span className="bg-slate-100 px-2 rounded-full text-xs flex items-center border">{leads.filter((l) => l.status === status).length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {leads
                        .filter((l) => l.status === status)
                        .map((l) => (
                          <div
                            key={l.id}
                            onClick={() => setActiveLead(l)}
                            className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all"
                          >
                            <div className="font-bold text-slate-800 text-sm mb-1">{l.name}</div>
                            <div className="text-xs text-slate-500 mb-2">{l.company}</div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] bg-slate-50 px-1 border rounded">{formatCurrency(l.loanAmount)}</span>
                              <span className="text-[10px] text-slate-400">{formatDate(l.nextFollowUp)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "reports" && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "reports", label: "Reports" },
                  { value: "analytics", label: "Analytics" },
                ]}
                onChange={(next) => {
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 overflow-y-auto flex-1 animate-fade-in space-y-4">
                {activeAnnouncement && (
                  <AnnouncementBanner
                    announcement={activeAnnouncement}
                    onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                    canManage={isAdmin}
                    onManage={() => setIsSettingsOpen(true)}
                  />
                )}
                <div className="surface p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Reports</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">Export & Performance</div>
                  <div className="text-sm text-slate-600 mt-1">Decision-focused exports for partners, audits, and internal reviews.</div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white"
                      onClick={() => setReportType("owner_daily_partner")}
                    >
                      <div className="font-extrabold text-slate-900">Daily Activity Report</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Open leads + today actions only (calls, dealt, met, payment, rejected, added-open-EOD)
                      </div>
                    </button>
                    <button
                      type="button"
                      className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white"
                      onClick={() => setReportType("daily_work_plan")}
                    >
                      <div className="font-extrabold text-slate-900">Daily Work Update + Day Plan</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Separate report for daily group update and next-day execution plan
                      </div>
                    </button>
                    <button type="button" className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setReportType("monthly")}>
                      <div className="font-extrabold text-slate-900">Monthly Performance</div>
                      <div className="text-xs text-slate-500 mt-1">Pipeline + closures + mediator performance</div>
                    </button>
                    <button type="button" className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setReportType("clearance_pdf")}>
                      <div className="font-extrabold text-slate-900">Clearance PDF</div>
                      <div className="text-xs text-slate-500 mt-1">Print-ready loose-ends clearance list</div>
                    </button>
                    <button
                      type="button"
                      className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition border-rose-200 bg-gradient-to-br from-rose-50/70 to-white"
                      onClick={() => setReportType("rejection_internal")}
                    >
                      <div className="font-extrabold text-slate-900">Detailed Rejection List (Internal)</div>
                      <div className="text-xs text-slate-500 mt-1">Combined rejected clients with detailed reasons and contributor trail</div>
                    </button>
                    {backendEnabled && isAdmin && (
                      <>
                        <button type="button" className="surface-solid p-4 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setReportType("eod")}>
                          <div className="font-extrabold text-slate-900">EOD Activity (Admin)</div>
                          <div className="text-xs text-slate-500 mt-1">End-of-day clearance + staff summary</div>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <ReportsHealthCheckPanel backendEnabled={backendEnabled} supabase={supabase} authUser={authUser} leads={leads} />
              </div>
            </div>
          )}

          {activeView === "settings" && (
            <div className="p-6 overflow-y-auto h-full animate-fade-in space-y-4">
              <div className="surface p-6">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Settings</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">Tools & Configuration</div>
                <div className="text-sm text-slate-600 mt-1">Backup, CSV, calculator, and app controls.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="button" className="surface-solid p-5 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setIsSettingsOpen(true)}>
                  <div className="font-extrabold text-slate-900">Data & Settings</div>
                  <div className="text-xs text-slate-500 mt-1">Backup/restore + CSV import/export</div>
                </button>
                <button type="button" className="surface-solid p-5 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setIsEmiOpen(true)}>
                  <div className="font-extrabold text-slate-900">Interest Calculator</div>
                  <div className="text-xs text-slate-500 mt-1">Monthly / weekly / bi-weekly / bi-monthly</div>
                </button>
                {backendEnabled && isAdmin && (
                  <button type="button" className="surface-solid p-5 text-left hover:ring-1 hover:ring-slate-200 transition" onClick={() => setIsSettingsOpen(true)}>
                    <div className="font-extrabold text-slate-900">Announcements</div>
                    <div className="text-xs text-slate-500 mt-1">Broadcast messages to staff</div>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeView === "analytics" && (
            <div className="h-full flex flex-col overflow-hidden">
              <SectionTabs
                value={activeView}
                tabs={[
                  { value: "reports", label: "Reports" },
                  { value: "analytics", label: "Analytics" },
                ]}
                onChange={(next) => {
                  setActiveView(next);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="p-6 space-y-6 overflow-y-auto flex-1 pb-20 animate-fade-in">
                {activeAnnouncement && (
                  <AnnouncementBanner
                    announcement={activeAnnouncement}
                    onDismiss={() => dismissAnnouncement(activeAnnouncement.id)}
                    canManage={isAdmin}
                    onManage={() => setIsSettingsOpen(true)}
                  />
                )}
                <AiPartnerInsightsWidget ai={ai} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-[500px]">
                  <LossAnalysisWidget leads={leads} />
                  <RenewalAnalyticsWidget leads={leads} />
                </div>
              </div>
            </div>
          )}
        </main>

        {nativeApp && (
          <nav className="print:hidden safe-bottom bg-white border-t border-slate-200">
            {(() => {
              const myDayActive =
                activeView === "android_myday" || activeView === "android_tasks" || activeView === "android_partners";
              const items = [
                { key: "dashboard", label: "Home", icon: TrendingUp, active: activeView === "dashboard" },
                { key: "clearance", label: "Clear", icon: AlertTriangle, active: activeView === "clearance" },
                { key: "all", label: "Leads", icon: FileText, active: activeView === "all" },
                { key: "mediators", label: "Partners", icon: Users, active: activeView === "mediators" || Boolean(activeMediatorForProfile) },
                { key: "android_myday", label: "My Day", icon: Timer, active: myDayActive },
              ];
              return (
                <div className="grid grid-cols-5 gap-1 px-2 py-2">
                  {items.map((it) => {
                    const Icon = it.icon;
                    const isActive = Boolean(it.active);
                    const badge =
                      it.key === "clearance" && clearanceCount > 0 ? clearanceCount : it.key === "clearance" ? 0 : null;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => {
                          setActiveView(it.key);
                          setIsSidebarOpen(false);
                        }}
                        className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition ${
                          isActive ? "bg-indigo-50 ring-1 ring-indigo-200 text-indigo-800" : "text-slate-600 hover:bg-white/70"
                        }`}
                        aria-label={it.label}
                      >
                        <Icon size={18} className={isActive ? "text-indigo-700" : "text-slate-600"} />
                        <span className={`text-[10px] font-extrabold ${isActive ? "text-indigo-800" : "text-slate-600"}`}>{it.label}</span>
                        {typeof badge === "number" && badge > 0 && (
                          <span className="absolute top-1 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </nav>
        )}
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddLeadType("new");
        }}
        title="Add New Lead"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.target);
            const type = String(d.get("type") || addLeadType);
            const isRenewal = type === "renewal";

            const base = {
              name: String(d.get("name") || ""),
              phone: String(d.get("phone") || ""),
              company: String(d.get("company") || ""),
              mediatorId: String(d.get("mediatorId") || "3"),
              location: String(d.get("location") || ""),
              isHighPotential: d.get("isHighPotential") === "on",
            };

            const rawNotes = String(d.get("notes") || "").trim();
            const notes = rawNotes ? [{ text: rawNotes, date: new Date().toISOString() }] : [];

            if (isRenewal) {
              const givenAmount = Number(d.get("principal") || 0);
              const interest = Number(d.get("interest") || 0);
              const tenure = Number(d.get("tenure") || 12);
              const paymentDateStr = String(d.get("paymentDate") || "");
              const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date();
              const principal = givenAmount + interest;
              const netCashOut = principal;

              const followUpDate = addMonths(paymentDate, tenure / 2).toISOString();
              const paymentISO = paymentDate.toISOString();

              addLead({
                ...base,
                status: "Payment Done",
                loanAmount: principal,
                nextFollowUp: followUpDate,
                loanDetails: { principal, interest, netDisbursed: netCashOut, tenure, frequency: "Monthly", rate: "0.00", paymentDate: paymentISO },
                notes: [
                  ...notes,
                  {
                    text: `[RENEWAL ADDED]: Given ${formatCurrency(givenAmount)}. Upfront Interest ${formatCurrency(
                      interest
                    )}. Principal ${formatCurrency(principal)}. Net Cash Out ${formatCurrency(principal)}. Payment date: ${paymentDate.toLocaleDateString()}. Follow-up set for 50% term (${new Date(
                      followUpDate
                    ).toLocaleDateString()})`,
                    date: new Date().toISOString(),
                  },
                ],
              });
            } else {
              addLead({
                ...base,
                status: "New",
                loanAmount: Number(d.get("loanAmount") || 0),
                notes,
              });
            }

            setAddLeadType("new");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2 surface-solid p-1.5">
            <label
              className={`flex items-center justify-center gap-2 cursor-pointer p-2 rounded-xl transition-all ${
                addLeadType === "new" ? "bg-white shadow-soft border border-slate-200/70" : "hover:bg-white/40"
              }`}
            >
              <input type="radio" name="type" value="new" checked={addLeadType === "new"} onChange={() => setAddLeadType("new")} />
              <span className="font-bold text-sm text-slate-600">New Client</span>
            </label>
            <label
              className={`flex items-center justify-center gap-2 cursor-pointer p-2 rounded-xl transition-all ${
                addLeadType === "renewal" ? "bg-white shadow-soft border border-slate-200/70" : "hover:bg-white/40"
              }`}
            >
              <input type="radio" name="type" value="renewal" checked={addLeadType === "renewal"} onChange={() => setAddLeadType("renewal")} />
              <span className="font-bold text-sm text-slate-600">Renewal / Existing</span>
            </label>
          </div>

          <input name="name" required placeholder="Client Name" className="w-full py-3" />
          <input name="company" placeholder="Company Name" className="w-full py-3" />
          <div className="grid grid-cols-2 gap-4">
            <input name="phone" placeholder="Phone" className="w-full py-3" />
            <input name="location" placeholder="City/Area" className="w-full py-3" />
          </div>

          {addLeadType === "new" ? (
            <input name="loanAmount" type="number" placeholder="Required Loan Amount (₹)" className="w-full py-3" />
          ) : (
            <div className="animate-fade-in space-y-3 p-4 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl shadow-sm">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-emerald-200/60 pb-2">
                <Banknote size={16} className="text-emerald-600" /> Record Closed Deal (Legacy/Renewal)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Given Amount (₹)</label>
                  <input name="principal" type="number" className="w-full py-2 text-sm font-bold" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Interest (₹)</label>
                  <input name="interest" type="number" className="w-full py-2 text-sm font-bold text-red-600" defaultValue="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Tenure (Months)</label>
                  <input name="tenure" type="number" defaultValue="12" className="w-full py-2 text-sm font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Payment Date</label>
                  <input name="paymentDate" type="date" className="w-full py-2 text-sm font-bold" />
                </div>
              </div>
              <div className="text-[10px] text-emerald-700 italic mt-1">System automatically sets follow-up at 50% of term.</div>
            </div>
          )}

          <textarea name="notes" placeholder="Additional Notes..." className="w-full p-3 h-20 resize-none text-sm"></textarea>

          <div className="flex items-center gap-2">
            <input id="isHighPotential" name="isHighPotential" type="checkbox" className="accent-indigo-600 w-4 h-4" />
            <label htmlFor="isHighPotential" className="text-sm font-bold text-slate-600">
              Mark as High Potential
            </label>
          </div>

          <select name="mediatorId" className="w-full py-3 bg-white">
            {(backendEnabled && isAdmin && authUser?.id ? mediators.filter((m) => m.id === "3" || !m.ownerId || m.ownerId === authUser.id) : mediators).map(
              (m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
              )
            )}
          </select>

          <button className="w-full py-3 btn-primary">Save Entry</button>
        </form>
      </Modal>

      <Modal isOpen={!!activeLead} onClose={() => setActiveLead(null)} title="Manage Lead" large>
        {activeLead && (
          <LeadActionModal
            lead={activeLead}
            nativeApp={nativeApp}
            backendEnabled={backendEnabled}
            supabase={supabase}
            ai={ai}
            automation={leadAutomationByLeadId[String(activeLead.id)] || null}
            mediators={
              backendEnabled && isAdmin && activeLead.ownerId
                ? mediators.filter((m) => m.id === "3" || !m.ownerId || m.ownerId === activeLead.ownerId)
                : mediators
            }
            onUpdate={updateLead}
            onDelete={(id) => {
              deleteLead(id);
              setActiveLead(null);
            }}
            onOpenRejectionLetter={(l) => {
              setActiveLead(null);
              setRejectionReportLead(l);
            }}
            initialMode={leadModalInitialMode}
            onConsumeInitialMode={() => setLeadModalInitialMode(null)}
            canReassignOwner={backendEnabled && isAdmin}
            staffUsers={staffUsers}
            staffUsersError={staffUsersError}
            onReassignOwner={(leadId, newOwnerId) => void reassignLeadOwner(leadId, newOwnerId)}
            onOpenPartnerStatusPdf={(lead, opts = {}) => {
              setActiveLead(null);
              setLeadPartnerStatusReport({
                leadId: lead.id,
                includeTimeline: !!opts.includeTimeline,
              });
            }}
          />
        )}
      </Modal>

      <Modal isOpen={isCallOutcomeOpen} onClose={dismissPendingCall} title="Call Outcome">
        {(() => {
          const pending = pendingCall && typeof pendingCall === "object" ? pendingCall : null;
          const kind = String(pending?.kind || (pending?.leadId ? "lead" : pending?.mediatorId ? "mediator" : "")).toLowerCase();
          const mediator = kind !== "lead" && pending?.mediatorId ? mediators.find((m) => m.id === pending.mediatorId) : null;
          const leadForCall = kind === "lead" && pending?.leadId ? leads.find((l) => l.id === pending.leadId) : null;
          const title = kind === "lead" ? leadForCall?.name || "Client Call" : mediator?.name || "Mediator Call";
          const phone = pending?.phone || leadForCall?.phone || mediator?.phone || "—";
          return (
            <div className="space-y-4">
              <div className="surface-solid p-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Auto-log</div>
                <div className="text-lg font-extrabold text-slate-900 mt-1">
                  {title}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Phone: <span className="font-mono">{phone}</span>
                </div>
                {pending?.startedAt && (
                  <div className="text-xs text-slate-500 mt-2">
                    Started: {new Date(pending.startedAt).toLocaleString("en-IN")}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Outcome</label>
                <select
                  value={callOutcomeForm.outcome}
                  onChange={(e) => setCallOutcomeForm((p) => ({ ...p, outcome: e.target.value }))}
                  className="w-full py-3"
                >
                  <option value="connected">Connected</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="switched_off">Switched Off</option>
                  <option value="wrong_number">Wrong Number</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="call_back">Call Back Later</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Notes (optional)</label>
                <textarea
                  value={callOutcomeForm.notes}
                  onChange={(e) => setCallOutcomeForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full p-3 h-24 resize-none text-sm"
                  placeholder="Quick notes… next step…"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" className="flex-1 btn-secondary py-3" onClick={dismissPendingCall}>
                  Skip
                </button>
                <button type="button" className="flex-1 btn-primary py-3" onClick={savePendingCallOutcome}>
                  Save Log
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={isEmiOpen} onClose={() => setIsEmiOpen(false)} title="Interest Rate Calculator">
        <div className="space-y-4">
          <div className="surface-solid p-6 text-center">
            <div className="text-sm text-indigo-600 font-bold uppercase tracking-wider mb-1">Our Interest Rate</div>
            <div className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent" id="rateDisplay">
              0.00%
            </div>
          </div>
          <form
            onChange={(e) => {
              const form = e.currentTarget;
              const given = Number(form.given.value);
              const interest = Number(form.interest.value);
              const frequency = String(form.frequency.value || "monthly").toLowerCase();
              const months = Number(form.months.value);
              const weeks = months; // required variable name for non-monthly formulas

              // Preserved monthly logic (do not change).
              if (frequency === "monthly") {
                if (given > 0 && months > 0) {
                  const result = (interest / given) / ((months + 1) / 2) * 100;
                  document.getElementById("rateDisplay").innerText = result.toFixed(2) + "%";
                } else {
                  document.getElementById("rateDisplay").innerText = "0.00%";
                }
                return;
              }

              if (!(given > 0) || !(weeks > 0)) {
                document.getElementById("rateDisplay").innerText = "0.00%";
                return;
              }

              // Weekly / Bi-Weekly / Bi-Monthly (15 days)
              const daysMap = {
                weekly: 7,
                biweekly: 14,
                bimonthly: 15,
              };

              const DAYS = daysMap[frequency];
              if (!DAYS) {
                document.getElementById("rateDisplay").innerText = "0.00%";
                return;
              }

              const result = (interest / given) / ((weeks + 1) / 2) / DAYS * 3000;
              document.getElementById("rateDisplay").innerText = isFinite(result) ? result.toFixed(2) + "%" : "0.00%";
            }}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Frequency</label>
                <select name="frequency" defaultValue="monthly" className="w-full py-2 font-mono">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="bimonthly">Bi-Monthly (15 days)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Given Amount (Principal)</label>
                <input name="given" type="number" defaultValue="100000" className="w-full py-2 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Total Interest Amount</label>
                <input name="interest" type="number" defaultValue="10000" className="w-full py-2 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Duration (Months)</label>
                <input name="months" type="number" defaultValue="12" className="w-full py-2 font-mono" />
              </div>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={!!dayLeads} onClose={() => setDayLeads(null)} title="Scheduled Activity">
        <div className="space-y-2">
          {dayLeads?.map((l) => (
            <div
              key={l.id}
              onClick={() => {
                setDayLeads(null);
                setActiveLead(l);
              }}
              className="surface-solid p-3 hover:shadow-elevated cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-slate-800">{l.name}</div>
                <div className="text-xs text-slate-500">{l.company}</div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-bold ${STATUS_CONFIG[l.status]?.color}`}>{l.status}</span>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={isAddMediatorModalOpen} onClose={() => setIsAddMediatorModalOpen(false)} title="Register New Mediator">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.target);
            addMediator({ name: d.get("name"), phone: d.get("phone") });
          }}
          className="space-y-4"
        >
          <input name="name" required placeholder="Mediator Name" className="w-full py-3" />
          <input name="phone" placeholder="Phone Number" className="w-full py-3" />
          <button className="w-full py-3 rounded-xl font-bold text-white shadow-soft transition active:scale-[0.98] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200">
            Save Mediator
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!editingMediator} onClose={() => setEditingMediator(null)} title="Edit Mediator">
        {editingMediator && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.target);
              updateMediator(editingMediator.id, { name: d.get("name"), phone: d.get("phone") });
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-bold text-slate-500">Name</label>
              <input name="name" defaultValue={editingMediator.name} required className="w-full py-3" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Phone</label>
              <input name="phone" defaultValue={editingMediator.phone} className="w-full py-3" />
            </div>
            <button className="w-full py-3 btn-primary">Save Changes</button>
          </form>
        )}
      </Modal>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        exportCSV={exportCSV}
        importCSV={importCSV}
        handleBackup={handleBackup}
        handleRestore={handleRestore}
        backendEnabled={backendEnabled}
        isAdmin={isAdmin}
        supabase={supabase}
        onUsersChanged={() => setStaffReloadNonce((n) => n + 1)}
        announcements={announcements}
        announcementsError={announcementsError}
        onCreateAnnouncement={createAnnouncement}
        onDeactivateAnnouncement={deactivateAnnouncement}
        onDeleteAnnouncement={deleteAnnouncement}
        onReloadAnnouncements={reloadAnnouncements}
      />
    </div>
  );
}
