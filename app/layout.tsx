import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LVAS — Bin Quraya",
  description:
    "Light Vehicles Authorization System for Bin Quraya fleet operations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster theme="light" richColors position="top-center" />
      </body>
    </html>
  );
}
