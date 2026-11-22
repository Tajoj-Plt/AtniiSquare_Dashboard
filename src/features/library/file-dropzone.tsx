import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, AudioLines, CheckCircle2, File as FileIcon, Film, Image as ImageIcon, Upload, X,
} from 'lucide-react';
import { ApiError, uploadFile } from '@/lib/api';
import { cn, formatBytes, formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/primitives';
import { MediaPlayer } from '@/components/data/media-player';

export interface UploadedAsset {
  id: string;
  original_name?: string;
  size_bytes?: number;
  mime_type?: string;
  url?: string;
  duration_seconds?: number;
}

type PreviewKind = 'image' | 'file' | 'video' | 'audio';

/**
 * Reads how long a media file plays, without uploading it.
 *
 * The duration is worth having before the transfer starts: it is shown while a long upload
 * runs, and it is stored with the asset, so a 90-minute lecture says so in the library
 * without anyone opening it. A file the browser cannot decode simply has no duration.
 */
function readDuration(file: File, kind: 'video' | 'audio'): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = (value?: number) => {
      URL.revokeObjectURL(url);
      resolve(value && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(undefined);
    // Never let a metadata read hold up the upload.
    setTimeout(() => done(el.duration), 4000);
    el.src = url;
  });
}

/**
 * Drag-and-drop upload straight to object storage.
 *
 * The client checks the accepted types and the size ceiling before it asks for signed
 * URLs, so an obviously invalid pick fails instantly instead of after a gigabyte of
 * transfer — but the server repeats both checks and verifies the file's magic bytes, so
 * this is a courtesy, not the security boundary. Large files are sent in parts by the
 * uploader; from here that only shows up as progress that survives a dropped part.
 */
export function FileDropzone({
  surface, accept, maxBytes, value, onChange, hint, preview,
}: {
  surface: string;
  accept: string[];
  maxBytes: number;
  value?: UploadedAsset | null;
  onChange: (asset: UploadedAsset | null) => void;
  hint?: string;
  preview?: PreviewKind;
}) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [sending, setSending] = React.useState<{ name: string; size: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const playable = preview === 'video' || preview === 'audio';

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);

    if (accept.length && !accept.includes(file.type)) {
      setError(`${file.type || t('common.unknown')} — ${accept.join(', ')}`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`${formatBytes(file.size)} > ${formatBytes(maxBytes)}`);
      return;
    }

    const durationSeconds = playable ? await readDuration(file, preview as 'video' | 'audio') : undefined;

    abortRef.current = new AbortController();
    setSending({ name: file.name, size: file.size });
    setProgress(0);
    try {
      const asset = await uploadFile(file, surface, setProgress, {
        durationSeconds,
        signal: abortRef.current.signal,
      });
      onChange({
        id: asset.id,
        original_name: asset.original_name ?? file.name,
        size_bytes: asset.size_bytes ?? file.size,
        mime_type: asset.mime_type ?? file.type,
        url: asset.url,
        // The API returns this as a numeric string; the content form sends it back as an
        // integer, so round it here rather than at every use.
        duration_seconds: Math.round(Number(asset.duration_seconds ?? durationSeconds ?? 0)) || undefined,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') setError(t('media.uploadCancelled'));
      else setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      abortRef.current = null;
      setProgress(null);
      setSending(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (value) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          {preview === 'image' && value.url ? (
            <img src={value.url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-success/10 text-success">
              {preview === 'video' ? <Film className="h-5 w-5" />
                : preview === 'audio' ? <AudioLines className="h-5 w-5" />
                : <CheckCircle2 className="h-5 w-5" />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.original_name ?? t('library.hints.uploaded')}</p>
            <p className="numeric text-xs text-muted-foreground">
              {formatBytes(value.size_bytes)}
              {value.duration_seconds ? ` · ${formatDuration(value.duration_seconds)}` : ''}
              {' · '}{t('library.hints.uploaded')}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label={t('actions.remove')}>
            <X />
          </Button>
        </div>
        {/* Confirming what actually landed matters more for media than for a PDF: a file
            can upload perfectly and still be the wrong take. */}
        {playable && value.url ? (
          <MediaPlayer
            src={value.url}
            kind={preview as 'video' | 'audio'}
            durationSeconds={value.duration_seconds}
            compact
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
        onClick={() => progress === null && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-input hover:border-accent/50 hover:bg-secondary/40',
          progress !== null && 'cursor-default',
        )}
      >
        {progress !== null ? (
          <>
            <Upload className="h-8 w-8 animate-pulse text-accent" />
            <p className="mt-3 max-w-xs truncate text-sm font-medium">
              {sending?.name ?? t('library.hints.verifying')}
            </p>
            <Progress value={progress} className="mt-3 w-56" />
            <p className="numeric mt-1 text-xs text-muted-foreground">
              {progress}%
              {sending ? ` · ${formatBytes((sending.size * progress) / 100)} / ${formatBytes(sending.size)}` : ''}
            </p>
            {/* A gigabyte upload has to be abandonable — the alternative is waiting out a
                mistake. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={(e) => { e.stopPropagation(); abortRef.current?.abort(); }}
            >
              {t('actions.cancel')}
            </Button>
          </>
        ) : (
          <>
            {preview === 'image' ? <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              : preview === 'video' ? <Film className="h-8 w-8 text-muted-foreground/50" />
              : preview === 'audio' ? <AudioLines className="h-8 w-8 text-muted-foreground/50" />
              : <FileIcon className="h-8 w-8 text-muted-foreground/50" />}
            <p className="mt-3 text-sm font-medium">{t('library.hints.dropzone')}</p>
            {hint ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
            <p className="numeric mt-1 text-xs text-muted-foreground/70">
              {t('media.maxSize', { size: formatBytes(maxBytes) })}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4">
              {t('actions.browse')}
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept.join(',')}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}
    </div>
  );
}
