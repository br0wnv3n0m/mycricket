import type { LiveMatch } from '@/lib/types';
import { IptvPlayer } from '@/components/IptvPlayer';
import {
  getIptvChannels,
  getIptvEpg,
  findChannelsForMatch,
  isIptvConfigured,
} from '@/lib/iptv';

const envHelp = [
  '# Option A - Xtream Codes login',
  'IPTV_XTREAM_HOST=http://your-provider-host:port',
  'IPTV_XTREAM_USERNAME=your-username',
  'IPTV_XTREAM_PASSWORD=your-password',
  '# Option B - direct M3U playlist URL',
  'IPTV_M3U_URL=https://your-provider/get.php?type=m3u_plus',
].join(String.fromCharCode(10));

/** Server component backing the live match Watch tab. */
export async function WatchTab({ match }: { match: LiveMatch }) {
  let channels: Awaited<ReturnType<typeof getIptvChannels>> = [];
  let suggestedId: string | undefined;
  let suggestionReason: string | undefined;
  if (isIptvConfigured()) {
    try {
      channels = await getIptvChannels();
      if (channels.length > 0) {
        const epg = await getIptvEpg(channels);
        const result = findChannelsForMatch(
          { teams: [match.teams[0] ?? '', match.teams[1] ?? ''], formatHint: match.formatHint },
          channels,
          epg,
        );
        suggestedId = result.best?.id;
        suggestionReason = result.ranked.find((r) => r.channel.id === result.best?.id)?.reason;
      }
    } catch {
      // ignore provider failures
    }
  }
  if (channels.length === 0) {
    return (
      <div className='glass rounded-xl p-10 text-center'>
        <h2 className='text-lg font-semibold text-slate-100'>Live stream not configured</h2>
        <p className='mx-auto mt-2 max-w-md text-sm text-slate-400'>
          Add your IPTV subscription details to a .env.local file and restart the dev server.
        </p>
        <pre className='mx-auto mt-4 w-fit rounded-lg bg-black/50 p-4 text-left text-xs leading-relaxed text-slate-300'>
          {envHelp}
        </pre>
      </div>
    );
  }
  return <IptvPlayer channels={channels} suggestedId={suggestedId} suggestionReason={suggestionReason} matchLabel={match.title} />;
}
