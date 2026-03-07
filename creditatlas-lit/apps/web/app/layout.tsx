import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import "./globals.css";
import AppShell from "@/components/app-shell";
import Providers from "./providers";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CreditAtlas LIT",
  description: "Lender-grade borrower intelligence cockpit",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
