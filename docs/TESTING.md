"# Testing Documentation

## Test Structure
- **Unit tests:** `apps/api/src/**/*.test.js` — service layer business logic
- **Integration tests:** `apps/api/tests/integration/**/*.test.js` — API endpoints
- **Cross-tenant tests:** `apps/api/tests/tenant-isolation/**/*.test.js`
- **Run all:** `npm test` (from apps/api)

## Test Standards
- Every feature: unit (service) + integration (API) + cross-tenant isolation
- Minimum 2 edge cases per unit test: invalid input, permission/tenant failure
- Use Jest + Supertest
- Test DB: separate test database (MongoDB Memory Server or dedicated test DB)
- Cleanup: `beforeEach`/`afterEach` for data isolation

## Current Test Status

### TICKET-001: Multi-Tenant Setup
- **Test files:** `apps/api/src/models/company.model.test.js`, `apps/api/tests/integration/company.test.js`
- **Covers:** Company creation, slug uniqueness, settings defaults, tenant middleware scoping
- **Run:** `npm test -- --testPathPattern=company`
- **Status:** Passing (as of 2024)

### TICKET-002: JWT Authentication
- **Test files:** `apps/api/src/controllers/auth.controller.test.js`, `apps/api/tests/integration/auth.test.js`
- **Covers:** Login success/failure, password hashing, token generation, refresh rotation, lockout, logout
- **Run:** `npm test -- --testPathPattern=auth`
- **Status:** Passing (as of 2024)

### TICKET-003: 2FA TOTP
- **Test files:** `apps/api/src/controllers/auth.controller.test.js`, `apps/api/tests/integration/auth-2fa.test.js`
- **Covers:** Setup QR generation, confirm TOTP, verify login (TOTP + recovery), mandatory role enforcement, challenge token flow
- **Run:** `npm test -- --testPathPattern=auth-2fa`
- **Status:** Passing (as of 2024)

### TICKET-004: RBAC — Roles & Permissions Middleware
- **Test files:** 
  - `apps/api/src/services/rbac.service.test.js` (unit)
  - `apps/api/tests/integration/rbac.middleware.test.js` (integration)
  - `apps/api/tests/tenant-isolation/rbac.test.js` (cross-tenant isolation)
  - `apps/web/src/hooks/usePermissions.test.tsx` (frontend hook)
  - `apps/web/src/components/ProtectedRoute.test.tsx` (frontend route guard)
- **Covers:**
  - `getUserPermissions()` — default role permissions, company-specific overrides, 5-min in-memory caching, DB-error fallback to defaults
  - `hasPermission()`, `hasAllPermissions()`, `hasAnyPermission()` — permission resolution logic
  - `checkSelfApproval()` — blocks actor===target, allows when either ID missing (edge cases)
  - `invalidateCache()` / `invalidateCompanyCache()` — cache invalidation on override updates
  - Middleware: `requirePermission`, `requireAnyPermission`, `requireAllPermissions`, `requireRole` — 403 on missing permission, 401 on invalid/missing token, self-approval denial with reason
  - Cross-tenant isolation: per-company permission resolution, separate audit logs per company
  - Access logging: allowed/denied attempts logged with actor, permission, resourceType, targetEmployeeId, reason
- **Run:**
  ```bash
  # From repo root
  cd apps/api
  $env:NODE_OPTIONS=\"--experimental-vm-modules\"; npx jest --testPathPattern=rbac.service.test
  $env:NODE_OPTIONS=\"--experimental-vm-modules\"; npx jest --testPathPattern=rbac.middleware.test
  $env:NODE_OPTIONS=\"--experimental-vm-modules\"; npx jest --testPathPattern=tenant-isolation/rbac
  # Or all RBAC tests at once:
  $env:NODE_OPTIONS=\"--experimental-vm-modules\"; npx jest --testPathPattern=rbac
  ```
- **Status:** Passing (as of 2025-08-11) — 34 tests total (16 unit + 18 integration)

### TICKET-005: Company Settings UI
- **Test files:** Not yet created (frontend)
- **Status:** Not started

## How to Run Tests
```bash
# From repo root
cd apps/api
npm test                    # All tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage report
npm test -- --testPathPattern=<pattern>  # Specific pattern
```

## Adding Tests for New Features
1. Create service unit tests in `src/<feature>/<feature>.service.test.js`
2. Create API integration tests in `tests/integration/<feature>.test.js`
3. Create cross-tenant isolation test in `tests/tenant-isolation/<feature>.test.js`
4. Run and verify all pass
5. Update this file with the new entry"