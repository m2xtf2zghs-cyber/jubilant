"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/http";
import { Borrower, LoanCase } from "@/lib/types";

export default function BorrowerDetailPage() {
  const params = useParams<{ id: string }>();
  const borrowerId = params.id;

  const borrowerQuery = useQuery({
    queryKey: ["borrower", borrowerId],
    queryFn: () => apiRequest<Borrower>(`/borrowers/${borrowerId}`),
  });

  const caseMutation = useMutation({
    mutationFn: () =>
      apiRequest<LoanCase>("/cases", {
        method: "POST",
        body: JSON.stringify({ borrower_id: borrowerId }),
      }),
  });

  const borrower = borrowerQuery.data;
  const createdCase = caseMutation.data;

  return (
    <div className="space-y-5">
      <Card>
        <h1 className="text-2xl font-bold">{borrower?.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {borrower?.industry || "Industry missing"} | {borrower?.constitution || "Constitution missing"}
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Loan Case</h2>
        <p className="mt-1 text-sm text-slate-600">Create a new underwriting case for this borrower.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => caseMutation.mutate()} disabled={caseMutation.isPending}>
            {caseMutation.isPending ? "Creating..." : "Create Case"}
          </Button>
          {createdCase ? (
            <Link href={`/cases/${createdCase.id}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
              Open Case {createdCase.id.slice(0, 8)}
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
