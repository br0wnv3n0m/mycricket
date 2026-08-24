import { notFound } from "next/navigation";
import { getLiveData } from "@/lib/live";
import { findCricbuzzId, getScorecard, getCommentary, getLiveState } from "@/lib/cricbuzz";
import { LiveMatchDetail } from "@/components/LiveMatchDetail";
import { MatchTabs, isMatchTab } from "@/components/MatchTabs";
import { WatchTab } from "@/components/WatchTab";
import { WATCH_ENABLED } from "@/lib/iptv";

export const dynamic = "force-dynamic";
const LIVE_TABS = ["summary", "scorecard", "commentary", "watch"] as const;

export default async function LiveMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab =
    isMatchTab(tab) && LIVE_TABS.includes(tab) && (tab !== "watch" || WATCH_ENABLED) ? tab : "summary";

  const data = await getLiveData();
  const match = [...data.live, ...data.recent, ...data.upcoming].find((m) => m.id === id);
  if (!match) notFound();

  /* Watch tab */
  if (activeTab === "watch") {
    if (!WATCH_ENABLED) {
      return (
        <div className="glass rounded-xl p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-100">Watch is coming soon</h2>
          <p className="mt-2 text-sm text-slate-400">Live streaming is temporarily disabled.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        <MatchTabs basePath={`/match/live/${id}`} active={activeTab} include={[...LIVE_TABS].filter((t) => WATCH_ENABLED || t !== "watch")} />
        <WatchTab match={match} />
      </div>
    );
  }

  // Try to enrich with live data scraped from Cricbuzz.
  // Fails gracefully -> summary-only view.
  let innings = null;
  let commentary = null;
  let snapshot = null;
  try {
    const cbId = await findCricbuzzId(match.teams);
    if (cbId) {
      if (activeTab === "scorecard") innings = await getScorecard(cbId);
      else if (activeTab === "commentary") commentary = await getCommentary(cbId);
      else {
        // summary tab: fetch commentary page once for both the snapshot and
        // recent balls (used for boundary counts + recent-overs strip)
        const state = await getLiveState(cbId);
        snapshot = state?.snapshot ?? null;
        commentary = state?.balls ?? null;
      }
    }
  } catch {
    // ignore scraper failures
  }

  return (
    <div className="flex flex-col gap-6">
        <MatchTabs basePath={`/match/live/${id}`} active={activeTab} include={[...LIVE_TABS].filter((t) => WATCH_ENABLED || t !== "watch")} />
      <LiveMatchDetail
        match={match}
        activeTab={activeTab}
        innings={activeTab === "scorecard" ? innings : undefined}
        commentary={commentary}
        snapshot={snapshot}
      />
    </div>
  );
}
