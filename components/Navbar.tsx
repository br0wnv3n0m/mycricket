"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const LINKS = [
  { href: "/", label: "Live" },
  { href: "/past", label: "Results" },
  { href: "/schedule", label: "Schedule" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-pitch-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <motion.span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-flame-500 text-lg shadow-lg shadow-accent-500/20"
            whileHover={{ rotate: -12, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            🏏
          </motion.span>
          <span className="text-lg font-bold tracking-tight">
            My<span className="text-gradient">Cricket</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? "text-pitch-950" : "text-slate-300 hover:text-white"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-400 to-accent-500"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}