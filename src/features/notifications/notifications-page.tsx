import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm, useListQuery } from '@/lib/hooks';
import { formatDate, formatNumber } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader, Panel, StatCard } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input, Textarea } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { RankedList } from '@/components/data/charts';

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('notifications', '/notifications', { sort: '-created_at' });
  const { data: stats } = useQuery({
    queryKey: ['notifications', 'stats'],
    queryFn: () => api.get('/notifications/stats'),
    enabled: can('analytics.read'),
  });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });

  const [broadcasting, setBroadcasting] = React.useState(false);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const form = useForm({ type: 'announcement', title: '', body: '', audience: 'everyone', role: 'reader' });

  const broadcast = useApiMutation(
    () => api.post('/notifications/broadcast', {
      type: form.values.type,
      payload: { title: form.values.title, body: form.values.body },
      role: form.values.audience === 'role' ? form.values.role : undefined,
    }),
    {
      invalidate: [['notifications']],
      onSuccess: () => {
        setBroadcasting(false);
        form.reset();
        list.refresh();
      },
      successMessage: t('actions.send'),
    },
  );

  const remove = useApiMutation(() => api.delete(`/notifications/${deleting.id}`), {
    successMessage: t('library.deleted'), invalidate: [['notifications']],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const columns: Column<any>[] = [
    { key: 'type', header: t('notifications.messageType'), cell: (row) => <Badge variant="secondary">{row.type}</Badge> },
    {
      key: 'payload', header: t('notifications.payload'), className: 'max-w-[28rem]',
      cell: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{row.payload?.title ?? '—'}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{row.payload?.body ?? row.payload?.reason ?? ''}</p>
        </div>
      ),
      exportValue: (row) => JSON.stringify(row.payload),
    },
    { key: 'recipient_name', header: t('learn.student'), hideBelow: 'md', cell: (row) => row.recipient_name ?? '—' },
    {
      key: 'read_at', header: t('common.status'), hideBelow: 'sm',
      cell: (row) => (row.read_at ? <Badge variant="muted">read</Badge> : <Badge variant="warning">unread</Badge>),
    },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, className: 'numeric text-muted-foreground', cell: (row) => formatDate(row.created_at, lang, true) },
  ];

  return (
    <>
      <PageHeader
        icon={Bell}
        tone="orange"
        title={t('notifications.title')}
        actions={
          can('notification.send') ? (
            <Button onClick={() => setBroadcasting(true)}><Send /> {t('notifications.broadcast')}</Button>
          ) : null
        }
      />

      {stats ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
            <StatCard label={t('common.count')} value={formatNumber(stats.totals.total, lang)} />
            <StatCard label={t('common.status')} value={formatNumber(stats.totals.unread, lang)} tone="warning" hint={t('notifications.unread', { count: stats.totals.unread })} />
            <StatCard label={t('learn.student')} value={formatNumber(stats.totals.recipients, lang)} />
          </section>
          <Panel title={t('notifications.messageType')}>
            <RankedList items={(stats.byType ?? []).slice(0, 6).map((r: any) => ({ label: r.type, value: r.count }))} />
          </Panel>
        </div>
      ) : null}

      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} sort={list.state.sort} onSortChange={list.setSort}
        exportFileName="notifications"
        filters={
          <Select value={list.state.filter.type ?? 'all'} onValueChange={(v) => list.setFilter('type', v)}>
            <SelectTrigger className="w-[13rem]"><SelectValue placeholder={t('notifications.messageType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {(stats?.byType ?? []).map((r: any) => (
                <SelectItem key={r.type} value={r.type}>{r.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rowActions={[
          { label: t('actions.delete'), icon: Trash2, destructive: true, onSelect: (row) => setDeleting(row), hidden: () => !can('notification.send') },
        ]}
      />

      <Dialog open={broadcasting} onOpenChange={setBroadcasting}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('notifications.broadcastTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label={t('notifications.messageType')} required error={form.errors.type}>
              <Input dir="ltr" value={form.values.type} onChange={(e) => form.set('type', e.target.value)} />
            </Field>
            <Field label={t('common.title')}>
              <Input value={form.values.title} onChange={(e) => form.set('title', e.target.value)} />
            </Field>
            <Field label={t('notifications.payload')}>
              <Textarea rows={3} value={form.values.body} onChange={(e) => form.set('body', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('notifications.audience')}>
                <Select value={form.values.audience} onValueChange={(v) => form.set('audience', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">{t('notifications.everyone')}</SelectItem>
                    <SelectItem value="role">{t('notifications.byRole')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.values.audience === 'role' ? (
                <Field label={t('users.roles')}>
                  <Select value={form.values.role} onValueChange={(v) => form.set('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((r: any) => (
                        <SelectItem key={r.slug} value={r.slug}>
                          {lang === 'ar' ? r.name : (r.name_en ?? r.slug)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcasting(false)}>{t('actions.cancel')}</Button>
            <Button loading={broadcast.isPending} onClick={() => broadcast.mutate(undefined, { onError: form.applyApiError })}>
              <Send /> {t('actions.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')} description={t('common.confirmDeleteBody')}
        confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')}
        loading={remove.isPending} onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
