#741 [CLEAN] Consolidate Duplicate Auth Redirect Logic

Description:*
Auth redirect logic exists in three places: app/lib/authRedirect.ts, components/auth/AuthProvider.tsx (useEffect), and the future middleware.ts. Once middleware is implemented (Issue #22), the client-side duplicates must be removed.

Acceptance Criteria:

 After middleware is implemented, remove the router.push() redirect from AuthProvider
 Keep authRedirect.ts as the single source of truth for the protected route list
 middleware.ts imports PROTECTED_ROUTES from authRedirect.ts
 Verify no protected page flickers unauthenticated content before redirect

-----------------------------------------------------------------------------------------------------------

#756 [A11Y] Add aria-live Regions for Toast, Progress, and SSE Updates

Description:
Toast notifications and SSE progress updates are visual-only. Screen reader users are not notified of processing completion, errors, or rate limit messages.

Acceptance Criteria:

 ToastProvider container has aria-live="polite" and role="status" for non-urgent toasts
 Error toasts use role="alert" and aria-live="assertive"
 The progress percentage on the processing page (/dashboard/processing) has aria-valuenow, aria-valuemin="0", aria-valuemax="100" on the or progress bar element
 "Moments found" counter announces updates via an off-screen live region
 Verified with NVDA + Chrome and VoiceOver + Safari

-----------------------------------------------------------------------------------------------------------

#757 [I18N] Add Translation Keys for All Hardcoded English Strings

Description:
Most UI strings are hardcoded English in JSX. The I18nProvider and locale files exist but are not used consistently.

Acceptance Criteria:

 Audit all app/ and components/ files for hardcoded English strings
 Replace each string with a t("namespace.key") call
 Add the key to all 4 locale files: en.json, es.json, fr.json, pt.json
 New transform feature strings added to all 4 locale files
 CI test from Issue #42 enforces 100% key parity across locales

-----------------------------------------------------------------------------------------------------------

#761 [FEAT] Implement Notification System for Job Completion

#76 · [FEAT] Implement Notification System for Job Completion
Description:
Users need to know when their video processing finishes (especially for long videos). Browser push notifications and in-app notification badges are both needed.

Acceptance Criteria:

 notifications.ts is integrated into the processing page: when status === "complete", call sendNotification("Your clips are ready!")
 Create an in-app notification bell in DashboardHeader with a badge count
 Create GET /api/notifications returning unread notification items
 Create PATCH /api/notifications/:id/read to mark as read
 Notification types: job_complete, transform_complete, mint_success, earnings_received
 Store notifications in the database with userId, type, payload, readAt