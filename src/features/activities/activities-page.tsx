import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { Lock, LockOpen, MessageSquareText, PenLine, Pencil, Plus, Trash2, Trophy, Upload, X } from 'lucide-react';
import { ApiError, api, uploadFile } from '@/lib/api';
import { useApiMutation, useForm } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader, Panel, EmptyState } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { QueryError } from '@/features/app-control/app-control-parts';

/* ----------------------------------------------------------------- types */

type Slider = 'challenge' | 'writing';

/** An activity as the API lists it. */
interface Activity {
  id: string;
  slider: Slider;
  question: string;
  description: string | null;
  cover_url: string | null;
  sponsor_name: string | null;
  sponsor_image_url: string | null;
  closes_at: string | null;
  status: 'open' | 'closed';
  /** Closed by staff, or past its closing date. */
  is_closed: boolean;
  answer_count: number;
  created_at: string;
}

interface Answer {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  username: string | null;
}

const SLIDERS: Slider[] = ['challenge', 'writing'];

const keyFor = (slider: Slider) => ['activities', slider];

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
 * One slider of the app's Activities tab: its questions, each with a cover and a sponsor,
 * added, edited, closed or deleted here, and the answers members sent.
 */
export function ActivitiesPage() {
  const { slider } = useParams<{ slider: string }>();
  if (!SLIDERS.includes(slider as Slider)) return <Navigate to="/activities/challenge" replace />;
  return <SliderPage key={slider} slider={slider as Slider} />;
}

