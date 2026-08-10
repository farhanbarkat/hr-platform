# Testing Documentation

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

### TICKET-004: Employee Model & CRUD
- **Test files:** Not yet created
- **Status:** Not started

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
5. Update this file with the new entry