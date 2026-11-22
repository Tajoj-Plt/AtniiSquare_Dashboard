import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ListMusic, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm, useListQuery } from '@/lib/hooks';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { TONES, type Tone } from '@/lib/tones';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { FileDropzone, type UploadedAsset } from './file-dropzone';

/** The two kinds of group, as the API names them — see the API's content-groups.rules.ts. */
export const GROUP_TYPES = ['playlist', 'reading_series'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

/** A group row, as `GET /content-groups` returns it. */
export interface ContentGroup {
  id: string;
  group_type: GroupType;
  title: string;
  title_en: string | null;
  description: string | null;
  cover_media_id: string | null;
  cover_url: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

/** Changing groups is editing other people's items, so it takes the same permission. */
export const GROUP_WRITE_PERMISSION = 'content.update.any';

const TYPE_TONE: Record<GroupType, Tone> = { playlist: 'indigo', reading_series: 'amber' };
const TYPE_ICON: Record<GroupType, typeof ListMusic> = { playlist: ListMusic, reading_series: BookOpen };
const COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const COVER_MAX_BYTES = 10 * 1024 * 1024;

/** "Playlist" / "Reading series", coloured the same on the list and on the group's own page. */
export function GroupTypeBadge({ type }: { type: GroupType }) {
  const { t } = useTranslation();
  const tone = TONES[TYPE_TONE[type] ?? 'blue'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tone.chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {t(`groups.type.${type}`)}
    </span>
  );
}

/**
 * Playlists and reading series.
 *
 * A group is an ordered set of library items the app shows as one thing — a lecture course,
 * a multi-volume book. This screen lists the groups; the items of one, and their order, are
 * managed on the group's own page.
 */
export function ContentGroupsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const writable = can(GROUP_WRITE_PERMISSION);
  const lang = i18n.language;

  const list = useListQuery<ContentGroup>('content-groups', '/content-groups', { sort: '-updated_at' });
  const [editing, setEditing] = React.useState<ContentGroup | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<ContentGroup | null>(null);

  const remove = useApiMutation((id: string) => api.delete(`/content-groups/${id}`), {
    successMessage: t('groups.deleted'),
    // Items released from the group carry it in their own rows, so the library lists go too.
    invalidate: [['content-groups'], ['content']],
    onSuccess: () => { setDeleting(null); list.refresh(); },
  });

  const columns: Column<ContentGroup>[] = [
    {
      key: 'title',
      header: t('common.title'),
      sortable: true,
      className: 'max-w-[26rem]',
      cell: (row) => {
        const Icon = TYPE_ICON[row.group_type] ?? ListMusic;
        return (
          <div className="flex items-start gap-2.5">
            {row.cover_url ? (
              <img src={row.cover_url} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONES[TYPE_TONE[row.group_type] ?? 'blue'].chip)}>
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <Link to={`/content/groups/${row.id}`} className="line-clamp-1 font-medium hover:text-accent hover:underline">
                {row.title}
              </Link>
              <p className="line-clamp-1 text-xs text-muted-foreground" dir="auto">{row.title_en ?? '—'}</p>
            </div>
          </div>
        );
      },
      exportValue: (row) => row.title,
    },
    {
      key: 'group_type',
      header: t('common.type'),
      cell: (row) => <GroupTypeBadge type={row.group_type} />,
      exportValue: (row) => row.group_type,
    },
    {
      key: 'item_count',
      header: t('groups.fields.items'),
      className: 'numeric',
      cell: (row) => formatNumber(row.item_count, lang),
    },
    {
      key: 'updated_at',
      header: t('common.updatedAt'),
      sortable: true,
      hideBelow: 'md',
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (row) => formatDate(row.updated_at, lang, true),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ListMusic}
        tone="violet"
        title={t('groups.title')}
        subtitle={t('groups.subtitle')}
        actions={writable ? (
          <Button onClick={() => setEditing('new')}><Plus /> {t('groups.new')}</Button>
        ) : undefined}
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
        searchPlaceholder={t('groups.searchPlaceholder')}
        sort={list.state.sort}
        onSortChange={list.setSort}
        exportFileName="content-groups"
        emptyTitle={t('groups.empty')}
        emptyHint={t('groups.emptyHint')}
        filters={
          <Select
            value={list.state.filter.group_type ?? 'all'}
            onValueChange={(v) => list.setFilter('group_type', v)}
          >
            <SelectTrigger className="w-[12rem]"><SelectValue placeholder={t('common.type')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {GROUP_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`groups.typePlural.${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rowActions={[
          { label: t('groups.manage'), icon: ListOrdered, onSelect: (row) => navigate(`/content/groups/${row.id}`) },
          { label: t('actions.edit'), icon: Pencil, onSelect: (row) => setEditing(row), hidden: () => !writable },
          {
            label: t('actions.delete'), icon: Trash2, destructive: true,
            onSelect: (row) => setDeleting(row), hidden: () => !writable,
          },
        ]}
      />

      {editing ? (
        <GroupDialog
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            // A new group has nothing in it yet, so the next thing to do is fill it.
            if (editing === 'new') navigate(`/content/groups/${saved.id}`);
            else list.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('groups.deleteTitle')}
        description={t('groups.deleteBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id); }}
      />
    </>
  );
}

/**
 * Create or edit a group.
 *
 * The type is locked once the group holds items: the API refuses the change, because a
 * playlist of ten videos cannot become a reading series, so the control says so up front
 * rather than letting the save fail.
 */
export function GroupDialog({
  group, onClose, onSaved,
}: { group: ContentGroup | null; onClose: () => void; onSaved: (group: ContentGroup) => void }) {
  const { t } = useTranslation();
  const isNew = !group;
  const typeLocked = Boolean(group && group.item_count > 0);

  const form = useForm({
    title: group?.title ?? '',
    title_en: group?.title_en ?? '',
    group_type: (group?.group_type ?? 'playlist') as GroupType,
    description: group?.description ?? '',
  });
  const [cover, setCover] = React.useState<UploadedAsset | null>(
    group?.cover_media_id ? { id: group.cover_media_id, url: group.cover_url ?? undefined } : null,
  );

  const save = useApiMutation<ContentGroup, void>(
    () => {
      const body = {
        title: form.values.title.trim(),
        // Sent as null rather than left out, so clearing a field on an edit really clears it.
        title_en: form.values.title_en.trim() || null,
        description: form.values.description.trim() || null,
        cover_media_id: cover?.id ?? null,
        ...(typeLocked ? {} : { group_type: form.values.group_type }),
      };
      return isNew ? api.post('/content-groups', body) : api.patch(`/content-groups/${group!.id}`, body);
    },
    {
      successMessage: isNew ? t('groups.created') : t('groups.updated'),
      invalidate: [['content-groups'], ['content']],
      onSuccess: onSaved,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? t('groups.new') : t('groups.edit')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('groups.fields.title')} required error={form.errors.title} htmlFor="group-title">
              <Input id="group-title" dir="rtl" autoFocus maxLength={200}
                value={form.values.title} onChange={(e) => form.set('title', e.target.value)}
                aria-invalid={Boolean(form.errors.title)} />
            </Field>
            <Field label={t('groups.fields.titleEn')} error={form.errors.title_en} htmlFor="group-title-en">
              <Input id="group-title-en" dir="ltr" maxLength={200}
                value={form.values.title_en} onChange={(e) => form.set('title_en', e.target.value)} />
            </Field>
          </div>

          <Field
            label={t('common.type')} required error={form.errors.group_type}
            hint={typeLocked ? t('groups.typeLocked') : t(`groups.typeHints.${form.values.group_type}`)}
          >
            <Select
              value={form.values.group_type} disabled={typeLocked}
              onValueChange={(v) => form.set('group_type', v as GroupType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`groups.type.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('groups.fields.description')} error={form.errors.description} htmlFor="group-description">
            <Textarea id="group-description" rows={3} maxLength={4000}
              value={form.values.description} onChange={(e) => form.set('description', e.target.value)} />
          </Field>

          <Field label={t('groups.fields.cover')} error={form.errors.cover_media_id} hint={t('groups.coverHint')}>
            <FileDropzone
              surface="cover" accept={COVER_MIMES} maxBytes={COVER_MAX_BYTES}
              value={cover} onChange={setCover} preview="image" hint="JPEG · PNG · WEBP"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            loading={save.isPending}
            disabled={form.values.title.trim().length < 2}
            onClick={() => save.mutate(undefined, { onError: form.applyApiError })}
          >
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
