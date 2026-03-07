"use client";

import { useParams } from "next/navigation";
import CaseCockpit from "@/components/case-cockpit";

export default function DecisionPage() {
  const params = useParams<{ id: string }>();
  return <CaseCockpit caseId={params.id} mode="decision" />;
}
