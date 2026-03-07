"use client";

import { useParams } from "next/navigation";
import CaseCockpit from "@/components/case-cockpit";

export default function TruthPage() {
  const params = useParams<{ id: string }>();
  return <CaseCockpit caseId={params.id} mode="truth" />;
}
