import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Save, X, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useForm } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/tones';
import { PageHeader } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Field, Input, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';
import { CountrySelect } from '@/components/data/country-select';
import { ChipInput } from '@/components/ui/chip-input';
import { countryFlag, countryName } from '@/lib/countries';
import { FileDropzone, type UploadedAsset } from '@/features/library/file-dropzone';

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'url' | 'email' | 'date' | 'switch' | 'select'
    | 'tags' | 'file' | 'lookup' | 'interests'
    /** One ISO country, picked by name in either language. */
    | 'country'
    /** Several ISO countries — e.g. the nationalities an award accepts. Empty means all. */
    | 'countries'
    /** A free list typed as chips, stored as a text array. */
    | 'chips'
    /**
     * Several values from `options`, stored as a text array.
     *
     * Where `chips` takes anything typed, this takes only what the column's vocabulary
     * allows — the languages a scholarship teaches in, say, which the CV matcher compares
     * against a fixed set and cannot read from twelve spellings of "English".
     */
    | 'multiselect'
    /** A moment rather than a day — an event starts at a time, not on a date. */
    | 'datetime';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  dir?: 'ltr' | 'rtl';
  /** Hidden from the form, e.g. computed columns. */
  readOnly?: boolean;
  /** What a new record starts with — for a select whose column has a default worth showing. */
  defaultValue?: string;
  /**
   * Heading this field sits under, and — since a group is a stage — the step it appears
   * on. A field with no group joins the run above it.
   */
  group?: string;
  /** Width in the two-column grid. Long prose and file pickers want the full row. */
  colSpan?: 1 | 2;

  /* --- type: 'file' ------------------------------------------------------ */
  surface?: string;
  accept?: string[];
  maxBytes?: number;
  fileNameFrom?: string;
  fileSizeFrom?: string;
  preview?: 'image' | 'file' | 'video' | 'audio';

  /* --- type: 'lookup' ---------------------------------------------------- */
  lookupPath?: string;
  lookupParams?: Record<string, any>;
  lookupLabel?: string;

  /* --- type: 'interests' -------------------------------------------------- */
  readFrom?: string;
  max?: number;
}

/** Everything the list screen and the form screen both need to know about a resource. */
export interface CrudConfig {
  queryKey: string;
  /** API path, e.g. '/exam-documents'. */
  path: string;
  /** UI base route, e.g. '/content/exams'. The form lives at `${route}/new` and `${route}/:id/edit`. */
  route: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  fields: CrudField[];
  createLabel?: string;
  writePermission: string;
  /** Maps a row to form values when editing. */
  toRow?: (row: any) => Record<string, any>;
  /** Reshapes the payload before it is sent. */
  toPayload?: (values: Record<string, any>) => Record<string, any>;
}

/** Radix forbids an empty option value, so "nothing selected" needs a sentinel. */
const NONE = '__none__';

/**
 * Field types whose value is a list. They share an empty array as their blank value and a
 * "send whatever array we hold" rule on save, so an editor who clears one sends `[]` rather
 * than `undefined` — which is the difference between "open to everyone" and "unchanged".
 */
const ARRAY_TYPES = new Set(['interests', 'countries', 'chips', 'multiselect']);

/**
 * A picker backed by a list endpoint — "which library item does this clip promote?".
 * Options are fetched once and filtered in the browser; these lists are short by nature,
 * and a request per keystroke would be worse than useless on a slow connection.
 */
function LookupSelect({
  field, value, onChange,
}: { field: CrudField; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['lookup', field.lookupPath, field.lookupParams],
    queryFn: () => api.get(field.lookupPath!, { limit: 100, ...field.lookupParams }),
    enabled: Boolean(field.lookupPath),
    staleTime: 60_000,
  });
  const rows: any[] = data?.data ?? [];
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
      <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('common.none')}</SelectItem>
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row[field.lookupLabel ?? 'title'] ?? row.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The interest taxonomy as toggle chips.
 *
 * Interests are what the feed, onboarding and the public filters are built on, so every
 * kind of content carries them — and picking from the real list beats free text, which is
 * how a taxonomy quietly turns into twelve spellings of the same word.
 */
