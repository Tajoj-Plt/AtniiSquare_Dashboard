import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useListQuery } from '@/lib/hooks';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/data/page-parts';

/**
 * One activity section on a member or page detail screen: a header that shows the real
 * count as a badge, and — once expanded — the real rows behind it, cursor-paginated with
 * a "load more" button, each one rendered by the caller and (usually) a link to the real
 * thing. Replaces what used to be a bare number in `MetricRow`: tapping the header is the
 * whole interaction, there is no separate "view all" screen to build per activity kind.
 *
 * The list itself only mounts once expanded, so collapsed sections on a busy profile cost
 * nothing — the fetch happens on first open, not on page load.
 */
export function ActivityPanel<T extends { id: string }>({
  title, icon: Icon, count, queryKey, path, extra, renderRow, renderList, emptyLabel, defaultOpen = false,
}: {
  title: string;
  icon?: LucideIcon;
  count: number;
  queryKey: string;
  path: string;
  extra?: Record<string, string>;
  /** Default rendering: one row per item, divided. */
  renderRow?: (row: T) => React.ReactNode;
  /** Escape hatch for a section that groups its rows itself (e.g. by target type). */
  renderList?: (rows: T[]) => React.ReactNode;
  emptyLabel: string;
  defaultOpen?: boolean;
}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-start"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          <span className="truncate font-medium">{title}</span>
          <span className="numeric shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {formatNumber(count, i18n.language)}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <CardContent className="border-t pt-4">
          <ActivityPanelBody
            queryKey={queryKey} path={path} extra={extra} renderRow={renderRow} renderList={renderList}
            emptyLabel={emptyLabel}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

/** Mounted only while its panel is open, so the request fires on first expand, not on load. */
function ActivityPanelBody<T extends { id: string }>({
  queryKey, path, extra, renderRow, renderList, emptyLabel,
}: {
  queryKey: string;
  path: string;
  extra?: Record<string, string>;
  renderRow?: (row: T) => React.ReactNode;
  renderList?: (rows: T[]) => React.ReactNode;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  const list = useListQuery<T>(queryKey, path, { limit: 8, extra });

  if (list.loading) {
    return <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>;
  }
  if (list.error) {
    return <p className="text-sm text-danger">{t('common.error')}</p>;
  }
  if (!list.rows.length) {
    return <EmptyState title={emptyLabel} />;
  }
  return (
    <div>
      {renderList ? renderList(list.rows) : (
        <ul className="divide-y">
          {list.rows.map((row) => <li key={row.id}>{renderRow?.(row)}</li>)}
        </ul>
      )}
      {list.hasMore ? (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={list.loadMore} loading={list.loadingMore}>
            {t('actions.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
