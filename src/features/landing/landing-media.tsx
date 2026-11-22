import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Play, Search, Signal, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES } from '@/lib/tones';

/* ------------------------------------------------------------------- video */

type Embed = { kind: 'youtube' | 'vimeo' | 'file' | 'none'; src?: string; thumb?: string };

/**
 * Works out how to play whatever URL an operator pasted.
 *
 * Only the two providers below are embedded; anything else that is not a media file is
 * treated as "no video" rather than dropped into an iframe, because an arbitrary origin in
 * a frame on the public page is not something a CMS field should be able to arrange.
 */
export function parseVideo(url?: string): Embed {
  const raw = (url ?? '').trim();
  if (!raw) return { kind: 'none' };
  try {
    const u = new URL(raw, window.location.origin);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const id = host === 'youtu.be'
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop();
      if (!id) return { kind: 'none' };
      return {
        kind: 'youtube',
        // The nocookie host, and only reached after the visitor clicks play.
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`,
        thumb: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`,
      };
    }

    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (!id) return { kind: 'none' };
      return { kind: 'vimeo', src: `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` };
    }

    if (/\.(mp4|webm|ogv|ogg|mov)$/i.test(u.pathname)) return { kind: 'file', src: u.href };
    return { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}

/** Applies a start offset in whichever way the provider understands. */
function embedSrc(embed: Embed, start: number) {
  if (!embed.src || !start) return embed.src;
  return embed.kind === 'youtube' ? `${embed.src}&start=${start}` : `${embed.src}#t=${start}s`;
}

