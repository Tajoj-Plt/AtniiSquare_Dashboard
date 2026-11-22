import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Save, ShieldCheck, UserCog } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { cn, formatNumber } from '@/lib/utils';
import { PageHeader, Panel } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, Checkbox, Field, Input, Skeleton } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';

/**
 * The permission matrix. Permissions are grouped by the module that owns them, which makes
 * the grid readable at ~37 permissions and keeps related capabilities adjacent.
 */
export function RolesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const lang = i18n.language;
  const writable = can('role.manage');

  const { data: roles, isLoading, refetch } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });
  const { data: permissions } = useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: () => api.get('/roles/permissions'),
  });

  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);

  const active = React.useMemo(
    () => (roles ?? []).find((r: any) => r.slug === (activeSlug ?? roles?.[0]?.slug)),
    [roles, activeSlug],
  );

  React.useEffect(() => {
    if (active) setDraft(active.permissions ?? []);
  }, [active?.id]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of permissions ?? []) {
      const key = p.module ?? 'other';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [permissions]);

  const save = useApiMutation(
    () => api.post(`/roles/${active.id}/permissions`, { permissions: draft }),
    { successMessage: t('roles.saved'), invalidate: [['roles']], onSuccess: () => void refetch() },
  );

  const form = useForm({ slug: '', name: '', name_en: '', description: '' });
  const create = useApiMutation(() => api.post('/roles', form.values), {
    successMessage: t('roles.saved'),
    invalidate: [['roles']],
    onSuccess: () => { setCreating(false); form.reset(); },
  });

  const dirty = active && JSON.stringify([...draft].sort()) !== JSON.stringify([...(active.permissions ?? [])].sort());
  const locked = active?.slug === 'admin';

  return (
    <>
      <PageHeader
        icon={UserCog}
        tone="sky"
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        actions={writable ? <Button onClick={() => setCreating(true)}><Plus /> {t('roles.newRole')}</Button> : null}
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card className="h-fit">
          <CardContent className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : (
              <ul className="space-y-0.5">
                {(roles ?? []).map((role: any) => (
                  <li key={role.id}>
                    <button
                      onClick={() => setActiveSlug(role.slug)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm transition-colors',
                        active?.slug === role.slug ? 'bg-accent/10 text-accent' : 'hover:bg-secondary',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {lang === 'ar' ? role.name : (role.name_en ?? role.slug)}
                        </span>
                        <span className="numeric block text-xs text-muted-foreground">
                          {t('roles.permissionCount', { count: role.permissions?.length ?? 0 })}
                        </span>
                      </span>
                      <Badge variant="secondary" className="numeric shrink-0">
                        {formatNumber(role.user_count, lang)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Panel
          title={active ? (lang === 'ar' ? active.name : (active.name_en ?? active.slug)) : t('roles.matrix')}
          description={active?.description}
          actions={
            writable && !locked ? (
              <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(undefined)}>
                <Save /> {t('actions.save')}
              </Button>
            ) : null
          }
        >
          {locked ? (
            <p className="mb-4 flex items-center gap-2 rounded-md bg-accent/5 p-3 text-sm text-accent">
              <ShieldCheck className="h-4 w-4" /> {t('roles.adminLocked')}
            </p>
          ) : null}

          <div className="space-y-5">
            {grouped.map(([module, perms]) => (
              <div key={module}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</p>
                <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {perms.map((p: any) => (
                    <label
                      key={p.slug}
                      className={cn(
                        'flex items-start gap-2 rounded-md border p-2 text-sm transition-colors',
                        writable && !locked ? 'cursor-pointer hover:bg-secondary/50' : 'opacity-80',
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        disabled={!writable || locked}
                        checked={locked || draft.includes(p.slug)}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => (checked ? [...prev, p.slug] : prev.filter((s) => s !== p.slug)))
                        }
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{p.name ?? p.slug}</span>
                        <code className="block truncate text-[11px] text-muted-foreground">{p.slug}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('roles.newRole')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('taxonomy.slug')} required error={form.errors.slug} hint="lower_snake_case">
              <Input dir="ltr" value={form.values.slug} onChange={(e) => form.set('slug', e.target.value)} />
            </Field>
            <Field label={t('taxonomy.nameAr')} required error={form.errors.name}>
              <Input value={form.values.name} onChange={(e) => form.set('name', e.target.value)} />
            </Field>
            <Field label={t('taxonomy.nameEn')}>
              <Input value={form.values.name_en} onChange={(e) => form.set('name_en', e.target.value)} />
            </Field>
            <Field label={t('common.details')}>
              <Input value={form.values.description} onChange={(e) => form.set('description', e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>{t('actions.cancel')}</Button>
            <Button loading={create.isPending} onClick={() => create.mutate(undefined, { onError: form.applyApiError })}>
              {t('actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
