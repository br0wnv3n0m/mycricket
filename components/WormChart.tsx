"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WormPoint } from "@/lib/types";

const COLORS = ["#38e8c6", "#ff7a59", "#7dd3fc", "#fbbf24"];

export function WormChart({ data, teams }: { data: WormPoint[]; teams: string[] }) {
  return (
    <div className="glass p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
        Runs progression
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <defs>
            {teams.slice(0, 2).map((t, i) => (
              <linearGradient key={t} id={`worm-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[i]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS[i]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="over"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            label={{ value: "Over", position: "insideBottomRight", offset: -2, fill: "#64748b", fontSize: 11 }}
          />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "rgba(10,15,30,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.75rem",
              color: "#e6ecf5",
            }}
            labelFormatter={(v) => `Over ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {teams.slice(0, 2).map((t, i) => (
            <Area
              key={t}
              type="monotone"
              dataKey={t}
              name={t}
              stroke={COLORS[i]}
              strokeWidth={2.5}
              fill={`url(#worm-${i})`}
              animationDuration={1400}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}