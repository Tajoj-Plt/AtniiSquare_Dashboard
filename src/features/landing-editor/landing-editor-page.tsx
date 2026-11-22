import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown, ArrowUp, ExternalLink, EyeOff, LayoutTemplate, Plus, RotateCcw, Save, Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { cn, formatRelative } from '@/lib/utils';
import { PageHeader, Panel } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import {
  Badge, Card, CardContent, Field, Input, Label, Switch, Textarea,
} from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { ICON_NAMES, Icon } from '@/features/landing/landing-parts';

/** Which text fields each known section exposes, and whether its items are editable. */
type Field = { name: string; long?: boolean; ltr?: boolean };
type ItemMeta = { name: string; type: 'number' | 'text'; placeholder?: string; width?: string };
type Schema = { text: Field[]; itemFields?: Field[]; itemMeta?: ItemMeta[]; itemLabel?: string };

const SECTION_SCHEMA: Record<string, Schema> = {
  hero:     { text: [{ name: 'eyebrow' }, { name: 'title', long: true }, { name: 'subtitle', long: true }, { name: 'ctaPrimary' }, { name: 'ctaSecondary' }],
              itemFields: [{ name: 'label' }], itemMeta: [{ name: 'value', type: 'number', width: 'w-28' }], itemLabel: 'Stat' },
  problem:  { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  solution: { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  types:    { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  how:      { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  audience: { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  trust:    { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
  faq:      { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }], itemLabel: 'Question' },
  cta:      { text: [{ name: 'title' }, { name: 'subtitle', long: true }, { name: 'primary' }, { name: 'secondary' }] },
  // A URL is the same in both languages nine times out of ten — the public page falls back
  // to the other language when one is left blank, so only fill both for a dubbed film.
  video:    { text: [{ name: 'eyebrow' }, { name: 'title' }, { name: 'subtitle', long: true },
                     { name: 'videoUrl', ltr: true }, { name: 'posterUrl', ltr: true },
                     { name: 'duration' }, { name: 'caption' }],
              itemFields: [{ name: 'title' }, { name: 'body', long: true }],
              itemMeta: [{ name: 'time', type: 'text', placeholder: '1:20', width: 'w-24' }] },
  mobile:   { text: [{ name: 'eyebrow' }, { name: 'title' }, { name: 'subtitle', long: true },
                     { name: 'screenUrl', ltr: true }, { name: 'screenTitle' }, { name: 'readerTitle' },
                     { name: 'storeNote' }, { name: 'note' }],
              itemFields: [{ name: 'title' }, { name: 'body', long: true }] },
};

const DEFAULT_SCHEMA: Schema = { text: [{ name: 'title' }, { name: 'subtitle', long: true }], itemFields: [{ name: 'title' }, { name: 'body', long: true }] };
const LANGS = [{ code: 'ar', label: 'العربية' }, { code: 'en', label: 'English' }] as const;

/**
 * The landing page editor.
 *
 * Copy is edited per language side by side rather than behind a language switch — the two
 * versions have to say the same thing, and that is far easier to check when both are on
 * screen. Saving sends only the section being edited, and the server merges, so an
 * untouched language is never overwritten by a partial save.
 */
export function LandingEditorPage() {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<any>(null);
  const [creating, setCreating] = React.useState(false);
  const [newKey, setNewKey] = React.useState('');
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState<'all' | string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['landing', 'admin'],
    queryFn: () => api.get('/landing/admin'),
  });

  const sections: any[] = data?.sections ?? [];
  const active = sections.find((s) => s.section_key === (activeKey ?? sections[0]?.section_key));

  // Re-seed the working copy whenever a different section is opened or the server data changes.
  React.useEffect(() => {
    if (!active) return;
    setDraft({
      text: { ar: {}, en: {}, ...(active.content?.text ?? {}) },
      items: JSON.parse(JSON.stringify(active.content?.items ?? [])),
    });
  }, [active?.section_key, active?.updated_at]);

  const invalidate = [['landing']];
  const after = () => { void refetch(); };

  const save = useApiMutation(
    () => api.patch(`/landing/sections/${active.section_key}`, draft),
    { successMessage: t('library.updated'), invalidate, onSuccess: after },
  );
  const toggle = useApiMutation(
    (vars: { key: string; visible: boolean }) =>
      api.post(`/landing/sections/${vars.key}/visibility`, { visible: vars.visible }),
    { invalidate, onSuccess: after },
  );
  const reorder = useApiMutation(
    (keys: string[]) => api.post('/landing/sections/reorder', { keys }),
    { invalidate, onSuccess: after },
  );
  const create = useApiMutation(
    () => api.post('/landing/sections', { section_key: newKey.trim() }),
    { successMessage: t('library.created'), invalidate,
      onSuccess: () => { setCreating(false); setNewKey(''); after(); } },
  );
  const remove = useApiMutation(
    (key: string) => api.delete(`/landing/sections/${key}`),
    { successMessage: t('library.deleted'), invalidate,
      onSuccess: () => { setDeleting(null); setActiveKey(null); after(); } },
  );
  const reset = useApiMutation(
    (scope: 'all' | string) =>
      scope === 'all' ? api.post('/landing/reset', {}) : api.post(`/landing/sections/${scope}/reset`, {}),
    { successMessage: t('settings.saved'), invalidate,
      onSuccess: () => { setResetting(null); after(); } },
  );
  const saveSettings = useApiMutation(
    (settings: Record<string, unknown>) => api.patch('/landing/settings', { settings }),
    { successMessage: t('settings.saved'), invalidate, onSuccess: after },
  );

  const move = (index: number, delta: number) => {
    const keys = sections.map((s) => s.section_key);
    const target = index + delta;
    if (target < 0 || target >= keys.length) return;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    reorder.mutate(keys);
  };

  const schema = active ? (SECTION_SCHEMA[active.section_key] ?? DEFAULT_SCHEMA) : DEFAULT_SCHEMA;

  const setText = (lang: string, field: string, value: string) =>
    setDraft((d: any) => ({ ...d, text: { ...d.text, [lang]: { ...d.text[lang], [field]: value } } }));

  const setItem = (i: number, lang: string, field: string, value: string) =>
    setDraft((d: any) => {
      const items = [...d.items];
      items[i] = { ...items[i], [lang]: { ...(items[i]?.[lang] ?? {}), [field]: value } };
      return { ...d, items };
    });

  const setItemMeta = (i: number, field: string, value: any) =>
    setDraft((d: any) => {
      const items = [...d.items];
      items[i] = { ...items[i], [field]: value };
      return { ...d, items };
    });

  return (
    <>
      <PageHeader
        icon={LayoutTemplate}
        tone="violet"
        title={t('landingEditor.title')}
        subtitle={t('landingEditor.subtitle')}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/welcome" target="_blank" rel="noreferrer">
                <ExternalLink /> {t('landingEditor.preview')}
              </a>
            </Button>
            <Button variant="outline" onClick={() => setResetting('all')}>
              <RotateCcw /> {t('landingEditor.resetAll')}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('landingEditor.newSection')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        {/* ----------------------------------------------------- section list */}
        <div className="space-y-4">
          <Card className="h-fit">
            <CardContent className="p-2">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-11 rounded-lg" />)}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {sections.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveKey(s.section_key)}
                        className={cn(
                          'min-w-0 flex-1 rounded-lg px-2.5 py-2 text-start text-sm transition-colors',
                          active?.section_key === s.section_key ? 'bg-accent/10 text-accent' : 'hover:bg-secondary',
                          !s.is_visible && 'opacity-55',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="numeric text-[11px] text-muted-foreground">{i + 1}</span>
                          <span className="truncate font-medium">
                            {t(`landingEditor.sections.${s.section_key}`, { defaultValue: s.section_key })}
                          </span>
                          {!s.is_visible ? <EyeOff className="ms-auto h-3.5 w-3.5 shrink-0" /> : null}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col">
                        <button onClick={() => move(i, -1)} disabled={i === 0}
                          aria-label={t('actions.previous')}
                          className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                          aria-label={t('actions.next')}
                          className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <SettingsPanel settings={data?.settings} onSave={(s) => saveSettings.mutate(s)} saving={saveSettings.isPending} />
        </div>

        {/* --------------------------------------------------------- editor */}
        {active && draft ? (
          <Panel
            title={t(`landingEditor.sections.${active.section_key}`, { defaultValue: active.section_key })}
            description={
              active.updated_at
                ? `${t('common.updatedAt')} · ${formatRelative(active.updated_at, t('common.language') === 'اللغة' ? 'ar' : 'en')}${active.updated_by_name ? ` · ${active.updated_by_name}` : ''}`
                : undefined
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={active.is_visible ? 'success' : 'muted'}>
                  {active.is_visible ? t('landingEditor.visible') : t('landingEditor.hidden')}
                </Badge>
                <Switch
                  checked={active.is_visible}
                  onCheckedChange={(v) => toggle.mutate({ key: active.section_key, visible: v })}
                  aria-label={t('landingEditor.visible')}
                />
                <Button variant="outline" size="sm" onClick={() => setResetting(active.section_key)}>
                  <RotateCcw /> {t('landingEditor.reset')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(active.section_key)}>
                  <Trash2 className="text-danger" />
                </Button>
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate(undefined)}>
                  <Save /> {t('actions.save')}
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              {schema.text.map((field) => (
                <div key={field.name} className="grid gap-3 sm:grid-cols-2">
                  {LANGS.map((lang) => (
                    <Field
                      key={lang.code}
                      label={`${t(`landingEditor.fields.${field.name}`, { defaultValue: field.name })} — ${lang.label}`}
                    >
                      {field.long ? (
                        <Textarea
                          rows={3}
                          dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                          value={draft.text[lang.code]?.[field.name] ?? ''}
                          onChange={(e) => setText(lang.code, field.name, e.target.value)}
                        />
                      ) : field.ltr ? (
                        <Input
                          dir="ltr"
                          placeholder="https://…"
                          value={draft.text[lang.code]?.[field.name] ?? ''}
                          onChange={(e) => setText(lang.code, field.name, e.target.value)}
                        />
                      ) : (
                        <Input
                          dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                          value={draft.text[lang.code]?.[field.name] ?? ''}
                          onChange={(e) => setText(lang.code, field.name, e.target.value)}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              ))}

              {schema.itemFields ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <Label>{t('landingEditor.items')}</Label>
                    <Button variant="outline" size="sm"
                      onClick={() => setDraft((d: any) => ({ ...d, items: [...d.items, { icon: 'Sparkles', ar: {}, en: {} }] }))}>
                      <Plus /> {t('actions.add')}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {draft.items.map((item: any, i: number) => (
                      <div key={i} className="rounded-xl border bg-muted/30 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="numeric grid h-7 w-7 place-items-center rounded-full bg-card text-xs font-semibold">
                            {i + 1}
                          </span>
                          <Select value={item.icon ?? 'Sparkles'} onValueChange={(v) => setItemMeta(i, 'icon', v)}>
                            <SelectTrigger className="h-9 w-44">
                              <span className="flex items-center gap-2">
                                <Icon name={item.icon} className="h-4 w-4" />
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {(schema.itemMeta ?? []).map((meta) => (
                            <Input
                              key={meta.name}
                              type={meta.type}
                              dir="ltr"
                              placeholder={meta.placeholder}
                              aria-label={t(`landingEditor.fields.${meta.name}`, { defaultValue: meta.name })}
                              className={cn('h-9', meta.width ?? 'w-28')}
                              value={item[meta.name] ?? (meta.type === 'number' ? 0 : '')}
                              onChange={(e) =>
                                setItemMeta(i, meta.name, meta.type === 'number' ? Number(e.target.value) : e.target.value)
                              }
                            />
                          ))}
                          <Button variant="ghost" size="icon-sm" className="ms-auto"
                            onClick={() => setDraft((d: any) => ({ ...d, items: d.items.filter((_: any, x: number) => x !== i) }))}
                            aria-label={t('actions.remove')}>
                            <Trash2 className="text-danger" />
                          </Button>
                        </div>
                        {schema.itemFields!.map((field) => (
                          <div key={field.name} className="mb-3 grid gap-3 last:mb-0 sm:grid-cols-2">
                            {LANGS.map((lang) => (
                              <Field key={lang.code}
                                label={`${t(`landingEditor.fields.${field.name}`, { defaultValue: field.name })} — ${lang.label}`}>
                                {field.long ? (
                                  <Textarea rows={2} dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                                    value={item[lang.code]?.[field.name] ?? ''}
                                    onChange={(e) => setItem(i, lang.code, field.name, e.target.value)} />
                                ) : (
                                  <Input dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                                    value={item[lang.code]?.[field.name] ?? ''}
                                    onChange={(e) => setItem(i, lang.code, field.name, e.target.value)} />
                                )}
                              </Field>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                    {draft.items.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {t('common.noResults')}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        ) : (
          <Panel title={t('common.loading')}><div className="skeleton h-64 rounded-xl" /></Panel>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('landingEditor.newSection')}</DialogTitle></DialogHeader>
          <Field label={t('taxonomy.slug')} required hint="lower_snake_case — e.g. partners">
            <Input dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value)} autoFocus />
          </Field>
          <p className="text-xs text-muted-foreground">{t('landingEditor.newSectionHint')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>{t('actions.cancel')}</Button>
            <Button loading={create.isPending} disabled={!/^[a-z][a-z0-9_]{1,39}$/.test(newKey.trim())}
              onClick={() => create.mutate(undefined)}>
              {t('actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.confirmDelete')} description={deleting ?? undefined}
        confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')}
        loading={remove.isPending} onConfirm={() => { if (deleting) remove.mutate(deleting); }}
      />
      <ConfirmDialog
        open={Boolean(resetting)} onOpenChange={(o) => !o && setResetting(null)}
        title={resetting === 'all' ? t('landingEditor.resetAll') : t('landingEditor.reset')}
        description={t('landingEditor.resetHint')}
        confirmLabel={t('actions.confirm')} cancelLabel={t('actions.cancel')}
        destructive={false} loading={reset.isPending}
        onConfirm={() => { if (resetting) reset.mutate(resetting); }}
      />
    </>
  );
}

/** Page-wide switches and links, saved as one settings document. */
function SettingsPanel({
  settings, onSave, saving,
}: { settings: any; onSave: (s: Record<string, unknown>) => void; saving: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState<any>(null);
  React.useEffect(() => { if (settings) setDraft({ ...settings }); }, [settings]);
  if (!draft) return null;

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  return (
    <Panel
      title={t('landingEditor.pageSettings')}
      actions={<Button size="sm" loading={saving} onClick={() => onSave(draft)}><Save /> {t('actions.save')}</Button>}
    >
      <div className="space-y-4">
        {[
          { key: 'showStats', label: t('landingEditor.showStats') },
          { key: 'showLiveLibrary', label: t('landingEditor.showLiveLibrary') },
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <Label className="text-sm font-normal">{row.label}</Label>
            <Switch checked={Boolean(draft[row.key])} onCheckedChange={(v) => set(row.key, v)} />
          </div>
        ))}
        <Field label={t('landingEditor.signInHref')}>
          <Input dir="ltr" value={draft.signInHref ?? ''} onChange={(e) => set('signInHref', e.target.value)} />
        </Field>
        <Field label={t('landingEditor.docsHref')}>
          <Input dir="ltr" value={draft.docsHref ?? ''} onChange={(e) => set('docsHref', e.target.value)} />
        </Field>
        {/* Left empty, the mobile section shows its own note instead of a dead button. */}
        <Field label={t('landingEditor.appStoreHref')}>
          <Input dir="ltr" placeholder="https://apps.apple.com/…"
            value={draft.appStoreHref ?? ''} onChange={(e) => set('appStoreHref', e.target.value)} />
        </Field>
        <Field label={t('landingEditor.playStoreHref')}>
          <Input dir="ltr" placeholder="https://play.google.com/…"
            value={draft.playStoreHref ?? ''} onChange={(e) => set('playStoreHref', e.target.value)} />
        </Field>
      </div>
    </Panel>
  );
}
