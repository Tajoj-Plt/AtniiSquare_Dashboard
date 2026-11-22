import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Apple, ExternalLink, Plus, Rocket, Smartphone, ToggleLeft, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { PageHeader, Panel, EmptyState } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { AppControlTabs, CsvButton, MoveButtons, QueryError, reorder } from './app-control-parts';

interface Flag {
  key: string;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  platform: 'ios' | 'android' | 'both';
  min_app_version: string | null;
  payload: Record<string, unknown>;
  position: number;
  updated_at: string;
  updated_by_name: string | null;
}

interface Gate {
  platform: 'ios' | 'android';
  minimum_version: string;
  latest_version: string | null;
  force_update: boolean;
  notice_ar: string | null;
  notice_en: string | null;
  store_url: string | null;
  updated_at: string;
}

/** One announced build of the app: its version, how pressing it is, and where to get it. */
interface AppVersion {
  id: string;
  platform: 'ios' | 'android';
  version: string;
  update_type: 'optional' | 'required';
  update_url: string;
  notes_ar: string | null;
  notes_en: string | null;
  created_at: string;
  created_by_name: string | null;
}

const FLAGS_KEY = ['app-control', 'flags'];
const VERSIONS_KEY = ['app-control', 'app-versions'];
const GATES_KEY = ['app-control', 'release-gates'];

/**
 * Feature flags and the version gate — the two things the app reads before drawing anything.
 *
 * Both live on one screen because they are one decision: what this build is allowed to do.
 * Toggling a flag is optimistic, since the switch is the whole interaction and waiting a
 * round trip to see it move makes the screen feel broken; a failure rolls the row back and
 * says why.
 */
