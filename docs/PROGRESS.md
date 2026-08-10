# Project Progress

## Completed Tickets

### TICKET-001: Multi-Tenant Setup
- Company model with settings (currency, timezone, leave policy, working hours)
- Tenant middleware for companyId scoping
- Database connection and Redis setup

### TICKET-002: JWT Authentication
- Login with bcrypt password hashing
- Access/refresh token rotation
- Account lockout after 5 failed attempts
- HttpOnly secure cookies for refresh tokens

### TICKET-003: 2FA TOTP
- TOTP setup with QR code generation (speakeasy)
- Recovery codes (8 codes, SHA-256 hashed)
- Mandatory 2FA for SUPER_ADMIN, COMPANY_ADMIN, HR roles
- 2FA verification during login flow

## In Progress
- None

## Pending / Backlog
- Employee model and CRUD
- Attendance module (check-in/out, geofence, biometric sync)
- Leave module (requests, approvals, balances)
- Payroll module (payslips, runs, tax certificates)
- Tasks module (Kanban board, assignments)
- Finance module (expenses, advances, loans)
- Web frontend (React + Vite + Tailwind)
- Mobile app (React Native)
- Design system implementation
- Notification service (FCM, Email, SMS)
- File storage (S3 presigned URLs)
- Calendar sync (Google/Outlook)
- Payment/subscription billing

## Current Architecture
- Monorepo: Turborepo with apps/api, apps/web, apps/mobile, packages/ui, packages/shared, packages/config
- Backend: Express + Mongoose (MongoDB) + Redis
- Auth: JWT + 2FA TOTP, role-based (SUPER_ADMIN, COMPANY_ADMIN, HR, MANAGER, EMPLOYEE)
- Multi-tenancy: Company-scoped via middleware, all queries filtered by companyId