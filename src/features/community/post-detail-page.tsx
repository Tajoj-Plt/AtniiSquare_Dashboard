import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, MessageSquare, Trash2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { useApiMutation } from '@/lib/hooks';
import { formatDate, formatNumber } from '@/lib/utils';
import { DetailList, PageHeader, Panel, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Skeleton } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlays';

/**
 * One post, whole — added as the minimal detail view the Posts list never had, so a row
 * opened from a member's or a page's activity list (or from `/posts` itself) has somewhere
 * real to land. Renders the same fields `PostsPage`'s row already showed, plus the
 * moderation actions that row's menu offered.
 */
export function PostDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const lang = i18n.language;
  const [deleting, setDeleting] = React.useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['posts', id],
    queryFn: () => api.get(`/posts/${id}`),
  });

  const moderate = useApiMutation(
    (action: string) => api.post(`/posts/${id}/moderate`, { action }),
    { successMessage: t('library.updated'), invalidate: [['posts', id!], ['posts']] },
  );
  const remove = useApiMutation(() => api.delete(`/posts/${id}`), {
    successMessage: t('library.deleted'), invalidate: [['posts']],
    onSuccess: () => navigate('/posts'),
  });

  if (isLoading || !post) return <><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></>;

  return (
    <>
      <PageHeader
        icon={MessageSquare}
        tone="violet"
        title={t('nav.posts')}
        subtitle={post.author_name ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can('post.moderate') && post.status !== 'published' ? (
              <Button variant="outline" onClick={() => moderate.mutate('approve')} loading={moderate.isPending}>
                <CheckCircle2 /> {t('actions.approve')}
              </Button>
            ) : null}
            {can('post.moderate') && post.status !== 'rejected' ? (
              <Button variant="outline" onClick={() => moderate.mutate('reject')} loading={moderate.isPending}>
                <XCircle /> {t('actions.reject')}
              </Button>
            ) : null}
            {can('post.moderate') ? (
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 /> {t('actions.delete')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate('/posts')}>
              <ArrowLeft className="rtl:rotate-180" /> {t('actions.back')}
            </Button>
          </div>
        }
      />

      <Panel title={t('community.body')}>
        <div className="flex items-start gap-3">
          <Avatar src={post.author_avatar} name={post.author_name} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap text-sm">
              {post.body ?? <span className="text-muted-foreground">— {post.content_title} —</span>}
            </p>
            {post.content_id ? (
              <Link to={`/content/item/${post.content_id}`} className="mt-2 inline-block text-sm text-accent hover:underline">
                {post.content_title}
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('common.details')}>
          <DetailList
            items={[
              { label: t('common.status'), value: <StatusPill status={post.status} /> },
              { label: t('library.engagement'), value: formatNumber(post.reaction_count, lang) },
              { label: t('nav.comments'), value: formatNumber(post.comment_count, lang) },
              {
                label: t('community.openReports'),
                value: post.open_reports ? <Badge variant="danger">{post.open_reports}</Badge> : '—',
              },
              { label: t('common.createdAt'), value: formatDate(post.created_at, lang, true) },
            ]}
          />
        </Panel>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('common.confirmDelete')}
        description={t('common.confirmDeleteBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
