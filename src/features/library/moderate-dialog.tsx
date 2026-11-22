import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/primitives';

/** Approve/reject a library item; a rejection must carry a reason for the author. */
export function ModerateDialog({
  item, onClose, onDone,
}: { item: any | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState('');

  React.useEffect(() => setReason(''), [item?.id]);

  const moderate = useApiMutation(
    (vars: { id: string; decision: string; reason?: string }) =>
      api.post(`/content/${vars.id}/moderate`, { decision: vars.decision, reason: vars.reason }),
    {
      successMessage: item?.decision === 'approve' ? t('library.approved') : t('library.rejected'),
      invalidate: [['content'], ['moderation', 'summary'], ['analytics', 'overview']],
      onSuccess: onDone,
    },
  );

  const rejecting = item?.decision === 'reject';

  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{rejecting ? t('actions.reject') : t('actions.approve')}</DialogTitle>
          <DialogDescription>{item?.title}</DialogDescription>
        </DialogHeader>

        {rejecting ? (
          <Field label={t('common.reason')} required hint={t('library.rejectReason')}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder={t('library.rejectReason')}
            />
          </Field>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
          <Button
            variant={rejecting ? 'danger' : 'success'}
            loading={moderate.isPending}
            disabled={rejecting && reason.trim().length < 3}
            onClick={() =>
              item && moderate.mutate({ id: item.id, decision: item.decision, reason: reason.trim() || undefined })
            }
          >
            {rejecting ? t('actions.reject') : t('actions.approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
