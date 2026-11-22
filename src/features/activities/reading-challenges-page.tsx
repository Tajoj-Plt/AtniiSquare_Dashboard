import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Eye, Pencil, Plus, Trash2, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useForm } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader, Panel, EmptyState } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input, Progress, Skeleton, Switch } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { QueryError } from '@/features/app-control/app-control-parts';

/* ----------------------------------------------------------------- types */

/** A challenge card, as the API lists it. */
interface ChallengeType {
  id: string;
  books_count: number;
  days: number;
  title: string | null;
  title_en: string | null;
  /** The title the app shows: the card's own, or its terms written out. */
  display_title: string;
  display_title_en: string;
  enabled: boolean;
  sort_order: number;
  challenge_count: number;
  running_count: number;
}

/** A challenge a member started, as the list shows it. */
interface ChallengeRow {
  id: string;
  title: string;
  title_en: string;
  books_count: number;
  days: number;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'cancelled';
  running: boolean;
  creator_name: string | null;
  joined_count: number;
  invited_count: number;
  average_percent: number;
}

interface ChallengeMember {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  status: 'invited' | 'joined' | 'declined' | 'left';
  is_creator: boolean;
  percent: number;
  progress: Record<string, number>;
  joined_at: string | null;
  last_read_at: string | null;
}

interface ChallengeDetail extends ChallengeRow {
  books: { id: string; title: string; cover: string }[];
  members: ChallengeMember[];
}

type ListStatus = 'active' | 'ended' | 'cancelled' | 'all';

const TYPES_KEY = ['activities', 'reading-challenge-types'];
const CHALLENGES_KEY = ['activities', 'reading-challenges'];

/** Whole days between now and an instant, never below zero. */
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/* ------------------------------------------------------------------ page */

/**
 * Reading challenges: the cards the app's Activities tab offers (how many books, how many days),
 * and the challenges members started from them — who is in each, and how far each has read.
 */
