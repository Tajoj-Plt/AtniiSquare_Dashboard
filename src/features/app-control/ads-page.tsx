import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Eye, Image as ImageIcon, Megaphone, MousePointerClick, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader, Panel, EmptyState } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Checkbox, Field, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { AppControlTabs, QueryError } from './app-control-parts';

/* ----------------------------------------------------------------- types */

type Placement = 'library' | 'learn' | 'search';
type MediaType = 'image' | 'video';

/** A banner as the API lists it. */
interface AdBanner {
  id: string;
  placement: Placement;
  section: string;
  media_type: MediaType;
  media_url: string;
  title: string | null;
  description: string | null;
  button_label: string | null;
  link_url: string | null;
  promoter: string | null;
  show_title: boolean;
  show_description: boolean;
  show_button: boolean;
  show_footer: boolean;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  start_minute: number | null;
  end_minute: number | null;
  priority: number;
  view_count: number;
  click_count: number;
  created_at: string;
  created_by_name?: string | null;
}

const ADS_KEY = ['app-control', 'ad-banners'];

/** The sections a banner may target in each placement; the API refuses any other pairing. */
const SECTIONS: Record<Placement, string[]> = {
  library: ['all', 'book', 'article', 'audio', 'video', 'research', 'scientific_paper', 'translated_paper'],
  learn: ['all', 'scholarships', 'courses', 'certificate'],
  search: ['all', 'community', 'library', 'discover', 'learn', 'profile'],
};

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/* --------------------------------------------------------------- helpers */

/** Minutes from midnight as "HH:MM" for a time input, and back. */
const minutesToTime = (m: number | null) => (m === null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
const timeToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** An ISO instant as a datetime-local input's value (the browser's local time), and back. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

/* ------------------------------------------------------------------ page */

/**
 * Ad banners: where in the app each shows, what it carries, and when it is on air.
 */
