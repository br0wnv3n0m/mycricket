import Link from "next/link";

const TABS = [
  { key: "summary", label: "Summary" },
  { key: "scorecard", label: "Scorecard" },
  { key: "commentary", label: "Commentary" },
  { key: "watch", label: "Watch" },
] as const;

export type MatchTab = (typeof TABS)[number]["key"];

export function isMatchTab(v: string | undefined): v is MatchTab {
  return TABS.some((t) => t.key === v);
}

/** ESPNcricinfo-style sub-tab bar for match pages.
 *  `include` optionally restricts which tabs render (e.g. Watch only on live pages). */
export function MatchTabs({
  basePath,
  active,
  include,
}: {
  basePath: string;
  active: MatchTab;
  include?: MatchTab[];
}) {
  const tabs = include ? TABS.filter((t) => include.includes(t.key)) : TABS;
  return (
    <nav className="glass flex gap-1 p-1.5" aria-label="Match sections">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            scroll={false}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors ${
              isActive
                ? "bg-accent-500/15 text-accent-300 shadow-[inset_0_0_0_1px_rgba(56,232,198,0.25)]"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}