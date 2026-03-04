# Phase 7: Invite Users, Manage Members with Editor/Viewer Roles, and Enforce Role-Based Access Control - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable multi-user collaboration within an organization. Editors invite team members by email, assign roles (editor or viewer) at invite time, and the app enforces role-based access control. Invited users auto-join the org on sign-in. Task management, special events, and advanced collaboration features (notifications, real-time co-editing) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Invitation flow
- Editor invites by entering an email address — system creates an invite record in Firestore
- Role (editor or viewer) is selected at invite time — no default-then-upgrade flow
- No email is sent — the editor tells the person verbally to sign up; the app matches them by email on sign-in
- When the invited person signs in (Google or email/password), if their email matches a pending invite, they auto-join the org with the assigned role — no accept/decline prompt
- Pending invites appear in the member table with a "Pending" status badge

### Role model — Firebase-style Editor/Viewer
- Two roles leveraging Firebase's permission model: **Editor** and **Viewer**
- Editor: full CRUD access to all features (songs, services, AI, print/share/export) plus team management (invite, change roles, remove members). Any Editor can manage the team — no special "owner" concept
- Viewer: can ONLY access the Services list and view individual service plan details (songs, scripture, teams, etc.) — read-only. No access to Song Library, Rotation tables, Dashboard, or any other pages
- The org creator's initial role is Editor (replaces the current 'admin' role in the members subcollection)

### Viewer UI treatment
- Viewers only see the Services nav link in the sidebar — Dashboard, Songs, and Team links are hidden
- Within the services list and service detail view, all edit controls are hidden (no Add/Edit/Delete buttons, no save, no AI suggest)
- Viewers CAN use read-oriented output actions on services they're viewing: print, share links, export
- No disabled/grayed buttons — clean experience showing only what they can access

### Member management UI
- New "Team" sidebar nav link alongside Dashboard, Songs, Services — dedicated /team route (visible only to Editors)
- Simple table layout for member list: name, email, role badge (Editor/Viewer), joined date, and actions (change role, remove)
- Inline invite form at top of page: email input + role dropdown + "Invite" button, right above the member table
- Editor can change a member's role (editor/viewer toggle) AND remove them entirely
- Removed users lose access but can be re-invited

### Onboarding for invited users
- Invited users skip the auto-create-org flow — they join the invited org directly instead of creating an orphan org
- The GettingStarted checklist adapts for viewers: shows relevant steps like "View upcoming services" instead of editor steps like "Import songs" or "Invite team"
- Organization name displayed at the top of the sidebar (e.g., "Grace Community Church") — makes the workspace identity clear

### Claude's Discretion
- How to centralize orgId and userRole in the auth store (currently fetched ad-hoc in each view)
- Firestore invite document schema and collection structure
- Exact Firestore security rules updates — editors get full CRUD, viewers get read on services only
- How to handle edge cases: last editor can't remove themselves, invite for email already a member, etc.
- Member table action button styling and confirmation dialogs
- Router guard implementation for role-based route access (viewers blocked from /songs, /dashboard, /team)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules`: `isOrgMember()` and `isOrgAdmin()` helper functions already defined — rename/extend to `isOrgEditor()`
- `stores/auth.ts`: `ensureUserDocument()` handles user/org creation on sign-in — needs modification to check for pending invites before creating a new org
- `shareTokens` collection pattern: demonstrates Firestore-based token flow for public access — similar pattern reusable for invites
- `rules.test.ts`: Test infrastructure for Firestore rules already exists with member/admin/planner scenarios
- `components/AppSidebar.vue`: Sidebar nav component — add "Team" link (editor-only), conditionally hide nav items for viewers
- `components/GettingStarted.vue`: Has a stub invite step (`done: false`, `to: null`) — wire up to /team route

### Established Patterns
- Dark mode palette: gray-950 body, gray-900 cards, gray-800 inputs — Team page must follow
- Pinia stores with `onSnapshot` for real-time Firestore data
- Table-based UI (SongTable pattern) — reuse for member table
- Inline SVG icons, no icon library
- orgId fetched ad-hoc in each view via `getDoc(doc(db, 'users', user.uid))` — Phase 7 should centralize this in auth store

### Integration Points
- `stores/auth.ts`: Add `orgId`, `userRole`, `isEditor` computed to the auth store — all views and components can use these
- `router/index.ts`: Route guard needs role awareness — viewers redirected away from /songs, /dashboard, /team
- `firestore.rules`: Wildcard `/{collection}/{docId}` rule currently allows all members to write — must restrict viewers to read-only on services, block access to songs for viewers
- Service-related views (ServicesView, ServiceEditorView): Conditionally hide mutation UI based on `isEditor`
- Song/Dashboard views: Block entirely for viewers via route guard
- `GettingStarted.vue`: Wire invite step to /team route, swap to viewer-specific steps based on role

</code_context>

<specifics>
## Specific Ideas

- Leverage Firebase's built-in Editor/Viewer permission model naming — familiar pattern for Firebase users
- The invite flow is deliberately low-tech: no email service, no Firebase Functions — editor tells the person to sign up, the app handles the rest by email matching
- Viewer experience is a narrow "window into the service plan" — they see what's planned for Sunday, nothing more
- Org name in the sidebar personalizes the workspace and prepares for potential multi-org support later

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control*
*Context gathered: 2026-03-04*
