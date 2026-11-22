import * as React from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle, BookOpen, Database, MinusCircle, Play, RefreshCcw, RotateCcw, Search,
  Sparkles, Undo2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { cn, CONTENT_TYPES, formatDate, formatNumber } from '@/lib/utils';
import { CONTENT_TONES, TONES } from '@/lib/tones';
import { DataTable, type Column } from '@/components/data/data-table';
import { MetricRow, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/primitives';
import {
  ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/overlays';
import { AssistantTabs } from './assistant-tabs';

/** Where one library item stands in the assistant's index. */
type IndexState = 'not_indexed' | 'pending' | 'processing' | 'ready' | 'failed' | 'excluded';

const INDEX_STATES: IndexState[] = ['ready', 'processing', 'pending', 'failed', 'not_indexed', 'excluded'];

/**
 * Index states borrow the colours StatusPill already gives to the library's own statuses, so
 * "ready" is the same green here as everywhere else and nothing new has to be learned.
 */
const STATE_PILL: Record<IndexState, string> = {
  ready: 'ready',
  processing: 'scheduled',
  pending: 'pending',
  failed: 'rejected',
  not_indexed: 'draft',
  excluded: 'archived',
};

interface IndexRow {
  contentId: string;
  title: string;
  contentType: string;
  language: string | null;
  publishedAt: string | null;
  state: IndexState;
  progress: number;
  error: string | null;
  version: number | null;
  chunkCount: number | null;
  pageCount: number | null;
  indexedAt: string | null;
  embeddingModel: string | null;
  warnings: string[] | null;
  parser: string | null;
  hasFile: boolean;
  mimeType: string | null;
}

/** DataTable keys its rows by `id`; the index speaks in content ids. */
type TableRow = IndexRow & { id: string };

interface IndexList { data: IndexRow[]; total: number; page: number; limit: number }

interface IndexSummary {
  states: Record<IndexState, number>;
  published: number;
  chunks: number;
  embedded_chunks: number;
  tokens: string;
  outdated: number;
  queued_jobs: number;
  running_jobs: number;
  pipeline: {
    answerProvider: string | null;
    answerModel: string | null;
    generative: boolean;
    embeddingModel: string | null;
    embeddingsEnabled: boolean;
    semantic: boolean;
    vectorDimension: number | null;
    vectorSearch: string | boolean | null;
    chunkSize: number;
    chunkOverlap: number;
    ingestionEnabled: boolean;
  };
}

interface UsageSummary {
  days: number;
  requests: number | string;
  input_tokens: number | string;
  output_tokens: number | string;
  avg_ms: number | string | null;
  p95_ms: number | string | null;
  avg_retrieval_ms: number | string | null;
  errors: number | string;
}

const PAGE_SIZE = 25;
/** How often the page re-reads the index while something is being worked on. */
const POLL_MS = 4000;

const isBusy = (state: IndexState) => state === 'pending' || state === 'processing';

/**
 * The knowledge index, item by item.
 *
 * The assistant can only answer from what has been read into its index, so this is where a
 * librarian checks that a published item actually made it in — and puts it in, refreshes it
 * or takes it out. Indexing happens in the background, so the page keeps re-reading itself
 * while anything is queued or running and goes quiet again once the work is done.
 */
export function AiIndexPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [stateFilter, setStateFilter] = React.useState<string>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [removing, setRemoving] = React.useState<TableRow | null>(null);
  // Flipped by the two queries below; state rather than a derived value because each query's
  // polling interval depends on what the *other* one last returned.
  const [polling, setPolling] = React.useState(false);

  const listParams = {
    state: stateFilter === 'all' ? undefined : stateFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const summary = useQuery({
    queryKey: ['ai', 'index', 'summary'],
    queryFn: () => api.get<IndexSummary>('/ai/index/summary'),
    refetchInterval: polling ? POLL_MS : false,
  });
  const list = useQuery({
    queryKey: ['ai', 'index', 'list', listParams],
    queryFn: () => api.get<IndexList>('/ai/index', listParams),
    placeholderData: keepPreviousData,
    refetchInterval: polling ? POLL_MS : false,
  });
  const usage = useQuery({
    queryKey: ['ai', 'usage', 30],
    queryFn: () => api.get<UsageSummary>('/ai/usage', { days: 30 }),
    staleTime: 60_000,
  });

  const s = summary.data;
  const rows: TableRow[] = React.useMemo(
    () => (list.data?.data ?? []).map((row) => ({ ...row, id: row.contentId })),
    [list.data],
  );

  // Work is in flight if the summary says so or a visible row does. The summary covers items
  // on other pages; the rows cover the moment right after a click, before the summary catches up.
  const working = Boolean(
    (s && (s.queued_jobs > 0 || s.running_jobs > 0 || s.states.pending > 0 || s.states.processing > 0))
    || rows.some((row) => isBusy(row.state)),
  );
  React.useEffect(() => setPolling(working), [working]);

  // A filter can shrink the list under the current page (so can a poll); step back onto it.
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  React.useEffect(() => {
    if (list.data && page > pageCount) setPage(pageCount);
  }, [list.data, page, pageCount]);

  // Every action changes both the rows and the counts, and the chat page's corpus figures.
  const invalidate = [['ai', 'index'], ['ai', 'stats']];

  /** Index, re-index, retry and "add back" are one call — the server decides what it means. */
  const index = useApiMutation(
    (row: TableRow) => api.post(`/ai/index/${row.contentId}`),
    { successMessage: t('assistant.index.queued'), invalidate },
  );
  const remove = useApiMutation(
    (row: TableRow) => api.delete(`/ai/index/${row.contentId}`),
    {
      successMessage: t('assistant.index.removed'),
      invalidate,
      onSuccess: () => setRemoving(null),
    },
  );
  const reconcile = useApiMutation<{ queued: number; retired: number; purged: number }, void>(
    () => api.post('/ai/index/reconcile'),
    {
      invalidate,
      onSuccess: (res) => {
        if (res?.queued) toast.success(t('assistant.index.reconciled', { n: formatNumber(res.queued, lang) }));
        else toast.success(t('assistant.index.upToDate'));
      },
    },
  );

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  /** The one row an index request is currently being sent for, to put the spinner on it. */
  const sendingId = index.isPending ? index.variables?.contentId : undefined;

  const columns: Column<TableRow>[] = [
    {
      key: 'title',
      header: t('common.title'),
      className: 'max-w-[24rem]',
      cell: (row) => (
        <div className="min-w-0">
          <Link
            to={`/content/item/${row.contentId}`}
            className="line-clamp-1 font-medium hover:text-accent hover:underline"
          >
            {row.title}
          </Link>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {row.hasFile ? t('insights.hasFile') : t('assistant.index.textOnly')}
            {row.language ? <span className="uppercase"> · {row.language}</span> : null}
          </p>
        </div>
      ),
    },
    {
      key: 'contentType',
      header: t('common.type'),
      hideBelow: 'md',
      cell: (row) => {
        const tone = TONES[CONTENT_TONES[row.contentType] ?? 'blue'];
        return (
          <span className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
            tone.chip,
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {t(`library.type.${row.contentType}`, { defaultValue: row.contentType })}
          </span>
        );
      },
    },
    {
      key: 'state',
      header: t('common.status'),
      className: 'min-w-[11rem] max-w-[20rem]',
      cell: (row) => <IndexStatus row={row} />,
      exportValue: (row) => row.state,
    },
    {
      key: 'chunkCount',
      header: t('assistant.index.passages'),
      hideBelow: 'lg',
      className: 'numeric',
      cell: (row) => (row.chunkCount ? formatNumber(row.chunkCount, lang) : '—'),
    },
    {
      key: 'pageCount',
      header: t('assistant.index.pages'),
      hideBelow: 'lg',
      className: 'numeric',
      cell: (row) => (row.pageCount ? formatNumber(row.pageCount, lang) : '—'),
    },
    {
      key: 'indexedAt',
      header: t('assistant.index.indexedAt'),
      hideBelow: 'xl',
      className: 'numeric whitespace-nowrap text-muted-foreground',
      cell: (row) => formatDate(row.indexedAt, lang, true),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (row) => {
        const sending = sendingId === row.contentId;
        // Nothing to do while an item is queued or being read: the status column shows it.
        if (isBusy(row.state)) return null;
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {row.state === 'not_indexed' ? (
              <Button size="sm" variant="outline" loading={sending} onClick={() => index.mutate(row)}>
                {sending ? null : <Play className="rtl:rotate-180" />} {t('assistant.index.actions.index')}
              </Button>
            ) : null}
            {row.state === 'ready' ? (
              <>
                <Button size="sm" variant="outline" loading={sending} onClick={() => index.mutate(row)}>
                  {sending ? null : <RefreshCcw />} {t('assistant.index.actions.reindex')}
                </Button>
                <Button
                  size="sm" variant="ghost" className="text-danger hover:text-danger"
                  onClick={() => setRemoving(row)}
                >
                  <MinusCircle /> {t('assistant.index.actions.remove')}
                </Button>
              </>
            ) : null}
            {row.state === 'failed' ? (
              <Button size="sm" variant="outline" loading={sending} onClick={() => index.mutate(row)}>
                {sending ? null : <RotateCcw />} {t('actions.retry')}
              </Button>
            ) : null}
            {row.state === 'excluded' ? (
              <Button size="sm" variant="outline" loading={sending} onClick={() => index.mutate(row)}>
                {sending ? null : <Undo2 className="rtl:-scale-x-100" />} {t('assistant.index.actions.addBack')}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        icon={Database}
        tone="teal"
        title={t('assistant.index.title')}
        subtitle={t('assistant.index.subtitle')}
      />

      <AssistantTabs active="index" />

      <Panel
        title={t('assistant.index.summaryTitle')}
        description={
          s ? t('assistant.index.summaryDescription', { n: formatNumber(s.published, lang) }) : undefined
        }
        actions={
          <Button
            variant={s?.outdated ? 'default' : 'outline'}
            size="sm"
            loading={reconcile.isPending}
            onClick={() => reconcile.mutate()}
          >
            {reconcile.isPending ? null : <RefreshCcw />} {t('assistant.index.bringUpToDate')}
          </Button>
        }
        contentClassName="space-y-4"
      >
        {summary.isLoading ? (
          <Skeleton className="h-20" />
        ) : summary.error || !s ? (
          <p className="text-sm text-danger">{(summary.error as Error | null)?.message ?? t('common.error')}</p>
        ) : (
          <>
            {s.outdated > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>{t('assistant.index.outdated', { n: formatNumber(s.outdated, lang) })}</p>
              </div>
            ) : null}

            {/* One tile per state; pressing one filters the table below to it. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {INDEX_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => changeFilter(setStateFilter)(stateFilter === state ? 'all' : state)}
                  aria-pressed={stateFilter === state}
                  className={cn(
                    'rounded-lg bg-muted/50 p-3 text-start transition-colors hover:bg-secondary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    stateFilter === state && 'bg-accent/10 hover:bg-accent/10',
                  )}
                >
                  <StatusPill status={STATE_PILL[state]} label={t(`assistant.index.state.${state}`)} />
                  <p className="numeric mt-1.5 text-lg font-semibold">{formatNumber(s.states[state] ?? 0, lang)}</p>
                </button>
              ))}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> {t('assistant.index.passages')}
                </p>
                <p className="numeric mt-1.5 text-lg font-semibold">{formatNumber(s.chunks, lang)}</p>
              </div>
            </div>

            {working ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                {t('assistant.index.working', {
                  running: formatNumber(s.running_jobs, lang),
                  queued: formatNumber(s.queued_jobs, lang),
                })}
              </p>
            ) : null}

            {/* What the index is built with — and, plainly, what is missing when it is. */}
            <ul className="space-y-1.5 text-sm">
              <PipelineLine icon={Sparkles} degraded={!s.pipeline.generative}>
                {s.pipeline.generative
                  ? t('assistant.index.pipeline.answers', {
                      model: s.pipeline.answerModel ?? s.pipeline.answerProvider ?? '—',
                    })
                  : t('assistant.index.pipeline.answersQuoted')}
              </PipelineLine>
              <PipelineLine icon={Search} degraded={!s.pipeline.semantic}>
                {s.pipeline.semantic
                  ? t('assistant.index.pipeline.semantic', { model: s.pipeline.embeddingModel ?? '—' })
                  : t('assistant.index.pipeline.lexical')}
              </PipelineLine>
              {!s.pipeline.ingestionEnabled ? (
                <PipelineLine icon={AlertTriangle} degraded>
                  {t('assistant.index.pipeline.ingestionOff')}
                </PipelineLine>
              ) : null}
            </ul>
          </>
        )}
      </Panel>

      <DataTable
        columns={columns}
        rows={rows}
        loading={list.isLoading}
        error={(list.error as Error) ?? null}
        total={list.data?.total}
        onRefresh={() => { void list.refetch(); void summary.refetch(); }}
        search={search}
        onSearchChange={changeFilter(setSearch)}
        searchPlaceholder={t('assistant.index.searchPlaceholder')}
        emptyTitle={t('assistant.index.empty')}
        emptyHint={t('assistant.index.emptyHint')}
        filters={
          <>
            <Select value={stateFilter} onValueChange={changeFilter(setStateFilter)}>
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('assistant.index.allStates')}</SelectItem>
                {INDEX_STATES.map((state) => (
                  <SelectItem key={state} value={state}>{t(`assistant.index.state.${state}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={changeFilter(setTypeFilter)}>
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.type')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('assistant.index.allTypes')}</SelectItem>
                {CONTENT_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>{t(`library.type.${ct}_plural`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stateFilter !== 'all' || typeFilter !== 'all' ? (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setStateFilter('all'); setTypeFilter('all'); setPage(1); }}
              >
                {t('actions.reset')}
              </Button>
            ) : null}
          </>
        }
        pagination={
          pageCount > 1 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('actions.previous')}
              </Button>
              <span className="numeric whitespace-nowrap">
                {t('assistant.index.pageOf', { page: formatNumber(page, lang), pages: formatNumber(pageCount, lang) })}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                {t('actions.next')}
              </Button>
            </div>
          ) : undefined
        }
      />

      {usage.data ? (
        <Panel title={t('assistant.index.usage.title')} description={t('assistant.index.usage.description')}>
          <MetricRow
            items={[
              { label: t('assistant.index.usage.requests'), value: formatNumber(usage.data.requests, lang) },
              {
                label: t('assistant.index.usage.tokens'),
                value: formatNumber(Number(usage.data.input_tokens ?? 0) + Number(usage.data.output_tokens ?? 0), lang),
              },
              { label: t('assistant.index.usage.avgLatency'), value: formatMs(usage.data.avg_ms, lang, t) },
              { label: t('assistant.index.usage.p95Latency'), value: formatMs(usage.data.p95_ms, lang, t) },
            ]}
          />
        </Panel>
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('assistant.index.confirmRemoveTitle')}
        description={
          <>
            <span className="block font-medium text-foreground">{removing?.title}</span>
            <span className="mt-1 block">{t('assistant.index.confirmRemoveBody')}</span>
          </>
        }
        confirmLabel={t('assistant.index.actions.remove')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.mutate(removing); }}
      />
    </>
  );
}

/**
 * The status cell: the state as a pill, plus whatever that state needs explained — how far
 * along a running item is, why a failed one failed, and any warnings the reader raised.
 */
function IndexStatus({ row }: { row: IndexRow }) {
  const { t, i18n } = useTranslation();
  const warnings = row.warnings ?? [];
  const progress = Math.max(0, Math.min(100, Math.round(Number(row.progress ?? 0))));

  return (
    <div className="space-y-1.5">
      <StatusPill status={STATE_PILL[row.state] ?? 'draft'} label={t(`assistant.index.state.${row.state}`, { defaultValue: row.state })} />

      {row.state === 'processing' ? (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-1.5 max-w-[9rem]" aria-label={t('assistant.index.state.processing')} />
          <span className="numeric text-xs text-muted-foreground">{formatNumber(progress, i18n.language)}%</span>
        </div>
      ) : null}

      {row.state === 'failed' && row.error ? (
        <p className="line-clamp-2 whitespace-normal break-words text-xs text-danger" title={row.error} dir="auto">
          {row.error}
        </p>
      ) : null}

      {warnings.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded text-xs text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('assistant.index.warnings', { n: formatNumber(warnings.length, i18n.language) })}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-normal">
            <ul className="space-y-1">
              {warnings.map((warning, i) => <li key={i} dir="auto">{warning}</li>)}
            </ul>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** One line of the "built with" summary; amber when that part is running in a reduced mode. */
function PipelineLine({
  icon: Icon, degraded, children,
}: { icon: typeof Sparkles; degraded?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', degraded ? 'text-warning' : 'text-muted-foreground')} />
      <span className={degraded ? undefined : 'text-muted-foreground'}>{children}</span>
    </li>
  );
}

/** A latency in whole milliseconds, or a dash when nothing has been measured yet. */
function formatMs(
  value: number | string | null | undefined,
  lang: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return t('assistant.index.usage.ms', { value: formatNumber(Math.round(Number(value)), lang) });
}
