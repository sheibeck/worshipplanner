# Phase 1: Foundation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Authentication (Google OAuth + email/password), Firebase infrastructure, Firestore data model with security rules, and the app shell. Planners can securely sign in and the data model is correct from day one. Song library, service planning, and all other features are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Sign-in experience
- Google-first layout: large "Sign in with Google" button prominently displayed, smaller "or use email" link/form below
- No separate registration page — accounts auto-created on first sign-in (Google or email)
- Minimal branding: clean page with "WorshipPlanner" title and sign-in options, no hero imagery
- Include "Forgot password?" flow — Firebase Auth handles the reset email

### App shell & navigation
- Sidebar navigation: persistent left sidebar with nav links, collapses to hamburger menu on mobile
- Getting started checklist as the empty dashboard state: step-by-step onboarding (1. Import songs, 2. Set up first service, etc.) with steps checking off as completed
- Clean & professional visual tone — minimal, muted colors, whitespace-heavy, tool-focused (think Linear/Notion)
- Light theme only for Phase 1; dark mode deferred (can be added later without major rework)

### Data model design
- Scaffold all Firestore collections up front (users, organizations, songs, services, tasks, events) — even if empty. Future phases populate them.
- Multi-tenant from day one: top-level `organizations` collection, all church data (songs, services, etc.) nested under the org ID. Users belong to one or more orgs.
- Strict security rules from day one: deny by default, only authenticated users with org membership can read/write their org's data

### Claude's Discretion
- Exact color palette and typography choices within "clean & professional" direction
- Loading states and error handling patterns
- Sidebar nav items and iconography
- Getting started checklist step details and completion tracking implementation
- Firebase project configuration and environment setup

</decisions>

<specifics>
## Specific Ideas

- Visual tone reference: Linear and Notion — tool-focused, no frills, professional
- Google sign-in should be the dominant CTA since most church teams use Google/Gmail
- Getting started checklist should guide the user naturally into Phase 2 actions (import songs, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-03*
