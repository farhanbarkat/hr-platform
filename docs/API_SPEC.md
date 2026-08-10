# API Specification — Frontend Integration Reference

> **Rule:** All third-party calls happen server-side. Frontend only calls internal `/api/v1/*` endpoints.
> Base URL: `http://localhost:5000/api/v1` (dev), `https://api.yourdomain.com/api/v1` (prod)

---

## Authentication

### POST /auth/login
**Purpose:** Step 1 of login — email/password verification

**Request:**
```json
{
  "email": "user@company.com",
  "password": "secret123"
}
```

**Response — 2FA Required (SUPER_ADMIN, COMPANY_ADMIN, HR, or enrolled users):**
```json
{
  "statusCode": 200,
  "data": {
    "requires2FA": true,
    "isEnrolled": true,
    "challengeToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "2FA verification required.",
  "success": true
}
```

**Response — No 2FA Required (EMPLOYEE/MANAGER without 2FA):**
```json
{
  "statusCode": 200,
  "data": {
    "user": { "_id", "email", "role", "companyId", "employeeId" },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User logged in successfully.",
  "success": true
}
```
**Cookie:** `refreshToken` (HttpOnly, Secure, SameSite=Strict, 7d)

---

### POST /auth/2fa/verify-login
**Purpose:** Step 2 — verify TOTP or recovery code

**Headers:** `Authorization: Bearer <challengeToken>` (from login response)

**Request (TOTP):**
```json
{ "code": "123456" }
```

**Request (Recovery Code):**
```json
{ "recoveryCode": "a1b2c3d4" }
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "user": { "_id", "email", "role", "companyId", "employeeId" },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "2FA verified and login complete.",
  "success": true
}
```
**Cookie:** New `refreshToken` (rotated)

---

### POST /auth/2fa/setup
**Purpose:** Initialize 2FA — generate secret + QR code

**Headers:** `Authorization: Bearer <challengeToken>` (from login) OR `Authorization: Bearer <accessToken>` (if already logged in)

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "recoveryCodes": [
      "a1b2c3d4", "e5f6g7h8", "i9j0k1l2", "m3n4o5p6",
      "q7r8s9t0", "u1v2w3x4", "y5z6a7b8", "c9d0e1f2"
    ]
  },
  "message": "2FA setup initialized.",
  "success": true
}
```
**Frontend:** Show QR code, secret (for manual entry), and recovery codes **once** — user must save them.

---

### POST /auth/2fa/confirm
**Purpose:** Confirm 2FA setup by verifying first TOTP

**Headers:** `Authorization: Bearer <challengeToken>`

**Request:**
```json
{ "code": "123456" }
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {},
  "message": "2FA successfully enabled.",
  "success": true
}
```

---

### POST /auth/refresh
**Purpose:** Rotate access token using refresh token cookie

**Cookie:** `refreshToken` (sent automatically)

**Response:**
```json
{
  "statusCode": 200,
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
  "message": "Tokens refreshed.",
  "success": true
}
```
**Cookie:** New `refreshToken` (rotated)

**Frontend:** Intercept 401 → call refresh → retry original request (once).

---

### POST /auth/logout
**Purpose:** Invalidate refresh token

**Cookie:** `refreshToken` (sent automatically)

**Response:**
```json
{
  "statusCode": 200,
  "data": {},
  "message": "Logged out successfully.",
  "success": true
}
```
**Cookie:** `refreshToken` cleared

---

## Company Settings

### GET /company
**Purpose:** Get current company settings

**Headers:** `Authorization: Bearer <accessToken>`

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "...",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "currency": "PKR",
    "defaultTimezone": "Asia/Karachi",
    "settings": {
      "workingHours": { "start": "09:00", "end": "18:00" },
      "gracePeriodMinutes": 15,
      "leavePolicyDefaults": {
        "annualQuota": 14,
        "casualQuota": 10,
        "sickQuota": 8
      }
    },
    "worksites": [
      { "_id": "...", "name": "Head Office", "address": "...", "lat": 31.5204, "lng": 74.3587, "radiusMeters": 100 }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Company fetched.",
  "success": true
}
```

---

### PUT /company
**Purpose:** Update company settings (COMPANY_ADMIN only)

**Headers:** `Authorization: Bearer <accessToken>`

**Request (partial allowed):**
```json
{
  "name": "Acme Corp",
  "currency": "PKR",
  "defaultTimezone": "Asia/Karachi",
  "settings": {
    "workingHours": { "start": "08:30", "end": "17:30" },
    "gracePeriodMinutes": 10,
    "leavePolicyDefaults": {
      "annualQuota": 16,
      "casualQuota": 12,
      "sickQuota": 10
    }
  }
}
```

**Response:** Same as GET

---

### Worksites (nested in company settings)

#### POST /company/worksites
**Request:**
```json
{
  "name": "Factory Unit 2",
  "address": "123 Industrial Ave",
  "lat": 31.5210,
  "lng": 74.3590,
  "radiusMeters": 150
}
```

#### PUT /company/worksites/:worksiteId
#### DELETE /company/worksites/:worksiteId

---

## Response Envelope (All Endpoints)

```typescript
interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

interface ApiError {
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  success: false;
}
```

---

## Frontend Integration Checklist

| Feature | Endpoint(s) | Token Handling |
|---------|-------------|----------------|
| Login | `/auth/login` → `/auth/2fa/verify-login` | Store `accessToken` in memory (React state/Zustand); `refreshToken` in HttpOnly cookie (auto) |
| Auto-refresh | Interceptor on 401 → `/auth/refresh` | Retry original request once |
| Logout | `/auth/logout` | Clear memory token; cookie cleared by backend |
| 2FA Setup | `/auth/2fa/setup` → `/auth/2fa/confirm` | Requires `challengeToken` from login |
| Company Settings | `GET/PUT /company` | Standard `accessToken` |
| Worksites | `POST/PUT/DELETE /company/worksites/*` | Standard `accessToken` |

---

## Error Codes to Handle

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| 400 | Validation error | Show field errors from `errors[]` |
| 401 | Unauthorized (token expired/invalid) | Trigger refresh interceptor; if fails → redirect to login |
| 403 | Forbidden (role/permission) | Show "Access denied" toast; disable action |
| 404 | Not found | Show "Not found" state |
| 409 | Conflict (duplicate slug, etc.) | Show specific error message |
| 423 | Locked (account locked) | Show "Account locked, try again in 15 min" |
| 429 | Rate limited | Show "Too many requests" with retry-after |
| 5xx | Server error | Show generic error; log to Sentry |

---

## TypeScript Types (for packages/shared)

```typescript
// packages/shared/src/types/api.ts

export interface User {
  _id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  companyId: string;
  employeeId: string | null;
  isTwoFactorEnabled: boolean;
}

export interface LoginResponse {
  requires2FA: boolean;
  isEnrolled: boolean;
  challengeToken?: string;
  user?: User;
  accessToken?: string;
}

export interface CompanySettings {
  workingHours: { start: string; end: string };
  gracePeriodMinutes: number;
  leavePolicyDefaults: { annualQuota: number; casualQuota: number; sickQuota: number };
}

export interface Company {
  _id: string;
  name: string;
  slug: string;
  currency: string;
  defaultTimezone: string;
  settings: CompanySettings;
  worksites: Worksite[];
  createdAt: string;
  updatedAt: string;
}

export interface Worksite {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}
```