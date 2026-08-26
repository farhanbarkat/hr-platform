# Architecture Decisions

## DEC-001: Monorepo with Turborepo
**Date:** 2024
**Decision:** Use Turborepo for monorepo management with workspaces for apps/api, apps/web, apps/mobile, packages/ui, packages/shared, packages/config.
**Reason:** Enables code sharing (types, UI components, config) across web and mobile while keeping deployable units separate.

## DEC-002: Multi-Tenancy via Company Middleware
**Date:** 2024
**Decision:** Enforce tenant scoping at middleware level (`tenant.middleware.js`) attaching `req.companyId` from authenticated user's companyId. All queries must filter by this.
**Reason:** Prevents accidental cross-tenant data leakage; centralizes enforcement rather than relying on per-endpoint discipline.

## DEC-003: JWT + Refresh Token Rotation with HttpOnly Cookies
**Date:** 2024
**Decision:** Short-lived access tokens (15min) in memory, long-lived refresh tokens (7d) in HttpOnly secure cookies with rotation and hash storage.
**Reason:** Mitigates XSS (access token not in localStorage) and token theft (rotation + hash storage + device tracking).

## DEC-004: Mandatory 2FA for Elevated Roles
**Date:** 2024
**Decision:** SUPER_ADMIN, COMPANY_ADMIN, HR must have 2FA enabled. EMPLOYEE and MANAGER optional.
**Reason:** Privileged roles can access sensitive payroll/employee data; regulatory compliance for financial data access.

## DEC-005: Decimal128 for Monetary Values
**Date:** 2024
**Decision:** All monetary fields use MongoDB Decimal128 (via Mongoose), never plain JS numbers.
**Reason:** Avoids floating-point precision errors in payroll, expenses, loans, advances.

## DEC-006: UTC Internally, Timezone at Display Layer
**Date:** 2024
**Decision:** All dates stored as UTC in DB. Company timezone (from Company.settings.defaultTimezone) applied only at API response formatting / frontend display.
**Reason:** Consistent handling across distributed teams, DST transitions, and multi-region deployments.

## DEC-007: Third-Party Calls Server-Side Only
**Date:** 2024
**Decision:** All external API calls (S3, FCM, SendGrid, Twilio, Google Maps, Stripe) happen in Express backend only. Frontend receives presigned URLs or calls internal endpoints.
**Reason:** Keeps API keys off client bundles; enables tenant/permission checks before external calls.

## DEC-008: Design System — IBM Plex Sans + Mono, Brass Accent, Notched Stat Cards
**Date:** 2024
**Decision:** Per Frontend Spec: IBM Plex Sans for display/body, IBM Plex Mono for numeric data; Timecard Brass (#B9812E) as sole brand accent; semantic colors for status only; notched stat card as signature element.
**Reason:** Functional legibility for data-dense operational tool; distinct visual identity tied to 'timecard/ledger' metaphor without gimmickry.

## DEC-009: RBAC Permission Cache — In-Memory with Explicit Invalidation
**Date:** 2025-08-11
**Decision:** Implement a 5-minute in-memory cache for resolved user permissions in `RBACService` with explicit invalidation methods (`invalidateCache`, `invalidateCompanyCache`). Not in original TICKET-004 spec; added to reduce DB load on permission checks.
**Reason:** Permission checks occur on every protected request. Cache avoids repeated RolePermissions lookups. Explicit invalidation on override updates ensures consistency. 5-min TTL balances performance with staleness risk.