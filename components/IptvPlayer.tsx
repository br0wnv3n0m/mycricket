'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { IptvChannel } from '@/lib/iptv';

interface Props {
  channels: IptvChannel[];
  suggestedId?: string;
  suggestionReason?: string;
  matchLabel: string;
}

export function IptvPlayer({ channels, suggestedId, suggestionReason, matchLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(suggestedId);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [query, setQuery] = useState('');

  const selected = useMemo(() => channels.find((c) => c.id === selectedId), [channels, selectedId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected) return;
    let destroyed = false;
    let hls: { destroy(): void } | null = null;
    setStatus('loading');
    setErrorMsg('');
    import('hls.js')
      .then(({ default: Hls }) => {
        if (destroyed) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ lowLatencyMode: true, enableWorker: true });
          hls = instance;
          instance.loadSource(selected.url);
          instance.attachMedia(video);
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              setStatus('error');
              setErrorMsg('Stream error - try another channel.');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = selected.url;
          video.play().catch(() => {});
        } else {
          setStatus('error');
          setErrorMsg('HLS playback is not supported in this browser.');
        }
      })
      .catch(() => {
        if (!destroyed) {
          setStatus('error');
          setErrorMsg('Failed to load the player.');
        }
      });
    return () => {
      destroyed = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? channels.filter((c) => (c.name + ' ' + c.group).toLowerCase().includes(q)) : channels;
    return [...list].sort((a, b) => {
      const s = (c: IptvChannel) => (/sport|cricket|willow|star|sky|tnt|supersport|kayo|ptv/i.test(c.group + ' ' + c.name) ? 0 : 1);
      return s(a) - s(b) || a.name.localeCompare(b.name);
    });
  }, [channels, query]);

  return (
    <div className='grid gap-4 lg:grid-cols-[1fr_320px]'>
      <div className='flex flex-col gap-2'>
        <div className='glass relative aspect-video overflow-hidden rounded-xl bg-black'>
          <video ref={videoRef} controls playsInline className='h-full w-full' onPlaying={() => setStatus('playing')} />
          {status === 'loading' && (
            <div className='absolute inset-0 flex items-center justify-center text-sm text-slate-400'>Connecting to stream...</div>
          )}
          {!selected && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center'>
              <p className='text-sm font-semibold text-slate-200'>No channel selected</p>
              <p className='text-xs text-slate-400'>Pick a channel from the list to start watching {matchLabel}.</p>
            </div>
          )}
        </div>
        {selected && (
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            <span className='font-semibold text-slate-100'>{selected.name}</span>
            <span className='rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400'>{selected.group}</span>
            {suggestedId === selected.id && suggestionReason && (
              <span className='rounded-md bg-accent-500/15 px-2 py-0.5 text-xs text-accent-300'>Auto-matched - {suggestionReason}</span>
            )}
            {status === 'error' && <span className='text-xs text-red-400'>{errorMsg}</span>}
          </div>
        )}
      </div>
      <aside className='glass flex max-h-[70vh] flex-col rounded-xl'>
        <div className='border-b border-white/10 p-3'>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'Search channels...'} className='w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-accent-500/50' />
        </div>
        <ul className='flex-1 overflow-y-auto p-2'>
          {filtered.map((ch) => (
            <li key={ch.id}>
              <button onClick={() => setSelectedId(ch.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${ch.id === selectedId ? 'bg-accent-500/15 text-accent-300' : 'text-slate-300 hover:bg-white/5'}`}>
                <span className='min-w-0 flex-1 truncate'>{ch.name}</span>
                <span className='shrink-0 text-[10px] uppercase tracking-wide text-slate-500'>{ch.group.slice(0, 12)}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className='px-3 py-6 text-center text-xs text-slate-500'>No channels match.</li>}
        </ul>
      </aside>
    </div>
  );
}
