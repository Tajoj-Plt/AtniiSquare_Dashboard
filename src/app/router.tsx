import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth } from '@/app/auth';
import { AppShell } from '@/components/layout/app-shell';
import { ForbiddenState } from '@/components/data/page-parts';
import { LoginPage } from '@/features/auth/login-page';
import { LandingPage } from '@/features/landing/landing-page';
import { LandingEditorPage } from '@/features/landing-editor/landing-editor-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { LibraryPage } from '@/features/library/library-page';
import { ContentFormPage } from '@/features/library/content-form-page';
import { ContentDetailPage } from '@/features/library/content-detail-page';
import { ContentGroupsPage } from '@/features/library/groups-page';
import { ContentGroupDetailPage } from '@/features/library/group-detail-page';
import { MediaPage } from '@/features/media/media-page';
import { DashboardUsersPage } from '@/features/users/dashboard-users-page';
import { DashboardUserFormPage } from '@/features/users/dashboard-user-form-page';
import { DashboardUserDetailPage } from '@/features/users/dashboard-user-detail-page';
import { AppMembersPage } from '@/features/users/app-members-page';
import { AppMemberDetailPage } from '@/features/users/app-member-detail-page';
import { VerificationRequestsPage } from '@/features/users/verification-requests-page';
import { RolesPage } from '@/features/users/roles-page';
import {
  AuthorsFormPage, AuthorsPage, InterestsFormPage, InterestsPage, PagesFormPage, PagesPage,
  TagsFormPage, TagsPage,
} from '@/features/taxonomy/taxonomy-pages';
import { PageDetailPage } from '@/features/taxonomy/page-detail-page';
import { ExamDocumentsPage, ExamFormPage } from '@/features/catalog/exams-page';
import { ScholarshipsPage, ScholarshipFormPage } from '@/features/catalog/scholarships-page';
import { ShortVideosPage, ShortVideoFormPage } from '@/features/catalog/short-videos-page';
import { CommentsPage, PostsPage } from '@/features/community/community-pages';
import { PostDetailPage } from '@/features/community/post-detail-page';
import { EventFormPage, EventsPage } from '@/features/community/events-page';
import { SpaceDetailPage, SpacesPage } from '@/features/community/spaces-page';
import { CourseDetailPage, CoursesPage, EnrollmentsPage } from '@/features/learn/learn-pages';
import {
  ModerationActionsPage, ReportsPage, ReviewQueuePage,
} from '@/features/moderation/moderation-pages';
import { AssistantPage } from '@/features/assistant/assistant-page';
import { AiIndexPage } from '@/features/assistant/ai-index-page';
import { NotificationsPage } from '@/features/notifications/notifications-page';
import { AuditPage } from '@/features/audit/audit-page';
import { ReportsPage as AnalyticsReportsPage } from '@/features/reports/reports-page';
import { AppFlagsPage } from '@/features/app-control/flags-page';
import { AppCurationPage } from '@/features/app-control/curation-page';
import { AppAdsPage } from '@/features/app-control/ads-page';
import { ActivitiesPage } from '@/features/activities/activities-page';
import { ReadingChallengesPage } from '@/features/activities/reading-challenges-page';
import { AppBroadcastsPage } from '@/features/app-control/broadcasts-page';
import { AppReportsPage } from '@/features/app-reports/app-reports-page';
import { SettingsPage } from '@/features/settings/settings-page';

/**
 * Route-level permissions mirror the API guards. A user who reaches a page they cannot use
 * is redirected to /forbidden rather than shown a screen full of 403s.
 */
