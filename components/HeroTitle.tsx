"use client";

import { motion } from "framer-motion";

export function HeroTitle() {
  const words = ["Every", "ball.", "Every", "run."];
  return (
    <section className="pt-4 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-4xl font-extrabold tracking-tight sm:text-5xl"
      >
        {words.map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
            className={`inline-block ${i % 2 === 1 ? "text-gradient" : ""}`}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.6 }}
        className="mx-auto mt-3 max-w-xl text-slate-400"
      >
        Live scores, deep match dashboards and a full year of results — all in one beautiful place.
      </motion.p>
    </section>
  );
}