"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/http";
import { Borrower } from "@/lib/types";

export default function BorrowersPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [constitution, setConstitution] = useState("Proprietorship");

  const borrowersQuery = useQuery({
    queryKey: ["borrowers"],
    queryFn: () => apiRequest<Borrower[]>("/borrowers"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<Borrower>("/borrowers", {
        method: "POST",
        body: JSON.stringify({ name, industry, constitution }),
      }),
    onSuccess: () => {
      setName("");
      setIndustry("");
      qc.invalidateQueries({ queryKey: ["borrowers"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
      <Card>
        <h2 className="text-lg font-bold">New Borrower</h2>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Borrower name"
          />
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry"
          />
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            value={constitution}
            onChange={(e) => setConstitution(e.target.value)}
          >
            <option>Proprietorship</option>
            <option>Partnership</option>
            <option>Private Limited</option>
            <option>LLP</option>
          </select>
          <Button className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Borrower"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Borrower Directory</h2>
        <div className="mt-4 grid gap-3">
          {(borrowersQuery.data ?? []).map((b) => (
            <Link key={b.id} href={`/borrowers/${b.id}`} className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{b.name}</p>
                <p className="text-xs uppercase text-slate-500">{b.constitution}</p>
              </div>
              <p className="text-sm text-slate-600">{b.industry || "Industry not set"}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
