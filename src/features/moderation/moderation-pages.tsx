import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Activity, ClipboardCheck, Eye, Flag, ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { DetailList, EmptyState, PageHeader, StatCard, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, Field, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

/** Everything awaiting a decision, across content, posts and reels. */
export function ReviewQueuePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: summary } = useQuery({
    queryKey: ['moderation', 'summary'],
    queryFn: () => api.get('/moderation/summary'),
  });
  const { data: queue, isLoading } = useQuery({
    queryKey: ['moderation', 'queue'],
    queryFn: () => api.get('/moderation/queue', { limit: 100 }),
  });

  return (
    <>
      <PageHeader icon={ClipboardCheck} tone="rose" title={t('moderation.queueTitle')} subtitle={t('moderation.queueSubtitle')} />

      {summary ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('nav.library')} value={summary.pending.content} tone={summary.pending.content ? 'warning' : 'blue'} />
          <StatCard label={t('nav.posts')} value={summary.pending.posts} tone={summary.pending.posts ? 'warning' : 'violet'} />
          <StatCard label={t('nav.reels')} value={summary.pending.reels} tone={summary.pending.reels ? 'warning' : 'rose'} />
          <StatCard label={t('moderation.open')} value={summary.reports.open} tone={summary.reports.open ? 'danger' : 'rose'}
            hint={summary.reports.overdue ? `${summary.reports.overdue} ${t('moderation.overdue')}` : undefined} />
        </section>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !queue?.length ? (
        <EmptyState icon={ClipboardCheck} title={t('moderation.emptyQueue')} hint={t('moderation.emptyQueueHint')} />
      ) : (
        <Card>
          <ul className="divide-y">
            {queue.map((row: any) => (
              <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center gap-3 p-4">
                <Badge variant="secondary" className="shrink-0">{row.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.author_name ?? '—'} · {formatRelative(row.created_at, i18n.language)}
                    {row.subtype ? ` · ${t(`library.type.${row.subtype}`, { defaultValue: row.subtype })}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      row.kind === 'content_item' ? `/content/item/${row.id}`
                        : row.kind === 'post' ? '/posts' : '/reels',
                    )
                  }
                >
                  <Eye /> {t('actions.view')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const list = useListQuery<any>('reports', '/moderation/reports', { sort: '-created_at' });
  const [resolving, setResolving] = React.useState<any | null>(null);

  const columns: Column<any>[] = [
    {
      key: 'reason', header: t('common.reason'),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.reason}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{row.details ?? '—'}</p>
        </div>
      ),
    },
    { key: 'target_type', header: t('moderation.target'), cell: (row) => <Badge variant="secondary">{row.target_type}</Badge> },
    { key: 'reporter_name', header: t('moderation.reporter'), hideBelow: 'md', cell: (row) => row.reporter_name ?? '—' },
    { key: 'status', header: t('common.status'), sortable: true, cell: (row) => <StatusPill status={row.status} label={t(`moderation.${row.status}`, { defaultValue: row.status })} /> },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'sm', className: 'text-muted-foreground', cell: (row) => formatRelative(row.created_at, lang) },
  ];

  return (
    <>
      <PageHeader icon={Flag} tone="rose" title={t('moderation.reportsTitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="reports"
        onRowClick={(row) => setResolving(row)}
        filters={
          <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="open">{t('moderation.open')}</SelectItem>
              <SelectItem value="actioned">{t('moderation.actioned')}</SelectItem>
              <SelectItem value="dismissed">{t('moderation.dismissed')}</SelectItem>
            </SelectContent>
          </Select>
        }
        rowActions={[{ label: t('moderation.resolve'), icon: ShieldAlert, onSelect: (row) => setResolving(row) }]}
      />
      <ResolveReportDialog
        report={resolving}
        onClose={() => setResolving(null)}
        onDone={() => { setResolving(null); list.refresh(); }}
      />
    </>
  );
}

function ResolveReportDialog({
  report, onClose, onDone,
}: { report: any | null; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const [action, setAction] = React.useState('none');
  const [reason, setReason] = React.useState('');

  React.useEffect(() => { setAction('none'); setReason(''); }, [report?.id]);

  const { data: full } = useQuery({
    queryKey: ['moderation', 'reports', report?.id],
    queryFn: () => api.get(`/moderation/reports/${report.id}`),
    enabled: Boolean(report?.id),
  });

  const resolve = useApiMutation(
    (status: 'actioned' | 'dismissed') =>
      api.post(`/moderation/reports/${report.id}/resolve`, {
        status,
        action: status === 'actioned' && action !== 'none' ? action : undefined,
        reason: reason || undefined,
      }),
    {
      successMessage: t('moderation.resolved'),
      invalidate: [['reports'], ['moderation', 'summary']],
      onSuccess: onDone,
    },
  );

  const resolved = report?.status !== 'open';

  return (
    <Dialog open={Boolean(report)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('moderation.resolve')}</DialogTitle>
          <DialogDescription>{report?.reason} · {report?.target_type}</DialogDescription>
        </DialogHeader>

        {full?.target ? (
          <Card className="bg-muted/40">
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('moderation.target')}
              </p>
              <p className="text-sm font-medium">{full.target.title ?? full.target.full_name ?? full.target.body ?? full.target.caption ?? '—'}</p>
              {full.target.summary ? <p className="mt-1 text-sm text-muted-foreground">{full.target.summary}</p> : null}
              {full.target.status ? (
                <StatusPill
                  status={full.target.status}
                  label={t(`library.status.${full.target.status}`, { defaultValue: full.target.status })}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <DetailList
          items={[
            { label: t('moderation.reporter'), value: report?.reporter_name ?? '—' },
            { label: t('common.details'), value: report?.details ?? '—' },
            { label: t('common.createdAt'), value: formatDate(report?.created_at, i18n.language, true) },
          ]}
        />

        {full?.history?.length ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('moderation.history')}
            </p>
            <ul className="space-y-1 text-sm">
              {full.history.map((h: any) => (
                <li key={h.id} className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{h.action}</Badge>
                  <span className="text-muted-foreground">{h.moderator_name ?? '—'}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {formatRelative(h.created_at, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!resolved ? (
          <>
            <Field label={t('moderation.consequence')}>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('moderation.consequences.none')}</SelectItem>
                  <SelectItem value="hide">{t('moderation.consequences.hide')}</SelectItem>
                  <SelectItem value="reject">{t('moderation.consequences.reject')}</SelectItem>
                  <SelectItem value="delete">{t('moderation.consequences.delete')}</SelectItem>
                  <SelectItem value="suspend">{t('moderation.consequences.suspend')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('common.reason')}>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.close')}</Button>
          {!resolved ? (
            <>
              <Button variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate('dismissed')}>
                {t('moderation.dismissed')}
              </Button>
              <Button variant="danger" loading={resolve.isPending} onClick={() => resolve.mutate('actioned')}>
                {t('moderation.actioned')}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModerationActionsPage() {
  const { t, i18n } = useTranslation();
  const list = useListQuery<any>('moderation-actions', '/moderation/actions', { sort: '-created_at' });

  const columns: Column<any>[] = [
    { key: 'action', header: t('audit.action'), cell: (row) => <Badge variant="secondary">{row.action}</Badge> },
    { key: 'target_type', header: t('moderation.target'), cell: (row) => row.target_type },
    { key: 'moderator_name', header: t('audit.actor'), hideBelow: 'md', cell: (row) => row.moderator_name ?? '—' },
    { key: 'reason', header: t('common.reason'), hideBelow: 'lg', cell: (row) => <span className="line-clamp-1">{row.reason ?? '—'}</span> },
    { key: 'created_at', header: t('common.date'), sortable: true, className: 'numeric text-muted-foreground', cell: (row) => formatDate(row.created_at, i18n.language, true) },
  ];

  return (
    <>
      <PageHeader icon={Activity} tone="rose" title={t('moderation.actionsTitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="moderation-actions"
        filters={
          <Select value={list.state.filter.target_type ?? 'all'} onValueChange={(v) => list.setFilter('target_type', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('moderation.target')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {['content_item', 'post', 'reel', 'comment', 'live_room', 'user'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}
