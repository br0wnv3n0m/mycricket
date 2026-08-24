"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

export function StatCard({
  label,
  value,
  suffix = "",
  accent = "accent",
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: "accent" | "flame" | "sky";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, mv, value]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = `${Math.round(v).toLocaleString()}${suffix}`;
      }
    });
  }, [spring, suffix]);

  const accents = {
    accent: "from-accent-400/20 to-transparent text-accent-400",
    flame: "from-flame-400/20 to-transparent text-flame-400",
    sky: "from-sky-400/20 to-transparent text-sky-300",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass relative overflow-hidden p-5`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accents[accent]} opacity-60`} />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <div ref={ref} className={`mt-2 text-3xl font-bold ${accents[accent].split(" ").pop()}`}>
          0{suffix}
        </div>
      </div>
    </motion.div>
  );
}