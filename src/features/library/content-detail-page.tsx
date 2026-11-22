import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, CheckCircle2, Download, ExternalLink, Pencil,
  Send, Star, Trash2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { formatBytes, formatDate, formatDuration, formatNumber } from '@/lib/utils';
import { MediaPlayer } from '@/components/data/media-player';
import { DetailList, MetricRow, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, Skeleton } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlays';
import { languageName } from '@/lib/countries';
import { ModerateDialog } from './moderate-dialog';

export function ContentDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const [moderating, setModerating] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const { data: item, isLoading, refetch } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get(`/content/${id}`),
  });
  // The same declaration the form renders from, so the page lists exactly what the type has.
  const { data: schema } = useQuery({
    queryKey: ['content-schema'],
    queryFn: () => api.get('/content/schema'),
    staleTime: 30 * 60_000,
  });

  const submit = useApiMutation(() => api.post(`/content/${id}/submit`), {
    successMessage: t('library.submitted'), invalidate: [['content', id!], ['moderation', 'summary']],
  });
  const remove = useApiMutation(() => api.delete(`/content/${id}`), {
    successMessage: t('library.deleted'), invalidate: [['content']],
    onSuccess: () => navigate('/content'),
  });
  const feature = useApiMutation(
    (on: boolean) => (on ? api.post(`/content/${id}/feature`) : api.delete(`/content/${id}/feature`)),
    { successMessage: t('library.updated'), invalidate: [['content', id!]] },
  );

  const download = async () => {
    const res = await api.get(`/content/${id}/download`);
    window.open(res.url, '_blank', 'noopener');
    void refetch();
  };

  if (isLoading || !item) {
    return (
      <>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </>
    );
  }

  /* ---- what the type declares, split by how it is best shown ---- */
  const fields: any[] = schema?.types?.[item.content_type]?.fields ?? [];
  // Shown elsewhere on the page — the title in the header, prose in its own panels, the
  // file behind the download button, classification as badges.
  const OWN_PANELS = ['title', 'summary', 'abstract', 'body_html', 'file_media_id', 'cover_media_id', 'interest_ids', 'keywords'];
  const LONG = ['textarea', 'richtext'];
  // The group is a link to its own page, added to the details below, not a raw id.
  const shortFields = fields.filter((f) => !OWN_PANELS.includes(f.key) && !LONG.includes(f.kind)
    && !['file', 'files', 'image', 'group'].includes(f.kind));
  const longFields = fields.filter((f) => LONG.includes(f.kind) && !OWN_PANELS.includes(f.key));
  const fileFields = fields.filter((f) => f.store === 'details' && ['file', 'files'].includes(f.kind));
  const media = item.details_media ?? {};

  const rawOf = (f: any) => (f.store === 'details' ? item.details?.[f.key] : item[f.key]);
  const fieldValue = (f: any): React.ReactNode => {
    if (f.store === 'people') {
      const names = (item.authors ?? []).filter((a: any) => a.role === f.role).map((a: any) => a.full_name);
      return names.length ? names.join('، ') : null;
    }
    const raw = rawOf(f);
    if (raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && !raw.length)) return null;
    switch (f.kind) {
      case 'date': return formatDate(raw, lang);
      case 'duration': return formatDuration(raw);
      case 'number': return formatNumber(raw, lang);
      case 'url':
        return (
          <a className="inline-flex items-center gap-1 text-accent hover:underline" href={raw} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> {(() => { try { return new URL(raw).hostname; } catch { return raw; } })()}
          </a>
        );
      case 'select':
        return t(`content.options.${f.optionsKey ?? f.key}.${raw}`, { defaultValue: String(raw).replace(/_/g, ' ') });
      case 'language': return languageName(raw, lang, t('content.options.language.other'));
      case 'license': return t(`content.options.license.${raw}`, { defaultValue: raw });
      case 'multiselect':
        return (raw as string[]).map((x) => (f.optionsKey === 'language'
          ? languageName(x, lang, t('content.options.language.other')) : x)).join('، ');
      case 'list': return (raw as string[]).join('، ');
      default: return String(raw);
    }
  };

  return (
    <>
      <PageHeader
        title={item.title}
        subtitle={item.title_en ?? item.subtitle ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/content')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
            {item.file_key && item.is_downloadable ? (
              <Button variant="outline" onClick={() => void download()}>
                <Download /> {t('actions.download')}
              </Button>
            ) : null}
            {can('content.update.own') ? (
              <Button variant="outline" asChild>
                <Link to={`/content/${item.id}/edit`}><Pencil /> {t('actions.edit')}</Link>
              </Button>
            ) : null}
            {['draft', 'rejected'].includes(item.status) ? (
              <Button loading={submit.isPending} onClick={() => submit.mutate(undefined)}>
                <Send /> {t('library.submitForReview')}
              </Button>
            ) : null}
            {can('content.moderate') && item.status !== 'published' ? (
              <Button variant="success" onClick={() => setModerating({ ...item, decision: 'approve' })}>
                <CheckCircle2 /> {t('actions.approve')}
              </Button>
            ) : null}
            {can('content.moderate') && item.status !== 'rejected' ? (
              <Button variant="danger" onClick={() => setModerating({ ...item, decision: 'reject' })}>
                <XCircle /> {t('actions.reject')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={item.status} label={t(`library.status.${item.status}`)} />
        <Badge variant="secondary">{t(`library.type.${item.content_type}`)}</Badge>
        <Badge variant="muted">{item.language?.toUpperCase()}</Badge>
        {item.is_featured ? (
          <Badge variant="accent"><Star className="h-3 w-3 fill-current" /> {t('library.fields.featured')}</Badge>
        ) : null}
        {can('content.moderate') ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => feature.mutate(!item.is_featured)}
            loading={feature.isPending}
          >
            {item.is_featured ? t('actions.unfeature') : t('actions.feature')}
          </Button>
        ) : null}
      </div>

      {item.status === 'rejected' && item.rejection_reason ? (
        <Card className="border-danger/40 bg-danger/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-danger">{t('actions.reject')}</p>
            <p className="mt-1 text-sm">{item.rejection_reason}</p>
            {item.reviewer_name ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {item.reviewer_name} · {formatDate(item.reviewed_at, lang, true)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <MetricRow
        items={[
          { label: t('library.views'), value: item.view_count ?? 0 },
          { label: t('library.downloads'), value: item.download_count ?? 0 },
          { label: t('nav.comments'), value: item.comment_count ?? 0 },
          { label: t('library.engagement'), value: item.reaction_count ?? 0 },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* For a recording, the recording is the item — it goes above the metadata, not
              behind a download button. */}
          {['video', 'audio'].includes(item.content_type) ? (
            <Panel
              title={t(`library.type.${item.content_type}`)}
              description={item.duration_seconds ? formatDuration(item.duration_seconds) : undefined}
            >
              <MediaPlayer
                src={item.stream_url}
                kind={item.content_type === 'audio' ? 'audio' : 'video'}
                poster={item.cover_url}
                durationSeconds={item.duration_seconds}
              />
            </Panel>
          ) : null}
          {item.preview_url ? (
            <Panel title={t('library.fields.clip')} description={t('library.hints.clipShort')}>
              <MediaPlayer src={item.preview_url} kind="video" durationSeconds={item.preview_duration} compact />
            </Panel>
          ) : null}
          {item.abstract ? (
            <Panel title={t('library.fields.abstract')}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.abstract}</p>
            </Panel>
          ) : null}
          {item.body_html ? (
            <Panel title={t('library.fields.body')}>
              <div className="prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{item.body_html}</div>
            </Panel>
          ) : null}
          {item.summary ? (
            <Panel title={t('library.fields.summary')}>
              <p className="text-sm leading-relaxed">{item.summary}</p>
            </Panel>
          ) : null}

          {/* The long-form sections a type declares — problem, objectives, methodology,
              results, references — each in its own panel, in declaration order. */}
          {longFields.map((f) => {
            const v = rawOf(f);
            return v ? (
              <Panel key={f.key} title={t(`content.fields.${f.label}`)}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{v}</p>
              </Panel>
            ) : null;
          })}

          {fileFields.some((f) => rawOf(f)) ? (
            <Panel title={t('content.fields.attachments')}>
              <div className="space-y-5">
                {fileFields.map((f) => {
                  const raw = rawOf(f);
                  const assets = (Array.isArray(raw) ? raw : raw ? [raw] : [])
                    .map((mid: string) => media[mid]).filter(Boolean);
                  if (!assets.length) return null;
                  return (
                    <div key={f.key}>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{t(`content.fields.${f.label}`)}</p>
                      {f.kind === 'files' ? (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {assets.map((a: any) => (
                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border">
                              <img src={a.url} alt="" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      ) : assets.map((a: any) => (a.asset_type === 'video' || a.asset_type === 'audio' ? (
                        <MediaPlayer key={a.id} src={a.url} kind={a.asset_type} durationSeconds={a.duration_seconds} compact />
                      ) : (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-secondary">
                          <Download className="h-4 w-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                          {a.size_bytes ? <span className="numeric text-xs text-muted-foreground">{formatBytes(a.size_bytes)}</span> : null}
                        </a>
                      )))}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <Panel title={t('library.fields.interests')}>
            <div className="flex flex-wrap gap-2">
              {(item.interests ?? []).map((i: any) => (
                <Badge key={i.id} variant="secondary">{lang === 'ar' ? i.name : (i.name_en ?? i.name)}</Badge>
              ))}
              {(item.tags ?? []).map((tg: any) => (
                <Badge key={tg.id} variant="outline">#{lang === 'ar' ? tg.name : (tg.name_en ?? tg.name)}</Badge>
              ))}
              {(item.keywords ?? []).map((k: string) => (
                <Link key={k} to={`/content?keyword=${encodeURIComponent(k)}`}>
                  <Badge variant="muted" className="hover:bg-secondary">{k}</Badge>
                </Link>
              ))}
              {!item.interests?.length && !item.tags?.length && !item.keywords?.length ? (
                <p className="text-sm text-muted-foreground">{t('common.none')}</p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {item.cover_url ? (
            <Card className="overflow-hidden">
              <img src={item.cover_url} alt="" className="aspect-[3/4] w-full object-cover" />
            </Card>
          ) : null}

          <Panel title={t('common.details')}>
            <DetailList
              items={[
                ...shortFields.map((f) => ({ label: t(`content.fields.${f.label}`), value: fieldValue(f) })),
                // The playlist or reading series the item is filed under, if any.
                {
                  label: t(`content.fields.${item.group?.group_type ?? 'playlist'}`),
                  value: item.group ? (
                    <Link className="text-accent hover:underline" to={`/content/groups/${item.group.id}`}>
                      {lang === 'ar' ? item.group.title : (item.group.title_en ?? item.group.title)}
                    </Link>
                  ) : null,
                },
                { label: t('common.size'), value: item.file_size ? formatBytes(item.file_size) : null },
                { label: t('content.fields.uploaded_by'), value: item.creator_name },
                { label: t('common.createdAt'), value: formatDate(item.created_at, lang, true) },
              ].filter((row) => row.value)}
            />
          </Panel>

          {can('content.delete.own') ? (
            <Panel title={t('common.dangerZone')}>
              <Button variant="danger" className="w-full" onClick={() => setDeleting(true)}>
                <Trash2 /> {t('actions.delete')}
              </Button>
            </Panel>
          ) : null}
        </div>
      </div>

      <ModerateDialog
        item={moderating}
        onClose={() => setModerating(null)}
        onDone={() => { setModerating(null); void refetch(); }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('common.confirmDelete')}
        description={t('common.confirmDeleteBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
