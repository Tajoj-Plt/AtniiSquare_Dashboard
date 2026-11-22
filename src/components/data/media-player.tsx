import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Film } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';

/**
 * Plays an uploaded audio or video asset.
 *
 * The browser's own controls are used rather than a custom transport: they already handle
 * captions, playback rate, picture-in-picture, AirPlay and the keyboard, and the one thing
 * a bespoke bar reliably adds is a seek that does not work. Seeking needs the store to
 * answer range requests — it does.
 */
export function MediaPlayer({
  src, kind, poster, durationSeconds, className, compact,
}: {
  src?: string | null;
  kind: 'video' | 'audio';
  poster?: string | null;
  durationSeconds?: number | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);

  if (!src || failed) {
    return (
      <div className={cn(
        'grid place-items-center gap-2 rounded-2xl border border-dashed bg-secondary/40 p-8 text-center',
        className,
      )}>
        {kind === 'video' ? <Film className="h-6 w-6 text-muted-foreground/60" />
          : <AudioLines className="h-6 w-6 text-muted-foreground/60" />}
        <p className="text-sm text-muted-foreground">
          {failed ? t('media.playbackFailed') : t('media.noFile')}
        </p>
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className={cn('rounded-2xl border bg-card p-4', className)}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <AudioLines className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('media.audioTrack')}</p>
            {durationSeconds ? (
              <p className="numeric text-xs text-muted-foreground">{formatDuration(durationSeconds)}</p>
            ) : null}
          </div>
        </div>
        {/* Audio elements ignore width unless told otherwise. */}
        <audio src={src} controls preload="metadata" onError={() => setFailed(true)} className="w-full" />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-black', compact && 'max-w-md', className)}>
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        preload="metadata"
        playsInline
        onError={() => setFailed(true)}
        className="aspect-video w-full bg-black"
      />
    </div>
  );
}
