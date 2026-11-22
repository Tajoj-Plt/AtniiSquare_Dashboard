import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Ban, BadgeCheck, BookMarked, CalendarClock, Heart, MapPin,
  MessageSquare, RotateCcw, Shapes, ShieldCheck, Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { DetailList, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { ActivityPanel } from '@/components/data/activity-list';
import { targetRoute } from '@/lib/activity-targets';
import { InterestPicker } from '@/features/taxonomy/crud-form';
import { CountrySelect } from '@/components/data/country-select';
import { countryFlag, countryName } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, CardContent, Field, Input, Skeleton } from '@/components/ui/primitives';
import { ConfirmDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';

/**
 * One app member, whole — identity, contribution class, demographics, interests, the
 * app's own social graph, settings and onboarding progress. This is the rich detail
 * view built in an earlier pass for the combined `/users/:id`; it has not been rebuilt,
 * only repointed at `/app-members/:id` and stripped of the two things that never
 * applied to a member in the first place — a role picker and API tokens — now that
 * members are addressed on their own surface (see db/16_account_kind.sql).
 */
export function AppMemberDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;
  const [editingInterests, setEditingInterests] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [editingDemographics, setEditingDemographics] = React.useState(false);
  const [demo, setDemo] = React.useState<Record<string, string>>({});
  const [suspending, setSuspending] = React.useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['appMembers', id],
    queryFn: () => api.get(`/app-members/${id}`),
  });

  React.useEffect(() => {
    if (user) {
      setPicked((user.interests ?? []).map((i: any) => i.id));
      setDemo({
        sex: user.sex ?? '',
        birth_date: user.birth_date ? String(user.birth_date).slice(0, 10) : '',
        country: user.country ?? '',
        town: user.town ?? '',
        village: user.village ?? '',
      });
    }
  }, [user]);

  const invalidate = [['appMembers', id!], ['appMembers']];

  const setStatus = useApiMutation(
    (status: 'active' | 'suspended') => api.post(`/app-members/${id}/status`, { status }),
    { successMessage: t('users.updated'), invalidate, onSuccess: () => setSuspending(false) },
  );

  const setDeactivated = useApiMutation(
    (deactivated: boolean) => api.post(`/app-members/${id}/deactivate`, { deactivated }),
    { successMessage: t('users.updated'), invalidate },
  );

  const saveDemographics = useApiMutation(
    () => api.patch(`/app-members/${id}`, {
      sex: demo.sex || null,
      birth_date: demo.birth_date || null,
      country: demo.country || null,
      town: demo.town.trim() || null,
      village: demo.village.trim() || null,
    }),
    { successMessage: t('users.demographics.saved'), invalidate, onSuccess: () => setEditingDemographics(false) },
  );

  const saveInterests = useApiMutation(
    () => api.patch(`/app-members/${id}`, { interest_ids: picked }),
    { successMessage: t('users.interestsUpdated'), invalidate, onSuccess: () => setEditingInterests(false) },
  );

  if (isLoading || !user) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></>;

  return (
    <>
      <PageHeader
        title={user.full_name ?? user.email ?? '—'}
        subtitle={user.handle ? `@${user.handle}` : (user.email ?? user.phone ?? undefined)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can('user.manage') && user.status === 'active' ? (
              <Button variant="outline" onClick={() => setSuspending(true)}><Ban /> {t('actions.suspend')}</Button>
            ) : null}
            {can('user.manage') && user.status !== 'active' ? (
              <Button variant="outline" onClick={() => setStatus.mutate('active')} loading={setStatus.isPending}>
                <ShieldCheck /> {t('actions.restore')}
              </Button>
            ) : null}
            {can('user.manage') ? (
              user.deactivated_at ? (
                <Button variant="outline" onClick={() => setDeactivated.mutate(false)} loading={setDeactivated.isPending}>
                  <RotateCcw /> {t('users.member.reactivateAccount')}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDeactivated.mutate(true)} loading={setDeactivated.isPending}>
                  <Ban /> {t('users.member.deactivateAccount')}
                </Button>
              )
            ) : null}
            <Button variant="outline" onClick={() => navigate('/app-members')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
          </div>
        }
      />

      <IdentityCard user={user} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('common.email'), value: <span dir="ltr">{user.email ?? '—'}</span> },
              { label: t('common.phone'), value: <span dir="ltr">{user.phone ?? '—'}</span> },
              { label: t('settings.language'), value: user.locale?.toUpperCase() },
              { label: t('users.lastLogin'), value: formatDate(user.last_login_at, lang, true) },
              { label: t('common.createdAt'), value: formatDate(user.created_at, lang, true) },
              { label: t('nav.enrollments'), value: user.activity?.enrollments ?? 0 },
              { label: t('users.member.bio'), value: user.bio ?? '—' },
            ]}
          />
        </Panel>

        <MemberProfilePanel user={user} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSettingsPanel settings={user.member?.settings} />
        <SocialGraphPanel social={user.member?.social} />
      </div>

      {/*
        The former MetricRow showed four bare numbers here. Every one of them opens now:
        the header carries the real count, and expanding it fetches the real rows behind
        it — each one a link to the actual post, content item, event or comment.
      */}
      <MemberActivitySections id={id!} activity={user.activity} />

      <Panel
        title={t('users.demographics.title')}
        description={t('users.demographics.subtitle')}
        actions={
          can('user.manage') ? (
            <Button variant="outline" size="sm" onClick={() => setEditingDemographics((v) => !v)}>
              <MapPin /> {editingDemographics ? t('actions.cancel') : t('actions.edit')}
            </Button>
          ) : null
        }
      >
        {editingDemographics ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('users.demographics.sex')}>
                <Select
                  value={demo.sex || 'unknown'}
                  onValueChange={(v) => setDemo((d) => ({ ...d, sex: v === 'unknown' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">{t('users.demographics.notStated')}</SelectItem>
                    <SelectItem value="male">{t('users.demographics.male')}</SelectItem>
                    <SelectItem value="female">{t('users.demographics.female')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('users.demographics.birthDate')}>
                <Input
                  type="date" dir="ltr"
                  max={new Date().toISOString().slice(0, 10)}
                  value={demo.birth_date}
                  onChange={(e) => setDemo((d) => ({ ...d, birth_date: e.target.value }))}
                />
              </Field>
              <Field className="md:col-span-2" label={t('users.demographics.country')}>
                <CountrySelect
                  value={demo.country}
                  onChange={(code) => setDemo((d) => ({ ...d, country: code ?? '' }))}
                />
              </Field>
              <Field label={t('users.demographics.town')}>
                <Input value={demo.town} onChange={(e) => setDemo((d) => ({ ...d, town: e.target.value }))} />
              </Field>
              <Field label={t('users.demographics.village')}>
                <Input value={demo.village} onChange={(e) => setDemo((d) => ({ ...d, village: e.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button loading={saveDemographics.isPending} onClick={() => saveDemographics.mutate(undefined)}>
                {t('actions.save')}
              </Button>
            </div>
          </div>
        ) : (
          <DetailList
            items={[
              {
                label: t('users.demographics.sex'),
                value: user.sex
                  ? t(`users.demographics.${user.sex}`)
                  : <span className="text-muted-foreground">{t('users.demographics.notStated')}</span>,
              },
              {
                label: t('users.demographics.birthDate'),
                value: user.birth_date ? (
                  <span>
                    {formatDate(user.birth_date, lang)}
                    {user.age != null ? (
                      <span className="ms-2 text-muted-foreground">
                        · {t('users.demographics.yearsOld', { count: user.age })}
                      </span>
                    ) : null}
                  </span>
                ) : <span className="text-muted-foreground">—</span>,
              },
              {
                label: t('users.demographics.country'),
                value: user.country
                  ? <span>{countryFlag(user.country)} {countryName(user.country, lang)}</span>
                  : <span className="text-muted-foreground">—</span>,
              },
              { label: t('users.demographics.town'), value: user.town || '—' },
              { label: t('users.demographics.village'), value: user.village || '—' },
            ]}
          />
        )}
      </Panel>

      <Panel
        title={t('users.interests')}
        description={t('users.interestsHint')}
        actions={
          can('user.manage') ? (
            <Button variant="outline" size="sm" onClick={() => setEditingInterests((v) => !v)}>
              <Shapes /> {editingInterests ? t('actions.cancel') : t('actions.edit')}
            </Button>
          ) : null
        }
      >
        {editingInterests ? (
          <div className="space-y-3">
            <InterestPicker value={picked} max={20} onChange={setPicked} />
            <Button size="sm" loading={saveInterests.isPending} onClick={() => saveInterests.mutate(undefined)}>
              {t('actions.save')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(user.interests ?? []).length ? (
              user.interests.map((i: any) => (
                <Badge key={i.id} variant="secondary">{lang === 'ar' ? i.name : (i.name_en ?? i.name)}</Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.none')}</p>
            )}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={suspending}
        onOpenChange={setSuspending}
        title={t('users.suspendTitle')}
        description={t('users.suspendBody')}
        confirmLabel={t('actions.suspend')}
        cancelLabel={t('actions.cancel')}
        loading={setStatus.isPending}
        onConfirm={() => setStatus.mutate('suspended')}
      />
    </>
  );
}

const CLASS_TONE: Record<string, string> = {
  blue_star: 'bg-accent/10 text-accent',
  silver: 'bg-muted text-muted-foreground',
  gold: 'bg-warning/15 text-warning',
};

/**
 * The member as the app shows them: cover, avatar, name, @handle, verification, account
 * status — with the contribution class beside it. Everything degrades: a member with no
 * cover gets a quiet band, no class row hides the chip rather than inventing one.
 */
function IdentityCard({ user }: { user: any }) {
  const { t } = useTranslation();
  const cls = user.member?.class;
  return (
    <Card className="overflow-hidden">
      {user.cover_url ? (
        <img src={user.cover_url} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="h-14 bg-gradient-to-r from-accent/15 via-secondary to-secondary" />
      )}
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5 pt-0">
        <div className="flex min-w-0 flex-wrap items-end gap-4">
          <Avatar
            src={user.avatar_url}
            name={user.full_name}
            className="-mt-9 h-20 w-20 border-4 border-card text-xl"
          />
          <div className="min-w-0 pb-0.5 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold leading-tight">{user.full_name ?? user.email ?? '—'}</h2>
              {user.verified ? (
                <Badge variant="accent">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t('users.member.verified')}
                </Badge>
              ) : null}
              <StatusPill status={user.status} label={t(`users.status.${user.status}`)} />
              {user.deactivated_at ? <Badge variant="danger">{t('users.member.deactivated')}</Badge> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {user.handle ? <span dir="ltr">@{user.handle}</span> : null}
            </div>
          </div>
        </div>
        {cls ? (
          <div className={cn('flex items-center gap-2.5 rounded-2xl px-4 py-2.5', CLASS_TONE[cls.user_class] ?? CLASS_TONE.blue_star)}>
            <Star className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold leading-tight">{t(`appControl.userClass.${cls.user_class}`)}</p>
              <p className="text-xs opacity-80">
                {t('users.member.contributions', { count: cls.contributions })}
                {cls.next_class_at != null ? ` · ${t('users.member.nextClassAt', { count: cls.next_class_at })}` : ''}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The member-side facts an operator cannot edit here: handle, academic titles, how the
 * account signs in, and where onboarding stopped.
 */
function MemberProfilePanel({ user }: { user: any }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const member = user.member ?? {};
  const onboarding = member.onboarding;
  return (
    <Panel title={t('users.member.title')} description={t('users.member.subtitle')}>
      <DetailList
        items={[
          {
            label: t('users.member.handle'),
            value: user.handle
              ? <span dir="ltr">@{user.handle}</span>
              : <span className="text-muted-foreground">{t('users.member.noHandle')}</span>,
          },
          {
            label: t('users.member.academicTitles'),
            value: (user.academic_titles ?? []).length ? (
              <span className="flex flex-wrap gap-1.5">
                {user.academic_titles.map((title: string) => (
                  <Badge key={title} variant="secondary">{t(`appReports.titles.${title}`)}</Badge>
                ))}
              </span>
            ) : <span className="text-muted-foreground">{t('users.member.noTitles')}</span>,
          },
          {
            label: t('users.member.providers'),
            value: (member.providers ?? []).length ? (
              <span className="flex flex-wrap gap-1.5">
                {member.providers.map((p: any) => (
                  <Badge key={p.provider} variant="outline">
                    {t(`appReports.providers.${p.provider}`, { defaultValue: p.provider })}
                    <span className="font-normal text-muted-foreground">
                      · {t('users.member.linkedAt', { date: formatDate(p.linked_at, lang) })}
                    </span>
                  </Badge>
                ))}
              </span>
            ) : <span className="text-muted-foreground">{t('users.member.passwordOnly')}</span>,
          },
          {
            label: t('users.member.onboarding'),
            value: onboarding?.finished ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{t('users.member.onboardingDone')}</Badge>
                <span className="text-muted-foreground">{formatDate(onboarding.completed_at, lang, true)}</span>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{t('users.member.onboardingNotDone')}</Badge>
                <span className="text-muted-foreground">
                  {t('users.member.reachedStep', {
                    step: t(`users.member.steps.${onboarding?.reached ?? 'account'}`),
                  })}
                </span>
              </span>
            ),
          },
          {
            label: t('users.member.accountState'),
            value: user.deactivated_at ? (
              <span className="text-danger">
                {t('users.member.deactivatedOn', { date: formatDate(user.deactivated_at, lang, true) })}
              </span>
            ) : t('users.member.active'),
          },
        ]}
      />
    </Panel>
  );
}

/** The switches the member owns in the app. No row in `user_settings` means "all defaults". */
function AppSettingsPanel({ settings }: { settings: any }) {
  const { t } = useTranslation();
  const KEYS = ['notifications', 'show_activity', 'show_contributions', 'show_interests'] as const;
  return (
    <Panel title={t('users.member.settings')} description={t('users.member.settingsHint')}>
      {!settings ? (
        <p className="mb-3 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
          {t('users.member.settingsDefaults')}
        </p>
      ) : null}
      <dl className="divide-y text-sm">
        {KEYS.map((key) => {
          const on = settings ? Boolean(settings[key]) : true;
          return (
            <div key={key} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted-foreground">{t(`users.member.setting.${key}`)}</dt>
              <dd>
                <Badge variant={on ? 'success' : 'muted'}>{t(on ? 'users.member.on' : 'users.member.off')}</Badge>
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

/** One person or page in a follow sample: avatar, name, verification and @handle. */
function FollowEntity({ entity }: { entity: any }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-2.5 py-2">
      <Avatar src={entity.avatar_url} name={entity.name} className="h-8 w-8" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{entity.name ?? '—'}</span>
          {entity.verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
          {entity.type === 'page' ? <Badge variant="muted">{t('users.member.page')}</Badge> : null}
        </span>
        {entity.handle ? (
          <span className="block truncate text-xs text-muted-foreground">
            <span dir="ltr">@{entity.handle}</span>
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** Following and followers: the counts, and a recent sample of each side. */
function SocialGraphPanel({ social }: { social: any }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const sides = [
    { key: 'following', count: social?.following ?? 0, sample: social?.following_sample ?? [], empty: 'noFollowing' },
    { key: 'followers', count: social?.followers ?? 0, sample: social?.followers_sample ?? [], empty: 'noFollowers' },
  ];
  return (
    <Panel title={t('users.member.social')} description={t('users.member.socialHint')}>
      <div className="grid gap-6 sm:grid-cols-2">
        {sides.map((side) => (
          <div key={side.key}>
            <p className="flex items-baseline gap-2 text-sm font-semibold">
              {t(`users.member.${side.key}`)}
              <span className="numeric text-lg">{formatNumber(side.count, lang)}</span>
            </p>
            {side.sample.length ? (
              <ul className="mt-1 divide-y">
                {side.sample.map((entity: any) => (
                  <FollowEntity key={`${entity.type}:${entity.id}`} entity={entity} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t(`users.member.${side.empty}`)}</p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

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
  if (!to) {
    return <div className="flex items-start justify-between gap-3 px-2 py-2.5">{body}</div>;
  }
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
 * Every one of the member's interactions, as real openable lists rather than counts —
 * the point of this whole change. Each section is collapsed by default and fetches only
 * once opened; every row links to the actual post, content item, event or comment.
 */
function MemberActivitySections({ id, activity }: { id: string; activity: any }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="space-y-3">
      <ActivityPanel<any>
        title={t('users.member.activity.posts')} icon={MessageSquare}
        count={activity?.posts ?? 0} queryKey={`member-${id}-posts`} path={`/app-members/${id}/posts`}
        emptyLabel={t('users.member.activity.noPosts')}
        renderRow={(row) => (
          <ActivityRow
            to={`/posts/${row.id}`}
            title={row.body ?? <span className="text-muted-foreground">— {row.content_title} —</span>}
            meta={<>
              <StatusPill status={row.status} />
              <span>{formatDate(row.created_at, lang, true)}</span>
            </>}
            trailing={`${formatNumber(row.reaction_count, lang)} · ${formatNumber(row.comment_count, lang)}`}
          />
        )}
      />

      <ActivityPanel<any>
        title={t('users.member.activity.comments')} icon={MessageSquare}
        count={activity?.comments ?? 0} queryKey={`member-${id}-comments`} path={`/app-members/${id}/comments`}
        emptyLabel={t('users.member.activity.noComments')}
        renderRow={(row) => (
          <ActivityRow
            to={targetRoute(row.target_type, row.target_id)}
            title={row.body}
            meta={<>
              <span>{t('users.member.activity.onTarget', { title: row.target_title ?? t('users.member.activity.removedTarget') })}</span>
              <span>· {formatDate(row.created_at, lang, true)}</span>
            </>}
          />
        )}
      />

      <ActivityPanel<any>
        title={t('users.member.activity.contributions')} icon={BookMarked}
        count={activity?.content ?? 0} queryKey={`member-${id}-contributions`} path={`/app-members/${id}/contributions`}
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
        title={t('users.member.activity.eventsHosted')} icon={CalendarClock}
        count={activity?.hosted_events ?? 0} queryKey={`member-${id}-events`} path={`/app-members/${id}/events`}
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
        title={t('users.member.activity.eventsReminders')} icon={CalendarClock}
        count={activity?.event_reminders ?? 0} queryKey={`member-${id}-reminders`} path={`/app-members/${id}/reminders`}
        emptyLabel={t('users.member.activity.noReminders')}
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
        title={t('users.member.activity.other')} icon={Heart}
        count={(activity?.reactions ?? 0) + (activity?.bookmarks ?? 0) + (activity?.shares ?? 0)}
        queryKey={`member-${id}-interactions`} path={`/app-members/${id}/interactions`}
        emptyLabel={t('users.member.activity.noInteractions')}
        renderList={(rows) => {
          // Grouped by what was interacted with — "other interactions" reads as a picture
          // of where this member spends their attention, not one undifferentiated feed.
          const groups = new Map<string, any[]>();
          for (const row of rows) {
            const key = row.target_type ?? 'other';
            groups.set(key, [...(groups.get(key) ?? []), row]);
          }
          return (
            <div className="space-y-4">
              {[...groups.entries()].map(([type, groupRows]) => (
                <div key={type}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`users.member.activity.group${type.replace(/(^|_)([a-z])/g, (_m, _p, c) => c.toUpperCase())}`,
                      { defaultValue: t('users.member.activity.groupOther') })}
                  </p>
                  <ul className="divide-y">
                    {groupRows.map((row) => (
                      <li key={row.id}>
                        <ActivityRow
                          to={targetRoute(row.target_type, row.target_id)}
                          title={row.target_title ?? t('users.member.activity.removedTarget')}
                          meta={<>
                            <Badge variant="outline">{t(`users.member.activity.kinds.${row.kind}`, { defaultValue: row.kind })}</Badge>
                            <span>{formatDate(row.created_at, lang, true)}</span>
                          </>}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
}