function SliderPage({ slider }: { slider: Slider }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const list = useQuery<Activity[]>({ queryKey: keyFor(slider), queryFn: () => api.get(`/activities?slider=${slider}`) });
  const [editing, setEditing] = React.useState<Activity | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<Activity | null>(null);
  const [closing, setClosing] = React.useState<Activity | null>(null);
  const [reading, setReading] = React.useState<Activity | null>(null);

  const remove = useApiMutation(
    () => api.delete(`/activities/${deleting!.id}`),
    { successMessage: t('activities.deleted'), invalidate: [keyFor(slider)], onSuccess: () => setDeleting(null) },
  );
  const close = useApiMutation(
    () => api.post(`/activities/${closing!.id}/close`),
    { successMessage: t('activities.closed'), invalidate: [keyFor(slider)], onSuccess: () => setClosing(null) },
  );
  const reopen = useApiMutation(
    (row: Activity) => api.patch(`/activities/${row.id}`, { status: 'open' }),
    { successMessage: t('activities.reopened'), invalidate: [keyFor(slider)] },
  );

  const rows = list.data ?? [];
  const Icon = slider === 'challenge' ? Trophy : PenLine;

  return (
    <>
      <PageHeader
        icon={Icon}
        tone={slider === 'challenge' ? 'amber' : 'violet'}
        title={t(`activities.${slider}.title`)}
        subtitle={t(`activities.${slider}.subtitle`)}
        actions={<Button onClick={() => setEditing('new')}><Plus /> {t('activities.add')}</Button>}
      />

      <Panel title={t('activities.listTitle')} description={t('activities.hint')}>
        {list.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={Icon} title={t('activities.empty')} hint={t('activities.emptyHint')} />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                {row.cover_url ? (
                  <img src={row.cover_url} alt="" className="h-16 w-24 shrink-0 rounded-lg bg-muted object-cover" />
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.is_closed
                      ? <Badge variant="danger">{t('activities.statusClosed')}</Badge>
                      : <Badge variant="success">{t('activities.statusOpen')}</Badge>}
                    <Badge variant="muted">{t('activities.answerCount', { count: row.answer_count })}</Badge>
                  </div>
                  <p className="mt-1 truncate font-semibold">{row.question}</p>
                  <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                    {row.sponsor_image_url ? <img src={row.sponsor_image_url} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
                    {row.sponsor_name ? <span>{row.sponsor_name}</span> : null}
                    <span>· {row.closes_at ? t('activities.closesOn', { date: formatDate(row.closes_at, lang, true) }) : t('activities.noClosing')}</span>
                  </p>
                </div>

                <Button variant="ghost" size="sm" onClick={() => setReading(row)}>
                  <MessageSquareText /> {t('activities.viewAnswers')}
                </Button>
                {row.status === 'closed' ? (
                  <Button variant="ghost" size="sm" disabled={reopen.isPending} onClick={() => reopen.mutate(row)}>
                    <LockOpen /> {t('activities.reopen')}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setClosing(row)}>
                    <Lock /> {t('activities.close')}
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label={t('actions.edit')} onClick={() => setEditing(row)}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label={t('actions.delete')} onClick={() => setDeleting(row)}><Trash2 className="text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing ? (
        <ActivityDialog slider={slider} activity={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}

      {reading ? <AnswersDialog activity={reading} onClose={() => setReading(null)} /> : null}

      <ConfirmDialog
        open={Boolean(closing)}
        onOpenChange={(open) => !open && setClosing(null)}
        title={t('activities.closeTitle')}
        description={t('activities.closeBody', { title: closing?.question ?? '' })}
        confirmLabel={t('activities.close')}
        cancelLabel={t('actions.cancel')}
        destructive={false}
        loading={close.isPending}
        onConfirm={() => close.mutate(undefined)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('activities.deleteTitle')}
        description={t('activities.deleteBody', { title: deleting?.question ?? '' })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

/* ---------------------------------------------------------------- dialogs */

/** Add or edit one item: the question, its words, its cover, its sponsor and when it closes. */
function ActivityDialog({ slider, activity, onClose }: { slider: Slider; activity: Activity | null; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({
    question: activity?.question ?? '',
    description: activity?.description ?? '',
    cover_url: activity?.cover_url ?? '',
    sponsor_name: activity?.sponsor_name ?? '',
    sponsor_image_url: activity?.sponsor_image_url ?? '',
    closes_at: toLocalInput(activity?.closes_at ?? null),
  });
  const v = form.values;

  const body = () => ({
    slider,
    question: v.question.trim(),
    description: v.description.trim() || null,
    cover_url: v.cover_url.trim() || null,
    sponsor_name: v.sponsor_name.trim() || null,
    sponsor_image_url: v.sponsor_image_url.trim() || null,
    closes_at: fromLocalInput(v.closes_at),
  });

  const save = useApiMutation(
    () => (activity ? api.patch(`/activities/${activity.id}`, body()) : api.post('/activities', body())),
    { successMessage: t('activities.saved'), invalidate: [keyFor(slider)], onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity ? t('activities.edit') : t('activities.add')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label={t('activities.fields.question')} required error={form.errors.question} htmlFor="act-question">
            <Input id="act-question" maxLength={300} value={v.question} onChange={(e) => form.set('question', e.target.value)} />
          </Field>
          <Field label={t('activities.fields.description')} hint={t('activities.fields.descriptionHint')} error={form.errors.description} htmlFor="act-description">
            <Textarea id="act-description" rows={4} maxLength={2000} value={v.description} onChange={(e) => form.set('description', e.target.value)} />
          </Field>

          <ImageField
            label={t('activities.fields.cover')}
            value={v.cover_url}
            error={form.errors.cover_url}
            wide
            onChange={(url) => form.set('cover_url', url)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('activities.fields.sponsorName')} error={form.errors.sponsor_name} htmlFor="act-sponsor">
              <Input id="act-sponsor" maxLength={120} value={v.sponsor_name} onChange={(e) => form.set('sponsor_name', e.target.value)} />
            </Field>
            <Field label={t('activities.fields.closesAt')} hint={t('activities.fields.closesAtHint')} error={form.errors.closes_at} htmlFor="act-closes">
              <Input id="act-closes" type="datetime-local" dir="ltr" value={v.closes_at} onChange={(e) => form.set('closes_at', e.target.value)} />
            </Field>
          </div>

          <ImageField
            label={t('activities.fields.sponsorImage')}
            value={v.sponsor_image_url}
            error={form.errors.sponsor_image_url}
            onChange={(url) => form.set('sponsor_image_url', url)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            loading={save.isPending}
            disabled={v.question.trim().length < 3}
            onClick={() => save.mutate(undefined, { onError: form.applyApiError })}
          >
            {activity ? t('actions.save') : t('activities.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A picture: uploaded straight to storage (the public "cover" bucket), or a link pasted in.
 * Either way the field holds the picture's public address.
 */
function ImageField({
  label, value, error, wide, onChange,
}: { label: string; value: string; error?: string; wide?: boolean; onChange: (url: string) => void }) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setProgress(0);
    try {
      const asset = await uploadFile(file, 'cover', setProgress);
      if (asset.url) onChange(asset.url);
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Field label={label} error={error ?? failure ?? undefined}>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="" className={wide ? 'h-20 w-32 rounded-lg bg-muted object-cover' : 'h-14 w-14 rounded-full bg-muted object-cover'} />
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" type="button" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
          <Upload /> {progress !== null ? `${t('activities.fields.uploading')} ${progress}%` : value ? t('activities.fields.replace') : t('activities.fields.upload')}
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange('')}>
            <X /> {t('activities.fields.remove')}
          </Button>
        ) : null}
      </div>
      <Input
        className="mt-2"
        dir="ltr"
        placeholder={`${t('activities.fields.pasteLink')} — https://…`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** What members answered one item, newest first. */
function AnswersDialog({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const answers = useQuery<Answer[]>({
    queryKey: ['activities', 'answers', activity.id],
    queryFn: () => api.get(`/activities/${activity.id}/answers`),
  });
  const rows = answers.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('activities.answersTitle')}</DialogTitle>
          <p className="text-sm text-muted-foreground">{activity.question}</p>
        </DialogHeader>
        {answers.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : answers.isError ? (
          <QueryError error={answers.error} onRetry={() => answers.refetch()} />
        ) : !rows.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('activities.noAnswers')}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="py-3">
                <p className="text-sm font-semibold">
                  {row.full_name ?? '—'}
                  {row.username ? <span className="ms-2 font-normal text-muted-foreground" dir="ltr">@{row.username}</span> : null}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{row.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(row.updated_at, i18n.language, true)}
                  {row.updated_at !== row.created_at ? ` · ${t('activities.edited')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