/** "1:24" or "01:02:03" as seconds; anything unparseable simply starts from the top. */
export function timeToSeconds(value?: string) {
  const parts = (value ?? '').trim().split(':').map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/**
 * The player frame.
 *
 * Nothing from a video host is requested until the visitor asks for the video: until then
 * the frame shows the operator's poster, or — when there is no poster and no video yet —
 * an animated mock of the product, so the section still looks deliberate on a fresh
 * install instead of showing a dead play button.
 */
export function VideoFrame({
  url, poster, duration, label, caption, seek,
}: {
  url?: string; poster?: string; duration?: string; label: string; caption?: string;
  /** Bumping the token starts playback at `seconds` — that is how chapters jump in. */
  seek?: { seconds: number; token: number };
}) {
  const { t } = useTranslation();
  const [playing, setPlaying] = React.useState(false);
  const [start, setStart] = React.useState(0);
  const embed = React.useMemo(() => parseVideo(url), [url]);

  React.useEffect(() => {
    if (!seek?.token) return;
    setStart(seek.seconds);
    setPlaying(true);
  }, [seek?.token]);
  const still = poster || (embed.kind === 'youtube' ? embed.thumb : undefined);
  const playable = embed.kind !== 'none';

  return (
    <figure className="relative">
      {/* Bloom behind the frame, so the player sits in light rather than on a flat panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] opacity-70 blur-2xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, hsl(var(--accent) / 0.28), transparent 70%)' }}
      />
      <div className="group relative aspect-video overflow-hidden rounded-[1.75rem] border bg-card shadow-raised">
        {playing && playable ? (
          embed.kind === 'file' ? (
            <video
              key={start}
              src={embed.src}
              poster={still}
              controls
              autoPlay
              playsInline
              onLoadedMetadata={(e) => { if (start) e.currentTarget.currentTime = start; }}
              className="absolute inset-0 h-full w-full bg-black object-contain"
            />
          ) : (
            <iframe
              key={start}
              src={embedSrc(embed, start)}
              title={label}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          )
        ) : (
          <>
            {still ? (
              <img
                src={still}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            ) : (
              <BrowserMock />
            )}
            {/* Enough scrim for the chips to read — heavier over a photo, barely there
                over the mock, which is already made of page tokens. */}
            <div aria-hidden className={cn(
              'absolute inset-0 bg-gradient-to-t to-transparent',
              still ? 'from-black/45 via-black/5' : 'from-black/25 via-transparent',
            )} />

            {playable ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={label}
                className="absolute inset-0 grid place-items-center focus-visible:ring-inset"
              >
                <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white/95 text-neutral-900 shadow-raised transition-transform duration-300 group-hover:scale-105">
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/40" />
                  {/* The glyph points at the reading direction, not always right. */}
                  <Play className="relative h-6 w-6 translate-x-0.5 fill-current rtl:-translate-x-0.5 rtl:-scale-x-100" />
                </span>
              </button>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                {playable ? label : t('landing.video.soon')}
              </span>
              {duration ? (
                <span className="numeric rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  {duration}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A miniature of the dashboard, used as the video still before anything is configured.
 * Deliberately abstract — it suggests the product without pretending to be a screenshot.
 */
export function BrowserMock() {
  return (
    <div className="absolute inset-0 flex flex-col bg-background p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex gap-1.5">
          {['bg-rose-400/70', 'bg-amber-400/70', 'bg-emerald-400/70'].map((c) => (
            <span key={c} className={cn('h-2.5 w-2.5 rounded-full', c)} />
          ))}
        </span>
        <span className="mx-auto rounded-full border bg-card px-3 py-1 text-[10px] text-muted-foreground">
          sudamind.sd/library
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="hidden w-10 shrink-0 flex-col items-center gap-2.5 rounded-2xl border bg-card py-3 sm:flex">
          <span className="h-5 w-5 rounded-lg bg-accent" />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={cn('h-3.5 w-3.5 rounded-md', i === 1 ? 'bg-foreground/40' : 'bg-foreground/10')} />
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { tone: 'blue' as const, w: 'w-8' },
              { tone: 'violet' as const, w: 'w-6' },
              { tone: 'amber' as const, w: 'w-10' },
            ].map((k, i) => (
              <div key={i} className="rounded-xl border bg-card p-2.5">
                <span className={cn('block h-1.5 w-10 rounded-full', TONES[k.tone].dot, 'opacity-60')} />
                <span className={cn('mt-2 block h-3 rounded', k.w, 'bg-foreground/70')} />
              </div>
            ))}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-card p-2.5">
            <svg viewBox="0 0 300 90" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="sm-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 74 L38 66 L76 70 L114 52 L152 58 L190 34 L228 40 L266 18 L300 10 L300 90 L0 90 Z"
                fill="url(#sm-spark)"
              />
              <path
                d="M0 74 L38 66 L76 70 L114 52 L152 58 L190 34 L228 40 L266 18 L300 10"
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="anim-draw"
              />
            </svg>
            <span className="absolute end-3 top-3 h-2 w-2 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ mobile */

/** A device shell. The screen is composed from tokens, so it themes with the page. */
export function PhoneMock({
  children, className, width = 'w-[15rem]',
}: { children: React.ReactNode; className?: string; width?: string }) {
  return (
    <div
      className={cn(
        // On a dark page the bezel is nearly the page colour, so the ring is what keeps
        // the device readable as an object rather than a floating screen.
        'relative shrink-0 rounded-[2.5rem] border-[9px] border-neutral-900 bg-neutral-900 shadow-raised',
        'ring-1 ring-black/10 dark:ring-white/20',
        width,
        className,
      )}
    >
      {/* Camera island — drawn over the screen, like the hardware it stands for. */}
      <span aria-hidden className="absolute inset-x-0 top-2 z-20 mx-auto h-5 w-20 rounded-full bg-neutral-900" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-background">{children}</div>
    </div>
  );
}

function StatusBar({ offline }: { offline?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[9px] font-semibold text-muted-foreground">
      <span className="numeric">٩:٤١</span>
      <span className="flex items-center gap-1">
        {offline ? <WifiOff className="h-2.5 w-2.5" /> : <Wifi className="h-2.5 w-2.5" />}
        <Signal className="h-2.5 w-2.5" />
        <span className="h-2 w-4 rounded-[3px] border border-current/60 p-[1px]">
          <span className="block h-full w-2/3 rounded-[1px] bg-current" />
        </span>
      </span>
    </div>
  );
}

const SCREEN_ROWS = [
  { tone: 'amber' as const, w: 'w-[85%]' },
  { tone: 'blue' as const, w: 'w-[70%]' },
  { tone: 'violet' as const, w: 'w-[78%]' },
  { tone: 'teal' as const, w: 'w-[62%]' },
  { tone: 'rose' as const, w: 'w-[80%]' },
];

/** The library screen: a search field and an endlessly scrolling result list. */
export function LibraryScreen({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="px-3.5 pb-2 pt-3">
        <p className="text-[13px] font-semibold">{title}</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 text-[9px] text-muted-foreground">
          <Search className="h-2.5 w-2.5" />
          <span className="h-1.5 w-14 rounded-full bg-foreground/15" />
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* The list is duplicated so the loop has no visible seam. */}
        <div className="anim-scroll-y space-y-2 px-3.5">
          {[...SCREEN_ROWS, ...SCREEN_ROWS].map((row, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl border bg-card p-2">
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', TONES[row.tone].chip)}>
                <BookOpen className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className={cn('block h-1.5 rounded-full bg-foreground/70', row.w)} />
                <span className="block h-1.5 w-1/2 rounded-full bg-foreground/15" />
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="flex items-center justify-around border-t px-4 py-2.5">
        {['bg-accent', 'bg-foreground/15', 'bg-foreground/15', 'bg-foreground/15'].map((c, i) => (
          <span key={i} className={cn('h-3 w-3 rounded-md', c)} />
        ))}
      </div>
    </div>
  );
}

/** The reader screen, shown on the phone standing behind. */
export function ReaderScreen({ title, progressLabel }: { title: string; progressLabel: string }) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar offline />
      <div className="px-3.5 pt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[8px] font-medium text-emerald-600 dark:text-emerald-400">
          <WifiOff className="h-2 w-2" /> {progressLabel}
        </span>
        <p className="mt-2 text-[12px] font-semibold leading-snug">{title}</p>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-1.5 px-3.5">
        {['w-full', 'w-[92%]', 'w-[96%]', 'w-[88%]', 'w-full', 'w-[70%]', 'w-full', 'w-[94%]', 'w-[80%]'].map((w, i) => (
          <span key={i} className={cn('block h-1.5 rounded-full bg-foreground/12', w)} />
        ))}
      </div>
      <div className="px-3.5 pb-4 pt-3">
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full w-2/3 rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}