export function InterestPicker({
  value, onChange, max,
}: { value: string[]; onChange: (v: string[]) => void; max: number }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['interests', 'all'],
    queryFn: () => api.get('/interests', { limit: 100, sort: 'name' }),
    staleTime: 5 * 60_000,
  });
  const rows: any[] = data?.data ?? [];
  const atLimit = value.length >= max;
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  if (isLoading) return <div className="skeleton h-16 rounded-xl" />;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {rows.map((interest) => {
          const active = value.includes(interest.id);
          return (
            <button
              key={interest.id}
              type="button"
              onClick={() => toggle(interest.id)}
              // A chip past the cap is refused, not hidden — the reader still needs to see
              // what the taxonomy offers.
              disabled={!active && atLimit}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                active
                  ? 'border-accent bg-primary text-primary-foreground'
                  : 'hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {i18n.language === 'ar' ? interest.name : (interest.name_en ?? interest.name)}
            </button>
          );
        })}
      </div>
      <p className="numeric mt-2 text-xs text-muted-foreground">
        {value.length}/{max}
        {rows.length === 0 ? ` · ${t('common.noResults')}` : ''}
      </p>
    </div>
  );
}

/**
 * A fixed vocabulary as toggle chips — the same gesture as the interest picker, so a form
 * that asks for both does not ask for them two different ways.
 */
