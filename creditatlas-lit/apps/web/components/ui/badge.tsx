import { cn } from "@/lib/utils";

type Props = {
  value: string;
};

export function Badge({ value }: Props) {
  const tone =
    value === "APPROVE"
      ? "bg-emerald-100 text-emerald-800"
      : value === "DECLINE"
        ? "bg-red-100 text-red-800"
        : value.includes("CAUTION")
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-200 text-slate-800";

  return <span className={cn("rounded-full px-3 py-1 text-xs font-bold", tone)}>{value}</span>;
}
