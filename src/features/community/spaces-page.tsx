import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft, BookOpenText, CalendarClock, Eye, GraduationCap, Lock, MessagesSquare, RotateCcw, Trash2, UsersRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { formatDate, formatNumber, formatRelative } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { ListInsights } from '@/components/data/list-insights';
import { DetailList, EmptyState, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Avatar, Badge, Skeleton, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

/**
 * Groups and spaces — what members create, join and gather in from the app.
 *
 * One table (`spaces`) holds both: `kind = 'reading_group'` is what the app calls a Group,
 * `kind = 'learning_group'` a Learning group and `kind = 'discussion'` a Space. Staff do not run them — their owners and admins do — so this
 * screen only reads, plus the one lever moderation needs: a soft delete that can be undone.
 * Everything here needs `space.moderate`, because a private space's members are private.
 */

const KINDS = ['reading_group', 'learning_group', 'discussion'] as const;
const PRIVACIES = ['public', 'private'] as const;

type SpaceAction = { row: any; to: 'active' | 'deleted' } | null;

/** The icon a kind is drawn with, so a group and a space are told apart at a glance. */
function KindIcon({ kind, className }: { kind: string; className?: string }) {
  return kind === 'reading_group'
    ? <BookOpenText className={className} />
    : kind === 'learning_group'
      ? <GraduationCap className={className} />
      : <MessagesSquare className={className} />;
}

/** Soft delete / restore, shared by the list and the detail page. */
function useSpaceStatus(onDone: () => void) {
  const { t } = useTranslation();
  const [pending, setPending] = React.useState<SpaceAction>(null);
  const mutation = useApiMutation(
    (vars: { id: string; status: 'active' | 'deleted' }) => api.post(`/spaces/${vars.id}/status`, { status: vars.status }),
    {
      invalidate: [['spaces']],
      onSuccess: (_data, vars) => {
        // `successMessage` is fixed; this route needs one message per direction.
        toast.success(vars.status === 'deleted' ? t('spaces.deleted') : t('spaces.restored'));
        setPending(null);
        onDone();
      },
    },
  );

  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      onOpenChange={(o) => !o && setPending(null)}
      title={pending?.to === 'deleted' ? t('spaces.deleteTitle') : t('spaces.restoreTitle')}
      description={pending?.to === 'deleted' ? t('spaces.deleteBody') : t('spaces.restoreBody')}
      confirmLabel={pending?.to === 'deleted' ? t('actions.delete') : t('actions.restore')}
      cancelLabel={t('actions.cancel')}
      destructive={pending?.to === 'deleted'}
      loading={mutation.isPending}
      onConfirm={() => { if (pending) mutation.mutate({ id: pending.row.id, status: pending.to }); }}
    />
  );

  return { ask: setPending, dialog };
}

