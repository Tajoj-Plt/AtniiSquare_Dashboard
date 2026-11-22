import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2, MessageSquare, Trash2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatNumber, formatRelative } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader, StatusPill } from '@/components/data/page-parts';
import { Avatar, Badge } from '@/components/ui/primitives';
import {
  ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

const STATUS_FILTER = (t: any, list: any, values: string[]) => (
  <Select value={list.state.filter.status ?? 'all'} onValueChange={(v: string) => list.setFilter('status', v)}>
    <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t('common.all')}</SelectItem>
      {values.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
    </SelectContent>
  </Select>
);

export function PostsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const list = useListQuery<any>('posts', '/posts', { sort: '-created_at' });
  const [deleting, setDeleting] = React.useState<any | null>(null);

  const moderate = useApiMutation(
    (vars: { id: string; action: string }) => api.post(`/posts/${vars.id}/moderate`, { action: vars.action }),
    { successMessage: t('library.updated'), invalidate: [['posts']], onSuccess: () => list.refresh() },
  );
  const remove = useApiMutation(() => api.delete(`/posts/${deleting.id}`), {
    successMessage: t('library.deleted'), invalidate: [['posts']],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const columns: Column<any>[] = [
    {
      key: 'body', header: t('community.body'), className: 'max-w-[30rem]',
      cell: (row) => (
        <div className="flex items-start gap-2.5">
          <Avatar src={row.author_avatar} name={row.author_name} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm">{row.body ?? <span className="text-muted-foreground">— {row.content_title} —</span>}</p>
            <p className="text-xs text-muted-foreground">{row.author_name ?? '—'}</p>
          </div>
        </div>
      ),
      exportValue: (row) => row.body,
    },
    { key: 'status', header: t('common.status'), cell: (row) => <StatusPill status={row.status} /> },
    { key: 'reaction_count', header: t('library.engagement'), className: 'numeric', hideBelow: 'md', cell: (row) => formatNumber(row.reaction_count, i18n.language) },
    { key: 'comment_count', header: t('nav.comments'), className: 'numeric', hideBelow: 'md', cell: (row) => formatNumber(row.comment_count, i18n.language) },
    {
      key: 'open_reports', header: t('community.openReports'), hideBelow: 'lg',
      cell: (row) => (row.open_reports ? <Badge variant="danger">{row.open_reports}</Badge> : '—'),
    },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'sm', className: 'text-muted-foreground', cell: (row) => formatRelative(row.created_at, i18n.language) },
  ];

  return (
    <>
      <PageHeader icon={MessageSquare} tone="violet" title={t('community.postsTitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="posts"
        filters={STATUS_FILTER(t, list, ['published', 'pending_review', 'rejected'])}
        rowActions={[
          { label: t('actions.approve'), icon: CheckCircle2, onSelect: (row) => moderate.mutate({ id: row.id, action: 'approve' }), hidden: (row) => !can('post.moderate') || row.status === 'published' },
          { label: t('actions.reject'), icon: XCircle, onSelect: (row) => moderate.mutate({ id: row.id, action: 'reject' }), hidden: (row) => !can('post.moderate') || row.status === 'rejected' },
          { label: t('actions.delete'), icon: Trash2, destructive: true, onSelect: (row) => setDeleting(row), hidden: () => !can('post.moderate') },
        ]}
      />
      <ConfirmDialog
        open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')} description={t('common.confirmDeleteBody')}
        confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')}
        loading={remove.isPending} onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

export function CommentsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const list = useListQuery<any>('comments', '/comments', { sort: '-created_at' });
  const [deleting, setDeleting] = React.useState<any | null>(null);

  const remove = useApiMutation(() => api.delete(`/comments/${deleting.id}`), {
    successMessage: t('library.deleted'), invalidate: [['comments']],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const columns: Column<any>[] = [
    {
      key: 'body', header: t('community.body'), className: 'max-w-[32rem]',
      cell: (row) => (
        <div className="flex items-start gap-2.5">
          <Avatar src={row.author_avatar} name={row.author_name} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm">{row.body}</p>
            <p className="text-xs text-muted-foreground">{row.author_name ?? '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'target_type', header: t('moderation.target'), hideBelow: 'md', cell: (row) => <Badge variant="secondary">{row.target_type}</Badge> },
    { key: 'reply_count', header: 'Replies', className: 'numeric', hideBelow: 'lg', cell: (row) => formatNumber(row.reply_count, i18n.language) },
    { key: 'open_reports', header: t('community.openReports'), hideBelow: 'lg', cell: (row) => (row.open_reports ? <Badge variant="danger">{row.open_reports}</Badge> : '—') },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'sm', className: 'text-muted-foreground', cell: (row) => formatRelative(row.created_at, i18n.language) },
  ];

  return (
    <>
      <PageHeader icon={MessageSquare} tone="violet" title={t('community.commentsTitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="comments"
        filters={
          <Select value={list.state.filter.target_type ?? 'all'} onValueChange={(v) => list.setFilter('target_type', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('moderation.target')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {['post', 'content_item', 'reel', 'course'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        rowActions={[
          { label: t('actions.delete'), icon: Trash2, destructive: true, onSelect: (row) => setDeleting(row), hidden: () => !can('comment.moderate') },
        ]}
      />
      <ConfirmDialog
        open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')} description={t('common.confirmDeleteBody')}
        confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')}
        loading={remove.isPending} onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