export function ReadingChallengesPage() {
  const { t } = useTranslation();
  const [editing, setEditing] = React.useState<ChallengeType | 'new' | null>(null);

  return (
    <>
      <PageHeader
        icon={BookOpenCheck}
        tone="teal"
        title={t('readingChallenges.title')}
        subtitle={t('readingChallenges.subtitle')}
        actions={<Button onClick={() => setEditing('new')}><Plus /> {t('readingChallenges.addCard')}</Button>}
      />

      <CardsPanel onEdit={setEditing} />
      <ChallengesPanel />

      {editing ? <CardDialog card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/* ----------------------------------------------------------------- cards */

/** The cards the app offers, in their order, each switchable on and off. */
function CardsPanel({ onEdit }: { onEdit: (card: ChallengeType) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const cards = useQuery<ChallengeType[]>({ queryKey: TYPES_KEY, queryFn: () => api.get('/activities/reading-challenge-types') });
  const [deleting, setDeleting] = React.useState<ChallengeType | null>(null);

  const toggle = useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/activities/reading-challenge-types/${id}`, { enabled }),
    { invalidate: [TYPES_KEY] },
  );
  const remove = useApiMutation(
    () => api.delete(`/activities/reading-challenge-types/${deleting!.id}`),
    { successMessage: t('readingChallenges.cardDeleted'), invalidate: [TYPES_KEY], onSuccess: () => setDeleting(null) },
  );

  const rows = cards.data ?? [];

  return (
    <Panel title={t('readingChallenges.cardsTitle')} description={t('readingChallenges.cardsHint')}>
      {cards.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : cards.isError ? (
        <QueryError error={cards.error} onRetry={() => cards.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={BookOpenCheck} title={t('readingChallenges.noCards')} hint={t('readingChallenges.noCardsHint')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((card) => (
            <div key={card.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${card.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-snug">{ar ? card.display_title : card.display_title_en}</p>
                <Switch
                  checked={card.enabled}
                  aria-label={t('readingChallenges.enabled')}
                  disabled={toggle.isPending}
                  onCheckedChange={(enabled) => toggle.mutate({ id: card.id, enabled })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">{t('readingChallenges.books', { count: card.books_count })}</Badge>
                <Badge variant="muted">{t('readingChallenges.days', { count: card.days })}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('readingChallenges.cardUsage', { running: card.running_count, total: card.challenge_count })}
              </p>
              <div className="mt-auto flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label={t('actions.edit')} onClick={() => onEdit(card)}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label={t('actions.delete')} onClick={() => setDeleting(card)}><Trash2 className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('readingChallenges.deleteCardTitle')}
        description={t('readingChallenges.deleteCardBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </Panel>
  );
}

/** Add or change a card: its terms, its titles (or none, for the terms written out), its order. */
function CardDialog({ card, onClose }: { card: ChallengeType | null; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({
    books_count: String(card?.books_count ?? 3),
    days: String(card?.days ?? 15),
    title: card?.title ?? '',
    title_en: card?.title_en ?? '',
    sort_order: String(card?.sort_order ?? 0),
    enabled: card?.enabled ?? true,
  });
  const v = form.values;
  const books = Number(v.books_count);
  const days = Number(v.days);
  const valid = Number.isInteger(books) && books >= 1 && books <= 50 && Number.isInteger(days) && days >= 1 && days <= 366;

  const body = () => ({
    books_count: books,
    days,
    title: v.title.trim() || null,
    title_en: v.title_en.trim() || null,
    sort_order: Number(v.sort_order) || 0,
    enabled: v.enabled,
  });

  const save = useApiMutation(
    () => (card ? api.patch(`/activities/reading-challenge-types/${card.id}`, body()) : api.post('/activities/reading-challenge-types', body())),
    { successMessage: t('readingChallenges.cardSaved'), invalidate: [TYPES_KEY], onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{card ? t('readingChallenges.editCard') : t('readingChallenges.addCard')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('readingChallenges.fields.books')} required error={form.errors.books_count} htmlFor="rc-books">
              <Input id="rc-books" type="number" dir="ltr" min={1} max={50} value={v.books_count} onChange={(e) => form.set('books_count', e.target.value)} />
            </Field>
            <Field label={t('readingChallenges.fields.days')} required error={form.errors.days} htmlFor="rc-days">
              <Input id="rc-days" type="number" dir="ltr" min={1} max={366} value={v.days} onChange={(e) => form.set('days', e.target.value)} />
            </Field>
          </div>
          <Field label={t('readingChallenges.fields.title')} hint={t('readingChallenges.fields.titleHint')} error={form.errors.title} htmlFor="rc-title">
            <Input id="rc-title" dir="rtl" maxLength={120} value={v.title} onChange={(e) => form.set('title', e.target.value)} />
          </Field>
          <Field label={t('readingChallenges.fields.titleEn')} hint={t('readingChallenges.fields.titleHint')} error={form.errors.title_en} htmlFor="rc-title-en">
            <Input id="rc-title-en" dir="ltr" maxLength={120} value={v.title_en} onChange={(e) => form.set('title_en', e.target.value)} />
          </Field>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Field label={t('readingChallenges.fields.order')} hint={t('readingChallenges.fields.orderHint')} htmlFor="rc-order">
              <Input id="rc-order" type="number" dir="ltr" value={v.sort_order} onChange={(e) => form.set('sort_order', e.target.value)} />
            </Field>
            <label className="flex h-10 items-center justify-between gap-2 rounded-xl border px-3 text-sm">
              <span>{t('readingChallenges.enabled')}</span>
              <Switch checked={v.enabled} onCheckedChange={(on) => form.set('enabled', on)} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate(undefined, { onError: form.applyApiError })}>
            {card ? t('actions.save') : t('readingChallenges.addCard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ challenges */

/** The challenges members started: running, ended or stopped, with their average progress. */
function ChallengesPanel() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [status, setStatus] = React.useState<ListStatus>('active');
  const [viewing, setViewing] = React.useState<string | null>(null);
  const list = useQuery<ChallengeRow[]>({
    queryKey: [...CHALLENGES_KEY, status],
    queryFn: () => api.get(`/activities/reading-challenges?status=${status}`),
  });
  const rows = list.data ?? [];

  return (
    <Panel
      title={t('readingChallenges.runningTitle')}
      description={t('readingChallenges.runningHint')}
      actions={
        <Select value={status} onValueChange={(value) => setStatus(value as ListStatus)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['active', 'ended', 'cancelled', 'all'] as const).map((s) => (
              <SelectItem key={s} value={s}>{t(`readingChallenges.status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : list.isError ? (
        <QueryError error={list.error} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={BookOpenCheck} title={t('readingChallenges.noChallenges')} hint={t('readingChallenges.noChallengesHint')} />
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge row={row} />
                  <Badge variant="muted">{t('readingChallenges.members', { count: row.joined_count })}</Badge>
                  {row.invited_count ? <Badge variant="warning">{t('readingChallenges.pending', { count: row.invited_count })}</Badge> : null}
                </div>
                <p className="mt-1 truncate font-semibold">{ar ? row.title : row.title_en}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('readingChallenges.startedBy', { name: row.creator_name ?? '—' })}
                  {' · '}{formatDate(row.starts_at, i18n.language)} → {formatDate(row.ends_at, i18n.language)}
                  {row.running ? ` · ${t('readingChallenges.daysLeft', { count: daysLeft(row.ends_at) })}` : ''}
                </p>
              </div>
              <div className="w-40">
                <p className="mb-1 text-xs text-muted-foreground">{t('readingChallenges.average', { percent: row.average_percent })}</p>
                <Progress value={row.average_percent} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewing(row.id)}><Eye /> {t('readingChallenges.details')}</Button>
            </li>
          ))}
        </ul>
      )}

      {viewing ? <ChallengeDialog id={viewing} onClose={() => setViewing(null)} /> : null}
    </Panel>
  );
}

