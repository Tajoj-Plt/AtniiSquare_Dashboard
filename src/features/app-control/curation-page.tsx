import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LayoutGrid, Pin, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { debounce, formatNumber } from '@/lib/utils';
import { EmptyState, PageHeader, Panel } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import {
  Badge, Field, Input, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/overlays';
import { AppControlTabs, CsvButton, MoveButtons, QueryError, reorder } from './app-control-parts';

/** The shelves the app draws, in the order the screen offers them. */
const SURFACES = ['home_featured_events', 'home_featured_library', 'home_featured_reels'] as const;
type Surface = (typeof SURFACES)[number];

interface CuratedItem {
  id: string;
  surface: Surface;
  target_id: string;
  position: number;
  enabled: boolean;
  target_label: string | null;
  target_subtitle: string | null;
  target_missing: boolean;
}

interface LibrarySection {
  key: string; name_ar: string; name_en: string | null; position: number; enabled: boolean;
}

interface Interest {
  id: string; slug: string; name: string; name_en: string | null;
  icon_emoji: string | null; enabled: boolean; position: number;
  member_count: number; content_count: number;
}

/**
 * Curation: what the app puts first, and what it offers at onboarding.
 *
 * One screen with five lists, because they are one job — deciding what a member sees before
 * they have asked for anything. Every list is ordered, every ordering is saved as a whole,
 * and every reorder and toggle is applied optimistically so a long list does not flicker
 * once per move.
 */
export function AppCurationPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const writable = can('app.config.manage');

  return (
    <>
      <PageHeader
        icon={LayoutGrid}
        tone="violet"
        title={t('appControl.curation.title')}
        subtitle={t('appControl.curation.subtitle')}
      />

      <AppControlTabs active="curation" />

      <Tabs defaultValue="home_featured_events">
        <TabsList className="h-auto flex-wrap justify-start">
          {SURFACES.map((surface) => (
            <TabsTrigger key={surface} value={surface}>{t(`appControl.surfaces.${surface}`)}</TabsTrigger>
          ))}
          <TabsTrigger value="sections">{t('appControl.sections.title')}</TabsTrigger>
          <TabsTrigger value="interests">{t('appControl.interests.title')}</TabsTrigger>
        </TabsList>

        {SURFACES.map((surface) => (
          <TabsContent key={surface} value={surface} className="mt-4">
            <ShelfPanel surface={surface} writable={writable} />
          </TabsContent>
        ))}

        <TabsContent value="sections" className="mt-4">
          <SectionsPanel writable={writable} />
        </TabsContent>

        <TabsContent value="interests" className="mt-4">
          <InterestsPanel writable={writable} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* --------------------------------------------------------------- shelves */

function ShelfPanel({ surface, writable }: { surface: Surface; writable: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['app-control', 'curation', surface];

  const shelf = useQuery<CuratedItem[]>({
    queryKey: key, queryFn: () => api.get(`/app-control/curation/${surface}`),
  });
  const rows = shelf.data ?? [];

  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<CuratedItem | null>(null);

  const move = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.post(`/app-control/curation/${surface}/reorder`, { items }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CuratedItem[]>(key);
      const order = new Map(items.map((i) => [i.id, i.position]));
      queryClient.setQueryData<CuratedItem[]>(key, (list) =>
        [...(list ?? [])]
          .map((row) => ({ ...row, position: order.get(row.id) ?? row.position }))
          .sort((a, b) => a.position - b.position));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/app-control/curation/items/${id}`, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CuratedItem[]>(key);
      queryClient.setQueryData<CuratedItem[]>(key, (list) =>
        (list ?? []).map((row) => (row.id === id ? { ...row, enabled } : row)));
      return { previous };
    },
    onError: (error, _v, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(error instanceof ApiError ? error.message : t('common.error'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const unpin = useApiMutation(
    () => api.delete(`/app-control/curation/items/${removing!.id}`),
    { successMessage: t('appControl.curation.removed'), invalidate: [key], onSuccess: () => setRemoving(null) },
  );

  return (
    <>
      <Panel
        title={t(`appControl.surfaces.${surface}`)}
        description={t(`appControl.surfaceHints.${surface}`)}
        actions={
          <div className="flex items-center gap-1">
            <CsvButton
              name={`curation-${surface}`}
              rows={rows}
              columns={[
                { key: 'position', header: 'position' },
                { key: 'target_label', header: 'item' },
                { key: 'enabled', header: 'enabled' },
                { key: 'target_id', header: 'target_id' },
              ]}
            />
            {writable ? (
              <Button size="sm" onClick={() => setAdding(true)}><Plus /> {t('appControl.curation.add')}</Button>
            ) : null}
          </div>
        }
      >
        {shelf.isLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : shelf.error ? (
          <QueryError error={shelf.error as Error} onRetry={() => void shelf.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={Pin}
            title={t('appControl.curation.empty')}
            hint={t('appControl.curation.emptyHint')}
            action={writable ? <Button onClick={() => setAdding(true)}><Plus /> {t('appControl.curation.add')}</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {rows.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="numeric w-6 shrink-0 text-sm text-muted-foreground">{index + 1}</span>
                <div className="w-full min-w-0 sm:flex-1">
                  <p className="truncate font-medium">
                    {item.target_label ?? t('appControl.curation.missing')}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.target_subtitle ?? '—'}</p>
                </div>
                {/* A pinned record that was deleted or unpublished still occupies the shelf;
                    saying so is more useful than quietly dropping it from the list. */}
                {item.target_missing ? (
                  <Badge variant="danger" className="gap-1">
                    <TriangleAlert className="h-3 w-3" /> {t('appControl.curation.missing')}
                  </Badge>
                ) : null}
                <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                  {writable ? (
                    <MoveButtons
                      index={index} total={rows.length} disabled={move.isPending}
                      onMove={(direction) => {
                        const next = reorder(rows, index, direction, (r) => r.id);
                        if (next) move.mutate(next.items);
                      }}
                    />
                  ) : null}
                  <Switch
                    checked={item.enabled} disabled={!writable}
                    aria-label={`${item.target_label ?? item.target_id} — ${t('appControl.flags.enabled')}`}
                    onCheckedChange={(enabled) => toggle.mutate({ id: item.id, enabled })}
                  />
                  {writable ? (
                    <Button variant="ghost" size="icon-sm" aria-label={t('actions.remove')} onClick={() => setRemoving(item)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {t('appControl.curation.count', { value: formatNumber(rows.length, i18n.language) })}
        </p>
      </Panel>

      {adding ? <AddToShelfDialog surface={surface} onClose={() => setAdding(false)} /> : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('appControl.curation.removeTitle')}
        description={t('appControl.curation.removeBody')}
        confirmLabel={t('actions.remove')}
        cancelLabel={t('actions.cancel')}
        loading={unpin.isPending}
        onConfirm={() => unpin.mutate(undefined)}
      />
    </>
  );
}

/** The picker: search what is eligible, pin one. Debounced, like every search in the app. */
function AddToShelfDialog({ surface, onClose }: { surface: Surface; onClose: () => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = React.useState('');
  const [query, setQuery] = React.useState('');
  const emit = React.useMemo(() => debounce((value: string) => setQuery(value), 300), []);

  const candidates = useQuery<{ id: string; label: string; subtitle: string }[]>({
    queryKey: ['app-control', 'curation', surface, 'candidates', query],
    queryFn: () => api.get(`/app-control/curation/${surface}/candidates`, { q: query || undefined }),
  });

  const pin = useApiMutation(
    (targetId: string) => api.post('/app-control/curation/items', { surface, target_id: targetId }),
    {
      successMessage: t('appControl.curation.added'),
      invalidate: [['app-control', 'curation', surface]],
      onSuccess: onClose,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('appControl.curation.addTitle')}</DialogTitle>
        </DialogHeader>

        <Field label={t('actions.search')} htmlFor="curation-search">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="curation-search" className="ps-9" autoFocus
              value={term}
              onChange={(e) => { setTerm(e.target.value); emit(e.target.value); }}
            />
          </div>
        </Field>

        <div className="max-h-80 overflow-y-auto">
          {candidates.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !candidates.data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <ul className="divide-y">
              {candidates.data.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 py-2">
                  <div className="w-full min-w-0 sm:flex-1">
                    <p className="truncate text-sm font-medium">{candidate.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{candidate.subtitle}</p>
                  </div>
                  <Button
                    size="sm" variant="outline" loading={pin.isPending && pin.variables === candidate.id}
                    onClick={() => pin.mutate(candidate.id)}
                  >
                    <Pin className="h-4 w-4" /> {t('appControl.curation.pin')}
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

/* ------------------------------------------------------- library sections */

function SectionsPanel({ writable }: { writable: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['app-control', 'curation', 'sections'];
  const lang = i18n.language;

  const sections = useQuery<LibrarySection[]>({
    queryKey: key, queryFn: () => api.get('/app-control/curation/sections'),
  });
  const rows = sections.data ?? [];
  const [editing, setEditing] = React.useState<LibrarySection | null>(null);

  const move = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.post('/app-control/curation/sections/reorder', { items }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LibrarySection[]>(key);
      const order = new Map(items.map((i) => [i.id, i.position]));
      queryClient.setQueryData<LibrarySection[]>(key, (list) =>
        [...(list ?? [])]
          .map((row) => ({ ...row, position: order.get(row.key) ?? row.position }))
          .sort((a, b) => a.position - b.position));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: ({ sectionKey, enabled }: { sectionKey: string; enabled: boolean }) =>
      api.patch(`/app-control/curation/sections/${sectionKey}`, { enabled }),
    onMutate: async ({ sectionKey, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LibrarySection[]>(key);
      queryClient.setQueryData<LibrarySection[]>(key, (list) =>
        (list ?? []).map((row) => (row.key === sectionKey ? { ...row, enabled } : row)));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <>
      <Panel
        title={t('appControl.sections.title')}
        description={t('appControl.sections.hint')}
        actions={<CsvButton name="library-sections" rows={rows} columns={[
          { key: 'position', header: 'position' }, { key: 'key', header: 'key' },
          { key: 'name_en', header: 'name_en' }, { key: 'enabled', header: 'enabled' },
        ]} />}
      >
        {sections.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : sections.error ? (
          <QueryError error={sections.error as Error} onRetry={() => void sections.refetch()} />
        ) : (
          <ul className="divide-y">
            {rows.map((section, index) => (
              <li key={section.key} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="numeric w-6 shrink-0 text-sm text-muted-foreground">{index + 1}</span>
                <div className="w-full min-w-0 sm:flex-1">
                  <p className="truncate font-medium">{lang === 'ar' ? section.name_ar : (section.name_en ?? section.name_ar)}</p>
                  <code className="text-xs text-muted-foreground" dir="ltr">{section.key}</code>
                </div>
                <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                  {writable ? (
                    <MoveButtons
                      index={index} total={rows.length} disabled={move.isPending}
                      onMove={(direction) => {
                        const next = reorder(rows, index, direction, (r) => r.key);
                        if (next) move.mutate(next.items);
                      }}
                    />
                  ) : null}
                  <Switch
                    checked={section.enabled} disabled={!writable}
                    aria-label={`${section.key} — ${t('appControl.flags.enabled')}`}
                    onCheckedChange={(enabled) => toggle.mutate({ sectionKey: section.key, enabled })}
                  />
                  {writable ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(section)}>{t('actions.edit')}</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing ? <SectionDialog section={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function SectionDialog({ section, onClose }: { section: LibrarySection; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({ name_ar: section.name_ar, name_en: section.name_en ?? '' });
  const save = useApiMutation(
    () => api.patch(`/app-control/curation/sections/${section.key}`, form.values),
    {
      successMessage: t('appControl.sections.saved'),
      invalidate: [['app-control', 'curation', 'sections']],
      onSuccess: onClose,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{section.key}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label={t('appControl.nameAr')} required error={form.errors.name_ar} htmlFor="section-ar">
            <Input id="section-ar" dir="rtl" value={form.values.name_ar} onChange={(e) => form.set('name_ar', e.target.value)} />
          </Field>
          <Field label={t('appControl.nameEn')} error={form.errors.name_en} htmlFor="section-en">
            <Input id="section-en" dir="ltr" value={form.values.name_en} onChange={(e) => form.set('name_en', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onError: form.applyApiError })}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- interests */

function InterestsPanel({ writable }: { writable: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['app-control', 'curation', 'interests'];
  const lang = i18n.language;

  const interests = useQuery<Interest[]>({
    queryKey: key, queryFn: () => api.get('/app-control/curation/interests'),
  });
  const rows = interests.data ?? [];
  const [editing, setEditing] = React.useState<Interest | 'new' | null>(null);

  const move = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.post('/app-control/curation/interests/reorder', { items }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Interest[]>(key);
      const order = new Map(items.map((i) => [i.id, i.position]));
      queryClient.setQueryData<Interest[]>(key, (list) =>
        [...(list ?? [])]
          .map((row) => ({ ...row, position: order.get(row.id) ?? row.position }))
          .sort((a, b) => a.position - b.position));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/app-control/curation/interests/${id}`, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Interest[]>(key);
      queryClient.setQueryData<Interest[]>(key, (list) =>
        (list ?? []).map((row) => (row.id === id ? { ...row, enabled } : row)));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <>
      <Panel
        title={t('appControl.interests.title')}
        description={t('appControl.interests.hint')}
        actions={
          <div className="flex items-center gap-1">
            <CsvButton name="onboarding-interests" rows={rows} columns={[
              { key: 'position', header: 'position' }, { key: 'slug', header: 'slug' },
              { key: 'name', header: 'name_ar' }, { key: 'name_en', header: 'name_en' },
              { key: 'enabled', header: 'enabled' }, { key: 'member_count', header: 'members' },
            ]} />
            {writable ? (
              <Button size="sm" onClick={() => setEditing('new')}><Plus /> {t('actions.add')}</Button>
            ) : null}
          </div>
        }
      >
        {interests.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : interests.error ? (
          <QueryError error={interests.error as Error} onRetry={() => void interests.refetch()} />
        ) : (
          <ul className="divide-y">
            {rows.map((interest, index) => (
              <li key={interest.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-center text-base">{interest.icon_emoji ?? '•'}</span>
                <div className="w-full min-w-0 sm:flex-1">
                  <p className="truncate font-medium">{lang === 'ar' ? interest.name : (interest.name_en ?? interest.name)}</p>
                  <code className="text-xs text-muted-foreground" dir="ltr">{interest.slug}</code>
                </div>
                {/* How many people already chose it — switching off an interest 400 members
                    declared is a different decision from one nobody ever picked. */}
                <Badge variant="secondary" className="numeric">
                  {formatNumber(interest.member_count, lang)} {t('appControl.interests.members')}
                </Badge>
                <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                  {writable ? (
                    <MoveButtons
                      index={index} total={rows.length} disabled={move.isPending}
                      onMove={(direction) => {
                        const next = reorder(rows, index, direction, (r) => r.id);
                        if (next) move.mutate(next.items);
                      }}
                    />
                  ) : null}
                  <Switch
                    checked={interest.enabled} disabled={!writable}
                    aria-label={`${interest.slug} — ${t('appControl.flags.enabled')}`}
                    onCheckedChange={(enabled) => toggle.mutate({ id: interest.id, enabled })}
                  />
                  {writable ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(interest)}>{t('actions.edit')}</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t('appControl.interests.noDelete')}</p>
      </Panel>

      {editing ? (
        <InterestDialog interest={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function InterestDialog({ interest, onClose }: { interest: Interest | null; onClose: () => void }) {
  const { t } = useTranslation();
  const isNew = !interest;
  const form = useForm({
    slug: interest?.slug ?? '',
    name: interest?.name ?? '',
    name_en: interest?.name_en ?? '',
    icon_emoji: interest?.icon_emoji ?? '',
  });

  const save = useApiMutation(
    () => {
      const body = {
        name: form.values.name,
        name_en: form.values.name_en || undefined,
        icon_emoji: form.values.icon_emoji || undefined,
      };
      return isNew
        ? api.post('/app-control/curation/interests', { ...body, slug: form.values.slug })
        : api.patch(`/app-control/curation/interests/${interest!.id}`, body);
    },
    {
      successMessage: t('appControl.interests.saved'),
      invalidate: [['app-control', 'curation', 'interests']],
      onSuccess: onClose,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? t('appControl.interests.new') : t('appControl.interests.edit')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t('appControl.interests.slug')} required={isNew} error={form.errors.slug}
            hint={isNew ? t('appControl.interests.slugHint') : t('appControl.interests.slugLocked')} htmlFor="interest-slug">
            <Input id="interest-slug" dir="ltr" disabled={!isNew}
              value={form.values.slug} onChange={(e) => form.set('slug', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('appControl.nameAr')} required error={form.errors.name} htmlFor="interest-ar">
              <Input id="interest-ar" dir="rtl" value={form.values.name} onChange={(e) => form.set('name', e.target.value)} />
            </Field>
            <Field label={t('appControl.nameEn')} error={form.errors.name_en} htmlFor="interest-en">
              <Input id="interest-en" dir="ltr" value={form.values.name_en} onChange={(e) => form.set('name_en', e.target.value)} />
            </Field>
          </div>
          <Field label={t('appControl.interests.emoji')} error={form.errors.icon_emoji} htmlFor="interest-emoji">
            <Input id="interest-emoji" className="w-24" value={form.values.icon_emoji}
              onChange={(e) => form.set('icon_emoji', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onError: form.applyApiError })}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
