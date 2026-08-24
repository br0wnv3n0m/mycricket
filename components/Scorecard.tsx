"use client";

import { motion } from "framer-motion";
import type { InningsDetail } from "@/lib/types";

function overs(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function Scorecard({ innings, index }: { innings: InningsDetail; index: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="glass overflow-hidden"
    >
      <header className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-4">
        <h3 className="font-bold text-white">{innings.team} — Innings</h3>
        <p className="font-mono text-lg font-bold text-accent-400">
          {innings.total}/{innings.wickets}
          <span className="ml-2 text-sm font-normal text-slate-400">({overs(innings.balls)} ov)</span>
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Batter</th>
              <th className="px-3 py-3 text-right font-medium">R</th>
              <th className="px-3 py-3 text-right font-medium">B</th>
              <th className="px-3 py-3 text-right font-medium">4s</th>
              <th className="px-3 py-3 text-right font-medium">6s</th>
              <th className="px-5 py-3 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {innings.batting.map((b, i) => (
              <motion.tr
                key={b.name}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5) }}
                className="border-t border-white/5 hover:bg-white/[0.03]"
              >
                <td className="px-5 py-2.5">
                  <span className="font-medium text-white">{b.name}</span>
                  <span className="block text-xs text-slate-500">{b.dismissal}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">{b.runs}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.balls}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.fours}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.sixes}</td>
                <td className="px-5 py-2.5 text-right font-mono text-slate-400">{b.strikeRate}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/5 px-5 py-3 text-xs text-slate-400">
        Extras {innings.extras.total}{" "}
        <span className="text-slate-500">
          (b {innings.extras.byes}, lb {innings.extras.legbyes}, w {innings.extras.wides}, nb{" "}
          {innings.extras.noballs})
        </span>
      </div>

      <div className="overflow-x-auto border-t border-white/5">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Bowler</th>
              <th className="px-3 py-3 text-right font-medium">O</th>
              <th className="px-3 py-3 text-right font-medium">M</th>
              <th className="px-3 py-3 text-right font-medium">R</th>
              <th className="px-3 py-3 text-right font-medium">W</th>
              <th className="px-5 py-3 text-right font-medium">Econ</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowling.map((b, i) => (
              <motion.tr
                key={b.name}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5) }}
                className="border-t border-white/5 hover:bg-white/[0.03]"
              >
                <td className="px-5 py-2.5 font-medium text-white">{b.name}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.overs}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.maidens}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{b.runs}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-accent-400">{b.wickets}</td>
                <td className="px-5 py-2.5 text-right font-mono text-slate-400">{b.economy}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {innings.fallOfWickets.length > 0 && (
        <div className="border-t border-white/5 px-5 py-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Fall of wickets: </span>
          {innings.fallOfWickets
            .map((f) => `${f.score}-${f.wicket} (${f.batter}, ${f.over} ov)`)
            .join(", ")}
        </div>
      )}
    </motion.section>
  );
}