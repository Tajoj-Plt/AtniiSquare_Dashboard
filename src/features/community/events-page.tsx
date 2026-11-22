import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell, CalendarClock, Headphones, MapPin, Pencil, Plus, Radio, Video, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useListQuery } from '@/lib/hooks';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader, StatusPill } from '@/components/data/page-parts';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CrudFormPage, type CrudConfig } from '@/features/taxonomy/crud-form';

/**
 * Events — what the app's Community tab calls the live rooms it lists.
 *
 * The table underneath is still `live_rooms`, and the API still speaks of a room's
 * `status`, but a member never sees either word: the phone shows an event that is live,
 * upcoming or past. This screen uses the member's vocabulary and translates at the edge,
 * so an editor scheduling something reads the same labels as the person who will attend it.
 */

/**
 * The app's three event states, and the room status each one is stored as.
 *
 * `mobile-events.service.ts` maps them in exactly this direction when it builds a card;
 * reversing the same table here is what keeps a dashboard filter and an app tab selecting
 * the same events.
 */
const STATE_STATUS: Record<string, string> = {
  live: 'live',
  upcoming: 'scheduled',
  past: 'ended',
};

/** A room status as the state the app would draw it in. */
function stateOf(status: string): 'live' | 'upcoming' | 'past' {
  return status === 'live' ? 'live' : status === 'ended' ? 'past' : 'upcoming';
}

/** Whether an event is carried as video or as audio — the app badges the two differently. */
const EVENT_TYPES = ['video', 'audio'] as const;

/**
 * The shared description of an event: used by the list's create button and by the form.
 *
 * The fields are the ones an event card on the phone actually draws — its cover, what it
 * is called, whether it is video or audio, when it starts, who hosts it, where it is and
 * what subject it belongs to. Everything else about a room (its LiveKit name, who joined,
 * when it really started) is the running of the event, not the publishing of it.
 */
function useEventConfig(): CrudConfig {
  const { t } = useTranslation();

  return {
    queryKey: 'rooms',
    path: '/rooms',
    route: '/events',
    title: t('events.title'),
    subtitle: t('events.subtitle'),
    tone: 'rose',
    icon: CalendarClock,
    writePermission: 'room.host',
    createLabel: t('events.newEvent'),
    fields: [
      /* --- what it is ------------------------------------------------- */
      {
        name: 'cover_media_id', label: t('events.cover'), type: 'file',
        surface: 'cover', accept: ['image/jpeg', 'image/png', 'image/webp'],
        maxBytes: 10 * 1024 * 1024, preview: 'image', hint: t('events.coverHint'),
        group: t('events.groups.about'),
      },
      { name: 'title', label: t('common.title'), required: true, colSpan: 2 },
      { name: 'description', label: t('events.description'), type: 'textarea', colSpan: 2 },
      {
        name: 'event_type', label: t('events.type'), type: 'select',
        options: EVENT_TYPES.map((v) => ({ value: v, label: t(`events.types.${v}`) })),
        hint: t('events.typeHint'),
      },
      { name: 'location', label: t('events.location'), placeholder: t('events.locationPlaceholder') },

      /* --- when, and who runs it -------------------------------------- */
      {
        name: 'scheduled_start', label: t('events.startsAt'), type: 'datetime', required: true,
        group: t('events.groups.when'), hint: t('events.startsAtHint'),
      },
      {
        name: 'host_user_id', label: t('events.host'), type: 'lookup',
        lookupPath: '/users', lookupLabel: 'full_name', hint: t('events.hostHint'),
      },
      {
        name: 'topic_interest_id', label: t('events.topic'), type: 'lookup',
        lookupPath: '/interests', lookupLabel: 'name', hint: t('events.topicHint'),
      },
      { name: 'max_participants', label: t('events.maxParticipants'), type: 'number' },
    ],
  };
}

