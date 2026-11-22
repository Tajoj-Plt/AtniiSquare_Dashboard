import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AudioLines, BookOpen, CheckCircle2, Eye, FileText, Film, FlaskConical, Languages,
  Library, Pencil, Plus, ScrollText, Send, Star, Trash2, XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { CONTENT_TONES, TONES } from '@/lib/tones';
import { CONTENT_STATUSES, CONTENT_TYPES, contentTypeFromSlug } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { ListInsights } from '@/components/data/list-insights';
import { PageHeader, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import {
  ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { ModerateDialog } from './moderate-dialog';

const TYPE_ICON: Record<string, typeof BookOpen> = {
  book: BookOpen,
  article: FileText,
  research: FlaskConical,
  scientific_paper: ScrollText,
  translated_paper: Languages,
  video: Film,
  audio: AudioLines,
};

/**
 * The library list. The same screen serves the "all items" view and each per-type view
 * (/content/books, /content/research, …) — the route param just pins one filter, which
 * keeps type-specific columns and empty states in a single place.
 */
export function LibraryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { type } = useParams<{ type?: string }>();
  const { can } = useAuth();

  const pinnedType = contentTypeFromSlug(type);

  const list = useListQuery<any>('content', '/content', {
    filter: pinnedType ? { content_type: pinnedType } : {},
    sort: '-created_at',
  });

  // Re-pin the filter when the route changes between type views.
  React.useEffect(() => {
    list.setFilter('content_type', pinnedType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedType]);

  // The summary reads the list's own query, so filtering the table moves the numbers.
  const statsParams = React.useMemo(
    () => ({ q: list.state.q || undefined, filter: list.state.filter, ...list.state.extra }),
    [list.state.q, list.state.filter, list.state.extra],
  );

  const { data: interests } = useQuery({
    queryKey: ['interests', 'all'],
    queryFn: () => api.get('/interests', { limit: 100, sort: 'name' }),
    staleTime: 5 * 60_000,
  });

  const [selected, setSelected] = React.useState<string[]>([]);
  const [moderating, setModerating] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);

  const invalidate: string[][] = [['content'], ['analytics', 'overview'], ['moderation', 'summary']];

  const submit = useApiMutation((id: string) => api.post(`/content/${id}/submit`), {
    successMessage: t('library.submitted'), invalidate,
  });
  const remove = useApiMutation((id: string) => api.delete(`/content/${id}`), {
    successMessage: t('library.deleted'),
    invalidate,
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });
  const bulk = useApiMutation(
    (vars: { ids: string[]; action: string }) => api.post('/content/bulk', vars),
    { successMessage: t('library.updated'), invalidate, onSuccess: () => { setSelected([]); list.refresh(); } },
  );
  const feature = useApiMutation(
    (vars: { id: string; on: boolean }) =>
      vars.on ? api.post(`/content/${vars.id}/feature`) : api.delete(`/content/${vars.id}/feature`),
    { successMessage: t('library.updated'), invalidate, onSuccess: () => list.refresh() },
  );

  const columns: Column<any>[] = [
    {
      key: 'title',
      header: t('common.title'),
      sortable: true,
      className: 'max-w-[26rem]',
      cell: (row) => {
        const Icon = TYPE_ICON[row.content_type] ?? FileText;
        return (
          <div className="flex items-start gap-2.5">
            <span className={cn(
              'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg',
              TONES[CONTENT_TONES[row.content_type] ?? 'blue'].chip,
            )}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <Link
                to={`/content/item/${row.id}`}
                className="line-clamp-1 font-medium hover:text-accent hover:underline"
              >
                {row.title}
              </Link>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {row.creator_name ?? '—'}
                {row.publication_year ? ` · ${row.publication_year}` : ''}
              </p>
            </div>
            {row.is_featured ? <Star className="mt-1 h-3.5 w-3.5 shrink-0 fill-accent text-accent" /> : null}
          </div>
        );
      },
      exportValue: (row) => row.title,
    },
    {
      key: 'content_type',
      header: t('common.type'),
      hideBelow: 'md',
      cell: (row) => (
        <span className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
          TONES[CONTENT_TONES[row.content_type] ?? 'blue'].chip,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', TONES[CONTENT_TONES[row.content_type] ?? 'blue'].dot)} />
          {t(`library.type.${row.content_type}`)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      sortable: false,
      cell: (row) => <StatusPill status={row.status} label={t(`library.status.${row.status}`)} />,
    },
    {
      key: 'language',
      header: t('common.language'),
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-xs uppercase text-muted-foreground">{row.language}</span>
      ),
    },
    {
      key: 'view_count',
      header: t('library.views'),
      sortable: true,
      hideBelow: 'lg',
      className: 'numeric',
      cell: (row) => formatNumber(row.view_count, i18n.language),
    },
    {
      key: 'download_count',
      header: t('library.downloads'),
      sortable: true,
      hideBelow: 'xl',
      className: 'numeric',
      cell: (row) => formatNumber(row.download_count, i18n.language),
    },
    {
      key: 'created_at',
      header: t('common.createdAt'),
      sortable: true,
      hideBelow: 'md',
      className: 'numeric whitespace-nowrap text-muted-foreground',
      cell: (row) => formatDate(row.created_at, i18n.language),
    },
  ];

  return (
    <>
      <PageHeader
        icon={pinnedType ? TYPE_ICON[pinnedType] : Library}
        tone={pinnedType ? (CONTENT_TONES[pinnedType] ?? 'blue') : 'blue'}
        title={pinnedType ? t(`library.type.${pinnedType}_plural`) : t('library.title')}
        subtitle={t('library.subtitle')}
        actions={
          can('content.create') ? (
            <Button onClick={() => navigate(`/content/new${pinnedType ? `?type=${pinnedType}` : ''}`)}>
              <Plus /> {t('library.newItem')}
            </Button>
          ) : null
        }
      />

      <ListInsights
        queryKey="content"
        path="/content"
        storageKey="content-list"
        params={statsParams}
        cards={[
          { key: 'total', label: t('insights.cards.total') },
          { key: 'published', label: t('library.status.published'), tone: 'success' },
          { key: 'pending', label: t('library.status.pending_review'), tone: 'warning' },
          { key: 'drafts', label: t('library.status.draft') },
          { key: 'contributors', label: t('insights.cards.contributors'), tone: 'violet' },
          { key: 'without_file', label: t('insights.cards.withoutFile'), tone: 'danger' },
        ]}
        cuts={[
          { key: 'content_type', label: t('common.type'), labelFor: (k) => t(`library.type.${k}`, { defaultValue: k }) },
          { key: 'status', label: t('common.status'), labelFor: (k) => t(`library.status.${k}`, { defaultValue: k }) },
          { key: 'language', label: t('common.language'), labelFor: (k) => (k === 'ar' ? 'العربية' : k === 'en' ? 'English' : k) },
        ]}
      />

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
        searchPlaceholder={t('library.title')}
        sort={list.state.sort}
        onSortChange={list.setSort}
        selectable={can('content.moderate')}
        selected={selected}
        onSelectedChange={setSelected}
        exportFileName={pinnedType ?? 'library'}
        emptyTitle={t('library.empty')}
        emptyHint={t('library.emptyHint')}
        bulkActions={
          <>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'publish' })}>
              {t('actions.publish')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'archive' })}>
              {t('actions.archive')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'feature' })}>
              {t('actions.feature')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => bulk.mutate({ ids: selected, action: 'delete' })}>
              {t('actions.delete')}
            </Button>
          </>
        }
        filters={
          <>
            {!pinnedType ? (
              <Select
                value={list.state.filter.content_type ?? 'all'}
                onValueChange={(v) => list.setFilter('content_type', v)}
              >
                <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.type')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {CONTENT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{t(`library.type.${ct}_plural`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={list.state.filter.status ?? 'all'}
              onValueChange={(v) => list.setFilter('status', v)}
            >
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {CONTENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`library.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={list.state.filter.language ?? 'all'}
              onValueChange={(v) => list.setFilter('language', v)}
            >
              <SelectTrigger className="w-[8rem]"><SelectValue placeholder={t('common.language')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={list.state.filter.license ?? 'all'}
              onValueChange={(v) => list.setFilter('license', v)}
            >
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('library.fields.license')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('library.fields.license')}</SelectItem>
                {['all_rights_reserved', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'cc0', 'public_domain'].map((l) => (
                  <SelectItem key={l} value={l}>{t(`library.license.${l}`, { defaultValue: l })}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={list.state.filter.is_featured ?? 'all'}
              onValueChange={(v) => list.setFilter('is_featured', v)}
            >
              <SelectTrigger className="w-[9.5rem]"><SelectValue placeholder={t('library.fields.featured')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('library.fields.featured')}</SelectItem>
                <SelectItem value="true">{t('reports.filters.yes')}</SelectItem>
                <SelectItem value="false">{t('reports.filters.no')}</SelectItem>
              </SelectContent>
            </Select>

            {/* "Missing its file" is the cut a librarian runs before a review session. */}
            <Select
              value={list.state.extra.has_file ?? 'all'}
              onValueChange={(v) => list.setExtra('has_file', v)}
            >
              <SelectTrigger className="w-[10.5rem]"><SelectValue placeholder={t('insights.cards.withoutFile')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('library.fields.file')}</SelectItem>
                <SelectItem value="true">{t('insights.hasFile')}</SelectItem>
                <SelectItem value="false">{t('insights.noFile')}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={list.state.extra.interest_id ?? 'all'}
              onValueChange={(v) => list.setExtra('interest_id', v)}
            >
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('library.fields.interests')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('library.fields.interests')}</SelectItem>
                {(interests?.data ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i18n.language === 'ar' ? i.name : (i.name_en ?? i.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date" dir="ltr" className="w-[10rem]"
              aria-label={t('reports.range.from')}
              value={list.state.extra.created_from ?? ''}
              onChange={(e) => list.setExtra('created_from', e.target.value || undefined)}
            />
            <Input
              type="date" dir="ltr" className="w-[10rem]"
              aria-label={t('reports.range.to')}
              value={list.state.extra.created_to ?? ''}
              onChange={(e) => list.setExtra('created_to', e.target.value || undefined)}
            />

            {Object.keys(list.state.filter).length || Object.keys(list.state.extra).length ? (
              <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
            ) : null}
          </>
        }
        rowActions={[
          { label: t('actions.view'), icon: Eye, onSelect: (row) => navigate(`/content/item/${row.id}`) },
          {
            label: t('actions.edit'), icon: Pencil,
            onSelect: (row) => navigate(`/content/${row.id}/edit`),
            hidden: () => !can('content.update.own'),
          },
          {
            label: t('library.submitForReview'), icon: Send,
            onSelect: (row) => submit.mutate(row.id),
            hidden: (row) => !['draft', 'rejected'].includes(row.status),
          },
          {
            label: t('actions.approve'), icon: CheckCircle2,
            onSelect: (row) => setModerating({ ...row, decision: 'approve' }),
            hidden: (row) => !can('content.moderate') || row.status === 'published',
          },
          {
            label: t('actions.reject'), icon: XCircle,
            onSelect: (row) => setModerating({ ...row, decision: 'reject' }),
            hidden: (row) => !can('content.moderate') || row.status === 'rejected',
          },
          {
            label: t('actions.feature'), icon: Star,
            onSelect: (row) => feature.mutate({ id: row.id, on: !row.is_featured }),
            hidden: () => !can('content.moderate'),
          },
          {
            label: t('actions.delete'), icon: Trash2, destructive: true,
            onSelect: (row) => setDeleting(row),
            hidden: () => !can('content.delete.own'),
          },
        ]}
      />

      <ModerateDialog
        item={moderating}
        onClose={() => setModerating(null)}
        onDone={() => { setModerating(null); list.refresh(); }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')}
        description={deleting?.title}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