export function AppAdsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const writable = can('app.config.manage');

  const banners = useQuery<AdBanner[]>({ queryKey: ADS_KEY, queryFn: () => api.get('/app-control/ad-banners') });
  const [editing, setEditing] = React.useState<AdBanner | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<AdBanner | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/app-control/ad-banners/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADS_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useApiMutation(
    () => api.delete(`/app-control/ad-banners/${deleting!.id}`),
    { successMessage: t('appControl.ads.deleted'), invalidate: [ADS_KEY], onSuccess: () => setDeleting(null) },
  );

  const rows = banners.data ?? [];

  return (
    <>
      <PageHeader
        icon={Megaphone}
        tone="indigo"
        title={t('appControl.ads.title')}
        subtitle={t('appControl.ads.subtitle')}
        actions={writable ? <Button onClick={() => setEditing('new')}><Plus /> {t('appControl.ads.add')}</Button> : null}
      />

      <AppControlTabs active="ads" />

      <Panel title={t('appControl.ads.listTitle')} description={t('appControl.ads.hint')}>
        {banners.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : banners.isError ? (
          <QueryError error={banners.error} onRetry={() => banners.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={Megaphone} title={t('appControl.ads.empty')} hint={t('appControl.ads.emptyHint')} />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                {/* What it shows */}
                {row.media_type === 'image' ? (
                  <img src={row.media_url} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover bg-muted" />
                ) : (
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Video className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{t(`appControl.ads.placement.${row.placement}`)}</Badge>
                    <Badge variant="muted">{t(`appControl.ads.section.${row.section}`)}</Badge>
                    <Badge variant="muted">{row.media_type === 'image' ? <ImageIcon className="me-1 h-3 w-3" /> : <Video className="me-1 h-3 w-3" />}{t(`appControl.ads.media.${row.media_type}`)}</Badge>
                    {!row.enabled ? <Badge variant="danger">{t('appControl.ads.off')}</Badge> : null}
                  </div>
                  <p className="mt-1 truncate font-semibold">{row.title || t('appControl.ads.untitled')}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {scheduleSummary(row, t, lang)}
                    {row.promoter ? ` · ${t('appControl.ads.promotedBy', { name: row.promoter })}` : ''}
                  </p>
                </div>

                <span className="flex items-center gap-3 text-xs text-muted-foreground" dir="ltr">
                  <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{row.view_count}</span>
                  <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" />{row.click_count}</span>
                  {row.link_url ? (
                    <a href={row.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </span>

                {writable ? (
                  <>
                    <Switch
                      checked={row.enabled}
                      aria-label={t('appControl.ads.enabled')}
                      disabled={toggle.isPending}
                      onCheckedChange={(enabled) => toggle.mutate({ id: row.id, enabled })}
                    />
                    <Button variant="ghost" size="icon" aria-label={t('actions.edit')} onClick={() => setEditing(row)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={t('actions.delete')} onClick={() => setDeleting(row)}><Trash2 className="text-destructive" /></Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing ? <AdBannerDialog banner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('appControl.ads.deleteTitle')}
        description={t('appControl.ads.deleteBody', { title: deleting?.title || t('appControl.ads.untitled') })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

/** One line saying when a banner is on air. */
function scheduleSummary(row: AdBanner, t: (key: string, opts?: Record<string, unknown>) => string, lang: string) {
  const parts: string[] = [];
  if (row.starts_at || row.ends_at) {
    parts.push(`${row.starts_at ? formatDate(row.starts_at, lang) : '…'} → ${row.ends_at ? formatDate(row.ends_at, lang) : '…'}`);
  } else {
    parts.push(t('appControl.ads.always'));
  }
  parts.push(row.days_of_week && row.days_of_week.length
    ? row.days_of_week.map((d) => t(`appControl.ads.days.${d}`)).join(' ')
    : t('appControl.ads.everyDay'));
  parts.push(row.start_minute !== null && row.end_minute !== null
    ? `${minutesToTime(row.start_minute)}–${minutesToTime(row.end_minute)}`
    : t('appControl.ads.allDay'));
  if (row.priority) parts.push(t('appControl.ads.priorityShort', { n: row.priority }));
  return parts.join(' · ');
}

/* ---------------------------------------------------------------- dialog */

/** Create or change a banner: where, what it shows, which parts, and when. */
function AdBannerDialog({ banner, onClose }: { banner: AdBanner | null; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({
    placement: (banner?.placement ?? 'library') as Placement,
    section: banner?.section ?? 'all',
    media_type: (banner?.media_type ?? 'image') as MediaType,
    media_url: banner?.media_url ?? '',
    title: banner?.title ?? '',
    description: banner?.description ?? '',
    button_label: banner?.button_label ?? '',
    link_url: banner?.link_url ?? '',
    promoter: banner?.promoter ?? '',
    show_title: banner?.show_title ?? true,
    show_description: banner?.show_description ?? true,
    show_button: banner?.show_button ?? true,
    show_footer: banner?.show_footer ?? true,
    enabled: banner?.enabled ?? true,
    starts_at: toLocalInput(banner?.starts_at ?? null),
    ends_at: toLocalInput(banner?.ends_at ?? null),
    days: banner?.days_of_week ?? ([] as number[]),
    start_time: minutesToTime(banner?.start_minute ?? null),
    end_time: minutesToTime(banner?.end_minute ?? null),
    priority: String(banner?.priority ?? 0),
  });
  const v = form.values;

  /** The body as the API takes it: empties as nulls, times as minutes, dates as instants. */
  const body = () => ({
    placement: v.placement,
    section: v.section,
    media_type: v.media_type,
    media_url: v.media_url.trim(),
    title: v.title.trim() || null,
    description: v.description.trim() || null,
    button_label: v.button_label.trim() || null,
    link_url: v.link_url.trim() || null,
    promoter: v.promoter.trim() || null,
    show_title: v.show_title,
    show_description: v.show_description,
    show_button: v.show_button,
    show_footer: v.show_footer,
    enabled: v.enabled,
    starts_at: fromLocalInput(v.starts_at),
    ends_at: fromLocalInput(v.ends_at),
    days_of_week: v.days.length && v.days.length < 7 ? [...v.days].sort() : null,
    start_minute: v.start_time && v.end_time ? timeToMinutes(v.start_time) : null,
    end_minute: v.start_time && v.end_time ? timeToMinutes(v.end_time) : null,
    priority: Number(v.priority) || 0,
  });

  const save = useApiMutation(
    () => (banner ? api.patch(`/app-control/ad-banners/${banner.id}`, body()) : api.post('/app-control/ad-banners', body())),
    { successMessage: t('appControl.ads.saved'), invalidate: [ADS_KEY], onSuccess: onClose },
  );

  const sections = SECTIONS[v.placement];
  const halfWindow = Boolean(v.start_time) !== Boolean(v.end_time);
  const canSave = v.media_url.trim().length > 0 && !halfWindow;

  const toggleDay = (day: number, on: boolean) => form.set('days', on ? [...v.days, day] : v.days.filter((d) => d !== day));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{banner ? t('appControl.ads.edit') : t('appControl.ads.add')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Where */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appControl.ads.placement.label')} required error={form.errors.placement}>
              <Select value={v.placement} onValueChange={(p) => { form.set('placement', p as Placement); form.set('section', 'all'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="library">{t('appControl.ads.placement.library')}</SelectItem>
                  <SelectItem value="learn">{t('appControl.ads.placement.learn')}</SelectItem>
                  <SelectItem value="search">{t('appControl.ads.placement.search')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('appControl.ads.section.label')} required error={form.errors.section}>
              <Select value={v.section} onValueChange={(s) => form.set('section', s)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => <SelectItem key={s} value={s}>{t(`appControl.ads.section.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('appControl.ads.media.label')} required error={form.errors.media_type}>
              <Select value={v.media_type} onValueChange={(m) => form.set('media_type', m as MediaType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">{t('appControl.ads.media.image')}</SelectItem>
                  <SelectItem value="video">{t('appControl.ads.media.video')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t('appControl.ads.mediaUrl')} required error={form.errors.media_url} hint={t('appControl.ads.mediaUrlHint')} htmlFor="ad-media-url">
            <Input id="ad-media-url" dir="ltr" placeholder="https://…" value={v.media_url} onChange={(e) => form.set('media_url', e.target.value)} />
          </Field>

          {/* What it says */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('appControl.ads.titleField')} error={form.errors.title} htmlFor="ad-title">
              <Input id="ad-title" maxLength={120} value={v.title} onChange={(e) => form.set('title', e.target.value)} />
            </Field>
            <Field label={t('appControl.ads.promoter')} error={form.errors.promoter} hint={t('appControl.ads.promoterHint')} htmlFor="ad-promoter">
              <Input id="ad-promoter" maxLength={120} value={v.promoter} onChange={(e) => form.set('promoter', e.target.value)} />
            </Field>
          </div>
          <Field label={t('appControl.ads.description')} error={form.errors.description} htmlFor="ad-description">
            <Textarea id="ad-description" rows={2} maxLength={300} value={v.description} onChange={(e) => form.set('description', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appControl.ads.buttonLabel')} error={form.errors.button_label} htmlFor="ad-button">
              <Input id="ad-button" maxLength={40} value={v.button_label} onChange={(e) => form.set('button_label', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('appControl.ads.linkUrl')} error={form.errors.link_url} hint={t('appControl.ads.linkUrlHint')} htmlFor="ad-link">
                <Input id="ad-link" dir="ltr" placeholder="https://…" value={v.link_url} onChange={(e) => form.set('link_url', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Which parts show */}
          <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-5">
            {([
              ['show_title', 'appControl.ads.show.title'],
              ['show_description', 'appControl.ads.show.description'],
              ['show_button', 'appControl.ads.show.button'],
              ['show_footer', 'appControl.ads.show.footer'],
              ['enabled', 'appControl.ads.enabled'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-sm">
                <span>{t(label)}</span>
                <Switch checked={v[key]} onCheckedChange={(on) => form.set(key, on)} />
              </label>
            ))}
          </div>

          {/* When */}
          <div>
            <Label>{t('appControl.ads.schedule.title')}</Label>
            <p className="mb-3 text-xs text-muted-foreground">{t('appControl.ads.schedule.hint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('appControl.ads.startsAt')} error={form.errors.starts_at} htmlFor="ad-starts">
                <Input id="ad-starts" type="datetime-local" dir="ltr" value={v.starts_at} onChange={(e) => form.set('starts_at', e.target.value)} />
              </Field>
              <Field label={t('appControl.ads.endsAt')} error={form.errors.ends_at} htmlFor="ad-ends">
                <Input id="ad-ends" type="datetime-local" dir="ltr" value={v.ends_at} onChange={(e) => form.set('ends_at', e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Label>{t('appControl.ads.days.label')}</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {DAYS.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={v.days.includes(day)} onCheckedChange={(on) => toggleDay(day, on === true)} />
                    {t(`appControl.ads.days.${day}`)}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('appControl.ads.days.hint')}</p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label={t('appControl.ads.window.from')} htmlFor="ad-from" error={halfWindow ? t('appControl.ads.window.half') : undefined}>
                <Input id="ad-from" type="time" dir="ltr" value={v.start_time} onChange={(e) => form.set('start_time', e.target.value)} />
              </Field>
              <Field label={t('appControl.ads.window.to')} htmlFor="ad-to" hint={t('appControl.ads.window.hint')}>
                <Input id="ad-to" type="time" dir="ltr" value={v.end_time} onChange={(e) => form.set('end_time', e.target.value)} />
              </Field>
              <Field label={t('appControl.ads.priority')} hint={t('appControl.ads.priorityHint')} htmlFor="ad-priority">
                <Input id="ad-priority" type="number" dir="ltr" min={-1000} max={1000} value={v.priority} onChange={(e) => form.set('priority', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button loading={save.isPending} disabled={!canSave} onClick={() => save.mutate(undefined, { onError: form.applyApiError })}>
            {banner ? t('actions.save') : t('appControl.ads.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
