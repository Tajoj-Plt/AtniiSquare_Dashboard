import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown, ArrowUp, ChevronsUpDown, Download, Inbox, MoreHorizontal, RefreshCw, Search, X,
} from 'lucide-react';
import { cn, debounce } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Card, Checkbox, Input, Skeleton } from '@/components/ui/primitives';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/overlays';

export interface Column<T> {
  /** Stable key; also the sort key sent to the API when `sortable` is set. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Receives the whole row. */
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  /** Value used for CSV export; falls back to the raw field. */
  exportValue?: (row: T) => string | number | null | undefined;
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface RowAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: (row: T) => void;
  destructive?: boolean;
  hidden?: (row: T) => boolean;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: Error | null;
  total?: number;
  /** Cursor pagination: present when another page exists. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /**
   * Footer controls for a list paged by number rather than by cursor (previous / next).
   * Rendered where "load more" would be; a page-numbered list passes this instead of hasMore.
   */
  pagination?: React.ReactNode;
  onRefresh?: () => void;

  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  sort?: string;
  onSortChange?: (sort: string) => void;

  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  bulkActions?: React.ReactNode;

  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;

  filters?: React.ReactNode;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  exportFileName?: string;
}

const HIDE_CLASS = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

/**
 * The list surface every screen in the dashboard is built on.
 *
 * Sorting and searching are *controlled* — the table reports intent and the page turns it
 * into an API query — because the data is paginated server-side by cursor, so sorting a
 * page client-side would silently sort only what happens to be loaded.
 */
export function DataTable<T extends { id: string }>({
  columns, rows, loading, error, total, hasMore, onLoadMore, loadingMore, pagination, onRefresh,
  search, onSearchChange, searchPlaceholder, sort, onSortChange,
  selectable, selected = [], onSelectedChange, bulkActions,
  rowActions, onRowClick, filters, toolbar, emptyTitle, emptyHint, exportFileName,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [searchDraft, setSearchDraft] = React.useState(search ?? '');

  React.useEffect(() => setSearchDraft(search ?? ''), [search]);

  const emitSearch = React.useMemo(
    () => debounce((value: string) => onSearchChange?.(value), 350),
    [onSearchChange],
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () =>
    onSelectedChange?.(allSelected ? [] : rows.map((r) => r.id));

  const toggleRow = (id: string) =>
    onSelectedChange?.(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const cycleSort = (key: string) => {
    if (!onSortChange) return;
    if (sort === `-${key}`) onSortChange(key);
    else if (sort === key) onSortChange('');
    else onSortChange(`-${key}`);
  };

  const exportCsv = () => {
    const header = columns.map((c) => csvCell(typeof c.header === 'string' ? c.header : c.key));
    const body = rows.map((row) =>
      columns.map((c) => csvCell(c.exportValue ? c.exportValue(row) : (row as any)[c.key])),
    );
    const csv = [header, ...body].map((r) => r.join(',')).join('\n');
    // BOM so Excel opens Arabic text in the right encoding.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden">
      {(onSearchChange || filters || toolbar || onRefresh) && (
        <div className="flex flex-col gap-3 p-4 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {onSearchChange ? (
              <div className="relative min-w-[12rem] flex-1 lg:max-w-xs">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchDraft}
                  onChange={(e) => { setSearchDraft(e.target.value); emitSearch(e.target.value); }}
                  placeholder={searchPlaceholder ?? t('actions.search')}
                  className="rounded-full ps-9 pe-9"
                  aria-label={t('actions.search')}
                />
                {searchDraft ? (
                  <button
                    onClick={() => { setSearchDraft(''); onSearchChange(''); }}
                    className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={t('actions.reset')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {filters}
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            {exportFileName ? (
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
                <Download /> <span className="hidden sm:inline">{t('actions.export')}</span>
              </Button>
            ) : null}
            {onRefresh ? (
              <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label={t('actions.refresh')}>
                <RefreshCw className={cn(loading && 'animate-spin')} />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {selectable && selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent/5 px-4 py-2.5 text-sm">
          <Badge>{t('common.selected', { count: selected.length })}</Badge>
          {bulkActions}
          <Button variant="ghost" size="sm" onClick={() => onSelectedChange?.([])} className="ms-auto">
            {t('actions.clearSelection')}
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border/60">
              {selectable ? (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label={t('actions.selectAll')}
                  />
                </th>
              ) : null}
              {columns.map((col) => {
                const active = sort === col.key || sort === `-${col.key}`;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 text-start text-xs font-medium text-muted-foreground',
                      col.hideBelow && HIDE_CLASS[col.hideBelow],
                      col.headerClassName,
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        onClick={() => cycleSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
                          active && 'text-foreground',
                        )}
                      >
                        {col.header}
                        {sort === `-${col.key}` ? <ArrowDown className="h-3 w-3" />
                          : sort === col.key ? <ArrowUp className="h-3 w-3" />
                          : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {rowActions?.length ? <th className="w-12 px-3 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {selectable ? <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td> : null}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-3', col.hideBelow && HIDE_CLASS[col.hideBelow])}>
                      <Skeleton className="h-4" style={{ width: `${50 + ((i * 13 + col.key.length * 7) % 45)}%` }} />
                    </td>
                  ))}
                  {rowActions?.length ? <td /> : null}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-16 text-center">
                  <p className="font-medium text-danger">{t('common.error')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
                  {onRefresh ? (
                    <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
                      {t('actions.retry')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-16 text-center">
                  <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">{emptyTitle ?? t('common.noResults')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{emptyHint ?? t('common.noResultsHint')}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/60',
                    onRowClick && 'cursor-pointer',
                    selected.includes(row.id) && 'bg-accent/5',
                  )}
                >
                  {selectable ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => toggleRow(row.id)} />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 align-middle', col.hideBelow && HIDE_CLASS[col.hideBelow], col.className)}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions?.length ? (
                    <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={t('common.actions')}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {rowActions.filter((a) => !a.hidden?.(row)).map((action) => (
                            <DropdownMenuItem
                              key={action.label}
                              destructive={action.destructive}
                              onSelect={() => action.onSelect(row)}
                            >
                              {action.icon ? <action.icon className="h-4 w-4" /> : null}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(rows.length > 0 || hasMore || pagination) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
          <span className="numeric">
            {typeof total === 'number'
              ? t('common.showing', { count: rows.length, total })
              : `${rows.length} ${t('common.results')}`}
          </span>
          {pagination ?? (hasMore ? (
            <Button variant="outline" size="sm" onClick={onLoadMore} loading={loadingMore}>
              {t('actions.loadMore')}
            </Button>
          ) : null)}
        </div>
      )}
    </Card>
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return /[",\n]/.test(str) ? `"${str}"` : str;
}