export function SpacesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('spaces', '/spaces', { sort: '-created_at' });
  const status = useSpaceStatus(() => list.refresh());

  const statsParams = React.useMemo(
    () => ({ q: list.state.q || undefined, filter: list.state.filter, ...list.state.extra }),
    [list.state.q, list.state.filter, list.state.extra],
  );
  const includeDeleted = list.state.extra.include_deleted === 'true';

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: t('common.name'),
      className: 'max-w-[26rem]',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={row.avatar_url} name={row.name} className="h-9 w-9" />
          <div className="min-w-0">
            <Link to={`/spaces/${row.id}`} className="line-clamp-1 font-medium hover:text-accent hover:underline">
              {row.name}
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {row.description || t('spaces.noDescription')}
            </p>
          </div>
        </div>
      ),
      exportValue: (row) => row.name,
    },
    {
      key: 'kind',
      header: t('spaces.kind'),
      hideBelow: 'md',
      cell: (row) => (
        <Badge variant="secondary" className="gap-1 whitespace-nowrap">
          <KindIcon kind={row.kind} className="h-3.5 w-3.5" />
          {t(`spaces.kinds.${row.kind}`, { defaultValue: row.kind })}
        </Badge>
      ),
      exportValue: (row) => row.kind,
    },
    {
      key: 'privacy',
      header: t('spaces.privacy'),
      hideBelow: 'lg',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          {row.privacy === 'private' ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
          {t(`spaces.privacies.${row.privacy}`, { defaultValue: row.privacy })}
        </span>
      ),
      exportValue: (row) => row.privacy,
    },
    {
      key: 'owner_name',
      header: t('spaces.owner'),
      hideBelow: 'lg',
      cell: (row) => (
        <div className="min-w-0">
          <Link to={`/app-members/${row.owner_user_id}`} className="line-clamp-1 hover:text-accent hover:underline">
            {row.owner_name ?? '—'}
          </Link>
          {row.owner_handle ? <p className="text-xs text-muted-foreground" dir="ltr">@{row.owner_handle}</p> : null}
        </div>
      ),
      exportValue: (row) => row.owner_name,
    },
    {
      key: 'member_count',
      header: t('spaces.members'),
      sortable: true,
      className: 'numeric',
      cell: (row) => formatNumber(row.member_count, lang),
    },
    {
      key: 'event_count',
      header: t('spaces.events'),
      className: 'numeric',
      hideBelow: 'md',
      cell: (row) => formatNumber(row.event_count, lang),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (row) => <StatusPill status={row.status} label={t(`spaces.status.${row.status}`)} />,
    },
    {
      key: 'created_at',
      header: t('common.createdAt'),
      sortable: true,
      hideBelow: 'sm',
      className: 'text-muted-foreground',
      cell: (row) => formatRelative(row.created_at, lang),
    },
  ];

  return (
    <>
      <PageHeader icon={UsersRound} tone="teal" title={t('spaces.title')} subtitle={t('spaces.subtitle')} />

      <Tabs value={list.state.filter.kind ?? 'all'} onValueChange={(v) => list.setFilter('kind', v)}>
        <TabsList className="h-auto flex-wrap justify-start">
          {(['all', ...KINDS] as const).map((k) => (
            <TabsTrigger key={k} value={k} className="gap-1.5">
              {k === 'all' ? <UsersRound className="h-4 w-4" /> : <KindIcon kind={k} className="h-4 w-4" />}
              {t(`spaces.kindTabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ListInsights
        queryKey="spaces"
        path="/spaces"
        storageKey="spaces-list"
        params={statsParams}
        timelineLabel={t('spaces.timeline')}
        cards={[
          { key: 'total', label: t('spaces.stats.total') },
          { key: 'reading_group', label: t('spaces.stats.reading_group'), tone: 'amber' },
          { key: 'learning_group', label: t('spaces.stats.learning_group'), tone: 'teal' },
          { key: 'discussion', label: t('spaces.stats.discussion'), tone: 'violet' },
          { key: 'private', label: t('spaces.stats.private'), tone: 'sky' },
          { key: 'members', label: t('spaces.stats.members'), tone: 'teal' },
          ...(includeDeleted ? [{ key: 'deleted', label: t('spaces.stats.deleted'), tone: 'danger' as const }] : []),
        ]}
        cuts={[
          { key: 'kind', label: t('spaces.kind'), labelFor: (k) => t(`spaces.kindTabs.${k}`, { defaultValue: k }) },
          { key: 'privacy', label: t('spaces.privacy'), labelFor: (k) => t(`spaces.privacies.${k}`, { defaultValue: k }) },
        ]}
      />

      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        searchPlaceholder={t('spaces.searchPlaceholder')}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="spaces"
        emptyTitle={t('spaces.empty')}
        onRowClick={(row) => navigate(`/spaces/${row.id}`)}
        filters={
          <>
            <Select value={list.state.filter.privacy ?? 'all'} onValueChange={(v) => list.setFilter('privacy', v)}>
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('spaces.privacy')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('spaces.privacy')}</SelectItem>
                {PRIVACIES.map((p) => <SelectItem key={p} value={p}>{t(`spaces.privacies.${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={includeDeleted}
                onCheckedChange={(v) => list.setExtra('include_deleted', v ? 'true' : undefined)}
              />
              {t('spaces.includeDeleted')}
            </label>
            {(Object.keys(list.state.filter).length || Object.keys(list.state.extra).length) ? (
              <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
            ) : null}
          </>
        }
        rowActions={[
          { label: t('actions.view'), icon: Eye, onSelect: (row) => navigate(`/spaces/${row.id}`) },
          {
            label: t('actions.delete'), icon: Trash2, destructive: true,
            onSelect: (row) => status.ask({ row, to: 'deleted' }),
            hidden: (row) => !can('space.moderate') || row.status === 'deleted',
          },
          {
            label: t('actions.restore'), icon: RotateCcw,
            onSelect: (row) => status.ask({ row, to: 'active' }),
            hidden: (row) => !can('space.moderate') || row.status !== 'deleted',
          },
        ]}
      />
      {status.dialog}
    </>
  );
}

/** One space: what it is, who is in it, and the events it has scheduled. */
export function SpaceDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const { data: space, isLoading, refetch } = useQuery({
    queryKey: ['spaces', id],
    queryFn: () => api.get(`/spaces/${id}`),
  });
  const status = useSpaceStatus(() => void refetch());

  if (isLoading || !space) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></>;

  const members: any[] = space.members ?? [];
  const events: any[] = space.events ?? [];
  const isDeleted = space.status === 'deleted';

  return (
    <>
      <PageHeader
        icon={UsersRound}
        tone="teal"
        title={space.name}
        subtitle={space.owner_name ? t('spaces.detailSubtitle', { name: space.owner_name }) : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can('space.moderate') && !isDeleted ? (
              <Button variant="outline" onClick={() => status.ask({ row: space, to: 'deleted' })}>
                <Trash2 /> {t('actions.delete')}
              </Button>
            ) : null}
            {can('space.moderate') && isDeleted ? (
              <Button variant="outline" onClick={() => status.ask({ row: space, to: 'active' })}>
                <RotateCcw /> {t('actions.restore')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate('/spaces')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={space.name}>
          <div className="flex items-start gap-3">
            <Avatar src={space.avatar_url} name={space.name} className="h-14 w-14" />
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
              {space.description || <span className="text-muted-foreground">{t('spaces.noDescription')}</span>}
            </p>
          </div>
        </Panel>

        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('common.status'), value: <StatusPill status={space.status} label={t(`spaces.status.${space.status}`)} /> },
              {
                label: t('spaces.kind'),
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <KindIcon kind={space.kind} className="h-4 w-4" />
                    {t(`spaces.kinds.${space.kind}`, { defaultValue: space.kind })}
                  </span>
                ),
              },
              { label: t('spaces.privacy'), value: t(`spaces.privacies.${space.privacy}`, { defaultValue: space.privacy }) },
              {
                label: t('spaces.owner'),
                value: (
                  <Link to={`/app-members/${space.owner_user_id}`} className="hover:text-accent hover:underline">
                    {space.owner_name ?? '—'}
                    {space.owner_handle ? <span className="ms-1.5 text-muted-foreground" dir="ltr">@{space.owner_handle}</span> : null}
                  </Link>
                ),
              },
              { label: t('spaces.members'), value: formatNumber(space.member_count, lang) },
              { label: t('spaces.pendingRequests'), value: formatNumber(space.pending_requests, lang) },
              { label: t('spaces.events'), value: formatNumber(space.event_count, lang) },
              {
                label: t('spaces.adminsCanCreateEvents'),
                value: space.admins_can_create_events ? t('common.yes') : t('common.no'),
              },
              { label: t('common.createdAt'), value: formatDate(space.created_at, lang, true) },
              ...(isDeleted ? [{ label: t('spaces.deletedAt'), value: formatDate(space.deleted_at, lang, true) }] : []),
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('spaces.members')} description={formatNumber(members.length, lang)}>
          {members.length ? (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <Avatar src={m.avatar_url} name={m.full_name} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/app-members/${m.user_id}`} className="line-clamp-1 text-sm font-medium hover:text-accent hover:underline">
                      {m.full_name ?? '—'}
                    </Link>
                    {m.handle ? <p className="text-xs text-muted-foreground" dir="ltr">@{m.handle}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                      {t(`spaces.memberRoles.${m.role}`, { defaultValue: m.role })}
                    </Badge>
                    {m.status !== 'active' ? (
                      <Badge variant="warning">{t(`spaces.memberStatus.${m.status}`, { defaultValue: m.status })}</Badge>
                    ) : null}
                    <span className="numeric text-xs text-muted-foreground" title={t('spaces.joinedAt')}>
                      {formatDate(m.joined_at, lang)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UsersRound} title={t('spaces.noMembers')} />
          )}
        </Panel>

        <Panel title={t('spaces.events')} description={formatNumber(events.length, lang)}>
          {events.length ? (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{e.title}</p>
                    <p className="numeric text-xs text-muted-foreground">
                      {formatDate(e.scheduled_start, lang, true)}
                      {e.host_name ? ` · ${e.host_name}` : ''}
                    </p>
                  </div>
                  <StatusPill status={e.status} label={t(`spaces.eventStatus.${e.status}`, { defaultValue: e.status })} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title={t('spaces.noEvents')} />
          )}
        </Panel>
      </div>

      {status.dialog}
    </>
  );
}
