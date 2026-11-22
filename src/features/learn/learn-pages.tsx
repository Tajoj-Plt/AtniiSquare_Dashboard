import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, CheckCircle2, Eye, GraduationCap, ListChecks, Plus, Trash2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation, useForm, useListQuery } from '@/lib/hooks';
import { formatDate, formatNumber } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { DetailList, MetricRow, PageHeader, Panel, StatCard, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Field, Input, Progress, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

export function CoursesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const list = useListQuery<any>('courses', '/courses', { sort: '-created_at' });
  const { data: stats } = useQuery({
    queryKey: ['courses', 'stats'],
    queryFn: () => api.get('/courses/stats'),
    enabled: can('analytics.read'),
  });

  const [creating, setCreating] = React.useState(false);
  const form = useForm({ title: '', description: '', delivery_mode: 'recorded', language: 'ar' });

  const create = useApiMutation(() => api.post('/courses', form.values), {
    successMessage: t('library.created'), invalidate: [['courses']],
    onSuccess: (row: any) => { setCreating(false); form.reset(); navigate(`/courses/${row.id}`); },
  });
  const publish = useApiMutation(
    (vars: { id: string; on: boolean }) =>
      vars.on ? api.post(`/courses/${vars.id}/publish`) : api.delete(`/courses/${vars.id}/publish`),
    { successMessage: t('library.updated'), invalidate: [['courses']], onSuccess: () => list.refresh() },
  );

  const columns: Column<any>[] = [
    {
      key: 'title', header: t('common.title'), sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link to={`/courses/${row.id}`} className="line-clamp-1 font-medium hover:text-accent hover:underline">
            {row.title}
          </Link>
          <p className="line-clamp-1 text-xs text-muted-foreground">{row.instructor_name ?? '—'}</p>
        </div>
      ),
    },
    { key: 'status', header: t('common.status'), cell: (row) => <StatusPill status={row.status} /> },
    { key: 'delivery_mode', header: t('learn.deliveryMode'), hideBelow: 'md', cell: (row) => <Badge variant="secondary">{t(`learn.${row.delivery_mode}`)}</Badge> },
    { key: 'module_count', header: t('learn.modules'), className: 'numeric', hideBelow: 'md', cell: (row) => formatNumber(row.module_count, lang) },
    { key: 'enrollment_count', header: t('learn.enrollmentsTitle'), className: 'numeric', cell: (row) => formatNumber(row.enrollment_count, lang) },
    {
      key: 'avg_progress', header: t('learn.avgProgress'), hideBelow: 'lg',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Progress value={Number(row.avg_progress)} className="w-16" />
          <span className="numeric text-xs text-muted-foreground">{Math.round(Number(row.avg_progress))}%</span>
        </div>
      ),
    },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'xl', className: 'numeric text-muted-foreground', cell: (row) => formatDate(row.created_at, lang) },
  ];

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        tone="amber"
        title={t('learn.coursesTitle')}
        actions={can('course.create') ? <Button onClick={() => setCreating(true)}><Plus /> {t('actions.create')}</Button> : null}
      />

      {stats ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('learn.coursesTitle')} value={formatNumber(stats.totals.total, lang)} />
          <StatCard label={t('library.status.published')} value={formatNumber(stats.totals.published, lang)} tone="success" />
          <StatCard label={t('learn.enrollmentsTitle')} value={formatNumber(stats.totals.enrollments, lang)} />
          <StatCard label={t('learn.avgProgress')} value={`${Math.round(Number(stats.totals.avg_progress))}%`} />
        </section>
      ) : null}

      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="courses"
        filters={
          <>
            <Select value={list.state.filter.status ?? 'all'} onValueChange={(v) => list.setFilter('status', v)}>
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="draft">{t('library.status.draft')}</SelectItem>
                <SelectItem value="published">{t('library.status.published')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={list.state.filter.delivery_mode ?? 'all'} onValueChange={(v) => list.setFilter('delivery_mode', v)}>
              <SelectTrigger className="w-[10rem]"><SelectValue placeholder={t('learn.deliveryMode')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="recorded">{t('learn.recorded')}</SelectItem>
                <SelectItem value="live">{t('learn.live')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        rowActions={[
          { label: t('actions.view'), icon: Eye, onSelect: (row) => navigate(`/courses/${row.id}`) },
          { label: t('actions.publish'), icon: CheckCircle2, onSelect: (row) => publish.mutate({ id: row.id, on: true }), hidden: (row) => !can('course.publish') || row.status === 'published' },
          { label: t('actions.unpublish'), icon: XCircle, onSelect: (row) => publish.mutate({ id: row.id, on: false }), hidden: (row) => !can('course.publish') || row.status !== 'published' },
        ]}
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('learn.coursesTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label={t('common.title')} required error={form.errors.title}>
              <Input value={form.values.title} onChange={(e) => form.set('title', e.target.value)} />
            </Field>
            <Field label={t('common.details')}>
              <Textarea rows={3} value={form.values.description} onChange={(e) => form.set('description', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('learn.deliveryMode')}>
                <Select value={form.values.delivery_mode} onValueChange={(v) => form.set('delivery_mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recorded">{t('learn.recorded')}</SelectItem>
                    <SelectItem value="live">{t('learn.live')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('common.language')}>
                <Select value={form.values.language} onValueChange={(v) => form.set('language', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
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

export function CourseDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;

  const { data: course, isLoading, refetch } = useQuery({
    queryKey: ['courses', id],
    queryFn: () => api.get(`/courses/${id}`),
  });

  const [adding, setAdding] = React.useState(false);
  const [deletingModule, setDeletingModule] = React.useState<any | null>(null);
  const form = useForm({ title: '', description: '', duration_seconds: '' });

  const addModule = useApiMutation(
    () => api.post(`/courses/${id}/modules`, {
      title: form.values.title,
      description: form.values.description || undefined,
      duration_seconds: form.values.duration_seconds ? Number(form.values.duration_seconds) : undefined,
    }),
    {
      successMessage: t('library.created'), invalidate: [['courses', id!]],
      onSuccess: () => { setAdding(false); form.reset(); void refetch(); },
    },
  );
  const removeModule = useApiMutation(() => api.delete(`/courses/modules/${deletingModule.id}`), {
    successMessage: t('library.deleted'),
    onSuccess: () => { setDeletingModule(null); void refetch(); },
  });
  const publish = useApiMutation(
    (on: boolean) => (on ? api.post(`/courses/${id}/publish`) : api.delete(`/courses/${id}/publish`)),
    { successMessage: t('library.updated'), onSuccess: () => void refetch() },
  );

  if (isLoading || !course) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></>;

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        tone="amber"
        title={course.title}
        subtitle={course.instructor_name ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/courses')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
            {can('course.publish') ? (
              <Button
                variant={course.status === 'published' ? 'outline' : 'default'}
                loading={publish.isPending}
                onClick={() => publish.mutate(course.status !== 'published')}
              >
                {course.status === 'published' ? t('actions.unpublish') : t('actions.publish')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={course.status} />
        <Badge variant="secondary">{t(`learn.${course.delivery_mode}`)}</Badge>
        <Badge variant="muted">{course.language?.toUpperCase()}</Badge>
      </div>

      <MetricRow
        items={[
          { label: t('learn.modules'), value: course.module_count ?? 0 },
          { label: t('learn.enrollmentsTitle'), value: course.enrollment_count ?? 0 },
          { label: t('learn.avgProgress'), value: `${Math.round(Number(course.avg_progress ?? 0))}%` },
          { label: t('common.createdAt'), value: formatDate(course.created_at, lang) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={t('learn.modules')}
          actions={
            can('course.create') ? (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus /> {t('learn.addModule')}
              </Button>
            ) : null
          }
        >
          {course.modules?.length ? (
            <ol className="divide-y">
              {course.modules.map((m: any) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span className="numeric grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {m.sort_order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-medium">{m.title}</p>
                    {m.description ? <p className="line-clamp-1 text-xs text-muted-foreground">{m.description}</p> : null}
                  </div>
                  {m.duration_seconds ? (
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {Math.round(m.duration_seconds / 60)} min
                    </span>
                  ) : null}
                  {can('course.create') ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeletingModule(m)} aria-label={t('actions.delete')}>
                      <Trash2 className="text-danger" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
        </Panel>

        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('learn.instructor'), value: course.instructor_name },
              { label: t('learn.deliveryMode'), value: t(`learn.${course.delivery_mode}`) },
              { label: t('common.status'), value: course.status },
              { label: t('common.language'), value: course.language?.toUpperCase() },
              { label: t('common.details'), value: course.description },
            ]}
          />
        </Panel>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('learn.addModule')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label={t('common.title')} required error={form.errors.title}>
              <Input value={form.values.title} onChange={(e) => form.set('title', e.target.value)} autoFocus />
            </Field>
            <Field label={t('common.details')}>
              <Textarea rows={2} value={form.values.description} onChange={(e) => form.set('description', e.target.value)} />
            </Field>
            <Field label="Duration (seconds)">
              <Input type="number" dir="ltr" value={form.values.duration_seconds}
                onChange={(e) => form.set('duration_seconds', e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>{t('actions.cancel')}</Button>
            <Button loading={addModule.isPending} onClick={() => addModule.mutate(undefined, { onError: form.applyApiError })}>
              {t('actions.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingModule)} onOpenChange={(o) => !o && setDeletingModule(null)}
        title={t('common.confirmDelete')} description={deletingModule?.title}
        confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')}
        loading={removeModule.isPending} onConfirm={() => removeModule.mutate(undefined)}
      />
    </>
  );
}

export function EnrollmentsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const list = useListQuery<any>('enrollments', '/enrollments', { sort: '-created_at' });

  const columns: Column<any>[] = [
    {
      key: 'student_name', header: t('learn.student'),
      cell: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{row.student_name ?? '—'}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground" dir="ltr">{row.student_email}</p>
        </div>
      ),
    },
    { key: 'course_title', header: t('learn.coursesTitle'), cell: (row) => <span className="line-clamp-1">{row.course_title}</span> },
    {
      key: 'progress_pct', header: t('learn.progress'), sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Progress value={Number(row.progress_pct)} className="w-20" />
          <span className="numeric text-xs text-muted-foreground">{Math.round(Number(row.progress_pct))}%</span>
        </div>
      ),
    },
    { key: 'lessons_completed', header: t('learn.modules'), className: 'numeric', hideBelow: 'md', cell: (row) => formatNumber(row.lessons_completed, lang) },
    { key: 'created_at', header: t('common.createdAt'), sortable: true, hideBelow: 'sm', className: 'numeric text-muted-foreground', cell: (row) => formatDate(row.created_at, lang) },
  ];

  return (
    <>
      <PageHeader icon={ListChecks} tone="amber" title={t('learn.enrollmentsTitle')} />
      <DataTable
        columns={columns} rows={list.rows} loading={list.loading} loadingMore={list.loadingMore}
        error={list.error} total={list.total} hasMore={list.hasMore} onLoadMore={list.loadMore}
        onRefresh={list.refresh} search={list.state.q} onSearchChange={list.setSearch}
        sort={list.state.sort} onSortChange={list.setSort} exportFileName="enrollments"
      />
    </>
  );
}
