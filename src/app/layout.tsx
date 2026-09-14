import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_BRAND, PRODUCT_TAGLINE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_BRAND,
  description: PRODUCT_TAGLINE,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
