import { useTranslation } from 'react-i18next';
import { FileCheck2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { CrudPage } from '@/features/taxonomy/crud-page';
import { CrudFormPage, type CrudConfig } from '@/features/taxonomy/crud-form';

const STAGES = ['primary', 'secondary', 'university', 'diploma', 'other'] as const;
/** What the document is — a paper, or the book, worksheet or summary shelved beside it. */
const MATERIAL_TYPES = ['exam', 'book', 'worksheet', 'summary', 'other'] as const;
const EXAM_TYPES = ['final', 'midterm', 'quiz', 'practice', 'supplementary'] as const;
const TERMS = ['first', 'second', 'summer', 'supplementary'] as const;
/** الدور — first sitting, the resit, a supplementary or a special round. */
const SITTINGS = ['first', 'second', 'supplementary', 'special'] as const;

/**
 * Past papers.
 *
 * The form follows how a paper is actually catalogued: the subject and level it tests, the
 * institution and teacher that set it, the sitting it belongs to (type, year, term, round),
 * and the two documents — the paper, and the marking scheme when one exists. There is no
 * title field: the API composes one from the subject and sitting, so the two can never
 * disagree. A file is asked for last because everything above it makes the file findable.
 */

/** The shared description of this resource: used by the list and by the form. */
function useExamConfig(): CrudConfig {
  const { t } = useTranslation();

  /** Turns a list of stored values into select options with their translated labels. */
  const options = (values: readonly string[], prefix: string) =>
    values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));

  return {
    queryKey: 'exam-documents',
    path: '/exam-documents',
    route: '/content/exams',
    title: t('learn.examsTitle'),
    subtitle: t('exams.subtitle'),
    tone: 'emerald',
    icon: FileCheck2,
    writePermission: 'exam.manage',
    createLabel: t('exams.newPaper'),
    fields: [
        /* --- the subject ---------------------------------------------- */
        { name: 'subject', label: t('exams.subjectName'), required: true, group: t('exams.groups.subject'),
          placeholder: t('exams.subjectPlaceholder') },
        { name: 'subject_en', label: t('exams.subjectNameEn'), dir: 'ltr' },
        { name: 'grade_level', label: t('exams.gradeLevel'), placeholder: t('exams.gradePlaceholder') },
        { name: 'stage', label: t('exams.stage'), type: 'select', required: true, options: options(STAGES, 'exams.stages') },
        { name: 'material_type', label: t('exams.materialType'), type: 'select', defaultValue: 'exam',
          options: options(MATERIAL_TYPES, 'exams.materialTypes'), hint: t('exams.materialTypeHint') },
        { name: 'specialization', label: t('exams.specialization'), colSpan: 2 },

        /* --- who set it ------------------------------------------------ */
        { name: 'institution', label: t('exams.institution'), colSpan: 2, group: t('exams.groups.source') },
        { name: 'faculty', label: t('exams.faculty') },
        { name: 'department', label: t('exams.department') },
        { name: 'teacher', label: t('exams.teacher') },

        /* --- the sitting ----------------------------------------------- */
        { name: 'exam_type', label: t('exams.type'), type: 'select', options: options(EXAM_TYPES, 'exams.types'),
          group: t('exams.groups.sitting') },
        { name: 'year', label: t('learn.year'), type: 'number', required: true, placeholder: '2025' },
        { name: 'term', label: t('exams.term'), type: 'select', options: options(TERMS, 'exams.terms') },
        { name: 'sitting', label: t('exams.sitting'), type: 'select', options: options(SITTINGS, 'exams.sittings') },
        { name: 'duration_minutes', label: t('exams.duration'), type: 'number', hint: t('exams.durationHint') },
        { name: 'page_count', label: t('exams.pageCount'), type: 'number' },

        /* --- where it belongs in the taxonomy --------------------------- */
        { name: 'interest_ids', label: t('library.fields.interests'), type: 'interests', colSpan: 2,
          group: t('common.classification'), hint: t('exams.interestsHint') },

        /* --- the documents --------------------------------------------- */
        {
          name: 'media_id', label: t('exams.paperFile'), type: 'file', required: true,
          surface: 'exam', accept: ['application/pdf'], hint: t('exams.paperHint'),
          fileNameFrom: 'title', group: t('exams.groups.documents'),
        },
        {
          name: 'answer_media_id', label: t('exams.answerFile'), type: 'file',
          surface: 'exam', accept: ['application/pdf'], hint: t('exams.answerHint'),
          fileNameFrom: 'title',
        },
        { name: 'source', label: t('exams.source'), placeholder: t('exams.sourcePlaceholder') },
        { name: 'status', label: t('common.status'), type: 'select',
          options: ['draft', 'published', 'archived'].map((v) => ({ value: v, label: t(`library.status.${v}`, { defaultValue: v }) })) },
      ],
  };
}

