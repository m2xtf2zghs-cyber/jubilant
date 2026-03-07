"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { clearToken, getToken } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/borrowers", label: "Borrowers" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login") return;
    const token = getToken();
    if (!token) router.replace("/login");
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 p-4 shadow-cockpit">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">CreditAtlas</p>
          <p className="text-lg font-bold">Lender Intelligence Terminal</p>
        </div>
        <div className="flex items-center gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium",
                pathname.startsWith(item.href) ? "bg-accent text-white" : "text-ink hover:bg-white",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
