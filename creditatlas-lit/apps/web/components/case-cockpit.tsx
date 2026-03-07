"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/http";
import { inr, pct } from "@/lib/format";

const SAMPLE_FINBOX = {
  accounts: [
    {
      account_id: "ACC_MAIN_001",
      bank_name: "HDFC BANK",
      masked_account_number: "XXXXXX1234",
      transactions: [
        {
          id: "demo-1",
          txn_date: "2026-01-10",
          amount: 220000,
          type: "CREDIT",
          description: "NEFT SALES RECEIPT CITY MART",
        },
        {
          id: "demo-2",
          txn_date: "2026-01-12",
          amount: -38000,
          type: "DEBIT",
          description: "ACH HDFC SME LOAN EMI",
          counterparty: "HDFC BANK LOAN",
        },
      ],
    },
  ],
};

type Summary = {
  case_id: string;
  borrower_name: string;
  industry?: string;
  constitution?: string;
  months_analyzed: number;
  accounts_analyzed: number;
  decision_badge: string;
  kpis: Record<string, number | string>;
  risk_flags: Array<{ title: string; severity: string; description: string; code: string }>;
};

type TruthRow = {
  period_month: string;
  gross_credits: number;
  internal_transfers_excluded: number;
  finance_credits_excluded: number;
  other_non_business_excluded: number;
  adjusted_business_credits: number;
  truth_confidence: number;
};

