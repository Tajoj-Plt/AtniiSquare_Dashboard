import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, Briefcase, Eye, KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { ListInsights } from '@/components/data/list-insights';
import { PageHeader, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

/**
 * Dashboard staff — the accounts that run the platform. Split from the old flat "Users"
 * list: an operator account never carries demographics or interests (those are a mobile
 * member's data), so this list is deliberately plain — name, email, role, status, last
 * sign-in — and its "Add user" is the only place a new account can be created at all.
 */
export function DashboardUsersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('dashboardUsers', '/dashboard-users', { sort: '-created_at' });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });

  const [suspending, setSuspending] = React.useState<any | null>(null);
  const [resetting, setResetting] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const statsParams = React.useMemo(
    () => ({ q: list.state.q || undefined, filter: list.state.filter, ...list.state.extra }),
    [list.state.q, list.state.filter, list.state.extra],
  );

  const invalidate = [['dashboardUsers']];

  const setStatus = useApiMutation(
    (vars: { id: string; status: string }) => api.post(`/dashboard-users/${vars.id}/status`, { status: vars.status }),
    { successMessage: t('users.updated'), invalidate, onSuccess: () => { setSuspending(null); list.refresh(); } },
  );

  const [newPassword, setNewPassword] = React.useState('');
  const resetPassword = useApiMutation(
    () => api.post(`/dashboard-users/${resetting.id}/password`, { password: newPassword }),
    { successMessage: t('auth.passwordChanged'), onSuccess: () => { setResetting(null); setNewPassword(''); } },
  );

  const remove = useApiMutation(() => api.delete(`/dashboard-users/${deleting.id}`), {
    successMessage: t('library.deleted'), invalidate,
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const columns: Column<any>[] = [
    {
      key: 'full_name',
      header: t('common.name'),
      cell: (row) => (
        <div className="min-w-0">
          <Link to={`/dashboard-users/${row.id}`} className="line-clamp-1 font-medium hover:text-accent hover:underline">
            {row.full_name ?? '—'}
          </Link>
          <p className="line-clamp-1 text-xs text-muted-foreground" dir="ltr">{row.email ?? row.phone}</p>
        </div>
      ),
      exportValue: (row) => row.full_name,
    },
    {
      key: 'roles',
      header: t('users.roles'),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.roles ?? []).map((r: any) => (
            <Badge key={r.slug} variant="secondary" className="text-[10px]">
              {lang === 'ar' ? r.name : (r.name_en ?? r.slug)}
            </Badge>
          ))}
        </div>
      ),
      exportValue: (row) => (row.roles ?? []).map((r: any) => r.slug).join(' '),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (row) => <StatusPill status={row.status} label={t(`users.status.${row.status}`)} />,
    },
    {
      key: 'last_login_at',
      header: t('users.lastLogin'),
      sortable: true,
      className: 'text-muted-foreground',
      cell: (row) => (row.last_login_at ? formatRelative(row.last_login_at, lang) : t('common.never')),
    },
    {
      key: 'created_at',
      header: t('common.createdAt'),
      sortable: true,
      hideBelow: 'lg',
      className: 'numeric text-muted-foreground',
      cell: (row) => formatDate(row.created_at, lang),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Briefcase}
        tone="indigo"
        title={t('nav.dashboardUsers')}
        subtitle={t('users.dashboardSubtitle')}
        actions={
          can('user.manage') ? (
            <Button onClick={() => navigate('/dashboard-users/new')}><UserPlus /> {t('users.newUser')}</Button>
          ) : null
        }
      />

      <ListInsights
        queryKey="dashboardUsers"
        path="/dashboard-users"
        storageKey="dashboard-users-list"
        params={statsParams}
        timelineLabel={t('insights.joined')}
        cards={[
          { key: 'total', label: t('users.stats.total') },
          { key: 'active', label: t('users.stats.active'), tone: 'success' },
          { key: 'suspended', label: t('users.stats.suspended'), tone: 'danger' },
          { key: 'active_7d', label: t('users.stats.active7d'), tone: 'teal' },
        ]}
        cuts={[
          { key: 'status', label: t('common.status'), labelFor: (k) => t(`users.status.${k}`, { defaultValue: k }) },
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
        sort={list.state.sort}
        onSortChange={list.setSort}
        exportFileName="dashboard-users"
        filters={
          <>
            <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
              <SelectTrigger className="w-[9.5rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.status')}</SelectItem>
                <SelectItem value="active">{t('users.status.active')}</SelectItem>
                <SelectItem value="suspended">{t('users.status.suspended')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={list.state.extra.role ?? 'all'} onValueChange={(v) => list.setExtra('role', v)}>
              <SelectTrigger className="w-[12rem]"><SelectValue placeholder={t('users.roles')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.roles')}</SelectItem>
                {(roles ?? []).map((r: any) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {lang === 'ar' ? r.name : (r.name_en ?? r.slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(Object.keys(list.state.filter).length || Object.keys(list.state.extra).length) ? (
              <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
            ) : null}
          </>
        }
        rowActions={[
          { label: t('actions.view'), icon: Eye, onSelect: (row) => navigate(`/dashboard-users/${row.id}`) },
          {
            label: t('actions.suspend'), icon: Ban,
            onSelect: (row) => setSuspending(row),
            hidden: (row) => !can('user.manage') || row.status !== 'active' || row.id === me?.id,
          },
          {
            label: t('actions.restore'), icon: ShieldCheck,
            onSelect: (row) => setStatus.mutate({ id: row.id, status: 'active' }),
            hidden: (row) => !can('user.manage') || row.status === 'active',
          },
          {
            label: t('users.resetPassword'), icon: KeyRound,
            onSelect: (row) => setResetting(row),
            hidden: () => !can('user.manage'),
          },
          {
            label: t('actions.delete'), icon: Trash2, destructive: true,
            onSelect: (row) => setDeleting(row),
            hidden: (row) => !can('user.manage') || row.id === me?.id,
          },
        ]}
      />

      <Dialog open={Boolean(resetting)} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('users.resetPassword')}</DialogTitle></DialogHeader>
          <Field label={t('auth.newPassword')} required hint="10+ chars, upper + lower + digit">
            <Input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>{t('actions.cancel')}</Button>
            <Button loading={resetPassword.isPending} onClick={() => resetPassword.mutate(undefined)}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(suspending)}
        onOpenChange={(o) => !o && setSuspending(null)}
        title={t('users.suspendTitle')}
        description={t('users.suspendBody')}
        confirmLabel={t('actions.suspend')}
        cancelLabel={t('actions.cancel')}
        loading={setStatus.isPending}
        onConfirm={() => setStatus.mutate({ id: suspending.id, status: 'suspended' })}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')}
        description={deleting?.email}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
