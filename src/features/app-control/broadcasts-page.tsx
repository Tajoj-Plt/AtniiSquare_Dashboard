import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, Megaphone, Plus, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { formatDate, formatNumber } from '@/lib/utils';
import { countryName } from '@/lib/countries';
import { DetailList, EmptyState, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import {
  Badge, Field, Input, Skeleton, Textarea,
} from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { AppControlTabs, CsvButton, QueryError } from './app-control-parts';

interface Broadcast {
  id: string;
  title_ar: string; title_en: string | null;
  body_ar: string; body_en: string | null;
  channel: 'push' | 'in_app' | 'both';
  segment: Record<string, string>;
  deep_link: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  audience_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
  created_by_name: string | null;
}

const LIST_KEY = ['app-control', 'broadcasts'];

/** The segment controls, declared once so the composer and the audience preview agree. */
const ACTIVITY_OPTIONS = ['active_7d', 'active_30d', 'dormant_30d', 'dormant_90d', 'never'];
const CLASS_OPTIONS = ['blue_star', 'silver', 'gold'];

/**
 * Broadcasts: compose once, send to everyone or to a segment, and keep the receipt.
 *
 * The audience is counted live while the segment is being built, because "to everyone" and
 * "to eleven people" are very different decisions and the only way to tell them apart
 * before pressing Send is to be told the number. Sending is irreversible, so it is behind a
 * confirmation that repeats that number back.
 */
export function AppBroadcastsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;
  const writable = can('app.broadcast.send');

  const list = useQuery<Broadcast[]>({ queryKey: LIST_KEY, queryFn: () => api.get('/app-control/broadcasts') });
  const rows = list.data ?? [];

  const [composing, setComposing] = React.useState(false);
  const [detail, setDetail] = React.useState<Broadcast | null>(null);
  const [sending, setSending] = React.useState<Broadcast | null>(null);
  const [cancelling, setCancelling] = React.useState<Broadcast | null>(null);

  const send = useApiMutation(
    () => api.post(`/app-control/broadcasts/${sending!.id}/send`),
    {
      invalidate: [LIST_KEY],
      onSuccess: (res: any) => {
        setSending(null);
        // The push half is logged rather than delivered until credentials exist. Saying so
        // at the moment of sending is the only place it cannot be missed.
        toastForSend(res, t);
      },
    },
  );

  const cancel = useApiMutation(
    () => api.post(`/app-control/broadcasts/${cancelling!.id}/cancel`),
    { successMessage: t('appControl.broadcasts.cancelled'), invalidate: [LIST_KEY], onSuccess: () => setCancelling(null) },
  );

  return (
    <>
      <PageHeader
        icon={Megaphone}
        tone="orange"
        title={t('appControl.broadcasts.title')}
        subtitle={t('appControl.broadcasts.subtitle')}
        actions={
          writable ? (
            <Button onClick={() => setComposing(true)}><Plus /> {t('appControl.broadcasts.new')}</Button>
          ) : null
        }
      />

      <AppControlTabs active="broadcasts" />

      <Panel
        title={t('appControl.broadcasts.title')}
        description={t('appControl.broadcasts.hint')}
        actions={<CsvButton name="app-broadcasts" rows={rows} columns={[
          { key: 'created_at', header: 'created' }, { key: 'title_en', header: 'title' },
          { key: 'status', header: 'status' }, { key: 'channel', header: 'channel' },
          { key: 'audience_count', header: 'audience' }, { key: 'delivered_count', header: 'delivered' },
          { key: 'failed_count', header: 'failed' },
        ]} />}
      >
        {list.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : list.error ? (
          <QueryError error={list.error as Error} onRetry={() => void list.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={Megaphone}
            title={t('appControl.broadcasts.empty')}
            hint={t('appControl.broadcasts.emptyHint')}
            action={writable ? <Button onClick={() => setComposing(true)}><Plus /> {t('appControl.broadcasts.new')}</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-full min-w-0 sm:flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="w-full truncate text-start font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                      onClick={() => setDetail(row)}
                    >
                      {lang === 'ar' ? row.title_ar : (row.title_en ?? row.title_ar)}
                    </button>
                    <StatusPill status={row.status} label={t(`appControl.broadcastStatus.${row.status}`)} />
                    <Badge variant="muted">{t(`appControl.channels.${row.channel}`)}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {lang === 'ar' ? row.body_ar : (row.body_en ?? row.body_ar)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.sent_at
                      ? `${t('appControl.broadcasts.sentAt')} ${formatDate(row.sent_at, lang, true)}`
                      : row.scheduled_for
                        ? `${t('appControl.broadcasts.scheduledFor')} ${formatDate(row.scheduled_for, lang, true)}`
                        : `${t('common.createdAt')} ${formatDate(row.created_at, lang, true)}`}
                    {row.created_by_name ? ` · ${row.created_by_name}` : ''}
                  </p>
                </div>

                <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
                  <span className="numeric text-sm text-muted-foreground">
                    <Users className="me-1 inline h-3.5 w-3.5" />
                    {formatNumber(row.audience_count, lang)}
                  </span>
                  {row.status === 'sent' ? (
                    <span className="numeric text-sm text-success">
                      {formatNumber(row.delivered_count, lang)}
                    </span>
                  ) : null}
                  {writable && (row.status === 'draft' || row.status === 'scheduled') ? (
                    <>
                      <Button size="sm" onClick={() => setSending(row)}><Send /> {t('actions.send')}</Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t('actions.cancel')} onClick={() => setCancelling(row)}>
                        <Ban className="h-4 w-4 text-danger" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>{t('actions.view')}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {composing ? <ComposeDialog onClose={() => setComposing(false)} /> : null}
      {detail ? <BroadcastDetailDialog id={detail.id} onClose={() => setDetail(null)} /> : null}

      <ConfirmDialog
        open={Boolean(sending)}
        onOpenChange={(open) => !open && setSending(null)}
        title={t('appControl.broadcasts.sendTitle')}
        description={t('appControl.broadcasts.sendBody', {
          value: formatNumber(sending?.audience_count ?? 0, lang),
        })}
        confirmLabel={t('actions.send')}
        cancelLabel={t('actions.cancel')}
        destructive={false}
        loading={send.isPending}
        onConfirm={() => send.mutate(undefined)}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t('appControl.broadcasts.cancelTitle')}
        description={t('appControl.broadcasts.cancelBody')}
        confirmLabel={t('actions.confirm')}
        cancelLabel={t('actions.cancel')}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined)}
      />
    </>
  );
}

/**
 * Report what actually happened, including the half that only reached a log file.
 *
 * The send response carries which transport handled it. While push has no credentials the
 * in-app copy is the only one that reached anyone, and a plain "sent" toast would be a
 * quiet lie — so that case gets a warning that says which half went out.
 */
function toastForSend(res: any, t: (k: string, o?: any) => string) {
  if (res?.pushConfigured === false && (res?.channel === 'push' || res?.channel === 'both')) {
    toast.warning(t('appControl.broadcasts.pushNotConfigured'), {
      description: t('appControl.broadcasts.pushNotConfiguredHint'),
    });
  } else {
    toast.success(t('appControl.broadcasts.sent'));
  }
}

/** Compose a broadcast: both languages, a channel, a segment and an optional schedule. */
function ComposeDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const form = useForm({
    title_ar: '', title_en: '', body_ar: '', body_en: '',
    channel: 'both', deep_link: '', scheduled_for: '',
    interest_id: 'all', country: 'all', user_class: 'all', activity: 'all', platform: 'all',
  });

  const { data: interests } = useQuery<any[]>({
    queryKey: ['app-control', 'curation', 'interests'],
    queryFn: () => api.get('/app-control/curation/interests'),
    staleTime: 5 * 60_000,
  });

  /** Only the narrowed fields travel; "all" is the absence of a filter, not a value. */
  const segment = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const field of ['interest_id', 'country', 'user_class', 'activity', 'platform'] as const) {
      const value = form.values[field];
      if (value && value !== 'all') out[field] = value;
    }
    return out;
  }, [form.values]);

  const audience = useQuery<{ members: number; pushable: number; pushConfigured: boolean }>({
    queryKey: ['app-control', 'broadcasts', 'audience', segment],
    queryFn: () => api.post('/app-control/broadcasts/audience', segment),
  });

  const save = useApiMutation(
    (andSend: boolean) =>
      api.post('/app-control/broadcasts', {
        title_ar: form.values.title_ar,
        title_en: form.values.title_en || undefined,
        body_ar: form.values.body_ar,
        body_en: form.values.body_en || undefined,
        channel: form.values.channel,
        deep_link: form.values.deep_link || undefined,
        segment,
        scheduled_for: form.values.scheduled_for
          ? new Date(form.values.scheduled_for).toISOString()
          : undefined,
      }).then(async (created: any) => (andSend ? api.post(`/app-control/broadcasts/${created.id}/send`) : created)),
    {
      successMessage: t('appControl.broadcasts.saved'),
      invalidate: [LIST_KEY],
      onSuccess: onClose,
    },
  );

  const countries = React.useMemo(
    () => ['SD', 'EG', 'SA', 'AE', 'QA', 'GB', 'US'].map((c) => ({ code: c, name: countryName(c, lang) })),
    [lang],
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{t('appControl.broadcasts.new')}</DialogTitle></DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t('common.title')} — ${t('appControl.nameAr')}`} required error={form.errors.title_ar} htmlFor="bc-title-ar">
              <Input id="bc-title-ar" dir="rtl" value={form.values.title_ar} onChange={(e) => form.set('title_ar', e.target.value)} />
            </Field>
            <Field label={`${t('common.title')} — ${t('appControl.nameEn')}`} error={form.errors.title_en} htmlFor="bc-title-en">
              <Input id="bc-title-en" dir="ltr" value={form.values.title_en} onChange={(e) => form.set('title_en', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t('appControl.broadcasts.body')} — ${t('appControl.nameAr')}`} required error={form.errors.body_ar} htmlFor="bc-body-ar">
              <Textarea id="bc-body-ar" dir="rtl" rows={3} value={form.values.body_ar} onChange={(e) => form.set('body_ar', e.target.value)} />
            </Field>
            <Field label={`${t('appControl.broadcasts.body')} — ${t('appControl.nameEn')}`} error={form.errors.body_en} htmlFor="bc-body-en">
              <Textarea id="bc-body-en" dir="ltr" rows={3} value={form.values.body_en} onChange={(e) => form.set('body_en', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appControl.broadcasts.channel')}>
              <Select value={form.values.channel} onValueChange={(v) => form.set('channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t('appControl.channels.both')}</SelectItem>
                  <SelectItem value="in_app">{t('appControl.channels.in_app')}</SelectItem>
                  <SelectItem value="push">{t('appControl.channels.push')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('appControl.broadcasts.deepLink')} error={form.errors.deep_link} htmlFor="bc-link">
              <Input id="bc-link" dir="ltr" placeholder="sudamind://library" value={form.values.deep_link} onChange={(e) => form.set('deep_link', e.target.value)} />
            </Field>
            <Field label={t('appControl.broadcasts.schedule')} hint={t('appControl.broadcasts.scheduleHint')} htmlFor="bc-when">
              <Input id="bc-when" type="datetime-local" dir="ltr" value={form.values.scheduled_for} onChange={(e) => form.set('scheduled_for', e.target.value)} />
            </Field>
          </div>

          <fieldset className="rounded-2xl bg-secondary/50 p-4">
            <legend className="px-1 text-sm font-medium">{t('appControl.broadcasts.segment')}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SegmentSelect
                label={t('appControl.segments.interest')} value={form.values.interest_id}
                onChange={(v) => form.set('interest_id', v)}
                options={(interests ?? []).map((i: any) => ({
                  value: i.id, label: lang === 'ar' ? i.name : (i.name_en ?? i.name),
                }))}
              />
              <SegmentSelect
                label={t('appControl.segments.country')} value={form.values.country}
                onChange={(v) => form.set('country', v)}
                options={countries.map((c) => ({ value: c.code, label: c.name }))}
              />
              <SegmentSelect
                label={t('appControl.segments.userClass')} value={form.values.user_class}
                onChange={(v) => form.set('user_class', v)}
                options={CLASS_OPTIONS.map((c) => ({ value: c, label: t(`appControl.userClass.${c}`) }))}
              />
              <SegmentSelect
                label={t('appControl.segments.activity')} value={form.values.activity}
                onChange={(v) => form.set('activity', v)}
                options={ACTIVITY_OPTIONS.map((a) => ({ value: a, label: t(`appControl.activity.${a}`) }))}
              />
              <SegmentSelect
                label={t('appControl.segments.platform')} value={form.values.platform}
                onChange={(v) => form.set('platform', v)}
                options={[
                  { value: 'ios', label: t('appControl.platform.ios') },
                  { value: 'android', label: t('appControl.platform.android') },
                ]}
              />
            </div>

            <p className="mt-3 text-sm">
              <span className="font-medium">{t('appControl.broadcasts.audience')}:</span>{' '}
              <span className="numeric">{formatNumber(audience.data?.members ?? 0, lang)}</span>{' '}
              <span className="text-muted-foreground">
                · {t('appControl.broadcasts.pushable', { value: formatNumber(audience.data?.pushable ?? 0, lang) })}
              </span>
            </p>
            {audience.data && !audience.data.pushConfigured ? (
              <p className="mt-1 text-xs text-warning">{t('appControl.broadcasts.pushNotConfigured')}</p>
            ) : null}
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate(false, { onError: form.applyApiError })}>
            {t('appControl.broadcasts.saveDraft')}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(true, { onError: form.applyApiError })}>
            <Send /> {t('appControl.broadcasts.sendNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One segment control. "All" is the first option and means no filter on this field. */
function SegmentSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('common.all')}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** What actually happened: counts by channel and status, plus a sample of who it reached. */
function BroadcastDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data, isLoading } = useQuery<any>({
    queryKey: ['app-control', 'broadcasts', id],
    queryFn: () => api.get(`/app-control/broadcasts/${id}`),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isLoading ? t('common.loading') : (lang === 'ar' ? data?.title_ar : (data?.title_en ?? data?.title_ar))}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
        ) : (
          <div className="grid gap-4">
            <p className="whitespace-pre-line text-sm">{lang === 'ar' ? data.body_ar : (data.body_en ?? data.body_ar)}</p>

            <DetailList
              items={[
                { label: t('common.status'), value: <StatusPill status={data.status} label={t(`appControl.broadcastStatus.${data.status}`)} /> },
                { label: t('appControl.broadcasts.channel'), value: t(`appControl.channels.${data.channel}`) },
                { label: t('appControl.broadcasts.audience'), value: formatNumber(data.audience_count, lang) },
                { label: t('appControl.broadcasts.delivered'), value: formatNumber(data.delivered_count, lang) },
                { label: t('appControl.broadcasts.failed'), value: formatNumber(data.failed_count, lang) },
                { label: t('appControl.broadcasts.sentAt'), value: data.sent_at ? formatDate(data.sent_at, lang, true) : '—' },
                { label: t('appControl.broadcasts.deepLink'), value: data.deep_link ?? '—' },
                {
                  label: t('appControl.broadcasts.segment'),
                  value: Object.keys(data.segment ?? {}).length
                    ? Object.entries(data.segment).map(([k, v]) => `${k}: ${v}`).join(' · ')
                    : t('appControl.broadcasts.everyone'),
                },
              ]}
            />

            <div>
              <p className="mb-2 text-sm font-medium">{t('appControl.broadcasts.delivery')}</p>
              {data.delivery?.length ? (
                <ul className="space-y-1 text-sm">
                  {data.delivery.map((row: any) => (
                    <li key={`${row.channel}-${row.status}`} className="flex items-center gap-2">
                      <Badge variant="muted">{t(`appControl.channels.${row.channel}`)}</Badge>
                      <span className="text-muted-foreground">{t(`appControl.deliveryStatus.${row.status}`)}</span>
                      <span className="numeric ms-auto font-medium">{formatNumber(row.count, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
              )}
            </div>

            {data.recipients?.length ? (
              <div>
                <p className="mb-2 text-sm font-medium">{t('appControl.broadcasts.recipients')}</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {data.recipients.map((r: any, i: number) => (
                    <li key={`${r.user_id}-${r.channel}-${i}`} className="flex items-center gap-2">
                      <span className="truncate">{r.full_name ?? r.user_id}</span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {t(`appControl.channels.${r.channel}`)} · {t(`appControl.deliveryStatus.${r.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