export default function CaseCockpit({ caseId, mode = "overview" }: { caseId: string; mode?: "overview" | "truth" | "lenders" | "decision" | "network" }) {
  const qc = useQueryClient();
  const [externalRef, setExternalRef] = useState(`manual-${Date.now()}`);
  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_FINBOX, null, 2));
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const summaryQ = useQuery({
    queryKey: ["case-summary", caseId],
    queryFn: () => apiRequest<Summary>(`/cases/${caseId}/summary`),
  });
  const truthQ = useQuery({
    queryKey: ["truth", caseId],
    queryFn: () => apiRequest<TruthRow[]>(`/cases/${caseId}/truth-engine`),
  });
  const lendersQ = useQuery({
    queryKey: ["street", caseId],
    queryFn: () => apiRequest<any[]>(`/cases/${caseId}/street-lender-intelligence`),
  });
  const emiQ = useQuery({
    queryKey: ["emi", caseId],
    queryFn: () => apiRequest<any[]>(`/cases/${caseId}/emi-tracker`),
  });
  const counterpartiesQ = useQuery({
    queryKey: ["counterparties", caseId],
    queryFn: () => apiRequest<any[]>(`/cases/${caseId}/counterparties`),
  });
  const creditQ = useQuery({
    queryKey: ["credit-brain", caseId],
    queryFn: () => apiRequest<any>(`/cases/${caseId}/credit-brain`),
  });

  const ingestMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/cases/${caseId}/bank-ingestion/finbox`, {
        method: "POST",
        body: JSON.stringify({ external_reference: externalRef, payload: JSON.parse(payloadText) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-summary", caseId] });
      qc.invalidateQueries({ queryKey: ["truth", caseId] });
      qc.invalidateQueries({ queryKey: ["street", caseId] });
      qc.invalidateQueries({ queryKey: ["emi", caseId] });
      qc.invalidateQueries({ queryKey: ["counterparties", caseId] });
      qc.invalidateQueries({ queryKey: ["credit-brain", caseId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) return;
      const fd = new FormData();
      fd.append("file", uploadFile);
      await apiRequest(`/cases/${caseId}/documents/upload`, { method: "POST", body: fd });
    },
  });

  const summary = summaryQ.data;
  const truthRows = truthQ.data ?? [];
  const lenders = lendersQ.data ?? [];
  const emis = emiQ.data ?? [];
  const counterparties = counterpartiesQ.data ?? [];
  const credit = creditQ.data;

  const topCustomers = useMemo(
    () => [...counterparties].sort((a, b) => b.total_credits - a.total_credits).slice(0, 5),
    [counterparties],
  );
  const topSuppliers = useMemo(
    () => [...counterparties].sort((a, b) => b.total_debits - a.total_debits).slice(0, 5),
    [counterparties],
  );

  function onIngest(e: FormEvent) {
    e.preventDefault();
    ingestMutation.mutate();
  }

  const nav = [
    { href: `/cases/${caseId}`, label: "Cockpit" },
    { href: `/cases/${caseId}/truth`, label: "Truth" },
    { href: `/cases/${caseId}/lenders`, label: "Lenders" },
    { href: `/cases/${caseId}/network`, label: "Network" },
    { href: `/cases/${caseId}/decision`, label: "Decision" },
  ];

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-[#0f5f4f] to-[#19484a] text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-emerald-100">Borrower Case</p>
            <h1 className="mt-1 text-2xl font-bold">{summary?.borrower_name || "Loading..."}</h1>
            <p className="mt-1 text-sm text-emerald-100">
              {summary?.industry || "Unknown industry"} | {summary?.constitution || "Unknown constitution"}
            </p>
            <p className="mt-2 text-sm text-emerald-100">
              {summary?.months_analyzed || 0} months analyzed | {summary?.accounts_analyzed || 0} accounts analyzed
            </p>
          </div>
          <Badge value={summary?.decision_badge || "PENDING"} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {item.label}
          </Link>
        ))}
      </div>

      {(mode === "overview" || mode === "truth" || mode === "lenders" || mode === "decision") && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="True Monthly Sales" value={inr(Number(summary?.kpis?.true_monthly_sales || 0))} />
          <MetricCard label="Net Surplus" value={inr(Number(summary?.kpis?.net_surplus || 0))} />
          <MetricCard label="EMI Burden" value={inr(Number(summary?.kpis?.emi_burden || 0))} />
          <MetricCard label="Hidden Private Finance" value={inr(Number(summary?.kpis?.hidden_private_finance || 0))} />
          <MetricCard label="Truth Score" value={pct(Number(summary?.kpis?.truth_score || 0))} />
          <MetricCard label="Fraud Risk Score" value={pct(Number(summary?.kpis?.fraud_risk_score || 0))} />
        </div>
      )}

      {(mode === "overview" || mode === "truth") && (
        <Card>
          <h2 className="text-lg font-bold">Borrower Truth Waterfall</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={truthRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period_month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="gross_credits" fill="#126f5c" />
                <Bar dataKey="adjusted_business_credits" fill="#1c8f71" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {(mode === "overview" || mode === "lenders") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">EMI Pass Tracker</h2>
            <div className="mt-3 space-y-2 text-sm">
              {emis.map((row) => (
                <div key={row.lender_name} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{row.lender_name}</p>
                  <p>Monthly EMI: {inr(row.monthly_amount_estimate)}</p>
                  <p>Confidence: {pct(row.confidence * 100)}</p>
                  <p>Missed Months: {(row.missed_months || []).join(", ") || "None"}</p>
                </div>
              ))}
              {!emis.length ? <p className="text-slate-500">No formal EMI pattern detected.</p> : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Private Finance Cards</h2>
            <div className="mt-3 space-y-2 text-sm">
              {lenders.map((row) => (
                <div key={row.lender_name} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-900">{row.lender_name}</p>
                  <p>Principal: {inr(row.estimated_principal)}</p>
                  <p>Monthly Interest Burden: {inr(row.estimated_monthly_interest_burden)}</p>
                  <p>Cycle: {row.avg_cycle_days} days | Pattern: {row.pattern_type}</p>
                </div>
              ))}
              {!lenders.length ? <p className="text-slate-500">No strong private lender cycles detected.</p> : null}
            </div>
          </Card>
        </div>
      )}

      {(mode === "overview" || mode === "network") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">Top Customers</h2>
            <div className="mt-3 space-y-2 text-sm">
              {topCustomers.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{row.canonical_name}</p>
                  <p>Credits: {inr(row.total_credits)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Top Suppliers</h2>
            <div className="mt-3 space-y-2 text-sm">
              {topSuppliers.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{row.canonical_name}</p>
                  <p>Debits: {inr(row.total_debits)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {(mode === "overview" || mode === "decision") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">Risk Flags</h2>
            <div className="mt-3 space-y-2 text-sm">
              {(summary?.risk_flags || []).map((flag) => (
                <div key={flag.code} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="font-semibold text-rose-900">{flag.title}</p>
                  <p className="text-rose-700">{flag.description}</p>
                </div>
              ))}
              {!summary?.risk_flags?.length ? <p className="text-slate-500">No high priority flags.</p> : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Credit Brain Recommendation</h2>
            {credit ? (
              <div className="mt-3 space-y-2 text-sm">
                <Badge value={credit.decision} />
                <p>Grade: {credit.grade}</p>
                <p>Suggested Exposure: {inr(credit.suggested_exposure_min)} to {inr(credit.suggested_exposure_max)}</p>
                <p className="rounded-xl bg-slate-100 p-3 text-slate-700">{credit.narrative}</p>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">Credit Brain output pending.</p>
            )}
          </Card>
        </div>
      )}

      {mode === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">FinBox Ingestion</h2>
            <form className="mt-3 space-y-2" onSubmit={onIngest}>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder="External reference"
              />
              <textarea
                className="h-44 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
              />
              <Button disabled={ingestMutation.isPending}>
                {ingestMutation.isPending ? "Ingesting..." : "Run FinBox Ingestion"}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Case Documents</h2>
            <div className="mt-3 space-y-3">
              <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!uploadFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
