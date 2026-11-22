import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AudioLines, ExternalLink, FileText, Image as ImageIcon, Play, Trash2, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatBytes, formatDate, formatDuration } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader, StatCard, StatusPill } from '@/components/data/page-parts';
import { Badge } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { MediaPlayer } from '@/components/data/media-player';

const TYPE_ICON: Record<string, typeof FileText> = {
  image: ImageIcon, document: FileText, video: Video, audio: AudioLines, recording: Video,
};
const PLAYABLE = ['video', 'audio', 'recording'];

export function MediaPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('media', '/media', { sort: '-created_at' });
  const { data: stats } = useQuery({
    queryKey: ['media', 'stats'],
    queryFn: () => api.get('/media/stats'),
    enabled: can('analytics.read'),
  });

  const [deleting, setDeleting] = React.useState<any | null>(null);
  const remove = useApiMutation(() => api.delete(`/media/${deleting.id}`), {
    successMessage: t('library.deleted'),
    invalidate: [['media']],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const open = async (row: any) => {
    const res = await api.get(`/media/${row.id}/download`);
    window.open(res.url, '_blank', 'noopener');
  };

  // Playback happens in place: opening a signed URL in a tab either downloads the file or
  // strands the operator on a bare video element with no way back.
  const [playing, setPlaying] = React.useState<any | null>(null);
  const play = async (row: any) => {
    const res = await api.get(`/media/${row.id}/stream`);
    setPlaying({ ...row, url: res.url, duration_seconds: res.durationSeconds ?? row.duration_seconds });
  };

  const totals = (stats ?? []).reduce(
    (acc: any, row: any) => {
      acc.count += row.count;
      acc.bytes += Number(row.bytes);
      if (row.status === 'ready') acc.ready += row.count;
      if (row.status === 'pending') acc.pending += row.count;
      return acc;
    },
    { count: 0, bytes: 0, ready: 0, pending: 0 },
  );

  const columns: Column<any>[] = [
    {
      key: 'original_name',
      header: t('common.name'),
      cell: (row) => {
        const Icon = TYPE_ICON[row.asset_type] ?? FileText;
        return (
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-1 font-medium">{row.original_name ?? row.object_key?.split('/').pop()}</p>
              <code className="line-clamp-1 text-[11px] text-muted-foreground" dir="ltr">{row.object_key}</code>
            </div>
          </div>
        );
      },
      exportValue: (row) => row.object_key,
    },
    { key: 'asset_type', header: t('media.assetType'), hideBelow: 'md', cell: (row) => <Badge variant="secondary">{row.asset_type}</Badge> },
    { key: 'mime_type', header: t('common.type'), hideBelow: 'lg', cell: (row) => <code className="text-xs">{row.mime_type}</code> },
    { key: 'size_bytes', header: t('common.size'), sortable: true, className: 'numeric', cell: (row) => formatBytes(row.size_bytes) },
    { key: 'duration_seconds', header: t('media.duration'), hideBelow: 'xl', className: 'numeric text-muted-foreground', cell: (row) => formatDuration(row.duration_seconds) || '—' },
    { key: 'status', header: t('common.status'), sortable: true, cell: (row) => <StatusPill status={row.status} label={t(`media.status.${row.status}`, { defaultValue: row.status })} /> },
    { key: 'owner_name', header: t('media.owner'), hideBelow: 'lg', cell: (row) => row.owner_name ?? '—' },
    { key: 'content_title', header: t('nav.library'), hideBelow: 'xl', cell: (row) => <span className="line-clamp-1">{row.content_title ?? '—'}</span> },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'md', className: 'numeric text-muted-foreground', cell: (row) => formatDate(row.created_at, lang) },
  ];

  return (
    <>
      <PageHeader icon={ImageIcon} tone="orange" title={t('media.title')} subtitle={t('media.subtitle')} />

      {stats ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('media.storageUsed')} value={formatBytes(totals.bytes)} />
          <StatCard label={t('nav.media')} value={totals.count} />
          <StatCard label={t('media.status.ready')} value={totals.ready} tone="success" />
          <StatCard label={t('media.status.pending')} value={totals.pending} tone="warning" />
        </section>
      ) : null}

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        loadingMore={list.loadingMore}
        error={list.error}
        total={list.total}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        onRefresh={list.refresh}
        search={list.state.q}
        onSearchChange={list.setSearch}
        sort={list.state.sort}
        onSortChange={list.setSort}
        exportFileName="media"
        filters={
          <>
            <Select value={list.state.filter.asset_type ?? 'all'} onValueChange={(v) => list.setFilter('asset_type', v)}>
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('media.assetType')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="document">document</SelectItem>
                <SelectItem value="image">image</SelectItem>
                <SelectItem value="video">video</SelectItem>
                <SelectItem value="audio">audio</SelectItem>
                <SelectItem value="recording">recording</SelectItem>
              </SelectContent>
            </Select>
            <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {['pending', 'scanning', 'ready', 'rejected'].map((s) => (
                  <SelectItem key={s} value={s}>{t(`media.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        rowActions={[
          {
            label: t('media.play'), icon: Play, onSelect: (row) => void play(row),
            hidden: (row) => row.status !== 'ready' || !PLAYABLE.includes(row.asset_type),
          },
          { label: t('media.open'), icon: ExternalLink, onSelect: (row) => void open(row), hidden: (row) => row.status !== 'ready' },
          { label: t('media.purge'), icon: Trash2, destructive: true, onSelect: (row) => setDeleting(row), hidden: () => !can('media.manage') },
        ]}
      />

      <Dialog open={Boolean(playing)} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="truncate">
              {playing?.original_name ?? t('media.preview')}
            </DialogTitle>
          </DialogHeader>
          {playing ? (
            <MediaPlayer
              src={playing.url}
              kind={playing.mime_type?.startsWith('audio/') ? 'audio' : 'video'}
              durationSeconds={playing.duration_seconds}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('media.purge')}
        description={deleting?.object_key}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
