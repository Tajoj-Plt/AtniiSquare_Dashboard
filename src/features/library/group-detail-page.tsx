import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ListOrdered, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { debounce, formatNumber } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Field, Input, Skeleton } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/overlays';
import { MoveButtons, QueryError, reorder } from '@/features/app-control/app-control-parts';
import {
  GROUP_WRITE_PERMISSION, GroupDialog, GroupTypeBadge, type ContentGroup,
} from './groups-page';

/** One member of a group, as `GET /content-groups/:id` lists it. */
interface GroupItem {
  id: string;
  title: string;
  content_type: string;
  status: string;
  cover_url: string | null;
  group_position: number | null;
}

type GroupDetail = ContentGroup & { items: GroupItem[] };

interface Candidate {
  id: string;
  title: string;
  content_type: string;
  status: string;
  current_group_id: string | null;
  current_group_title: string | null;
}

/**
 * One playlist or reading series: its items, in the order the app shows them.
 *
 * The order is the whole point of the screen, so a move is applied optimistically and saved
 * as the complete ordering — the same pattern as the curation shelves — rather than
 * flickering the list once per click.
 */
export function ContentGroupDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const writable = can(GROUP_WRITE_PERMISSION);
  const key = ['content-groups', id];

  const detail = useQuery<GroupDetail>({ queryKey: key, queryFn: () => api.get(`/content-groups/${id}`) });
  const group = detail.data;
  const rows = group?.items ?? [];

  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<GroupItem | null>(null);

  const move = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.post(`/content-groups/${id}/reorder`, { items }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GroupDetail>(key);
      const order = new Map(items.map((i) => [i.id, i.position]));
      queryClient.setQueryData<GroupDetail>(key, (current) => (current ? {
        ...current,
        items: current.items
          .map((row) => ({ ...row, group_position: order.get(row.id) ?? row.group_position }))
          .sort((a, b) => (a.group_position ?? Infinity) - (b.group_position ?? Infinity)),
      } : current));
      return { previous };
    },
    onError: (error, _v, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(error instanceof ApiError ? error.message : t('common.error'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useApiMutation(
    () => api.delete(`/content-groups/${id}/items/${removing!.id}`),
    {
      successMessage: t('groups.items.removed'),
      invalidate: [['content-groups'], ['content']],
      onSuccess: () => setRemoving(null),
    },
  );

  if (detail.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 rounded-2xl" />
      </>
    );
  }
  if (detail.error || !group) {
    return (
      <QueryError
        error={(detail.error as Error) ?? new Error(t('common.noResults'))}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        icon={ListOrdered}
        tone="violet"
        title={group.title}
        subtitle={group.title_en ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/content/groups')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
            {writable ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('actions.edit')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        {group.cover_url ? (
          <img src={group.cover_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <GroupTypeBadge type={group.group_type} />
          {group.description ? (
            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{group.description}</p>
          ) : null}
        </div>
      </div>

      <Panel
        title={t('groups.items.title')}
        description={t('groups.items.hint')}
        actions={writable ? (
          <Button size="sm" onClick={() => setAdding(true)}><Plus /> {t('groups.items.add')}</Button>
        ) : undefined}
      >
        {!rows.length ? (
          <EmptyState
            icon={ListOrdered}
            title={t('groups.items.empty')}
            hint={t('groups.items.emptyHint')}
            action={writable ? <Button onClick={() => setAdding(true)}><Plus /> {t('groups.items.add')}</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {rows.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="numeric w-6 shrink-0 text-sm text-muted-foreground">{index + 1}</span>
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded-lg bg-secondary" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <Link to={`/content/item/${item.id}`} className="block truncate font-medium hover:text-accent hover:underline">
                    {item.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{t(`library.type.${item.content_type}`)}</p>
                </div>
                {/* Members only see published items; the pill says which of these they get. */}
                <StatusPill status={item.status} label={t(`library.status.${item.status}`)} />
                {writable ? (
                  <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                    <MoveButtons
                      index={index} total={rows.length} disabled={move.isPending}
                      onMove={(direction) => {
                        const next = reorder(rows, index, direction, (r) => r.id);
                        if (next) move.mutate(next.items);
                      }}
                    />
                    <Button
                      variant="ghost" size="icon-sm"
                      aria-label={`${t('actions.remove')} — ${item.title}`} title={t('actions.remove')}
                      onClick={() => setRemoving(item)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {t('groups.items.count', { value: formatNumber(rows.length, i18n.language) })}
        </p>
      </Panel>

      {adding ? <AddToGroupDialog groupId={group.id} onClose={() => setAdding(false)} /> : null}

      {editing ? (
        <GroupDialog
          group={group}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('groups.items.removeTitle')}
        description={t('groups.items.removeBody')}
        confirmLabel={t('actions.remove')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

/**
 * The picker: search the items this group may hold, add one. It stays open after an add —
 * filling a playlist is usually several items in a row — and the item just added drops out
 * of the results, because the candidates are "not already in this group".
 */
function AddToGroupDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = React.useState('');
  const [query, setQuery] = React.useState('');
  const emit = React.useMemo(() => debounce((value: string) => setQuery(value), 300), []);

  const candidates = useQuery<Candidate[]>({
    queryKey: ['content-groups', groupId, 'candidates', query],
    queryFn: () => api.get(`/content-groups/${groupId}/candidates`, { q: query || undefined }),
  });

  const add = useApiMutation(
    (contentId: string) => api.post(`/content-groups/${groupId}/items`, { content_id: contentId }),
    { successMessage: t('groups.items.added'), invalidate: [['content-groups'], ['content']] },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('groups.items.addTitle')}</DialogTitle>
        </DialogHeader>

        <Field label={t('actions.search')} htmlFor="group-candidate-search">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="group-candidate-search" className="ps-9" autoFocus
              value={term}
              onChange={(e) => { setTerm(e.target.value); emit(e.target.value); }}
            />
          </div>
        </Field>

        <div className="max-h-80 overflow-y-auto">
          {candidates.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : candidates.error ? (
            <QueryError error={candidates.error as Error} onRetry={() => void candidates.refetch()} />
          ) : !candidates.data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <ul className="divide-y">
              {candidates.data.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{candidate.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`library.type.${candidate.content_type}`)} · {t(`library.status.${candidate.status}`)}
                      {/* An item can be in one group only: adding it here takes it out of there. */}
                      {candidate.current_group_title
                        ? ` · ${t('groups.items.inOtherGroup', { title: candidate.current_group_title })}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    size="sm" variant="outline" loading={add.isPending && add.variables === candidate.id}
                    disabled={add.isPending}
                    onClick={() => add.mutate(candidate.id)}
                  >
                    <Plus className="h-4 w-4" /> {t('groups.items.addAction')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
