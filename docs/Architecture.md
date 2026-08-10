# Architecture Overview

## System Context
Multi-tenant HR & Team Management Platform serving companies (tenants) with role-based access control. Built as a MERN-stack monorepo.

## Repository Structure
```
hr-platform/
├── apps/
│   ├── api/          # Express backend
│   ├── web/          # React + Vite (to be built)
│   └── mobile/       # React Native (future)
├── packages/
│   ├── ui/           # Shared React components (to be built)
│   ├── shared/       # Shared types, utilities (to be built)
│   └── config/       # Shared config (Tailwind, ESLint, etc.)
├── docs/
│   ├── PROGRESS.md
│   ├── DECISIONS.md
│   ├── Architecture.md
│   ├── PRD.md
│   ├── Feature_Tickets.md
│   ├── TESTING.md
│   └── CHANGELOG.md
├── turbo.json
├── package.json
└── docker-compose.yml
```

## Backend Architecture (apps/api)

### Tech Stack
- **Runtime:** Node.js 20+ (Express)
- **Database:** MongoDB (Mongoose ODM)
- **Cache/Session:** Redis
- **Auth:** JWT (access + refresh rotation) + TOTP 2FA
- **Validation:** Zod (planned)
- **Testing:** Jest + Supertest

### Module Pattern (Strict)
Each feature follows:
```
feature/
├── *.model.js        # Mongoose schema only
├── *.service.js      # ALL business logic here
├── *.controller.js   # Request/response handling ONLY
├── *.routes.js       # Routing only
└── *.test.js         # Unit + integration tests
```

**Rules:**
- Controllers call services only, never models directly
- Services are the only layer other modules may import
- All DB queries tenant-scoped via `req.companyId` from middleware

### Multi-Tenancy
- `tenant.middleware.js` extracts `companyId` from authenticated user
- Attaches `req.companyId` for all downstream handlers
- Every query: `{ companyId: req.companyId, ... }`
- Cross-tenant isolation tested per feature

### Authentication & Authorization
- **Roles:** SUPER_ADMIN > COMPANY_ADMIN > HR > MANAGER > EMPLOYEE
- **Access Token:** 15 min, in memory (React state)
- **Refresh Token:** 7 days, HttpOnly secure cookie, rotated on use, stored as SHA-256 hash
- **2FA:** TOTP (speakeasy), mandatory for SUPER_ADMIN, COMPANY_ADMIN, HR
- **Account Lockout:** 5 failed attempts → 15 min lock

### Data Conventions
- **Monetary:** Decimal128 (Mongoose) → string in JSON
- **Dates:** UTC in DB; company timezone applied at display layer
- **Soft Deletes:** `deletedAt` field + query middleware (planned)
- **Audit:** `createdAt`, `updatedAt` on all models; audit log collection (planned)

### API Design
- **Base Path:** `/api/v1`
- **Response Envelope:** `ApiResponse` / `ApiError` classes
- **Pagination:** Cursor-based (planned) or offset/limit
- **File Upload:** Presigned S3 URLs (client → S3 direct)

### Third-Party Integrations (Server-Side Only)
| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| AWS S3 / DO Spaces | File storage (contracts, payslips, attachments) | Presigned URLs via `/api/documents` |
| Firebase FCM | Push notifications | `NotificationService` → FCM HTTP v1 |
| SendGrid | Email (payslips, approvals, resets) | Dynamic templates via `NotificationService` |
| Twilio | SMS (urgent alerts) | `NotificationService` with cost controls |
| Google Maps | Geocoding, map display | Geofence math done in backend (Haversine) |
| ZKTeco | Biometric device events | Local bridge agent → `/api/attendance/biometric-events` |
| Google/Outlook Calendar | Calendar sync | OAuth tokens stored encrypted (future) |
| Stripe / Regional Gateway | Subscription billing | Webhooks → company subscription status |

## Frontend Architecture (apps/web) — Planned
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS (design tokens from spec)
- **State:** TanStack Query (server) + Zustand (client)
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod
- **Components:** `packages/ui` (shared with mobile via React Native Web / separate)
- **Design System:** Per Frontend Spec (IBM Plex, Brass accent, notched cards)

## Mobile Architecture (apps/mobile) — Future
- **Framework:** React Native (Expo or bare)
- **Shared:** Types from `packages/shared`, API client, business logic
- **Native:** FCM, biometric auth, camera (document scan), GPS

## Infrastructure
- **Containerization:** Docker (api, web, mongo, redis)
- **Orchestration:** docker-compose (dev), Kubernetes (prod planned)
- **CI/CD:** GitHub Actions (lint, test, build, deploy)
- **Environments:** Development → Staging → Production
- **Secrets:** GitHub Secrets / Vault (never in code)

## Security
- Helmet, CORS, rate limiting on API
- Input validation at controller boundary
- No secrets in client bundles
- Audit logging for sensitive actions (planned)
- Penetration testing before launch

## Observability
- Structured logging (Pino/Winston planned)
- Metrics: Prometheus + Grafana (planned)
- Error tracking: Sentry (planned)
- Distributed tracing: OpenTelemetry (planned)