export function AppRouter() {
  return (
    <Routes>
      {/* Public marketing page — the only route reachable without a session. */}
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenState />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<OverviewPage />} />
        <Route path="reports" element={<RequireAuth permissions={['analytics.read']}><AnalyticsReportsPage /></RequireAuth>} />
        <Route path="reports/:section" element={<RequireAuth permissions={['analytics.read']}><AnalyticsReportsPage /></RequireAuth>} />

        {/* The mobile app: remote configuration, curation and broadcasts on one side, the
            behaviour reports built from what the app records on the other. */}
        <Route path="app-control" element={<Navigate to="/app-control/flags" replace />} />
        <Route path="app-control/flags" element={<RequireAuth permissions={['app.config.manage']}><AppFlagsPage /></RequireAuth>} />
        <Route path="app-control/curation" element={<RequireAuth permissions={['app.config.manage']}><AppCurationPage /></RequireAuth>} />
        <Route path="app-control/ads" element={<RequireAuth permissions={['app.config.manage']}><AppAdsPage /></RequireAuth>} />
        <Route path="app-control/broadcasts" element={<RequireAuth permissions={['app.broadcast.send']}><AppBroadcastsPage /></RequireAuth>} />
        {/* The Activities tab's sliders: one page per slider */}
        <Route path="activities" element={<Navigate to="/activities/challenge" replace />} />
        <Route path="activities/reading" element={<RequireAuth permissions={['app.config.manage']}><ReadingChallengesPage /></RequireAuth>} />
        <Route path="activities/:slider" element={<RequireAuth permissions={['app.config.manage']}><ActivitiesPage /></RequireAuth>} />
        <Route path="app-reports" element={<RequireAuth permissions={['analytics.read']}><AppReportsPage /></RequireAuth>} />
        <Route path="app-reports/:section" element={<RequireAuth permissions={['analytics.read']}><AppReportsPage /></RequireAuth>} />

        {/* The catalogue. Exams, funding calls and short videos sit here with the books:
            they are all things the platform holds, whatever team files them. */}
        <Route path="content" element={<LibraryPage />} />
        <Route path="content/new" element={<RequireAuth permissions={['content.create']}><ContentFormPage /></RequireAuth>} />
        <Route path="content/item/:id" element={<ContentDetailPage />} />
        <Route path="content/:id/edit" element={<RequireAuth permissions={['content.update.own', 'content.update.any']}><ContentFormPage /></RequireAuth>} />
        {/* Every resource is a list route plus a form route — creating and editing get a
            page of their own, like the library's upload wizard. */}
        <Route path="content/shorts" element={<ShortVideosPage />} />
        <Route path="content/shorts/new" element={<RequireAuth permissions={['reel.create']}><ShortVideoFormPage /></RequireAuth>} />
        <Route path="content/shorts/:id/edit" element={<RequireAuth permissions={['reel.create']}><ShortVideoFormPage /></RequireAuth>} />
        <Route path="content/exams" element={<ExamDocumentsPage />} />
        <Route path="content/exams/new" element={<RequireAuth permissions={['exam.manage']}><ExamFormPage /></RequireAuth>} />
        <Route path="content/exams/:id/edit" element={<RequireAuth permissions={['exam.manage']}><ExamFormPage /></RequireAuth>} />
        <Route path="content/scholarships" element={<ScholarshipsPage />} />
        <Route path="content/scholarships/new" element={<RequireAuth permissions={['scholarship.manage']}><ScholarshipFormPage /></RequireAuth>} />
        <Route path="content/scholarships/:id/edit" element={<RequireAuth permissions={['scholarship.manage']}><ScholarshipFormPage /></RequireAuth>} />
        {/* Playlists and reading series. Declared before the `content/:type` catch-all,
            which would otherwise read "groups" as a content type. */}
        <Route path="content/groups" element={<RequireAuth permissions={['content.read']}><ContentGroupsPage /></RequireAuth>} />
        <Route path="content/groups/:id" element={<RequireAuth permissions={['content.read']}><ContentGroupDetailPage /></RequireAuth>} />
        <Route path="content/:type" element={<LibraryPage />} />

        {/* Bookmarks and anything already sent out keep working. */}
        <Route path="library/*" element={<LegacyLibraryRedirect />} />
        <Route path="reels" element={<Navigate to="/content/shorts" replace />} />
        <Route path="scholarships" element={<Navigate to="/content/scholarships" replace />} />
        <Route path="exam-documents" element={<Navigate to="/content/exams" replace />} />

        <Route path="media" element={<RequireAuth permissions={['media.upload']}><MediaPage /></RequireAuth>} />

        <Route path="posts" element={<PostsPage />} />
        <Route path="posts/:id" element={<RequireAuth permissions={['content.read']}><PostDetailPage /></RequireAuth>} />
        <Route path="comments" element={<CommentsPage />} />

        {/* Events. The app calls these events, so the dashboard does too; /rooms was the
            table's name leaking into the navigation. */}
        <Route path="events" element={<EventsPage />} />
        <Route path="events/new" element={<RequireAuth permissions={['room.host']}><EventFormPage /></RequireAuth>} />
        <Route path="events/:id/edit" element={<RequireAuth permissions={['room.host']}><EventFormPage /></RequireAuth>} />
        <Route path="rooms" element={<Navigate to="/events" replace />} />

        {/* Member-created reading groups and discussion spaces: read and soft-delete/restore. */}
        <Route path="spaces" element={<RequireAuth permissions={['space.moderate']}><SpacesPage /></RequireAuth>} />
        <Route path="spaces/:id" element={<RequireAuth permissions={['space.moderate']}><SpaceDetailPage /></RequireAuth>} />

        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route path="enrollments" element={<RequireAuth permissions={['enrollment.read.any']}><EnrollmentsPage /></RequireAuth>} />
        <Route path="assistant" element={<RequireAuth permissions={['ai.use']}><AssistantPage /></RequireAuth>} />
        {/* The tab strip links to /assistant/chat; the chat itself stays at /assistant. */}
        <Route path="assistant/chat" element={<Navigate to="/assistant" replace />} />
        <Route path="assistant/index" element={<RequireAuth permissions={['ai.manage']}><AiIndexPage /></RequireAuth>} />

        <Route path="moderation/queue" element={<RequireAuth permissions={['content.moderate']}><ReviewQueuePage /></RequireAuth>} />
        <Route path="moderation/reports" element={<RequireAuth permissions={['report.read']}><ReportsPage /></RequireAuth>} />
        <Route path="moderation/actions" element={<RequireAuth permissions={['report.read']}><ModerationActionsPage /></RequireAuth>} />

        {/* Dashboard staff and app members used to be one flat "Users" directory; they are
            split into two surfaces here, matching the API split (see db/16_account_kind.sql
            and api/src/modules/users/{dashboard-users,app-members}.controller.ts). Only
            dashboard-users can create — a member account only ever comes from the app. */}
        <Route path="dashboard-users" element={<RequireAuth permissions={['user.read']}><DashboardUsersPage /></RequireAuth>} />
        <Route path="dashboard-users/new" element={<RequireAuth permissions={['user.manage']}><DashboardUserFormPage /></RequireAuth>} />
        <Route path="dashboard-users/:id" element={<RequireAuth permissions={['user.read']}><DashboardUserDetailPage /></RequireAuth>} />
        <Route path="app-members" element={<RequireAuth permissions={['user.read']}><AppMembersPage /></RequireAuth>} />
        <Route path="app-members/:id" element={<RequireAuth permissions={['user.read']}><AppMemberDetailPage /></RequireAuth>} />
        {/* The request/review/decision trail behind profiles.verified (db/18_verification_
            requests.sql) — its own screen rather than a tab on app-members/:id, since a
            reviewer works the queue across members, not one member at a time. */}
        <Route path="verification-requests" element={<RequireAuth permissions={['user.manage']}><VerificationRequestsPage /></RequireAuth>} />
        <Route path="roles" element={<RequireAuth permissions={['user.read']}><RolesPage /></RequireAuth>} />
        {/* A bookmark to the old combined directory lands on its staff half; a specific
            account is not redirected — which of the two surfaces it belongs to cannot be
            known from the URL alone, and the catch-all route below sends it home instead
            of guessing wrong. */}
        <Route path="users" element={<Navigate to="/dashboard-users" replace />} />
        <Route path="pages" element={<PagesPage />} />
        <Route path="pages/new" element={<RequireAuth permissions={['page.manage']}><PagesFormPage /></RequireAuth>} />
        <Route path="pages/:id/edit" element={<RequireAuth permissions={['page.manage']}><PagesFormPage /></RequireAuth>} />
        <Route path="pages/:id" element={<RequireAuth permissions={['content.read']}><PageDetailPage /></RequireAuth>} />
        <Route path="interests" element={<InterestsPage />} />
        <Route path="interests/new" element={<RequireAuth permissions={['interest.manage']}><InterestsFormPage /></RequireAuth>} />
        <Route path="interests/:id/edit" element={<RequireAuth permissions={['interest.manage']}><InterestsFormPage /></RequireAuth>} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="tags/new" element={<RequireAuth permissions={['interest.manage']}><TagsFormPage /></RequireAuth>} />
        <Route path="tags/:id/edit" element={<RequireAuth permissions={['interest.manage']}><TagsFormPage /></RequireAuth>} />
        <Route path="authors" element={<AuthorsPage />} />
        <Route path="authors/new" element={<RequireAuth permissions={['content.create']}><AuthorsFormPage /></RequireAuth>} />
        <Route path="authors/:id/edit" element={<RequireAuth permissions={['content.create']}><AuthorsFormPage /></RequireAuth>} />
        <Route path="notifications" element={<RequireAuth permissions={['notification.send']}><NotificationsPage /></RequireAuth>} />
        <Route path="audit" element={<RequireAuth permissions={['audit.read']}><AuditPage /></RequireAuth>} />
        <Route path="landing-editor" element={<RequireAuth permissions={['landing.manage']}><LandingEditorPage /></RequireAuth>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** /library/... → /content/..., preserving whatever followed. */
function LegacyLibraryRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/library/, '/content')}${search}`} replace />;
}
