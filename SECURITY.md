# Security Controls & Policy — InternHub Backend API

This document details the security architecture, safeguards, and defensive controls implemented across the InternHub REST API and Application submission system.

---

## 🛡 Security Checklist & Implemented Controls

| Control Category | Implemented Safeguard | Location in Code | Status |
|---|---|---|---|
| **SQL Injection Prevention** | 100% Parameterized queries (`?` prepared statements); zero string concatenation | `src/routes/internships.js`, `src/routes/applications.js`, `src/db.js` | ✅ Passed |
| **Input Validation** | Strict type, length, and format validation for all fields | `src/middleware/validate.js` | ✅ Passed |
| **URL Scheme Allowlisting** | Reject `javascript:`, `data:`, `file:`, `vbscript:`; enforce `http://` / `https://` only with valid domain structure | `src/middleware/validate.js` (`validateApplication`) | ✅ Passed |
| **Stored XSS Sanitization** | HTML tag stripping and sanitization on all user-submitted text | `src/middleware/validate.js` (`sanitizeString`) | ✅ Passed |
| **Rate Limiting (Anti-DoS / Anti-Spam)** | Global API limiter (200 req/15 min) + strict application limiter (15 submissions/15 min) | `src/middleware/security.js` (`apiLimiter`, `applicationLimiter`) | ✅ Passed |
| **Security Headers (Helmet)** | Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | `src/middleware/security.js` (`securityHeaders`) | ✅ Passed |
| **PII-Safe Logging** | Request latency and sanitized path logging only; never logs body, passwords, tokens, or applicant PII | `src/middleware/security.js` (`safeLogger`) | ✅ Passed |
| **Database-Level Integrity** | `UNIQUE(internship_id, applicant_email)` constraint prevents duplicate submissions | `schema.sql`, `src/routes/applications.js` | ✅ Passed |
| **Payload Size Capping** | JSON body parser limited to 100kb to mitigate memory exhaustion attacks | `src/app.js` (`express.json({ limit: '100kb' })`) | ✅ Passed |

---

## 🔍 Detailed Control Descriptions

### 1. SQL Injection Prevention (100% Parameterized Queries)
All database interactions use `better-sqlite3` prepared statements (`db.prepare(...)`). Dynamic user inputs are bound strictly via `?` or named parameters (`@param`). SQL string interpolation or concatenation is prohibited across all data access routes.

### 2. URL Scheme Allowlisting & Rejection of Malicious Schemes
The application portfolio input is strictly audited before acceptance:
- **Disallowed**: Any string containing or starting with dangerous schemes (`javascript:`, `data:`, `file:`, `vbscript:`, etc.).
- **Required**: Standard `http:` or `https:` protocol verified via Node's `new URL()`.
- **Domain Verification**: Requires a valid, non-spaced hostname with a domain suffix.

### 3. Rate Limiting & Anti-Abuse
- **General Rate Limiter**: Configured with `express-rate-limit` on all `/api/*` endpoints to thwart brute-force attacks (200 requests per 15-minute sliding window).
- **Application Submission Limiter**: Mounted specifically on `POST /api/applications` to curb spam submissions (15 applications per 15 minutes per IP address).

### 4. HTTP Security Headers with Helmet
Every response includes hardened security headers:
- `Content-Security-Policy`: Restricts script and resource origins to `'self'`.
- `X-Frame-Options: DENY`: Defends against clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `Strict-Transport-Security` & `Referrer-Policy`: Protects transport integrity.

### 5. PII-Safe Logging
Production logging (`safeLogger`) captures only:
`[ISO Timestamp] METHOD /sanitized-path STATUS - DURATIONms`
- Request query strings and body payloads are excluded from logs.
- Applicant names, emails, cover notes, authorization tokens, and credentials are never written to server logs or console outputs.

---

## 🧪 Security Test Verification

Automated security and validation tests are verified via:
```bash
npm test
```
All security assertions (rejection of malicious URLs, duplicate submissions, invalid inputs, and security header verification) are automated in [`tests/integration.test.js`](tests/integration.test.js).
