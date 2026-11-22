import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, BadgeCheck, BookMarked, CalendarClock, MessageSquare, Pencil, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { formatDate, formatNumber } from '@/lib/utils';
import { DetailList, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { ActivityPanel } from '@/components/data/activity-list';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, CardContent, Skeleton } from '@/components/ui/primitives';

/** An event's status, in the vocabulary the app's Community tab shows a member. */
function eventState(status: string): 'live' | 'upcoming' | 'past' {
  return status === 'live' ? 'live' : status === 'ended' ? 'past' : 'upcoming';
}

/** Shared row chrome: a clickable strip if `to` is given, plain text otherwise. */
function ActivityRow({
  to, title, meta, trailing,
}: { to: string | null; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode }) {
  const navigate = useNavigate();
  const body = (
    <>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm">{title}</p>
        {meta ? <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {trailing ? <span className="numeric shrink-0 text-xs text-muted-foreground">{trailing}</span> : null}
    </>
  );
  if (!to) return <div className="flex items-start justify-between gap-3 px-2 py-2.5">{body}</div>;
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="-mx-2 flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-secondary/50"
    >
      {body}
    </button>
  );
}

/**
 * A page, whole — the read-first detail view a page never had before (`taxonomy-pages.tsx`
 * only offered a list and an edit form). Mirrors the shape of `AppMemberDetailPage`: an
 * identity card, its own details, its interests as chips, then every one of its
 * activities as a real openable list rather than the two bare counts the list row shows.
 */
export function PageDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const { data: page, isLoading } = useQuery({
    queryKey: ['pages', id],
    queryFn: () => api.get(`/pages/${id}`),
  });

  if (isLoading || !page) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></>;

  return (
    <>
      <PageHeader
        title={page.name}
        subtitle={page.handle ? `@${page.handle}` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can('page.manage') ? (
              <Button variant="outline" onClick={() => navigate(`/pages/${id}/edit`)}>
                <Pencil /> {t('actions.edit')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate('/pages')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        {page.cover_url ? (
          <img src={page.cover_url} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className="h-14 bg-gradient-to-r from-accent/15 via-secondary to-secondary" />
        )}
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5 pt-0">
          <div className="flex min-w-0 flex-wrap items-end gap-4">
            <Avatar src={page.avatar_url} name={page.name} className="-mt-9 h-20 w-20 border-4 border-card text-xl" />
            <div className="min-w-0 pb-0.5 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold leading-tight">{page.name}</h2>
                {page.verified ? (
                  <Badge variant="accent"><BadgeCheck className="h-3.5 w-3.5" /> {t('taxonomy.verified')}</Badge>
                ) : null}
                <Badge variant="secondary">{page.kind}</Badge>
              </div>
              {page.handle ? <p className="mt-1 text-sm text-muted-foreground" dir="ltr">@{page.handle}</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('common.author'), value: page.owner_name ?? '—' },
              {
                label: t('taxonomy.website'),
                value: page.website_url ? (
                  <a href={page.website_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" dir="ltr">
                    {page.website_url}
                  </a>
                ) : '—',
              },
              { label: t('common.createdAt'), value: formatDate(page.created_at, lang, true) },
              { label: t('taxonomy.items'), value: formatNumber(page.activity?.content ?? page.content_count ?? 0, lang) },
              { label: t('taxonomy.followers'), value: formatNumber(page.activity?.followers ?? page.follower_count ?? 0, lang) },
              { label: t('common.details'), value: (lang === 'ar' ? page.description : (page.description_en ?? page.description)) || '—' },
            ]}
          />
        </Panel>

        <Panel
          title={t('users.interests')}
          description={t('taxonomy.pagesTitle')}
        >
          <div className="flex flex-wrap gap-2">
            {(page.interests ?? []).length ? (
              page.interests.map((i: any) => (
                <Badge key={i.id} variant="secondary">{lang === 'ar' ? i.name : (i.name_en ?? i.name)}</Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.none')}</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <ActivityPanel<any>
          title={t('nav.posts')} icon={MessageSquare}
          count={page.activity?.posts ?? 0} queryKey={`page-${id}-posts`} path={`/pages/${id}/posts`}
          emptyLabel={t('users.member.activity.noPosts')}
          renderRow={(row) => (
            <ActivityRow
              to={`/posts/${row.id}`}
              title={row.body ?? <span className="text-muted-foreground">— {row.content_title} —</span>}
              meta={<>
                <StatusPill status={row.status} />
                <span>{row.author_name}</span>
                <span>· {formatDate(row.created_at, lang, true)}</span>
              </>}
              trailing={`${formatNumber(row.reaction_count, lang)} · ${formatNumber(row.comment_count, lang)}`}
            />
          )}
        />

        <ActivityPanel<any>
          title={t('nav.content')} icon={BookMarked}
          count={page.activity?.content ?? page.content_count ?? 0} queryKey={`page-${id}-content`} path={`/pages/${id}/content`}
          emptyLabel={t('users.member.activity.noContributions')}
          renderRow={(row) => (
            <ActivityRow
              to={`/content/item/${row.id}`}
              title={row.title}
              meta={<>
                <Badge variant="secondary">{t(`library.type.${row.content_type}`, { defaultValue: row.content_type })}</Badge>
                <StatusPill status={row.status} label={t(`library.status.${row.status}`, { defaultValue: row.status })} />
                <span>{formatDate(row.created_at, lang, true)}</span>
              </>}
            />
          )}
        />

        <ActivityPanel<any>
          title={t('nav.events')} icon={CalendarClock}
          count={page.activity?.events ?? 0} queryKey={`page-${id}-events`} path={`/pages/${id}/events`}
          emptyLabel={t('users.member.activity.noEventsHosted')}
          renderRow={(row) => (
            <ActivityRow
              to={`/events/${row.id}/edit`}
              title={row.title}
              meta={<>
                <StatusPill status={row.status} label={t(`events.states.${eventState(row.status)}`)} />
                <span>{formatDate(row.scheduled_start, lang, true)}</span>
              </>}
            />
          )}
        />

        <ActivityPanel<any>
          title={t('taxonomy.followers')} icon={Users}
          count={page.activity?.followers ?? page.follower_count ?? 0} queryKey={`page-${id}-followers`} path={`/pages/${id}/followers`}
          emptyLabel={t('users.member.noFollowers')}
          renderRow={(row) => (
            <ActivityRow
              to={`/app-members/${row.follower_id}`}
              title={row.full_name ?? '—'}
              meta={row.handle ? <span dir="ltr">@{row.handle}</span> : undefined}
            />
          )}
        />
      </div>
    </>
  );
}
