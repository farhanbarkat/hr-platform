# Feature Tickets

## TICKET-001: Multi-Tenant Setup ✅ DONE
**Branch:** `feature/farhan/TICKET-001-multi-tenant-setup`
**PR:** #3
**Status:** Merged to develop
**Acceptance Criteria:**
- [x] Company model with name, slug, currency, timezone, settings
- [x] Tenant middleware attaching req.companyId from authenticated user
- [x] All queries scoped to companyId
- [x] Docker compose with MongoDB + Redis

---

## TICKET-002: JWT Authentication ✅ DONE
**Branch:** `feature/farhan/TICKET-002-jwt-auth`
**PR:** #4
**Status:** Merged to develop
**Acceptance Criteria:**
- [x] POST /api/v1/auth/login — email/password → access + refresh tokens
- [x] bcrypt hashing (cost 12)
- [x] Access token 15min, refresh token 7d HttpOnly cookie
- [x] Refresh rotation with hash storage
- [x] Account lockout after 5 failures (15 min)
- [x] Logout invalidates refresh token

---

## TICKET-003: 2FA TOTP ✅ DONE
**Branch:** `feature/farhan/TICKET-003-2fa-totp`
**PR:** #5
**Status:** Merged to develop
**Acceptance Criteria:**
- [x] POST /api/v1/auth/2fa/setup — generates secret + QR code
- [x] POST /api/v1/auth/2fa/confirm — verifies TOTP, enables 2FA
- [x] POST /api/v1/auth/2fa/verify-login — TOTP or recovery code
- [x] 8 recovery codes (SHA-256 hashed, single-use)
- [x] Mandatory for SUPER_ADMIN, COMPANY_ADMIN, HR
- [x] Challenge token flow for unenrolled users

---

## TICKET-004: RBAC — Roles & Permissions Middleware ✅ DONE
**Branch:** `feature/ticket-004-rbac`
**PR:** #TBD
**Status:** Merged to develop
**Acceptance Criteria:**
- [x] Central permissions registry (`config/permissions.js`) with 5 roles (SUPER_ADMIN, COMPANY_ADMIN, HR, MANAGER, EMPLOYEE) and 50+ granular permissions
- [x] RolePermissions model for per-company overrides with audit trail (`updatedBy`, `updatedAt`)
- [x] `requirePermission()` / `requireAnyPermission()` / `requireAllPermissions()` / `requireRole()` middleware — 403 with clear messages
- [x] Self-approval guard blocks actor===target for leave, loan, shift-swap approvals (allows when either ID missing)
- [x] In-memory 5-min cache with `invalidateCache()` / `invalidateCompanyCache()`
- [x] AccessLog model logs every authorization attempt (allowed/denied)
- [x] Full test coverage: unit (16), integration (18), cross-tenant isolation — all passing

---

## TICKET-005: Employee Model & CRUD 📋 NEXT
**Status:** Not started
**Priority:** High
**Acceptance Criteria:**
- [ ] Employee model (personal info, employment details, documents, bank info)
- [ ] Link to User via employeeId
- [ ] CRUD endpoints with tenant scoping
- [ ] Document upload via presigned S3 URLs
- [ ] Org chart / reporting line
- [ ] Tests: unit (service), integration (API), cross-tenant isolation

---

## TICKET-006: Company Settings UI 📋 PLANNED
**Status:** Not started
**Priority:** High
**Acceptance Criteria:**
- [ ] Web app scaffold (Vite + React + TS + Tailwind)
- [ ] Design system implementation (tokens, components)
- [ ] Auth pages (login, 2FA challenge, 2FA setup)
- [ ] Company settings page (currency, timezone, leave policy, working hours)
- [ ] Role-aware sidebar navigation

---

## TICKET-007: Attendance Module 📋 PLANNED
**Status:** Not started
**Priority:** High
**Acceptance Criteria:**
- [ ] Check-in/out endpoint (GPS + manual)
- [ ] Geofence validation (Haversine, company worksite coords + radius)
- [ ] Attendance record model (date, checkIn, checkOut, status, location)
- [ ] Daily/weekly/monthly attendance views
- [ ] Correction requests workflow
- [ ] Biometric event ingestion endpoint
- [ ] Tests including offline mobile sync scenario

---

## TICKET-008: Leave Module 📋 PLANNED
**Status:** Not started
**Priority:** High
**Acceptance Criteria:**
- [ ] Leave request model (type, dates, reason, status, approver)
- [ ] Leave balance model (annual/casual/sick, carry-over)
- [ ] Request → approve/reject workflow with notifications
- [ ] Calendar view (company holidays + team leave)
- [ ] Balance deduction on approval
- [ ] Tests including overlapping requests, quota enforcement

---

## TICKET-009: Payroll Module 📋 PLANNED
**Status:** Not started
**Priority:** Medium
**Acceptance Criteria:**
- [ ] Payroll run model (period, status, generatedBy)
- [ ] Payslip model (earnings, deductions, net, PDF generation)
- [ ] Monthly/bi-weekly run workflow
- [ ] PDF generation + S3 storage + email delivery
- [ ] Tax certificate annual generation
- [ ] Tests with Decimal128 precision verification

---

## TICKET-010: Finance Module 📋 PLANNED
**Status:** Not started
**Priority:** Medium
**Acceptance Criteria:**
- [ ] Expense claim model (category, amount, receipt, status)
- [ ] Salary advance / loan model (principal, installments, status)
- [ ] Approval workflows
- [ ] Finance dashboard (income vs expenses, profit/loss)
- [ ] Tests

---

## TICKET-011: Tasks Module 📋 PLANNED
**Status:** Not started
**Priority:** Medium
**Acceptance Criteria:**
- [ ] Task model (title, description, status, assignee, dueDate, board)
- [ ] Kanban board UI (web + mobile)
- [ ] Comments, attachments
- [ ] Recurring tasks
- [ ] Notifications on assignment/updates
- [ ] Tests
