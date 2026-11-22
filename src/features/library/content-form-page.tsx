import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, FileText, Film, FlaskConical,
  GraduationCap, Languages, Save, ScrollText, Send, X,
} from 'lucide-react';
import { api, type Page } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm } from '@/lib/hooks';
import { cn, CONTENT_TYPES, formatDuration } from '@/lib/utils';
import { CONTENT_TONES } from '@/lib/tones';
import { PageHeader } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import {
  Badge, Card, CardContent, Field, Input, Label, Skeleton, Switch, Textarea,
} from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { ChipInput } from '@/components/ui/chip-input';
import { InterestPicker } from '@/features/taxonomy/crud-form';
import { languageName } from '@/lib/countries';
import { FileDropzone, type UploadedAsset } from './file-dropzone';
import { GROUP_WRITE_PERMISSION, type ContentGroup } from './groups-page';

/* ------------------------------------------------------------------ the schema */

/** Mirrors `FieldDef` in the API's content-schema.ts, which is where it is defined. */
interface FieldDef {
  key: string;
  kind: string;
  store: 'column' | 'details' | 'people' | 'relation';
  step: string;
  label: string;
  required?: boolean;
  options?: string[];
  optionsKey?: string;
  role?: string;
  accept?: 'document' | 'book' | 'image' | 'video' | 'audio' | 'presentation';
  max?: number;
  min?: number;
  span?: 1 | 2;
  /** On a `group` field: the kind of group this type may be filed under. */
  groupType?: 'playlist' | 'reading_series';
}
interface TypeDef {
  surface: string;
  fileAccept: string;
  fields: FieldDef[];
  requireOneOf?: { keys: string[]; label: string }[];
}
interface ContentSchema {
  types: Record<string, TypeDef>;
  steps: string[];
}

/* ------------------------------------------------------------------ upload rules */

const DOC = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const IMG = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
const AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/webm'];
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const MB = 1024 * 1024;
type Preview = 'image' | 'file' | 'video' | 'audio';

/**
 * What each kind of file field accepts. The ceilings match the API's; everything over a few
 * dozen megabytes goes up in parts, so the video limit is policy rather than a transport one.
 */
const ACCEPT: Record<string, { mimes: string[]; max: number; preview: Preview; surface?: string }> = {
  document: { mimes: DOC, max: 100 * MB, preview: 'file' },
  book: { mimes: ['application/pdf', 'application/epub+zip'], max: 100 * MB, preview: 'file' },
  image: { mimes: IMG, max: 10 * MB, preview: 'image', surface: 'cover' },
  video: { mimes: VIDEO, max: 5 * 1024 * MB, preview: 'video', surface: 'video' },
  audio: { mimes: AUDIO, max: 1024 * MB, preview: 'audio', surface: 'audio' },
  presentation: { mimes: ['application/pdf', PPTX], max: 100 * MB, preview: 'file', surface: 'presentation' },
};

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF', 'application/epub+zip': 'EPUB',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  [PPTX]: 'PPTX', 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WEBP',
  'video/mp4': 'MP4', 'video/webm': 'WEBM', 'video/quicktime': 'MOV', 'video/x-matroska': 'MKV',
  'audio/mpeg': 'MP3', 'audio/mp4': 'M4A', 'audio/aac': 'AAC', 'audio/wav': 'WAV',
  'audio/x-wav': 'WAV', 'audio/ogg': 'OGG', 'audio/flac': 'FLAC', 'audio/webm': 'WEBA',
};

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  book: BookOpen, article: FileText, research: FlaskConical, scientific_paper: ScrollText,
  translated_paper: Languages, graduation_project: GraduationCap, video: Film, audio: AudioLines,
};

const LIST_KINDS = ['list', 'keywords', 'multiselect', 'people', 'interests'];
const FILE_KINDS = ['file', 'image', 'files'];
/** Radix Select has no empty value, so "not in a group" travels as this and is saved as null. */
const NO_GROUP = 'none';

