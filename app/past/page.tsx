import Link from "next/link";
import { getPastMatches, getTeams, getEvents } from "@/lib/queries";
import { MatchCard } from "@/components/MatchCard";
import { PastFilters } from "@/components/PastFilters";

export const dynamic = "force-dynamic";

interface SearchParams {
  format?: string;
  team?: string;
  event?: string;
  q?: string;
  page?: string;
}

export default async function PastPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = getPastMatches({
    format: (sp.format as never) ?? "all",
    team: sp.team ?? "",
    event: sp.event ?? "",
    query: sp.q ?? "",
    page,
    perPage: 24,
  });
  const teams = getTeams();
  const events = getEvents();
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.format) params.set("format", sp.format);
    if (sp.team) params.set("team", sp.team);
    if (sp.event) params.set("event", sp.event);
    if (sp.q) params.set("q", sp.q);
    params.set("page", String(p));
    return `/past?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Past <span className="text-gradient">Results</span>
        </h1>
        <p className="mt-1 text-slate-400">
          {result.total.toLocaleString()} matches found · page {result.page} of {totalPages}
        </p>
      </header>

      <PastFilters teams={teams} events={events} />

      {result.matches.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {result.matches.map((m, i) => (
            <MatchCard key={`${m.format}-${m.id}`} match={m} index={i % 8} />
          ))}
        </div>
      ) : (
        <div className="glass p-10 text-center text-slate-400">
          No matches match your filters. Try clearing them.
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={buildPageHref(page - 1)}
              className="glass glass-hover px-4 py-2 text-sm font-medium"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-400">
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageHref(page + 1)}
              className="glass glass-hover px-4 py-2 text-sm font-medium"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}