function MultiSelect({
  value, options, onChange,
}: {
  value: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-accent bg-primary text-primary-foreground'
                : 'hover:bg-secondary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * An ISO timestamp as the value `<input type="datetime-local">` wants, in local time.
 *
 * Slicing an ISO string would show the reader UTC and then save whatever they corrected it
 * to as if it were UTC again, moving every event by the offset each time it was edited.
 */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The create/edit screen for a CRUD resource — a page of its own, like the library's upload
 * wizard, rather than a dialog. A record with twenty fields is not a popup's job: the form
 * needs room, its own URL to return to, and a back button that means something.
 *
 * Field groups become steps. One group is not a journey, so a short form stays a single
 * page with no rail.
 */
export function CrudFormPage({ config }: { config: CrudConfig }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const [step, setStep] = React.useState(0);

  const fields = config.fields.filter((f) => !f.readOnly);
  const initial = React.useMemo(
    () => Object.fromEntries(fields.map((f) => [
      f.name,
      f.type === 'switch' ? false
        : ARRAY_TYPES.has(f.type ?? '') ? ([] as string[])
        : f.defaultValue ?? '',
    ])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.queryKey],
  );
  const form = useForm<Record<string, any>>(initial);
  const [attached, setAttached] = React.useState<Record<string, UploadedAsset | null>>({});

  const { data: record, isLoading } = useQuery({
    queryKey: [config.queryKey, id],
    queryFn: () => api.get(`${config.path}/${id}`),
    enabled: editing,
  });

  React.useEffect(() => {
    if (!record) return;
    const source = config.toRow ? config.toRow(record) : record;
    form.setValues(
      Object.fromEntries(
        fields.map((f) => {
          if (f.type === 'interests') {
            // The row carries the joined records; the form carries their ids.
            const linked = source[f.readFrom ?? 'interests'] ?? [];
            return [f.name, linked.map((x: any) => x.id ?? x)];
          }
          if (f.type === 'multiselect') {
            return [f.name, Array.isArray(source[f.name]) ? source[f.name] : []];
          }
          if (f.type === 'datetime') return [f.name, toLocalInput(source[f.name])];
          return [f.name, source[f.name] ?? (f.type === 'switch' ? false : '')];
        }),
      ),
    );
    setAttached(
      Object.fromEntries(
        fields.filter((f) => f.type === 'file').map((f) => [
          f.name,
          source[f.name]
            ? {
                id: source[f.name],
                original_name: source[f.fileNameFrom ?? 'title'] ?? undefined,
                size_bytes: source[f.fileSizeFrom ?? 'size_bytes'] ?? undefined,
              }
            : null,
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const payload = () => {
    const values = Object.fromEntries(
      fields.map((f) => {
        const raw = form.values[f.name];
        if (f.type === 'number') return [f.name, raw === '' ? undefined : Number(raw)];
        if (f.type === 'tags') {
          return [f.name, String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)];
        }
        if (ARRAY_TYPES.has(f.type ?? '')) return [f.name, Array.isArray(raw) ? raw : []];
        if (f.type === 'switch') return [f.name, Boolean(raw)];
        // The input hands back local wall-clock time; the API stores an instant.
        if (f.type === 'datetime') {
          return [f.name, raw ? new Date(String(raw)).toISOString() : undefined];
        }
        return [f.name, raw === '' ? undefined : raw];
      }),
    );
    return config.toPayload ? config.toPayload(values) : values;
  };

  // A group name opens a run; every field after it belongs to that run until the next name
  // appears. Only the first field of each stage carries the label.
  const groups = React.useMemo(() => {
    const out: [string, CrudField[]][] = [];
    let current = '';
    for (const field of fields) {
      if (field.group) current = field.group;
      const last = out[out.length - 1];
      if (last && last[0] === current) last[1].push(field);
      else out.push([current, [field]]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.queryKey]);
  const stepped = groups.length > 1;
  const active = Math.min(step, groups.length - 1);

  const save = useApiMutation(
    () => (editing ? api.patch(`${config.path}/${id}`, payload()) : api.post(config.path, payload())),
    {
      successMessage: editing ? t('library.updated') : t('library.created'),
      invalidate: [[config.queryKey]],
      onSuccess: () => navigate(config.route),
    },
  );

  const onSave = () =>
    save.mutate(undefined, {
      onError: (err) => {
        form.applyApiError(err);
        // A rejected field two steps back is invisible from here, so go to it.
        const bad = (err as any)?.errors?.find((e: any) => e.field)?.field;
        const at = bad ? groups.findIndex(([, gf]) => gf.some((f) => f.name === bad)) : -1;
        if (at >= 0) setStep(at);
      },
    });

  if (editing && isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={config.icon}
        tone={config.tone}
        title={editing ? t('actions.edit') : (config.createLabel ?? t('actions.create'))}
        subtitle={config.title}
        actions={
          <Button variant="outline" onClick={() => navigate(config.route)}>
            <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
          </Button>
        }
      />

      {stepped ? (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {groups.map(([group], i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={group || i} className="flex items-center gap-2">
                <button
                  type="button"
                  // Steps already passed stay reachable; editing unlocks all of them,
                  // because a correction is rarely in the step you happen to be on.
                  onClick={() => (i <= active || editing) && setStep(i)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors',
                    current ? 'bg-primary text-primary-foreground'
                      : done ? 'bg-accent/10 text-accent hover:bg-accent/15'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <span className="numeric grid h-5 w-5 place-items-center rounded-full bg-current/20 text-[11px] font-semibold">
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {group}
                </button>
                {i < groups.length - 1 ? (
                  <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      <Card>
        <CardContent className="p-5 sm:p-6">
          {(stepped ? [groups[active]] : groups).map(([group, groupFields]) => (
            <section key={group || 'default'} className="mb-6 last:mb-0">
              {group && !stepped ? (
                <h3 className="mb-3 border-b pb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group}
                </h3>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                {groupFields.map((field) => (
                  <Field
                    key={field.name}
                    className={
                      field.colSpan === 2 || field.type === 'textarea' || field.type === 'file'
                        || ARRAY_TYPES.has(field.type ?? '')
                        ? 'md:col-span-2'
                        : undefined
                    }
                    label={field.label}
                    required={field.required}
                    error={form.errors[field.name]}
                    // A dropzone prints its own hint inside the box; repeating it is noise.
                    hint={field.type === 'file' ? undefined : field.hint}
                  >
                    {field.type === 'file' ? (
                      <FileDropzone
                        surface={field.surface ?? 'document'}
                        accept={field.accept ?? ['application/pdf']}
                        maxBytes={field.maxBytes ?? 100 * 1024 * 1024}
                        preview={field.preview}
                        value={attached[field.name] ?? null}
                        onChange={(asset) => {
                          setAttached((a) => ({ ...a, [field.name]: asset }));
                          form.set(field.name, asset?.id ?? '');
                        }}
                        hint={field.hint}
                      />
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        rows={4}
                        value={form.values[field.name] ?? ''}
                        onChange={(e) => form.set(field.name, e.target.value)}
                      />
                    ) : field.type === 'switch' ? (
                      <div className="flex h-9 items-center">
                        <Switch
                          checked={Boolean(form.values[field.name])}
                          onCheckedChange={(v) => form.set(field.name, v)}
                        />
                      </div>
                    ) : field.type === 'select' ? (
                      <Select
                        value={form.values[field.name] || undefined}
                        onValueChange={(v) => form.set(field.name, v)}
                      >
                        <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                        <SelectContent>
                          {field.options?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'interests' ? (
                      <InterestPicker
                        value={form.values[field.name] ?? []}
                        max={field.max ?? 10}
                        onChange={(v: string[]) => form.set(field.name, v)}
                      />
                    ) : field.type === 'country' ? (
                      <CountrySelect
                        value={form.values[field.name] || null}
                        onChange={(code) => form.set(field.name, code ?? '')}
                      />
                    ) : field.type === 'countries' ? (
                      <CountriesPicker
                        value={Array.isArray(form.values[field.name]) ? form.values[field.name] : []}
                        onChange={(next) => form.set(field.name, next)}
                        emptyHint={field.placeholder}
                      />
                    ) : field.type === 'chips' ? (
                      <ChipInput
                        value={Array.isArray(form.values[field.name]) ? form.values[field.name] : []}
                        onChange={(next) => form.set(field.name, next)}
                        max={field.max}
                        placeholder={field.placeholder}
                      />
                    ) : field.type === 'multiselect' ? (
                      <MultiSelect
                        value={Array.isArray(form.values[field.name]) ? form.values[field.name] : []}
                        options={field.options ?? []}
                        onChange={(next) => form.set(field.name, next)}
                      />
                    ) : field.type === 'lookup' ? (
                      <LookupSelect
                        field={field}
                        value={form.values[field.name] ?? ''}
                        onChange={(v) => form.set(field.name, v)}
                      />
                    ) : (
                      <Input
                        type={
                          field.type === 'number' ? 'number'
                            : field.type === 'date' ? 'date'
                            : field.type === 'datetime' ? 'datetime-local'
                            : field.type === 'url' ? 'url'
                            : field.type === 'email' ? 'email'
                            : 'text'
                        }
                        dir={
                          field.dir
                          ?? (['url', 'email', 'datetime'].includes(field.type ?? '') ? 'ltr' : undefined)
                        }
                        placeholder={field.placeholder}
                        value={form.values[field.name] ?? ''}
                        onChange={(e) => form.set(field.name, e.target.value)}
                        aria-invalid={Boolean(form.errors[field.name])}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={stepped && active === 0}
          onClick={() => (stepped ? setStep((x) => x - 1) : navigate(config.route))}
        >
          <ArrowLeft className="rtl:rotate-180" /> {t('actions.previous')}
        </Button>
        <div className="flex gap-2">
          {/* Save stays available on every step: a correction on step two should not
              require walking to the end again. */}
          <Button variant={stepped && active < groups.length - 1 ? 'outline' : 'default'}
            loading={save.isPending} onClick={onSave}>
            <Save /> {t('actions.save')}
          </Button>
          {stepped && active < groups.length - 1 ? (
            <Button onClick={() => setStep((x) => x + 1)}>
              {t('actions.next')} <ArrowRight className="rtl:rotate-180" />
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

/**
 * A list of countries, added one at a time through the searchable picker.
 *
 * Stored as ISO codes so a scholarship's accepted nationalities can be matched against the
 * countries users actually live in — the reach figure in the learning report depends on it.
 */
function CountriesPicker({
  value, onChange, emptyHint,
}: { value: string[]; onChange: (next: string[]) => void; emptyHint?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-sm">
              <span aria-hidden>{countryFlag(code)}</span>
              {countryName(code, i18n.language)}
              <button
                type="button"
                aria-label={t('actions.remove')}
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : emptyHint ? <p className="text-xs text-muted-foreground">{emptyHint}</p> : null}
      <CountrySelect
        value={null}
        allowClear={false}
        placeholder={t('common.add', { defaultValue: 'Add' })}
        onChange={(code) => code && !value.includes(code) && onChange([...value, code])}
      />
    </div>
  );
}