/** Form-state key: details and people get a prefix so they can never collide with a column. */
const stateKey = (f: FieldDef) => (f.store === 'details' ? `details.${f.key}` : f.key);

/** "1:02:03", "62:03" or "3723" → seconds. */
function parseDuration(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const parts = String(v).trim().split(':').map(Number);
  if (!parts.length || parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  const total = parts.reduce((acc, p) => acc * 60 + p, 0);
  return total > 0 ? Math.round(total) : null;
}

/**
 * The upload wizard, shared by "create" and "edit".
 *
 * It no longer knows what a book or a research paper is. The fields, their order, which
 * step each sits on and which are required all come from `GET /content/schema` — the same
 * declaration the API validates against — so the form cannot ask for something the server
 * rejects, or omit something it requires. Adding a field to a type is a change to the API's
 * registry and nothing here.
 */
export function ContentFormPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const editing = Boolean(id);

  const [type, setType] = React.useState<string>(searchParams.get('type') ?? 'book');
  const [step, setStep] = React.useState<string>(editing ? '' : 'type');
  const [files, setFiles] = React.useState<Record<string, UploadedAsset | UploadedAsset[] | null>>({});
  const [clip, setClip] = React.useState<UploadedAsset | null>(null);
  const [downloadable, setDownloadable] = React.useState(true);
  const form = useForm<Record<string, any>>({});

  const { data: schema } = useQuery<ContentSchema>({
    queryKey: ['content-schema'],
    queryFn: () => api.get('/content/schema'),
    staleTime: 30 * 60_000,
  });
  const { data: existing } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get(`/content/${id}`),
    enabled: editing,
  });

  const def = schema?.types[type];
  /* Filing an item under a playlist or series changes that group, which takes the group
     editor's permission; without it the field is not offered and nothing is sent for it. */
  const canGroup = can(GROUP_WRITE_PERMISSION);
  const fields = (def?.fields ?? []).filter((f) => f.kind !== 'group' || canGroup);
  const groupField = fields.find((f) => f.kind === 'group');

  /* The groups this type may join — playlists for video and audio, reading series for the
     rest. The schema says which; the list is short enough to load whole. */
  const { data: groupOptions } = useQuery<Page<ContentGroup>>({
    queryKey: ['content-groups', 'options', groupField?.groupType],
    queryFn: () => api.get('/content-groups', {
      filter: { group_type: groupField!.groupType }, sort: 'title', limit: 100,
    }),
    enabled: Boolean(groupField?.groupType),
    staleTime: 60_000,
  });
  const groupTitle = (g: Pick<ContentGroup, 'title' | 'title_en'>) =>
    (lang === 'ar' ? g.title : (g.title_en ?? g.title));
  const typeSteps = (schema?.steps ?? []).filter((s) => fields.some((f) => f.step === s));
  const steps = ['type', ...typeSteps, 'review'];
  const current = step || typeSteps[0] || 'type';
  const stepIndex = steps.indexOf(current);

  /* Reset to the chosen type's fields, carrying over any value both types share — picking
     a type, typing the title, then changing type should not throw the title away. */
  React.useEffect(() => {
    if (!def || editing) return;
    form.setValues((prev) => Object.fromEntries(def.fields
      .filter((f) => !FILE_KINDS.includes(f.kind))
      .map((f) => {
        const k = stateKey(f);
        // A playlist chosen for a video means nothing once the type is a book.
        if (f.kind === 'group') return [k, ''];
        const fallback = LIST_KINDS.includes(f.kind) ? []
          : f.kind === 'language' ? (lang === 'en' ? 'en' : 'ar')
          : f.kind === 'license' ? 'all_rights_reserved' : '';
        return [k, prev[k] ?? fallback];
      })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, editing]);

  /* Editing: spread the stored item back into form state, field by field. */
  React.useEffect(() => {
    if (!existing || !schema) return;
    const d = schema.types[existing.content_type];
    if (!d) return;
    setType(existing.content_type);
    const people: Record<string, string[]> = {};
    for (const a of existing.authors ?? []) (people[a.role] ??= []).push(a.full_name);
    const media = existing.details_media ?? {};
    const asset = (mediaId: string): UploadedAsset => ({
      id: mediaId, url: media[mediaId]?.url, original_name: media[mediaId]?.name,
      size_bytes: media[mediaId]?.size_bytes, duration_seconds: media[mediaId]?.duration_seconds,
    } as UploadedAsset);

    const values: Record<string, any> = {};
    const nextFiles: Record<string, any> = {};
    for (const f of d.fields) {
      const k = stateKey(f);
      if (f.store === 'people') { values[k] = people[f.role!] ?? []; continue; }
      if (f.store === 'relation') { values[k] = (existing.interests ?? []).map((i: any) => i.id); continue; }
      // `group` is only set while the group is live; a stale id would not be among the options.
      if (f.kind === 'group') { values[k] = existing.group?.id ?? ''; continue; }
      const raw = f.store === 'details' ? existing.details?.[f.key] : existing[f.key];
      if (f.key === 'file_media_id') {
        nextFiles[k] = raw ? { id: raw, original_name: existing.file_name ?? existing.title, size_bytes: existing.file_size } : null;
      } else if (f.key === 'cover_media_id') {
        nextFiles[k] = raw ? { id: raw, url: existing.cover_url } : null;
      } else if (f.kind === 'file') nextFiles[k] = raw ? asset(raw) : null;
      else if (f.kind === 'files') nextFiles[k] = (raw ?? []).map(asset);
      else if (f.kind === 'date') values[k] = raw ? String(raw).slice(0, 10) : '';
      else if (f.kind === 'duration') values[k] = raw ? formatDuration(raw) : '';
      else if (LIST_KINDS.includes(f.kind)) values[k] = Array.isArray(raw) ? raw : [];
      else values[k] = raw ?? '';
    }
    form.setValues(values);
    setFiles(nextFiles);
    setDownloadable(existing.is_downloadable !== false);
    if (existing.preview_media_id) {
      setClip({
        id: existing.preview_media_id, url: existing.preview_url, original_name: existing.preview_name,
        size_bytes: existing.preview_size, duration_seconds: existing.preview_duration,
      } as UploadedAsset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, schema]);

  /* ---------------------------------------------------------------- completeness */

  const isEmpty = (f: FieldDef) => {
    const k = stateKey(f);
    if (FILE_KINDS.includes(f.kind)) {
      const v = files[k];
      return !v || (Array.isArray(v) && !v.length);
    }
    const v = form.values[k];
    return v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && !v.length);
  };
  const missingIn = (s: string) => fields.filter((f) => f.required && f.step === s && isEmpty(f));
  const allMissing = fields.filter((f) => f.required && isEmpty(f));
  const oneOfMissing = (def?.requireOneOf ?? []).filter((rule) =>
    !rule.keys.some((key) => {
      const f = fields.find((x) => x.key === key && x.store === 'column');
      return f ? !isEmpty(f) : false;
    }));

  /* ---------------------------------------------------------------- payload */

  const payload = () => {
    const out: Record<string, any> = { content_type: type, details: {}, people: {} };
    for (const f of fields) {
      const k = stateKey(f);
      const raw = form.values[k];
      let value: any;
      if (f.store === 'people') { out.people[f.role!] = raw ?? []; continue; }
      if (f.kind === 'file' || f.kind === 'image') value = (files[k] as UploadedAsset | null)?.id ?? null;
      else if (f.kind === 'files') value = ((files[k] as UploadedAsset[]) ?? []).map((a) => a.id);
      else if (f.kind === 'number' || f.kind === 'year') value = raw === '' || raw == null ? null : Number(raw);
      else if (f.kind === 'duration') {
        const primary = files.file_media_id as UploadedAsset | null;
        value = parseDuration(raw) ?? primary?.duration_seconds ?? null;
      } else if (LIST_KINDS.includes(f.kind)) value = Array.isArray(raw) ? raw : [];
      else value = typeof raw === 'string' ? (raw.trim() || null) : (raw ?? null);

      if (f.store === 'details') out.details[f.key] = value;
      else out[f.key] = value;
    }
    out.preview_media_id = clip?.id ?? null;
    out.is_downloadable = downloadable;
    // A new item has nothing to clear, so empty columns are simply not sent.
    if (!editing) {
      for (const [k, v] of Object.entries(out)) if (v === null) delete out[k];
    }
    return out;
  };

  const save = useApiMutation(
    (submitAfter: boolean) =>
      (editing ? api.patch(`/content/${id}`, payload()) : api.post('/content', payload())).then(
        async (row: any) => {
          if (submitAfter) await api.post(`/content/${row.id}/submit`);
          return row;
        },
      ),
    {
      successMessage: editing ? t('library.updated') : t('library.created'),
      invalidate: [['content'], ['content-groups'], ['analytics', 'overview'], ['moderation', 'summary']],
      onSuccess: (row: any) => navigate(`/content/item/${row.id}`),
    },
  );

  const onSave = (submitAfter: boolean) => {
    form.setErrors({});
    save.mutate(submitAfter, {
      onError: (err: any) => {
        form.applyApiError(err);
        // Take the operator to the step that holds the rejected field.
        const bad = err?.errors?.find((e: any) => e.field)?.field;
        const f = fields.find((x) => stateKey(x) === bad || x.key === bad || `people.${x.role}` === bad);
        if (f) setStep(f.step);
      },
    });
  };

  const setFile = (k: string, v: UploadedAsset | UploadedAsset[] | null) => setFiles((p) => ({ ...p, [k]: v }));
  const label = (f: FieldDef) => t(`content.fields.${f.label}`);
  const optionLabel = (f: FieldDef, v: string) => (f.optionsKey === 'language' || f.kind === 'language')
    ? languageName(v, lang, t('content.options.language.other'))
    : t(`content.options.${f.optionsKey ?? f.key}.${v}`, { defaultValue: v.replace(/_/g, ' ') });

  /* ---------------------------------------------------------------- one field */

  const renderField = (f: FieldDef) => {
    const k = stateKey(f);
    const value = form.values[k];
    const set = (v: any) => form.set(k, v);
    const error = form.errors[k] ?? (f.store === 'people' ? form.errors[`people.${f.role}`] : undefined);
    const accept = ACCEPT[f.key === 'file_media_id' ? (def?.fileAccept ?? 'document') : (f.accept ?? 'document')];
    const surface = f.key === 'file_media_id' ? def!.surface
      : f.kind === 'files' ? 'gallery'
      : f.kind === 'image' ? 'cover'
      : accept.surface ?? def!.surface;

    let control: React.ReactNode;
    switch (f.kind) {
      case 'textarea':
        control = <Textarea rows={4} value={value ?? ''} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(error)} />;
        break;
      case 'richtext':
        control = <Textarea rows={14} value={value ?? ''} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(error)} />;
        break;
      case 'number':
      case 'year':
        control = (
          <Input type="number" dir="ltr" min={f.min} max={f.max} value={value ?? ''}
            onChange={(e) => set(e.target.value)} aria-invalid={Boolean(error)} />
        );
        break;
      case 'date':
        control = <Input type="date" dir="ltr" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
        break;
      case 'url':
        control = (
          <Input type="url" dir="ltr" placeholder="https://" value={value ?? ''}
            onChange={(e) => set(e.target.value)} aria-invalid={Boolean(error)} />
        );
        break;
      case 'duration':
        control = (
          <Input dir="ltr" placeholder="h:mm:ss" value={value ?? ''}
            onChange={(e) => set(e.target.value)} />
        );
        break;
      case 'select':
      case 'language':
      case 'license': {
        const options = f.options ?? [];
        control = (
          <Select value={value || undefined} onValueChange={set}>
            <SelectTrigger aria-invalid={Boolean(error)}>
              <SelectValue placeholder={f.required ? t('common.required') : t('common.optional')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => <SelectItem key={o} value={o}>{optionLabel(f, o)}</SelectItem>)}
            </SelectContent>
          </Select>
        );
        break;
      }
      case 'multiselect':
        control = (
          <div className="flex flex-wrap gap-2">
            {(f.options ?? []).map((o) => {
              const on = (value ?? []).includes(o);
              return (
                <button
                  key={o} type="button"
                  onClick={() => set(on ? value.filter((x: string) => x !== o) : [...(value ?? []), o])}
                  className={cn('rounded-full border px-3 py-1 text-sm transition-colors',
                    on ? 'border-accent bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                >
                  {optionLabel(f, o)}
                </button>
              );
            })}
          </div>
        );
        break;
      case 'list':
      case 'keywords':
      case 'people':
        control = (
          <ChipInput
            value={value ?? []} onChange={set} max={f.max ?? (f.kind === 'people' ? 30 : undefined)}
            placeholder={t(f.kind === 'people' ? 'content.form.peoplePlaceholder' : 'content.form.chipsPlaceholder')}
            invalid={Boolean(error)}
          />
        );
        break;
      case 'interests':
        control = <InterestPicker value={value ?? []} max={10} onChange={set} />;
        break;
      case 'group': {
        // The item's current group is listed even if it fell outside the first page of options.
        const options = groupOptions?.data ?? [];
        const current = existing?.group && !options.some((g) => g.id === existing.group.id)
          && existing.group.group_type === f.groupType ? [existing.group as ContentGroup] : [];
        control = (
          <Select value={value || NO_GROUP} onValueChange={(v) => set(v === NO_GROUP ? '' : v)}>
            <SelectTrigger aria-invalid={Boolean(error)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUP}>{t('common.none')}</SelectItem>
              {[...current, ...options].map((g) => (
                <SelectItem key={g.id} value={g.id}>{groupTitle(g)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        break;
      }
      case 'file':
      case 'image':
        control = (
          <FileDropzone
            surface={surface} accept={accept.mimes} maxBytes={accept.max}
            value={(files[k] as UploadedAsset) ?? null}
            onChange={(a) => {
              setFile(k, a);
              // A playable file knows its own length; the duration field fills itself in.
              if (f.key === 'file_media_id' && a?.duration_seconds) {
                const dur = fields.find((x) => x.kind === 'duration');
                if (dur && !form.values[stateKey(dur)]) form.set(stateKey(dur), formatDuration(a.duration_seconds));
              }
            }}
            preview={f.kind === 'image' ? 'image' : accept.preview}
            hint={accept.mimes.map((m) => MIME_LABEL[m] ?? m).join(' · ')}
          />
        );
        break;
      case 'files': {
        const list = (files[k] as UploadedAsset[]) ?? [];
        control = (
          <div className="space-y-3">
            {list.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {list.map((a) => (
                  <div key={a.id} className="group relative overflow-hidden rounded-lg border">
                    {a.url ? <img src={a.url} alt="" className="aspect-square w-full object-cover" />
                      : <div className="grid aspect-square place-items-center bg-muted text-xs">{a.original_name}</div>}
                    <button
                      type="button" aria-label={t('actions.remove')}
                      onClick={() => setFile(k, list.filter((x) => x.id !== a.id))}
                      className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {list.length < (f.max ?? 12) ? (
              <FileDropzone
                surface="gallery" accept={IMG} maxBytes={10 * MB} value={null}
                onChange={(a) => a && setFile(k, [...list, a])}
                preview="image" hint={`JPEG · PNG · WEBP — ${list.length}/${f.max ?? 12}`}
              />
            ) : null}
          </div>
        );
        break;
      }
      default:
        control = (
          <Input
            value={value ?? ''} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(error)}
            dir={['isbn', 'doi', 'issn', 'volume', 'issue', 'pages'].includes(f.key) ? 'ltr' : undefined}
          />
        );
    }

    return (
      <Field
        key={k}
        className={cn(
          (f.span === 2 || ['textarea', 'richtext', 'file', 'files', 'people', 'keywords', 'list', 'interests', 'multiselect'].includes(f.kind))
            && 'md:col-span-2',
        )}
        label={label(f)}
        required={f.required}
        error={error}
        hint={t(`content.hints.${f.label}`, { defaultValue: '' }) || undefined}
      >
        {control}
      </Field>
    );
  };

  /* ---------------------------------------------------------------- display value */

  const display = (f: FieldDef): string | null => {
    const k = stateKey(f);
    if (FILE_KINDS.includes(f.kind)) {
      const v = files[k];
      if (Array.isArray(v)) return v.length ? t('content.form.fileCount', { count: v.length }) : null;
      return (v as UploadedAsset | null)?.original_name ?? (v ? t('content.form.attached') : null);
    }
    const v = form.values[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
    if (f.kind === 'interests') return t('content.form.selectedCount', { count: v.length });
    if (f.kind === 'group') {
      const picked = groupOptions?.data.find((g) => g.id === v)
        ?? (existing?.group?.id === v ? existing.group : null);
      return picked ? groupTitle(picked) : null;
    }
    if (Array.isArray(v)) return v.map((x: string) => (f.kind === 'multiselect' ? optionLabel(f, x) : x)).join('، ');
    if (['select', 'language', 'license'].includes(f.kind)) return optionLabel(f, v);
    const text = String(v);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  };

  if (!schema || (editing && !existing)) {
    return <><Skeleton className="h-10 w-72" /><Skeleton className="h-96 rounded-2xl" /></>;
  }

  const Icon = TYPE_ICONS[type] ?? BookOpen;
  const blocked = current !== 'type' && current !== 'review' ? missingIn(current) : [];
  const canSave = !allMissing.length && !oneOfMissing.length;

  return (
    <>
      <PageHeader
        icon={Icon}
        tone={CONTENT_TONES[type] ?? 'blue'}
        title={editing ? t('actions.edit') : t('library.uploadTitle')}
        subtitle={`${t(`library.type.${type}`)} — ${t(`library.hints.${type}`)}`}
        actions={<Button variant="outline" onClick={() => navigate(-1)}>{t('actions.cancel')}</Button>}
      />

      {/* Step rail */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((s, i) => {
          if (editing && s === 'type') return null;
          const done = i < stepIndex;
          const active = s === current;
          const incomplete = s !== 'type' && s !== 'review' && missingIn(s).length > 0 && i < stepIndex;
          return (
            <li key={s} className="flex items-center gap-2">
              <button
                onClick={() => (i <= stepIndex || editing) && setStep(s)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors',
                  active ? 'bg-primary text-primary-foreground'
                    : incomplete ? 'bg-warning/15 text-warning'
                    : done ? 'bg-accent/10 text-accent hover:bg-accent/15'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <span className="numeric grid h-5 w-5 place-items-center rounded-full bg-current/20 text-[11px] font-semibold">
                  {done && !incomplete ? <Check className="h-3 w-3" /> : (editing ? i : i + 1)}
                </span>
                {t(`content.steps.${s}`)}
              </button>
              {i < steps.length - 1 ? <span className="hidden h-px w-5 bg-border sm:block" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="p-5 sm:p-6">
          {current === 'type' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CONTENT_TYPES.map((ct) => {
                const TypeIcon = TYPE_ICONS[ct] ?? BookOpen;
                const active = type === ct;
                return (
                  <button
                    key={ct}
                    onClick={() => setType(ct)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all',
                      active ? 'border-accent bg-accent/5 shadow-soft' : 'hover:border-accent/40 hover:bg-secondary/40',
                    )}
                  >
                    <span className={cn('grid h-9 w-9 place-items-center rounded-lg',
                      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                      <TypeIcon className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{t(`library.type.${ct}`)}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{t(`library.hints.${ct}`)}</span>
                    <span className="numeric text-[11px] text-muted-foreground">
                      {t('content.form.fieldCount', { count: schema.types[ct]?.fields.length ?? 0 })}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : current === 'review' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`library.type.${type}`)}</Badge>
                {downloadable ? <Badge variant="success">{t('library.fields.downloadable')}</Badge> : null}
              </div>
              <h2 className="text-xl font-semibold">{form.values.title || '—'}</h2>

              {!canSave ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
                  <p className="mb-1 flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4" /> {t('content.form.incomplete')}
                  </p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {allMissing.map((f) => (
                      <li key={stateKey(f)}>
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => setStep(f.step)}>
                          {label(f)}
                        </button>
                      </li>
                    ))}
                    {oneOfMissing.map((r) => (
                      <li key={r.label}>
                        {r.keys.map((k) => label(fields.find((f) => f.key === k)!)).join(` ${t('content.form.or')} `)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {typeSteps.map((s) => {
                const rows = fields.filter((f) => f.step === s)
                  .map((f) => [f, display(f)] as const).filter(([, v]) => v);
                if (!rows.length) return null;
                return (
                  <section key={s}>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t(`content.steps.${s}`)}</h3>
                    <dl className="grid gap-x-6 sm:grid-cols-2">
                      {rows.map(([f, v]) => (
                        <div key={stateKey(f)} className="flex gap-3 border-b py-1.5 text-sm">
                          <dt className="w-40 shrink-0 text-muted-foreground">{label(f)}</dt>
                          <dd className="min-w-0 break-words font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {fields.filter((f) => f.step === current).map(renderField)}

              {/* Platform settings, not bibliographic fields: an introductory clip any item
                  may carry, and whether readers may take a copy away. */}
              {current === 'media' ? (
                <Field className="md:col-span-2" label={t('library.fields.clip')} hint={t('library.hints.clip')}>
                  <FileDropzone
                    surface="preview" accept={VIDEO} maxBytes={500 * MB} value={clip} onChange={setClip}
                    preview="video" hint={VIDEO.map((m) => MIME_LABEL[m]).join(' · ')}
                  />
                </Field>
              ) : null}
              {current === 'classify' ? (
                <div className="flex items-center justify-between rounded-xl border p-3 md:col-span-2">
                  <div>
                    <Label>{t('library.fields.downloadable')}</Label>
                    <p className="text-xs text-muted-foreground">{t('content.hints.downloadable')}</p>
                  </div>
                  <Switch checked={downloadable} onCheckedChange={setDownloadable} />
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={stepIndex <= (editing ? 1 : 0)}
          onClick={() => setStep(steps[Math.max(0, stepIndex - 1)])}
        >
          <ArrowRight className="hidden rtl:block" />
          <ArrowLeft className="rtl:hidden" />
          {t('actions.previous')}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {blocked.length ? (
            <span className="text-xs text-muted-foreground">
              {t('content.form.stillNeeded')}: {blocked.map(label).join('، ')}
            </span>
          ) : null}
          {current === 'review' || editing ? (
            <>
              <Button variant="outline" loading={save.isPending} disabled={!canSave} onClick={() => onSave(false)}>
                <Save /> {t('actions.save')}
              </Button>
              <Button loading={save.isPending} disabled={!canSave} onClick={() => onSave(true)}>
                <Send /> {t('library.submitForReview')}
              </Button>
            </>
          ) : null}
          {current !== 'review' ? (
            <Button
              variant={editing ? 'outline' : 'default'}
              disabled={blocked.length > 0}
              onClick={() => setStep(steps[Math.min(steps.length - 1, stepIndex + 1)])}
            >
              {t('actions.next')}
              <ArrowLeft className="hidden rtl:block" />
              <ArrowRight className="rtl:hidden" />
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
