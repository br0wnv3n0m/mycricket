import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "MyCricket — Live Scores, Results & Schedule",
  description:
    "A beautiful cricket dashboard with live scores, past match results and upcoming fixtures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
        <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
          Built with{" "}
          <Link href="/" className="text-accent-400 hover:underline">
            MyCricket
          </Link>{" "}
          · Data by Cricsheet & live-score API
        </footer>
      </body>
    </html>
  );
}