import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, Eye, RotateCcw, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { ListInsights } from '@/components/data/list-insights';
import { CountrySelect } from '@/components/data/country-select';
import { countryFlag, countryName } from '@/lib/countries';
import { PageHeader, StatusPill } from '@/components/data/page-parts';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';

/** Tints for the contribution class chip — the app's blue star → silver → gold ladder. */
const CLASS_TONE: Record<string, string> = {
  blue_star: 'bg-accent/10 text-accent',
  silver: 'bg-muted text-muted-foreground',
  gold: 'bg-warning/15 text-warning',
};

/**
 * App members — everyone who registered through the mobile app. Split from the old flat
 * "Users" list: a member holds no dashboard role (their academic identity is
 * `profiles.academic_titles`, set at onboarding), so this list is the mobile-shaped view
 * of the directory — avatar, handle, contribution class, country, interests, onboarding —
 * and there is deliberately no "add member" here: a member account only ever comes from
 * the app's own registration.
 */
export function AppMembersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('appMembers', '/app-members', { sort: '-created_at' });
  const { data: interests } = useQuery({
    queryKey: ['interests', 'all'],
    queryFn: () => api.get('/interests', { limit: 100, sort: 'name' }),
    staleTime: 5 * 60_000,
  });

  const [suspending, setSuspending] = React.useState<any | null>(null);
  const statsParams = React.useMemo(
    () => ({ q: list.state.q || undefined, filter: list.state.filter, ...list.state.extra }),
    [list.state.q, list.state.filter, list.state.extra],
  );

  const invalidate = [['appMembers']];

  const setStatus = useApiMutation(
    (vars: { id: string; status: string }) => api.post(`/app-members/${vars.id}/status`, { status: vars.status }),
    { successMessage: t('users.updated'), invalidate, onSuccess: () => { setSuspending(null); list.refresh(); } },
  );

  const setDeactivated = useApiMutation(
    (vars: { id: string; deactivated: boolean }) => api.post(`/app-members/${vars.id}/deactivate`, { deactivated: vars.deactivated }),
    { successMessage: t('users.updated'), invalidate, onSuccess: () => list.refresh() },
  );

  const columns: Column<any>[] = [
    {
      key: 'full_name',
      header: t('common.name'),
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={row.avatar_url} name={row.full_name ?? row.email} />
          <div className="min-w-0">
            <Link to={`/app-members/${row.id}`} className="line-clamp-1 font-medium hover:text-accent hover:underline">
              {row.full_name ?? '—'}
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground" dir="ltr">
              {row.handle ? `@${row.handle}` : (row.email ?? row.phone)}
            </p>
          </div>
        </div>
      ),
      exportValue: (row) => row.full_name,
    },
    {
      key: 'user_class',
      header: t('users.member.class'),
      hideBelow: 'md',
      cell: (row) => (
        <Badge className={CLASS_TONE[row.user_class] ?? CLASS_TONE.blue_star}>
          {t(`appControl.userClass.${row.user_class ?? 'blue_star'}`)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusPill status={row.status} label={t(`users.status.${row.status}`)} />
          {row.deactivated_at ? <Badge variant="danger">{t('users.member.deactivated')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'country',
      header: t('users.demographics.country'),
      hideBelow: 'lg',
      cell: (row) => (row.country ? (
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{countryFlag(row.country)}</span>
          <span className="truncate">{countryName(row.country, lang)}</span>
        </span>
      ) : <span className="text-muted-foreground">—</span>),
      exportValue: (row) => countryName(row.country, 'en'),
    },
    {
      key: 'interest_count',
      header: t('users.interests'),
      className: 'numeric',
      hideBelow: 'xl',
      cell: (row) => row.interest_count ?? 0,
    },
    {
      key: 'onboarding_completed_at',
      header: t('users.member.onboarding'),
      hideBelow: 'lg',
      cell: (row) => (
        <Badge variant={row.onboarding_completed_at ? 'success' : 'warning'}>
          {t(row.onboarding_completed_at ? 'users.member.onboardingDone' : 'users.member.onboardingNotDone')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: t('users.joinedAt'),
      sortable: true,
      hideBelow: 'xl',
      className: 'numeric text-muted-foreground',
      cell: (row) => formatDate(row.created_at, lang),
    },
  ];

  return (
    <>
      <PageHeader
        icon={UsersIcon}
        tone="sky"
        title={t('nav.appMembers')}
        subtitle={t('users.appMembersSubtitle')}
      />

      <ListInsights
        queryKey="appMembers"
        path="/app-members"
        storageKey="app-members-list"
        params={statsParams}
        timelineLabel={t('insights.joined')}
        cards={[
          { key: 'total', label: t('users.stats.total') },
          { key: 'active', label: t('users.stats.active'), tone: 'success' },
          { key: 'suspended', label: t('users.stats.suspended'), tone: 'danger' },
          { key: 'new_30d', label: t('users.stats.new30d') },
          { key: 'active_7d', label: t('users.stats.active7d'), tone: 'teal' },
          { key: 'never_signed_in', label: t('insights.cards.neverSignedIn'), tone: 'warning' },
          { key: 'contributors', label: t('insights.cards.contributors'), tone: 'violet' },
        ]}
        cuts={[
          { key: 'status', label: t('common.status'), labelFor: (k) => t(`users.status.${k}`, { defaultValue: k }) },
          { key: 'country', label: t('users.demographics.country'),
            labelFor: (k) => (k === 'unknown' ? t('users.demographics.notStated') : countryName(k, lang)) },
          { key: 'age_band', label: t('users.demographics.ageBand'),
            labelFor: (k) => t(`users.demographics.bands.${k}`, { defaultValue: k }) },
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
        exportFileName="app-members"
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

            <div className="w-[12rem]">
              <CountrySelect
                value={list.state.filter.country ?? null}
                placeholder={t('users.demographics.country')}
                onChange={(code) => list.setFilter('country', code ?? 'all')}
              />
            </div>

            <Select value={list.state.extra.interest_id ?? 'all'} onValueChange={(v) => list.setExtra('interest_id', v)}>
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('users.interests')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.interests')}</SelectItem>
                {(interests?.data ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {lang === 'ar' ? i.name : (i.name_en ?? i.name)}
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
          { label: t('actions.view'), icon: Eye, onSelect: (row) => navigate(`/app-members/${row.id}`) },
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
            label: t('users.member.deactivateAccount'), icon: Ban,
            onSelect: (row) => setDeactivated.mutate({ id: row.id, deactivated: true }),
            hidden: (row) => !can('user.manage') || Boolean(row.deactivated_at),
          },
          {
            label: t('users.member.reactivateAccount'), icon: RotateCcw,
            onSelect: (row) => setDeactivated.mutate({ id: row.id, deactivated: false }),
            hidden: (row) => !can('user.manage') || !row.deactivated_at,
          },
        ]}
      />

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
    </>
  );
}
