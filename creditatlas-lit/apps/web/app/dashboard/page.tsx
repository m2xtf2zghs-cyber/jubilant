"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/http";
import { Borrower } from "@/lib/types";

export default function DashboardPage() {
  const borrowersQuery = useQuery({
    queryKey: ["borrowers"],
    queryFn: () => apiRequest<Borrower[]>("/borrowers"),
  });

  const borrowers = borrowersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Borrowers" value={borrowers.length} />
        <MetricCard label="Active Cases" value="Use borrower profile" />
        <MetricCard label="Decision Engine" value="Credit Brain v1" />
      </div>

      <Card>
        <h2 className="text-lg font-bold">Recent Borrowers</h2>
        <div className="mt-4 grid gap-3">
          {borrowers.map((b) => (
            <Link key={b.id} href={`/borrowers/${b.id}`} className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <p className="font-semibold">{b.name}</p>
              <p className="text-sm text-slate-600">{b.industry || "Industry not set"}</p>
            </Link>
          ))}
          {!borrowers.length ? <p className="text-sm text-slate-600">No borrowers yet. Create one in Borrowers.</p> : null}
        </div>
      </Card>
    </div>
  );
}
