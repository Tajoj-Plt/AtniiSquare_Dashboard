import { useTranslation } from 'react-i18next';
import { CheckCircle2, PlayCircle, Video, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { formatDuration, formatNumber, formatRelative } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/data/page-parts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CrudPage } from '@/features/taxonomy/crud-page';
import { CrudFormPage, type CrudConfig } from '@/features/taxonomy/crud-form';

const VIDEO_ACCEPT = ['video/mp4', 'video/webm', 'video/quicktime'];
/** Matches the API's ceiling — anything longer belongs in the library as a video. */
const MAX_SECONDS = 180;

/**
 * Short videos.
 *
 * A clip is published to point at something: the form asks for the video, a caption worth
 * reading, and the library item it promotes, so the reel is a route into the catalogue
 * rather than a dead end. Length is the one hard rule, and the server enforces it against
 * the file the store actually holds.
 */

/** The shared description of this resource: used by the list and by the form. */
function useShortVideoConfig(): CrudConfig {
  const { t } = useTranslation();

  return {
    queryKey: 'reels',
    path: '/reels',
    route: '/content/shorts',
    title: t('shorts.title'),
    subtitle: t('shorts.subtitle'),
    tone: 'rose',
    icon: Video,
    writePermission: 'reel.create',
    createLabel: t('shorts.newClip'),
    fields: [
        {
          name: 'media_id', label: t('shorts.videoFile'), type: 'file', required: true,
          surface: 'reel', accept: VIDEO_ACCEPT, maxBytes: 500 * 1024 * 1024,
          hint: t('shorts.videoHint', { seconds: MAX_SECONDS }), preview: 'video',
          fileNameFrom: 'title', fileSizeFrom: 'size_bytes',
          group: t('shorts.groups.clip'),
        },
        {
          name: 'cover_media_id', label: t('shorts.thumbnail'), type: 'file',
          surface: 'cover', accept: ['image/jpeg', 'image/png', 'image/webp'],
          maxBytes: 10 * 1024 * 1024, hint: t('shorts.coverHint'), preview: 'image',
        },
        { name: 'title', label: t('common.title'), colSpan: 2, group: t('shorts.groups.details'),
          placeholder: t('shorts.titlePlaceholder') },
        { name: 'caption', label: t('shorts.description'), type: 'textarea', hint: t('shorts.captionHint') },
        { name: 'language', label: t('library.fields.language'), type: 'select',
          options: [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }] },
        { name: 'location', label: t('shorts.location'), placeholder: t('shorts.locationPlaceholder') },
        { name: 'sound_title', label: t('shorts.sound'), hint: t('shorts.soundHint'), colSpan: 2 },
        { name: 'tags', label: t('shorts.keywords'), type: 'chips', max: 12,
          placeholder: t('content.form.chipsPlaceholder') },
        { name: 'interest_ids', label: t('shorts.category'), type: 'interests', colSpan: 2,
          group: t('common.classification'), hint: t('shorts.interestsHint') },
        {
          name: 'content_id', label: t('shorts.originalContent'), type: 'lookup',
          lookupPath: '/content', lookupParams: { sort: '-created_at' }, lookupLabel: 'title',
          placeholder: t('shorts.promotesPlaceholder'), hint: t('shorts.promotesHint'), colSpan: 2,
        },
      ],
  };
}

export function ShortVideosPage() {
  const config = useShortVideoConfig();
  const { t, i18n } = useTranslation();
  const { can } = useAuth();

  const moderate = useApiMutation(
    (vars: { id: string; action: string }) => api.post(`/reels/${vars.id}/moderate`, { action: vars.action }),
    { successMessage: t('library.updated'), invalidate: [['reels']] },
  );

  return (
    <CrudPage
      {...config}
      path="/reels"
      subtitle={t('shorts.subtitle')}
      icon={Video}
      createLabel={t('shorts.newClip')}
      columns={[
        {
          key: 'caption', header: t('common.title'), className: 'max-w-[26rem]',
          cell: (r: any) => (
            <div className="flex items-center gap-2.5">
              <span className="grid h-11 w-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                <PlayCircle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="line-clamp-1 font-medium">{r.title ?? r.caption ?? '—'}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{r.creator_name ?? '—'}</p>
              </div>
            </div>
          ),
        },
        { key: 'status', header: t('common.status'), cell: (r: any) => <StatusPill status={r.status} /> },
        {
          key: 'duration_seconds', header: t('media.duration'), className: 'numeric', hideBelow: 'sm',
          cell: (r: any) => formatDuration(r.duration_seconds) || '—',
        },
        {
          key: 'content_title', header: t('shorts.promotes'), hideBelow: 'lg',
          cell: (r: any) => (r.content_title
            ? <Badge variant="secondary" className="max-w-[14rem] truncate">{r.content_title}</Badge>
            : '—'),
        },
        {
          key: 'view_count', header: t('library.views'), sortable: true, className: 'numeric', hideBelow: 'md',
          cell: (r: any) => formatNumber(r.view_count, i18n.language),
        },
        {
          key: 'reaction_count', header: t('library.engagement'), className: 'numeric', hideBelow: 'xl',
          cell: (r: any) => formatNumber(r.reaction_count, i18n.language),
        },
        {
          key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'lg',
          className: 'text-muted-foreground',
          cell: (r: any) => formatRelative(r.created_at, i18n.language),
        },
      ]}
      insights={{
        cards: [
          { key: 'total', label: t('insights.cards.total') },
          { key: 'published', label: t('library.status.published'), tone: 'success' },
          { key: 'pending', label: t('library.status.pending_review'), tone: 'warning' },
          { key: 'views', label: t('library.views'), tone: 'violet' },
          { key: 'linked', label: t('shorts.promotes'), tone: 'teal' },
          {
            key: 'avg_seconds', label: t('insights.cards.avgLength'),
            format: (v: any) => formatDuration(Number(v ?? 0)) || '—',
          },
        ],
        cuts: [
          { key: 'status', label: t('common.status'), labelFor: (k) => t(`library.status.${k}`, { defaultValue: k }) },
          { key: 'language', label: t('common.language'), labelFor: (k) => (k === 'ar' ? 'العربية' : k === 'en' ? 'English' : k) },
          { key: 'creator', label: t('common.author') },
        ],
      }}
      filters={(list) => (
        <>
        <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
          <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {['published', 'pending_review', 'rejected', 'draft'].map((s) => (
              <SelectItem key={s} value={s}>{t(`library.status.${s}`, { defaultValue: s })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={list.state.filter.language ?? 'all'} onValueChange={(v) => list.setFilter('language', v)}>
          <SelectTrigger className="w-[9rem]"><SelectValue placeholder={t('common.language')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.language')}</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
        {Object.keys(list.state.filter).length ? (
          <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
        ) : null}
        </>
      )}
      extraRowActions={(refresh) => [
        {
          label: t('actions.approve'), icon: CheckCircle2,
          onSelect: (row: any) => moderate.mutate({ id: row.id, action: 'approve' }, { onSuccess: refresh }),
          hidden: (row: any) => !can('reel.moderate') || row.status === 'published',
        },
        {
          label: t('actions.reject'), icon: XCircle,
          onSelect: (row: any) => moderate.mutate({ id: row.id, action: 'reject' }, { onSuccess: refresh }),
          hidden: (row: any) => !can('reel.moderate') || row.status === 'rejected',
        },
      ]}
    />
  );
}

/** Create and edit, on their own route. */
export function ShortVideoFormPage() {
  return <CrudFormPage config={useShortVideoConfig()} />;
}