/** The events list, in the app's words. */
export function EventsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListQuery<any>('rooms', '/rooms', { sort: '-scheduled_start' });

  const setStatus = useApiMutation(
    (vars: { id: string; status: string }) => api.post(`/rooms/${vars.id}/status`, { status: vars.status }),
    { successMessage: t('library.updated'), invalidate: [['rooms']], onSuccess: () => list.refresh() },
  );

  // The filter reads in the app's vocabulary and is sent as the status the API stores.
  const activeState = Object.keys(STATE_STATUS)
    .find((s) => STATE_STATUS[s] === list.state.filter.status) ?? 'all';

  const columns: Column<any>[] = [
    {
      key: 'title',
      header: t('common.title'),
      className: 'max-w-[26rem]',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          {row.cover_url ? (
            <img
              src={row.cover_url} alt=""
              className="h-10 w-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="grid h-10 w-16 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
              {row.event_type === 'audio'
                ? <Headphones className="h-4 w-4" />
                : <Video className="h-4 w-4" />}
            </span>
          )}
          <div className="min-w-0">
            <p className="line-clamp-1 font-medium">{row.title}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {row.host_name ?? '—'}
              {row.location ? (
                <span className="inline-flex items-center gap-1 ms-1.5">
                  <MapPin className="h-3 w-3" />{row.location}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ),
      exportValue: (row) => row.title,
    },
    {
      key: 'event_type',
      header: t('events.type'),
      hideBelow: 'md',
      cell: (row) => (
        <Badge variant="secondary" className="whitespace-nowrap">
          {t(`events.types.${row.event_type ?? 'video'}`, { defaultValue: row.event_type })}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: t('events.state'),
      cell: (row) => {
        const state = stateOf(row.status);
        return (
          <StatusPill
            status={state === 'live' ? 'published' : state === 'past' ? 'archived' : 'pending_review'}
            label={t(`events.states.${state}`)}
          />
        );
      },
    },
    {
      key: 'scheduled_start',
      header: t('events.startsAt'),
      sortable: true,
      hideBelow: 'sm',
      className: 'numeric whitespace-nowrap text-muted-foreground',
      cell: (row) => formatDate(row.scheduled_start, i18n.language, true),
    },
    {
      key: 'topic_name',
      header: t('library.fields.interests'),
      hideBelow: 'xl',
      cell: (row) => row.topic_name ?? '—',
    },
    {
      key: 'active_participants',
      header: t('events.attendees'),
      className: 'numeric',
      hideBelow: 'lg',
      cell: (row) =>
        `${formatNumber(row.active_participants, i18n.language)} / ${formatNumber(row.total_participants, i18n.language)}`,
    },
    {
      key: 'reminder_count',
      header: t('events.reminders'),
      className: 'numeric',
      hideBelow: 'lg',
      cell: (row) => (
        <span className={cn('inline-flex items-center gap-1', !row.reminder_count && 'text-muted-foreground')}>
          <Bell className="h-3.5 w-3.5" />
          {formatNumber(row.reminder_count, i18n.language)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={CalendarClock}
        tone="rose"
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        actions={
          can('room.host') ? (
            <Button onClick={() => navigate('/events/new')}>
              <Plus /> {t('events.newEvent')}
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="events"
        emptyTitle={t('events.empty')}
        filters={
          <>
            <Select
              value={activeState}
              onValueChange={(v) => list.setFilter('status', v === 'all' ? 'all' : STATE_STATUS[v])}
            >
              <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('events.state')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {Object.keys(STATE_STATUS).map((s) => (
                  <SelectItem key={s} value={s}>{t(`events.states.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={list.state.filter.event_type ?? 'all'}
              onValueChange={(v) => list.setFilter('event_type', v)}
            >
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('events.type')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {EVENT_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>{t(`events.types.${v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {Object.keys(list.state.filter).length ? (
              <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
            ) : null}
          </>
        }
        rowActions={[
          {
            label: t('actions.edit'), icon: Pencil,
            onSelect: (row) => navigate(`/events/${row.id}/edit`),
            hidden: () => !can('room.host'),
          },
          {
            label: t('events.goLive'), icon: Radio,
            onSelect: (row) => setStatus.mutate({ id: row.id, status: 'live' }),
            hidden: (row) => !can('room.host') || row.status !== 'scheduled',
          },
          {
            label: t('events.endEvent'), icon: XCircle, destructive: true,
            onSelect: (row) => setStatus.mutate({ id: row.id, status: 'ended' }),
            hidden: (row) => !can('room.host') || row.status !== 'live',
          },
        ]}
      />
    </>
  );
}

/** Create and edit, on their own route — like every other resource in the dashboard. */
export function EventFormPage() {
  return <CrudFormPage config={useEventConfig()} />;
}
