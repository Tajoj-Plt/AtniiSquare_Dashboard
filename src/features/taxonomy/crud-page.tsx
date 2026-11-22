import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/overlays';
import { ListInsights, type InsightCard, type InsightCut } from '@/components/data/list-insights';
import type { CrudConfig } from './crud-form';

export type { CrudField, CrudConfig } from './crud-form';

interface CrudPageProps<T extends { id: string }> extends CrudConfig {
  columns: Column<T>[];
  defaultSort?: string;
  filters?: (list: ReturnType<typeof useListQuery<T>>) => React.ReactNode;
  emptyTitle?: string;
  exportFileName?: string;
  /** A summary strip above the table, built from the resource's own /stats. */
  insights?: { cards: InsightCard[]; cuts?: InsightCut[]; timelineLabel?: string };
  /** Actions beyond edit/delete — moderation, say. Appended to the row menu. */
  extraRowActions?: (refresh: () => void) => Column<T> extends never ? never : any[];
}

/**
 * The list screen for a CRUD resource: the table, its filters, and the row menu.
 *
 * Creating and editing happen on their own route rather than in a dialog — see
 * CrudFormPage. A resource is therefore two screens over one config object, which is what
 * keeps the dashboard's admin surfaces from becoming twenty copies of the same file.
 */
export function CrudPage<T extends { id: string }>({
  queryKey, path, route, title, subtitle, icon, tone = 'blue', columns, writePermission,
  defaultSort = '-created_at', filters, emptyTitle, exportFileName, extraRowActions,
  createLabel, insights,
}: CrudPageProps<T>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const writable = can(writePermission);

  const list = useListQuery<T>(queryKey, path, { sort: defaultSort });
  const [deleting, setDeleting] = React.useState<T | null>(null);

  const remove = useApiMutation(() => api.delete(`${path}/${deleting!.id}`), {
    successMessage: t('library.deleted'),
    invalidate: [[queryKey]],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  return (
    <>
      <PageHeader
        icon={icon}
        tone={tone}
        title={title}
        subtitle={subtitle}
        actions={
          writable ? (
            <Button onClick={() => navigate(`${route}/new`)}>
              <Plus /> {createLabel ?? t('actions.create')}
            </Button>
          ) : null
        }
      />

      {insights ? (
        <ListInsights
          queryKey={queryKey}
          path={path}
          params={{ q: list.state.q || undefined, filter: list.state.filter, ...list.state.extra }}
          cards={insights.cards}
          cuts={insights.cuts}
          timelineLabel={insights.timelineLabel}
        />
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
        filters={filters?.(list)}
        emptyTitle={emptyTitle}
        exportFileName={exportFileName ?? queryKey}
        rowActions={[
          ...(extraRowActions?.(list.refresh) ?? []),
          ...(writable
            ? [
                {
                  label: t('actions.edit'), icon: Pencil,
                  onSelect: (row: T) => navigate(`${route}/${row.id}/edit`),
                },
                {
                  label: t('actions.delete'), icon: Trash2, destructive: true,
                  onSelect: (row: T) => setDeleting(row),
                },
              ]
            : []),
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
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
