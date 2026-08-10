# Product Requirements Document

## Vision
A multi-tenant HR & Team Management Platform for companies to manage attendance, leave, payroll, tasks, and finance — usable on factory floors, in HR offices, and on low-end Android phones.

## Target Users
| Persona | Primary Needs |
|---------|---------------|
| Employee | Check-in/out, view payslip, request leave, see tasks |
| Manager | Approve leave/tasks, view team attendance, assign work |
| HR | Run payroll, manage employees, configure policies, generate reports |
| Company Admin | Company settings, worksites, roles, subscription |
| Super Admin | Platform-wide oversight, tenant management |

## Core Modules (Phased)

### Phase 1: Foundation (Current)
- [x] Multi-tenant company setup
- [x] JWT auth + 2FA
- [ ] Employee directory & profiles
- [ ] Company settings UI

### Phase 2: Attendance & Leave
- [ ] GPS/geofence check-in/out (mobile)
- [ ] Manual check-in/out (web kiosk)
- [ ] Biometric device sync (ZKTeco)
- [ ] Attendance corrections & approvals
- [ ] Leave requests (annual/casual/sick) with workflow
- [ ] Leave balances & carry-over
- [ ] Holiday calendar per company

### Phase 3: Payroll & Finance
- [ ] Payroll runs (monthly/bi-weekly)
- [ ] Payslip generation (PDF) + email delivery
- [ ] Tax certificates (annual)
- [ ] Expense claims (receipts via S3)
- [ ] Salary advances & loans
- [ ] Finance dashboard (income vs expenses)

### Phase 4: Tasks & Collaboration
- [ ] Kanban board (To Do / In Progress / Review / Done)
- [ ] Task assignments, due dates, comments
- [ ] Recurring tasks & templates
- [ ] Notifications (FCM, email, SMS)

### Phase 5: Advanced / Integrations
- [ ] Calendar sync (Google/Outlook)
- [ ] Subscription billing (Stripe/regional)
- [ ] Advanced reports & exports
- [ ] API for third-party integrations

## Non-Functional Requirements
- **Performance:** <200ms p95 API latency; <3s web first paint on 3G
- **Accessibility:** WCAG 2.1 AA; min 14px text; 44x44 tap targets
- **Offline:** Mobile check-in queues offline, syncs when online
- **Security:** OWASP Top 10; pen test before launch; data encryption at rest
- **Compliance:** GDPR-ready; local labor law config (Pakistan first)
- **Scalability:** Horizontal scaling via stateless API + Redis

## Design Principles (from Frontend Spec)
- Operational tool aesthetic (ledger/timecard metaphor)
- IBM Plex Sans + Mono; Brass accent; semantic status colors only
- Notched stat cards for key metrics
- Dense data tables with mono-aligned numbers
- Mobile-first responsive (breakpoints: <768, 768-1024, >1024)

## Success Metrics
- Daily active users / tenant > 60%
- Check-in success rate > 99%
- Payroll run error rate < 0.1%
- Support tickets / tenant / month < 5
"