function StatusBadge({ row }: { row: Pick<ChallengeRow, 'status' | 'running'> }) {
  const { t } = useTranslation();
  if (row.status === 'cancelled') return <Badge variant="danger">{t('readingChallenges.status.cancelled')}</Badge>;
  return row.running
    ? <Badge variant="success">{t('readingChallenges.status.active')}</Badge>
    : <Badge variant="muted">{t('readingChallenges.status.ended')}</Badge>;
}

/** One challenge in full: its books, and each member's reading of each book; it can be stopped here. */
function ChallengeDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const detail = useQuery<ChallengeDetail>({
    queryKey: [...CHALLENGES_KEY, 'detail', id],
    queryFn: () => api.get(`/activities/reading-challenges/${id}`),
  });
  const [stopping, setStopping] = React.useState(false);
  const cancel = useApiMutation(
    () => api.post(`/activities/reading-challenges/${id}/cancel`),
    { successMessage: t('readingChallenges.cancelled'), invalidate: [CHALLENGES_KEY], onSuccess: () => { setStopping(false); onClose(); } },
  );
  const data = detail.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{data ? (ar ? data.title : data.title_en) : t('readingChallenges.details')}</DialogTitle>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : detail.isError ? (
          <QueryError error={detail.error} onRetry={() => detail.refetch()} />
        ) : !data ? null : (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge row={data} />
              <span className="text-muted-foreground">
                {t('readingChallenges.startedBy', { name: data.creator_name ?? '—' })} · {formatDate(data.starts_at, i18n.language, true)} → {formatDate(data.ends_at, i18n.language, true)}
              </span>
            </div>

            {/* The books */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('readingChallenges.booksTitle')}</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {data.books.map((book) => (
                  <div key={book.id} className="w-20 shrink-0">
                    {book.cover
                      ? <img src={book.cover} alt="" className="h-28 w-20 rounded-lg bg-muted object-cover" />
                      : <div className="h-28 w-20 rounded-lg bg-muted" />}
                    <p className="mt-1 line-clamp-2 text-xs">{book.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* The members, joined first and furthest-read first, each book's reading beside them */}
            <div>
              <p className="mb-2 text-sm font-semibold">{t('readingChallenges.membersTitle')}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-start font-medium">{t('readingChallenges.member')}</th>
                      <th className="py-2 text-start font-medium">{t('readingChallenges.state')}</th>
                      <th className="py-2 text-start font-medium">{t('readingChallenges.overall')}</th>
                      {data.books.map((book, i) => (
                        <th key={book.id} className="py-2 text-center font-medium" title={book.title}>{i + 1}</th>
                      ))}
                      <th className="py-2 text-start font-medium">{t('readingChallenges.lastRead')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {member.avatar
                              ? <img src={member.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                              : <div className="h-7 w-7 rounded-full bg-muted" />}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{member.name ?? '—'}{member.is_creator ? ` · ${t('readingChallenges.creator')}` : ''}</p>
                              {member.username ? <p className="truncate text-xs text-muted-foreground" dir="ltr">@{member.username}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-2"><Badge variant={member.status === 'joined' ? 'success' : member.status === 'invited' ? 'warning' : 'muted'}>{t(`readingChallenges.memberStatus.${member.status}`)}</Badge></td>
                        <td className="py-2">
                          <div className="flex w-28 items-center gap-2">
                            <Progress value={member.percent} />
                            <span className="text-xs tabular-nums">{member.percent}%</span>
                          </div>
                        </td>
                        {data.books.map((book) => (
                          <td key={book.id} className="py-2 text-center text-xs tabular-nums">
                            {member.progress[book.id] !== undefined ? `${Math.round(member.progress[book.id] * 100)}%` : '—'}
                          </td>
                        ))}
                        <td className="py-2 text-xs text-muted-foreground">{member.last_read_at ? formatDate(member.last_read_at, i18n.language, true) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {data && data.status === 'active' && data.running ? (
            <Button variant="outline" className="me-auto text-destructive" onClick={() => setStopping(true)}>
              <Ban /> {t('readingChallenges.cancel')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>{t('actions.close')}</Button>
        </DialogFooter>

        <ConfirmDialog
          open={stopping}
          onOpenChange={setStopping}
          title={t('readingChallenges.cancelTitle')}
          description={t('readingChallenges.cancelBody')}
          confirmLabel={t('readingChallenges.cancel')}
          cancelLabel={t('actions.cancel')}
          loading={cancel.isPending}
          onConfirm={() => cancel.mutate(undefined)}
        />
      </DialogContent>
    </Dialog>
  );
}