export function AppFlagsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const writable = can('app.config.manage');

  const flags = useQuery<Flag[]>({ queryKey: FLAGS_KEY, queryFn: () => api.get('/app-control/flags') });
  const gates = useQuery<Gate[]>({ queryKey: GATES_KEY, queryFn: () => api.get('/app-control/release-gates') });

  const [editing, setEditing] = React.useState<Flag | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<Flag | null>(null);

  /**
   * Optimistic toggle.
   *
   * The previous list is captured before the write and restored if the server refuses, so
   * a rejected change never leaves the screen showing something the platform is not doing.
   */
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.patch(`/app-control/flags/${key}`, { enabled }),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: FLAGS_KEY });
      const previous = queryClient.getQueryData<Flag[]>(FLAGS_KEY);
      queryClient.setQueryData<Flag[]>(FLAGS_KEY, (rows) =>
        (rows ?? []).map((row) => (row.key === key ? { ...row, enabled } : row)));
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(FLAGS_KEY, context?.previous);
      toast.error(error instanceof ApiError ? error.message : t('common.error'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FLAGS_KEY }),
  });

  const move = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.post('/app-control/flags/reorder', { items }),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: FLAGS_KEY });
      const previous = queryClient.getQueryData<Flag[]>(FLAGS_KEY);
      const order = new Map(items.map((i) => [i.id, i.position]));
      queryClient.setQueryData<Flag[]>(FLAGS_KEY, (rows) =>
        [...(rows ?? [])]
          .map((row) => ({ ...row, position: order.get(row.key) ?? row.position }))
          .sort((a, b) => a.position - b.position));
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(FLAGS_KEY, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: FLAGS_KEY }),
  });

  const remove = useApiMutation(
    () => api.delete(`/app-control/flags/${deleting!.key}`),
    {
      successMessage: t('appControl.flagDeleted'),
      invalidate: [FLAGS_KEY],
      onSuccess: () => setDeleting(null),
    },
  );

  const rows = flags.data ?? [];

  return (
    <>
      <PageHeader
        icon={ToggleLeft}
        tone="indigo"
        title={t('appControl.flags.title')}
        subtitle={t('appControl.flags.subtitle')}
        actions={
          writable ? (
            <Button onClick={() => setEditing('new')}><Plus /> {t('appControl.flags.new')}</Button>
          ) : null
        }
      />

      <AppControlTabs active="flags" />

      <Panel
        title={t('appControl.flags.title')}
        description={t('appControl.flags.hint')}
        actions={
          <CsvButton
            name="app-feature-flags"
            rows={rows}
            columns={[
              { key: 'key', header: 'key' },
              { key: 'name_en', header: 'name' },
              { key: 'enabled', header: 'enabled' },
              { key: 'rollout_percentage', header: 'rollout' },
              { key: 'platform', header: 'platform' },
              { key: 'min_app_version', header: 'min_version' },
            ]}
          />
        }
        contentClassName="pt-0"
      >
        {flags.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : flags.error ? (
          <QueryError error={flags.error as Error} onRetry={() => void flags.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={ToggleLeft}
            title={t('appControl.flags.empty')}
            hint={t('appControl.flags.emptyHint')}
            action={writable ? <Button onClick={() => setEditing('new')}><Plus /> {t('appControl.flags.new')}</Button> : undefined}
          />
        ) : (
          <ul className="divide-y">
            {rows.map((flag, index) => (
              <li key={flag.key} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-full min-w-0 sm:flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The name takes its own line on a phone: sharing a wrapping row with
                        the key and the badges squeezes it down to two characters. */}
                    <p className="w-full truncate font-medium sm:w-auto">
                      {lang === 'ar' ? flag.name_ar : (flag.name_en ?? flag.name_ar)}
                    </p>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{flag.key}</code>
                    <PlatformBadge platform={flag.platform} />
                    {flag.rollout_percentage < 100 ? (
                      <Badge variant="warning" className="numeric">{flag.rollout_percentage}%</Badge>
                    ) : null}
                    {flag.min_app_version ? (
                      <Badge variant="secondary" className="numeric" dir="ltr">≥ {flag.min_app_version}</Badge>
                    ) : null}
                  </div>
                  {flag.description ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{flag.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('common.updatedAt')} {formatDate(flag.updated_at, lang, true)}
                    {flag.updated_by_name ? ` · ${flag.updated_by_name}` : ''}
                  </p>
                </div>

                <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                  {writable ? (
                    <MoveButtons
                      index={index}
                      total={rows.length}
                      disabled={move.isPending}
                      onMove={(direction) => {
                        const next = reorder(rows, index, direction, (r) => r.key);
                        if (next) move.mutate(next.items);
                      }}
                    />
                  ) : null}
                  <Switch
                    checked={flag.enabled}
                    disabled={!writable}
                    aria-label={`${flag.key} — ${t('appControl.flags.enabled')}`}
                    onCheckedChange={(enabled) => toggle.mutate({ key: flag.key, enabled })}
                  />
                  {writable ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(flag)}>
                        {t('actions.edit')}
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm"
                        aria-label={t('actions.delete')}
                        onClick={() => setDeleting(flag)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {(gates.data ?? []).map((gate) => (
          <ReleaseGateCard key={gate.platform} gate={gate} writable={writable} />
        ))}
      </div>

      <AppVersionsPanel writable={writable} lang={lang} />

      {editing ? (
        <FlagDialog
          flag={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('appControl.flags.deleteTitle')}
        description={t('appControl.flags.deleteBody', { key: deleting?.key ?? '' })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

function PlatformBadge({ platform }: { platform: 'ios' | 'android' | 'both' }) {
  const { t } = useTranslation();
  if (platform === 'both') return <Badge variant="muted">{t('appControl.platform.both')}</Badge>;
  return (
    <Badge variant="secondary" className="gap-1">
      {platform === 'ios' ? <Apple className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {t(`appControl.platform.${platform}`)}
    </Badge>
  );
}

/** Create or edit one flag. The key is shown but locked on edit — the app reads it by name. */
function FlagDialog({ flag, onClose }: { flag: Flag | null; onClose: () => void }) {
  const { t } = useTranslation();
  const isNew = !flag;
  const form = useForm({
    key: flag?.key ?? '',
    name_ar: flag?.name_ar ?? '',
    name_en: flag?.name_en ?? '',
    description: flag?.description ?? '',
    rollout_percentage: String(flag?.rollout_percentage ?? 100),
    platform: flag?.platform ?? 'both',
    min_app_version: flag?.min_app_version ?? '',
    payload: JSON.stringify(flag?.payload ?? {}, null, 2),
    enabled: flag?.enabled ?? false,
  });
  const [payloadError, setPayloadError] = React.useState<string | null>(null);

  const save = useApiMutation(
    () => {
      let payload: Record<string, unknown>;
      try {
        payload = form.values.payload.trim() ? JSON.parse(form.values.payload) : {};
      } catch {
        // Rejected before the request: a malformed payload is a typing mistake, and the
        // useful place to say so is beside the field rather than in a toast from the server.
        throw new ApiError(400, [{ code: 'INVALID_JSON', message: t('appControl.flags.badJson'), field: 'payload' }]);
      }
      const body = {
        name_ar: form.values.name_ar,
        name_en: form.values.name_en || undefined,
        description: form.values.description || undefined,
        enabled: form.values.enabled,
        rollout_percentage: Number(form.values.rollout_percentage),
        platform: form.values.platform,
        min_app_version: form.values.min_app_version,
        payload,
      };
      return isNew
        ? api.post('/app-control/flags', { ...body, key: form.values.key })
        : api.patch(`/app-control/flags/${flag!.key}`, body);
    },
    {
      successMessage: t('appControl.flags.saved'),
      invalidate: [FLAGS_KEY],
      onSuccess: onClose,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? t('appControl.flags.new') : t('appControl.flags.edit')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Field
            label={t('appControl.flags.key')}
            required={isNew}
            error={form.errors.key}
            hint={isNew ? t('appControl.flags.keyHint') : t('appControl.flags.keyLocked')}
            htmlFor="flag-key"
          >
            <Input
              id="flag-key" dir="ltr" disabled={!isNew}
              value={form.values.key}
              onChange={(e) => form.set('key', e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('appControl.nameAr')} required error={form.errors.name_ar} htmlFor="flag-name-ar">
              <Input id="flag-name-ar" dir="rtl" value={form.values.name_ar} onChange={(e) => form.set('name_ar', e.target.value)} />
            </Field>
            <Field label={t('appControl.nameEn')} error={form.errors.name_en} htmlFor="flag-name-en">
              <Input id="flag-name-en" dir="ltr" value={form.values.name_en} onChange={(e) => form.set('name_en', e.target.value)} />
            </Field>
          </div>

          <Field label={t('appControl.description')} error={form.errors.description} htmlFor="flag-desc">
            <Textarea id="flag-desc" rows={2} value={form.values.description} onChange={(e) => form.set('description', e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appControl.flags.rollout')} error={form.errors.rollout_percentage} hint={t('appControl.flags.rolloutHint')} htmlFor="flag-rollout">
              <Input
                id="flag-rollout" type="number" min={0} max={100} dir="ltr"
                value={form.values.rollout_percentage}
                onChange={(e) => form.set('rollout_percentage', e.target.value)}
              />
            </Field>
            <Field label={t('appControl.platform.label')} error={form.errors.platform}>
              <Select value={form.values.platform} onValueChange={(v) => form.set('platform', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t('appControl.platform.both')}</SelectItem>
                  <SelectItem value="ios">{t('appControl.platform.ios')}</SelectItem>
                  <SelectItem value="android">{t('appControl.platform.android')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('appControl.flags.minVersion')} error={form.errors.min_app_version} hint={t('appControl.flags.minVersionHint')} htmlFor="flag-min">
              <Input id="flag-min" dir="ltr" placeholder="1.4.0" value={form.values.min_app_version} onChange={(e) => form.set('min_app_version', e.target.value)} />
            </Field>
          </div>

          <Field label={t('appControl.flags.payload')} error={form.errors.payload ?? payloadError ?? undefined} hint={t('appControl.flags.payloadHint')} htmlFor="flag-payload">
            <Textarea
              id="flag-payload" dir="ltr" rows={4} className="font-mono text-xs"
              value={form.values.payload}
              onChange={(e) => {
                form.set('payload', e.target.value);
                try {
                  if (e.target.value.trim()) JSON.parse(e.target.value);
                  setPayloadError(null);
                } catch {
                  setPayloadError(t('appControl.flags.badJson'));
                }
              }}
            />
          </Field>

          <div className="flex items-center gap-3">
            <Switch id="flag-enabled" checked={form.values.enabled} onCheckedChange={(v) => form.set('enabled', v)} />
            <Label htmlFor="flag-enabled">{t('appControl.flags.enabled')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            loading={save.isPending}
            disabled={Boolean(payloadError)}
            onClick={() => save.mutate(undefined, { onError: form.applyApiError })}
          >
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The versions of the app the team has announced.
 *
 * Adding one is how members are told to update: from its next launch, every build of that
 * platform below the version sees a sheet with the link given here — one it can put off when
 * the version is optional, and cannot when it is required. Removing a row withdraws it.
 */
function AppVersionsPanel({ writable, lang }: { writable: boolean; lang: string }) {
  const { t } = useTranslation();
  const versions = useQuery<AppVersion[]>({ queryKey: VERSIONS_KEY, queryFn: () => api.get('/app-control/app-versions') });
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AppVersion | null>(null);

  const remove = useApiMutation(
    () => api.delete(`/app-control/app-versions/${deleting!.id}`),
    {
      successMessage: t('appControl.versions.deleted'),
      invalidate: [VERSIONS_KEY],
      onSuccess: () => setDeleting(null),
    },
  );

  const rows = versions.data ?? [];

  return (
    <>
      <Panel
        title={t('appControl.versions.title')}
        description={t('appControl.versions.hint')}
        actions={
          writable ? (
            <Button onClick={() => setAdding(true)}><Plus /> {t('appControl.versions.add')}</Button>
          ) : null
        }
      >
        {versions.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : versions.isError ? (
          <QueryError error={versions.error} onRetry={() => versions.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={Rocket} title={t('appControl.versions.empty')} hint={t('appControl.versions.emptyHint')} />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <PlatformBadge platform={row.platform} />
                <span className="numeric font-semibold" dir="ltr">{row.version}</span>
                <Badge variant={row.update_type === 'required' ? 'danger' : 'muted'}>
                  {t(`appControl.versions.type.${row.update_type}`)}
                </Badge>
                <a
                  href={row.update_url} target="_blank" rel="noreferrer" dir="ltr"
                  className="inline-flex min-w-0 max-w-full items-center gap-1 truncate text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{row.update_url}</span>
                </a>
                <span className="ms-auto text-xs text-muted-foreground">
                  {formatDate(row.created_at, lang)}
                  {row.created_by_name ? ` · ${row.created_by_name}` : ''}
                </span>
                {writable ? (
                  <Button
                    variant="ghost" size="icon" aria-label={t('actions.delete')}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                ) : null}
                {(lang === 'ar' ? row.notes_ar : row.notes_en) ? (
                  <p className="basis-full text-sm text-muted-foreground">
                    {lang === 'ar' ? row.notes_ar : row.notes_en}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {adding ? <AppVersionDialog onClose={() => setAdding(false)} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('appControl.versions.deleteTitle')}
        description={t('appControl.versions.deleteBody', { version: deleting?.version ?? '' })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

/** Announce a version: which platform, its number, optional or necessary, and the update link. */
function AppVersionDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const form = useForm({
    platform: 'android' as 'ios' | 'android',
    version: '',
    update_type: 'optional' as 'optional' | 'required',
    update_url: '',
    notes_ar: '',
    notes_en: '',
  });

  const save = useApiMutation(
    () => api.post('/app-control/app-versions', {
      platform: form.values.platform,
      version: form.values.version.trim(),
      update_type: form.values.update_type,
      update_url: form.values.update_url.trim(),
      notes_ar: form.values.notes_ar || undefined,
      notes_en: form.values.notes_en || undefined,
    }),
    {
      successMessage: t('appControl.versions.saved'),
      invalidate: [VERSIONS_KEY],
      onSuccess: onClose,
    },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('appControl.versions.add')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appControl.platform.label')} required error={form.errors.platform}>
              <Select value={form.values.platform} onValueChange={(v) => form.set('platform', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="android">{t('appControl.platform.android')}</SelectItem>
                  <SelectItem value="ios">{t('appControl.platform.ios')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('appControl.versions.version')} required error={form.errors.version} htmlFor="version-number">
              <Input id="version-number" dir="ltr" placeholder="1.4.0" value={form.values.version} onChange={(e) => form.set('version', e.target.value)} />
            </Field>
            <Field
              label={t('appControl.versions.type.label')} required error={form.errors.update_type}
              hint={t(`appControl.versions.type.${form.values.update_type}Hint`)}
            >
              <Select value={form.values.update_type} onValueChange={(v) => form.set('update_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="optional">{t('appControl.versions.type.optional')}</SelectItem>
                  <SelectItem value="required">{t('appControl.versions.type.required')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t('appControl.versions.url')} required error={form.errors.update_url} hint={t('appControl.versions.urlHint')} htmlFor="version-url">
            <Input id="version-url" dir="ltr" placeholder="https://play.google.com/store/apps/details?id=…" value={form.values.update_url} onChange={(e) => form.set('update_url', e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t('appControl.versions.notes')} — ${t('appControl.nameAr')}`} error={form.errors.notes_ar} htmlFor="version-notes-ar">
              <Textarea id="version-notes-ar" dir="rtl" rows={3} value={form.values.notes_ar} onChange={(e) => form.set('notes_ar', e.target.value)} />
            </Field>
            <Field label={`${t('appControl.versions.notes')} — ${t('appControl.nameEn')}`} error={form.errors.notes_en} htmlFor="version-notes-en">
              <Textarea id="version-notes-en" dir="ltr" rows={3} value={form.values.notes_en} onChange={(e) => form.set('notes_en', e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            loading={save.isPending}
            disabled={!form.values.version.trim() || !form.values.update_url.trim()}
            onClick={() => save.mutate(undefined, { onError: form.applyApiError })}
          >
            {t('appControl.versions.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One platform's version gate.
 *
 * Saved as a whole rather than field by field: the minimum, the store version and the
 * notice are read together by the app, and a half-applied gate — a new minimum with last
 * release's copy — is worse than either state on its own.
 */
function ReleaseGateCard({ gate, writable }: { gate: Gate; writable: boolean }) {
  const { t, i18n } = useTranslation();
  const form = useForm({
    minimum_version: gate.minimum_version,
    latest_version: gate.latest_version ?? '',
    force_update: gate.force_update,
    notice_ar: gate.notice_ar ?? '',
    notice_en: gate.notice_en ?? '',
    store_url: gate.store_url ?? '',
  });

  const save = useApiMutation(
    () => api.patch(`/app-control/release-gates/${gate.platform}`, form.values),
    { successMessage: t('appControl.gate.saved'), invalidate: [GATES_KEY] },
  );

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {gate.platform === 'ios' ? <Apple className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          {t(`appControl.platform.${gate.platform}`)}
        </span>
      }
      description={t('appControl.gate.hint')}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('appControl.gate.minimum')} error={form.errors.minimum_version} htmlFor={`min-${gate.platform}`}>
            <Input id={`min-${gate.platform}`} dir="ltr" disabled={!writable}
              value={form.values.minimum_version} onChange={(e) => form.set('minimum_version', e.target.value)} />
          </Field>
          <Field label={t('appControl.gate.latest')} error={form.errors.latest_version} htmlFor={`latest-${gate.platform}`}>
            <Input id={`latest-${gate.platform}`} dir="ltr" disabled={!writable} placeholder="1.6.0"
              value={form.values.latest_version} onChange={(e) => form.set('latest_version', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('appControl.gate.notice')} — ${t('appControl.nameAr')}`} htmlFor={`nar-${gate.platform}`}>
            <Input id={`nar-${gate.platform}`} dir="rtl" disabled={!writable}
              value={form.values.notice_ar} onChange={(e) => form.set('notice_ar', e.target.value)} />
          </Field>
          <Field label={`${t('appControl.gate.notice')} — ${t('appControl.nameEn')}`} htmlFor={`nen-${gate.platform}`}>
            <Input id={`nen-${gate.platform}`} dir="ltr" disabled={!writable}
              value={form.values.notice_en} onChange={(e) => form.set('notice_en', e.target.value)} />
          </Field>
        </div>
        <Field label={t('appControl.gate.storeUrl')} error={form.errors.store_url} htmlFor={`store-${gate.platform}`}>
          <Input id={`store-${gate.platform}`} dir="ltr" disabled={!writable}
            value={form.values.store_url} onChange={(e) => form.set('store_url', e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Switch id={`force-${gate.platform}`} disabled={!writable}
            checked={form.values.force_update} onCheckedChange={(v) => form.set('force_update', v)} />
          <Label htmlFor={`force-${gate.platform}`}>{t('appControl.gate.force')}</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('common.updatedAt')} {formatDate(gate.updated_at, i18n.language, true)}
        </p>
        {writable ? (
          <div className="flex justify-end">
            <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onError: form.applyApiError })}>
              {t('actions.save')}
            </Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
