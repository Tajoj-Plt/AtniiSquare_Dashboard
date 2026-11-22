import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import { useListQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/data/page-parts';
import { Badge } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';

const TARGET_TYPES = ['content_item', 'user', 'role', 'media_asset', 'report', 'live_room', 'course', 'notification'];

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const list = useListQuery<any>('audit-logs', '/audit-logs', { sort: '-created_at' });

  const columns: Column<any>[] = [
    { key: 'action', header: t('audit.action'), cell: (row) => <Badge variant="secondary" className="font-mono text-[10px]">{row.action}</Badge> },
    {
      key: 'actor_name', header: t('audit.actor'),
      cell: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{row.actor_name ?? '—'}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground" dir="ltr">{row.actor_email ?? ''}</p>
        </div>
      ),
    },
    { key: 'target_type', header: t('audit.target'), hideBelow: 'md', cell: (row) => row.target_type ?? '—' },
    {
      key: 'metadata', header: t('common.details'), hideBelow: 'lg', className: 'max-w-[20rem]',
      cell: (row) => (
        <code className="line-clamp-1 text-[11px] text-muted-foreground" dir="ltr">
          {row.metadata && Object.keys(row.metadata).length ? JSON.stringify(row.metadata) : '—'}
        </code>
      ),
      exportValue: (row) => JSON.stringify(row.metadata),
    },
    { key: 'ip_text', header: t('audit.ip'), hideBelow: 'xl', className: 'numeric text-muted-foreground', cell: (row) => row.ip_text ?? '—' },
    { key: 'created_at', header: t('common.date'), sortable: true, className: 'numeric whitespace-nowrap text-muted-foreground', cell: (row) => formatDate(row.created_at, i18n.language, true) },
  ];

  return (
    <>
      <PageHeader icon={ScrollText} tone="ink" title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="audit-log"
        filters={
          <Select value={list.state.filter.target_type ?? 'all'} onValueChange={(v) => list.setFilter('target_type', v)}>
            <SelectTrigger className="w-[12rem]"><SelectValue placeholder={t('audit.target')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {TARGET_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}
