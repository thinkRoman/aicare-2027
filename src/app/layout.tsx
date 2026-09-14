import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PRODUCT_BRAND, PRODUCT_TAGLINE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_BRAND,
  description: PRODUCT_TAGLINE,
  appleWebApp: {
    capable: true,
    title: PRODUCT_BRAND,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="aicare-shell min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
