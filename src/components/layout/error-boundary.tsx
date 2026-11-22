import * as React from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';

interface Props extends WithTranslation {
  children: React.ReactNode;
  /** Changing this resets the boundary — used to clear the error on navigation. */
  resetKey?: string;
}
interface State { error: Error | null }

/**
 * Catches render errors below it and shows a recoverable message.
 *
 * Without one, a single bad property access anywhere in a screen unmounts the whole app and
 * leaves a blank page with nothing but a console trace — which is exactly how a data-shape
 * mismatch in one report took down the entire dashboard. The boundary resets when the route
 * changes, so navigating away is always a way out.
 */
class ErrorBoundaryBase extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    const { t } = this.props;
    if (!this.state.error) return this.props.children;
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">{t('common.error')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{this.state.error.message}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              {t('actions.retry')}
            </Button>
            <Button onClick={() => window.location.reload()}>{t('actions.refresh')}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
