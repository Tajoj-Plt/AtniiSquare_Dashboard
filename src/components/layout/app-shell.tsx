import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/app/auth';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';
import { ErrorBoundary } from './error-boundary';

const SIDEBAR_KEY = 'sudamind.sidebar.collapsed';

/** The authenticated layout: sidebar + topbar + routed content. */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  // The rail's width is a workspace preference, so it outlives the session.
  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem(SIDEBAR_KEY) === '1',
  );
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const { canAny } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      return !c;
    });
  }, []);

  // Sidebar counters. Only fetched when the user can actually see those screens.
  const { data: moderation } = useQuery({
    queryKey: ['moderation', 'summary'],
    queryFn: () => api.get('/moderation/summary'),
    enabled: canAny('report.read', 'content.moderate'),
    refetchInterval: 60_000,
  });

  const badges = {
    pendingReview: moderation?.pending
      ? moderation.pending.content + moderation.pending.posts + moderation.pending.reels
      : undefined,
    openReports: moderation?.reports?.open || undefined,
  };

  return (
    // The page is a tinted ground; the rail and the content sit on it as two floating
    // surfaces rather than filling the viewport edge to edge. On small screens the padding
    // collapses so the panel still uses the full width.
    <div className="flex min-h-screen gap-0 bg-background p-0 lg:gap-4 lg:p-4">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        badges={badges}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card shadow-panel lg:rounded-panel">
        <Topbar onMenu={() => setSidebarOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="flex-1 animate-fade-in p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1600px] space-y-5">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