export function ExamDocumentsPage() {
  const config = useExamConfig();
  const { t, i18n } = useTranslation();
  return (
    <CrudPage
      {...config}
      path="/exam-documents"
      subtitle={t('exams.subtitle')}
      icon={FileCheck2}
      createLabel={t('exams.newPaper')}
      columns={[
        {
          key: 'title', header: t('common.title'), sortable: true,
          cell: (r: any) => (
            <div className="min-w-0">
              <p className="line-clamp-1 font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {[r.institution, r.faculty, r.teacher].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          ),
        },
        {
          key: 'stage', header: t('exams.stage'), hideBelow: 'md',
          cell: (r: any) => (
            <div className="flex flex-wrap gap-1">
              {r.stage ? <Badge variant="secondary">{t(`exams.stages.${r.stage}`)}</Badge> : null}
              {r.grade_level ? <Badge variant="muted">{r.grade_level}</Badge> : null}
            </div>
          ),
        },
        { key: 'subject', header: t('learn.subject'), sortable: true, cell: (r: any) => r.subject ?? '—' },
        {
          key: 'material_type', header: t('exams.materialType'), hideBelow: 'md',
          cell: (r: any) => (
            <Badge variant={r.material_type && r.material_type !== 'exam' ? 'secondary' : 'muted'}>
              {t(`exams.materialTypes.${r.material_type ?? 'exam'}`, { defaultValue: r.material_type })}
            </Badge>
          ),
        },
        {
          key: 'year', header: t('exams.sitting'), sortable: true, className: 'numeric', hideBelow: 'sm',
          cell: (r: any) => [
            r.year,
            r.term ? t(`exams.terms.${r.term}`, { defaultValue: r.term }) : null,
            r.sitting ? t(`exams.sittings.${r.sitting}`, { defaultValue: r.sitting }) : null,
          ].filter(Boolean).join(' · ') || '—',
        },
        {
          key: 'exam_type', header: t('exams.type'), hideBelow: 'lg',
          cell: (r: any) => (r.exam_type ? t(`exams.types.${r.exam_type}`) : '—'),
        },
        {
          key: 'has_answers', header: t('exams.answers'), hideBelow: 'lg',
          cell: (r: any) => (
            <Badge variant={r.has_answers ? 'success' : 'muted'}>
              {t(r.has_answers ? 'exams.withAnswers' : 'exams.paperOnly')}
            </Badge>
          ),
        },
        {
          key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'xl',
          className: 'numeric text-muted-foreground',
          cell: (r: any) => formatDate(r.created_at, i18n.language),
        },
      ]}
      insights={{
        cards: [
          { key: 'total', label: t('insights.cards.total') },
          { key: 'published', label: t('library.status.published'), tone: 'success' },
          { key: 'with_answers', label: t('exams.withAnswers'), tone: 'teal' },
          { key: 'subjects', label: t('insights.cards.subjects'), tone: 'violet' },
          { key: 'latest_year', label: t('insights.cards.latestYear') },
        ],
        cuts: [
          { key: 'stage', label: t('exams.stage'), labelFor: (k) => t(`exams.stages.${k}`, { defaultValue: k }) },
          { key: 'material_type', label: t('exams.materialType'), labelFor: (k) => t(`exams.materialTypes.${k}`, { defaultValue: k }) },
          { key: 'exam_type', label: t('exams.type'), labelFor: (k) => t(`exams.types.${k}`, { defaultValue: k }) },
          { key: 'sitting', label: t('exams.sitting'), labelFor: (k) => t(`exams.sittings.${k}`, { defaultValue: k }) },
          { key: 'institution', label: t('exams.institution') },
          { key: 'subject', label: t('learn.subject') },
        ],
      }}
      filters={(list) => (
        <>
          <Select value={list.state.filter.stage ?? 'all'} onValueChange={(v) => list.setFilter('stage', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('exams.stage')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{t(`exams.stages.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.material_type ?? 'all'} onValueChange={(v) => list.setFilter('material_type', v)}>
            <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('exams.materialType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('exams.materialType')}</SelectItem>
              {MATERIAL_TYPES.map((s) => <SelectItem key={s} value={s}>{t(`exams.materialTypes.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.exam_type ?? 'all'} onValueChange={(v) => list.setFilter('exam_type', v)}>
            <SelectTrigger className="w-[11rem]"><SelectValue placeholder={t('exams.type')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {EXAM_TYPES.map((s) => <SelectItem key={s} value={s}>{t(`exams.types.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.year ?? 'all'} onValueChange={(v) => list.setFilter('year', v)}>
            <SelectTrigger className="w-[8rem]"><SelectValue placeholder={t('learn.year')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('learn.year')}</SelectItem>
              {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.sitting ?? 'all'} onValueChange={(v) => list.setFilter('sitting', v)}>
            <SelectTrigger className="w-[9.5rem]"><SelectValue placeholder={t('exams.sitting')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('exams.sitting')}</SelectItem>
              {SITTINGS.map((s) => <SelectItem key={s} value={s}>{t(`exams.sittings.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
            <SelectTrigger className="w-[9.5rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.status')}</SelectItem>
              {['draft', 'published', 'archived'].map((st) => (
                <SelectItem key={st} value={st}>{t(`library.status.${st}`, { defaultValue: st })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {Object.keys(list.state.filter).length ? (
            <Button variant="ghost" size="sm" onClick={list.reset}>{t('actions.reset')}</Button>
          ) : null}
        </>
      )}
    />
  );
}

/** Create and edit, on their own route. */
export function ExamFormPage() {
  return <CrudFormPage config={useExamConfig()} />;
}
