import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { formatDate, formatRelative } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/data-table';
import { DetailList, PageHeader, StatusPill } from '@/components/data/page-parts';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, Field, Textarea } from '@/components/ui/primitives';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/overlays';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

/** One request, with exactly the member context `VerificationRequestsService` joins in. */
interface VerificationRequestRow {
  id: string;
  status: VerificationStatus;
  reason: string;
  rejectionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  member: {
    id: string;
    fullName: string | null;
    handle: string | null;
    avatarUrl: string | null;
    email: string | null;
    userClass: string | null;
    contributions: number | null;
  };
}

/**
 * The verification queue: members asking for the blue tick, from `api/src/modules/users/
 * verification-requests.*`.
 *
 * Pending is the working view — oldest first, the same ordering the API answers with — and
 * the status filter switches to a decided history without leaving the page, since a reviewer
 * checking "did I already turn this down" is the same screen as the queue itself, not a
 * second one to navigate to.
 */
export function VerificationRequestsPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = React.useState<VerificationStatus | 'all'>('pending');
  const [reviewing, setReviewing] = React.useState<VerificationRequestRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['verification-requests', status],
    queryFn: () =>
      status === 'pending'
        ? api.get<{ items: VerificationRequestRow[] }>('/verification-requests/queue')
        : api.get<{ items: VerificationRequestRow[] }>('/verification-requests', { status }),
  });

  const rows = data?.items ?? [];

  const columns: Column<VerificationRequestRow>[] = [
    {
      key: 'member',
      header: t('users.verification.member'),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.member.fullName ?? '—'}</p>
          {row.member.handle ? (
            <p className="truncate text-xs text-muted-foreground" dir="ltr">@{row.member.handle}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'class',
      header: t('users.member.class'),
      hideBelow: 'md',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          {row.member.userClass ? (
            <Badge variant="secondary" className="w-fit">
              {t(`appControl.userClass.${row.member.userClass}`)}
            </Badge>
          ) : (
            '—'
          )}
          {row.member.contributions != null ? (
            <span className="text-xs text-muted-foreground">
              {t('users.member.contributions', { count: row.member.contributions })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('users.verification.reason'),
      hideBelow: 'lg',
      cell: (row) => <p className="line-clamp-2 max-w-xs text-sm text-muted-foreground">{row.reason}</p>,
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (row) => <StatusPill status={row.status} label={t(`users.verification.status.${row.status}`)} />,
    },
    {
      key: 'created_at',
      header: t('common.createdAt'),
      hideBelow: 'sm',
      className: 'text-muted-foreground',
      cell: (row) => formatRelative(row.createdAt, i18n.language),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        tone="sky"
        title={t('users.verification.title')}
        subtitle={t('users.verification.subtitle')}
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        onRefresh={refetch}
        onRowClick={(row) => setReviewing(row)}
        emptyTitle={t('users.verification.emptyTitle')}
        emptyHint={t('users.verification.emptyHint')}
        filters={
          <Select value={status} onValueChange={(v) => setStatus(v as VerificationStatus | 'all')}>
            <SelectTrigger className="w-[11rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t('users.verification.status.pending')}</SelectItem>
              <SelectItem value="approved">{t('users.verification.status.approved')}</SelectItem>
              <SelectItem value="rejected">{t('users.verification.status.rejected')}</SelectItem>
              <SelectItem value="all">{t('users.verification.filterAll')}</SelectItem>
            </SelectContent>
          </Select>
        }
        rowActions={[{ label: t('users.verification.review'), icon: BadgeCheck, onSelect: (row) => setReviewing(row) }]}
      />

      <DecideVerificationDialog
        request={reviewing}
        onClose={() => setReviewing(null)}
        onDone={() => { setReviewing(null); refetch(); }}
      />
    </>
  );
}

function DecideVerificationDialog({
  request, onClose, onDone,
}: { request: VerificationRequestRow | null; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = React.useState('');

  React.useEffect(() => { setReason(''); }, [request?.id]);

  const decide = useApiMutation(
    (nextStatus: 'approved' | 'rejected') =>
      api.post(`/verification-requests/${request!.id}/decide`, {
        status: nextStatus,
        reason: nextStatus === 'rejected' ? reason.trim() : undefined,
      }),
    {
      successMessage: t('users.verification.decided'),
      invalidate: [['verification-requests']],
      onSuccess: onDone,
    },
  );

  const decided = request ? request.status !== 'pending' : false;

  return (
    <Dialog open={Boolean(request)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('users.verification.review')}</DialogTitle>
          <DialogDescription>{request?.member.fullName}</DialogDescription>
        </DialogHeader>

        <DetailList
          items={[
            {
              label: t('users.member.class'),
              value: request?.member.userClass ? t(`appControl.userClass.${request.member.userClass}`) : '—',
            },
            {
              label: t('users.member.contributions', { count: request?.member.contributions ?? 0 }),
              value: request?.member.contributions ?? 0,
            },
            { label: t('users.verification.requestedAt'), value: formatDate(request?.createdAt, i18n.language, true) },
          ]}
        />

        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('users.verification.reason')}
            </p>
            <p className="text-sm">{request?.reason}</p>
          </CardContent>
        </Card>

        {decided ? (
          <DetailList
            items={[
              {
                label: t('common.status'),
                value: request ? <StatusPill status={request.status} label={t(`users.verification.status.${request.status}`)} /> : '—',
              },
              ...(request?.status === 'rejected'
                ? [{ label: t('users.verification.rejectionReason'), value: request.rejectionReason }]
                : []),
              { label: t('users.verification.decidedBy'), value: formatDate(request?.decidedAt, i18n.language, true) },
            ]}
          />
        ) : (
          <Field label={t('users.verification.rejectionReasonLabel')}>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('users.verification.rejectionReasonPlaceholder')}
            />
          </Field>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.close')}</Button>
          {!decided ? (
            <>
              <Button
                variant="danger"
                loading={decide.isPending}
                disabled={!reason.trim()}
                onClick={() => decide.mutate('rejected')}
              >
                {t('users.verification.reject')}
              </Button>
              <Button variant="success" loading={decide.isPending} onClick={() => decide.mutate('approved')}>
                {t('users.verification.approve')}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
