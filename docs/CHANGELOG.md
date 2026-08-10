# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation files: PROGRESS.md, DECISIONS.md, Architecture.md, PRD.md, Feature_Tickets.md, TESTING.md, CHANGELOG.md

## [0.1.0] - 2024-01-XX

### Added
- TICKET-001: Multi-tenant company setup with Company model, tenant middleware, Docker compose
- TICKET-002: JWT authentication with bcrypt, token rotation, account lockout
- TICKET-003: 2FA TOTP with QR codes, recovery codes, mandatory for elevated roles

### Changed
- N/A

### Fixed
- N/A

### Security
- HttpOnly secure cookies for refresh tokens
- Refresh token rotation with hash storage
- Account lockout after 5 failed attempts
- Mandatory 2FA for SUPER_ADMIN, COMPANY_ADMIN, HR roles
