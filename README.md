# InternHub — Full-Stack Internship Board & Application API

A production-ready full-stack web application and RESTful backend API for an **Internship Board** with an **internship application submission workflow**, persistent SQLite storage (`better-sqlite3`), strict server-side security safeguards, accessible responsive UI, and automated integration test coverage.

---

## 📑 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Database Schema & Seed Data](#-database-schema--seed-data)
- [Security Architecture](#-security-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Database Seeding](#database-seeding)
  - [Running the Server](#running-the-server)
- [Automated Tests & Test Report](#-automated-tests--test-report)
- [Frontend Client & Application Workflow](#-frontend-client--application-workflow)
- [API Reference](#-api-reference)
  - [Internships Endpoints](#internships-endpoints)
  - [Applications Endpoints](#applications-endpoints)
  - [Health Check](#health-check)
- [License](#-license)

---

## ✨ Features

- **Responsive & Accessible Frontend**: Pure vanilla HTML5, CSS3, and JavaScript located in `public/`. Tested mobile-first down to **360px** with full keyboard navigation and focus traps in native `<dialog>` elements.
- **Application Submission Workflow**: Applicants can view full internship details and submit applications with full name, email address, portfolio/GitHub URL, and cover note.
- **SQLite with Parameterized Queries**: High-speed persistence using `better-sqlite3`, WAL mode, and 100% parameterized queries (`?` placeholders) ensuring zero SQL injection risk.
- **Database-Level Deduplication**: Enforces a `UNIQUE(internship_id, applicant_email)` constraint preventing duplicate applications per position.
- **Strict Server-Side Security**:
  - `helmet` security headers (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
  - Rate limiting via `express-rate-limit` on all API routes, with tighter limits on application submissions.
  - URL scheme allowlisting: Rejects dangerous protocols (`javascript:`, `data:`, `file:`, `vbscript:`) and enforces valid `http:`/`https:` domains.
  - PII-Safe Logging: Logs method, path, status, and duration only — never writes applicant PII or credentials.
- **Consistent Response Envelopes**: Standardized `{ "status": "success", "data": ... }` and centralized error envelopes `{ "status": "error", "message": ..., "errors": [...] }`.
- **Automated Integration Tests**: 32 automated tests using Node's native test runner (`node --test`), covering CRUD operations, application workflows, validation rejections, and security headers.

---

## 🏗 Project Structure

```
internship-board-api/
├── public/                  # Responsive, accessible frontend client
│   ├── index.html           # Semantic markup, detail modal, and application form dialog
│   ├── styles.css           # Mobile-first CSS, 360px-ready, accessible focus rings
│   └── app.js               # API loading, filtering, form validation, modal focus trap
├── src/
│   ├── server.js            # Express app initialization and server entrypoint
│   ├── db.js                # SQLite connection, pragmas (WAL), auto-schema runner
│   ├── routes/
│   │   ├── internships.js   # REST CRUD endpoints for internships (/api/internships)
│   │   ├── applications.js  # Application submission workflow (/api/applications)
│   │   └── health.js        # Health check endpoint (/api/health)
│   └── middleware/
│       ├── security.js      # Helmet headers, rate limiters, PII-safe request logger
│       ├── validate.js      # Payload validators and URL scheme allowlisting
│       └── errorHandler.js  # Centralized 404 and global JSON error envelope handler
├── tests/
│   └── integration.test.js  # End-to-end integration test suite
├── schema.sql               # SQLite DDL schema with tables and indexes
├── seed.js                  # Idempotent database population script
├── server.js                # Root proxy entrypoint
├── package.json             # NPM package definition, scripts, and dependencies
├── SECURITY.md              # Security checklist and policy documentation
└── README.md                # Project documentation
```

---

## 🗄 Database Schema & Seed Data

### Schema (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS internships (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('Remote', 'Hybrid', 'On-site')),
  location TEXT NOT NULL,
  skills TEXT NOT NULL, -- Stored as JSON array: e.g. ["HTML","CSS","JavaScript"]
  openings INTEGER NOT NULL DEFAULT 1 CHECK(openings >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  internship_id TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  portfolio_url TEXT NOT NULL,
  cover_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
  CONSTRAINT uq_internship_applicant UNIQUE (internship_id, applicant_email)
);

CREATE INDEX IF NOT EXISTS idx_internships_domain ON internships(domain);
CREATE INDEX IF NOT EXISTS idx_internships_mode ON internships(mode);
CREATE INDEX IF NOT EXISTS idx_applications_internship_id ON applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(applicant_email);
```

### Seed Data
The database is pre-seeded idempotently with the 5 sample records (`INT-101` through `INT-105`) matching the exact specification:
- `INT-101`: Frontend Intern (Full Stack Development, Remote, India, `["HTML","CSS","JavaScript"]`, openings: 3)
- `INT-102`: API Engineering Intern (Full Stack Development, Hybrid, Pune, `["Node.js","SQL","Testing"]`, openings: 2)
- `INT-103`: UI/UX Intern (UI/UX, Remote, India, `["Figma","Research","Accessibility"]`, openings: 1)
- `INT-104`: Data Analyst Intern (Data Analytics, On-site, Bengaluru, `["Excel","SQL","Data visualisation"]`, openings: 2)
- `INT-105`: Security Operations Intern (Cyber Security, Remote, India, `["Linux","Logs","Networking"]`, openings: 1)

---

## 🛡 Security Architecture

See [`SECURITY.md`](SECURITY.md) for full policy details. Implemented security safeguards include:

1. **SQL Injection Prevention**: 100% prepared statements with parameterized inputs (`?`). No SQL concatenation is used anywhere in the codebase.
2. **URL Scheme Allowlist**: Strict validation rejecting malicious pseudo-protocols like `javascript:alert(1)`, `data:`, `file:`, or `vbscript:`. Only valid `http://` and `https://` URLs are accepted.
3. **Stored XSS Sanitization**: User input strings are trimmed and sanitized to strip dangerous tags and characters before storage.
4. **Rate Limiting**:
   - General API limiter: 200 requests / 15 minutes per IP.
   - Application submission limiter: 15 submissions / 15 minutes per IP to curb spam.
5. **Security Headers (Helmet)**: Sets `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`.
6. **PII-Safe Logging**: Safe logger records HTTP method, sanitized path, status code, and latency only. Applicant emails, names, cover notes, passwords, and authorization tokens are strictly omitted from logs.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ or v24+ recommended)
- **npm**: v9.0.0 or later

### Installation

```bash
git clone https://github.com/rajasaravananbalamurugan/internship-board-integrated.git
cd internship-board-integrated
npm install
```

### Environment Setup

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port for the Express server to listen on |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `DB_PATH` | `./data/internships.db` | Path to the SQLite database file |

### Database Seeding

Run the idempotent seed script:
```bash
npm run seed
```
Output:
```
✅ Seed complete! Seeded 5 records. Total internships in database: 5.
```

### Running the Server

#### Production / Standard:
```bash
npm start
```

#### Development Mode (with native file watching):
```bash
npm run dev
```

The application will be accessible at:
- **Frontend UI**: [http://localhost:3000/](http://localhost:3000/)
- **Backend API**: [http://localhost:3000/api/internships](http://localhost:3000/api/internships)

---

## 🧪 Automated Tests & Test Report

The project includes automated integration and unit tests using Node's built-in test runner (`node:test`).

### Run All Tests:
```bash
npm test
```

### Run Integration Tests Specifically:
```bash
npm run test:integration
```

### Test Report Summary:
```
✔ Internship Board REST API Test Suite (20 tests)
✔ Internship Board & Applications Integration Tests (12 tests)
  - Verifies presence of Helmet security headers (CSP, X-Frame-Options, nosniff)
  - 1. Successful listing and filtering of internships with pagination envelope
  - 2. Successful application submission (201 Created)
  - 3. Rejected missing or blank name (400 Bad Request)
  - 4. Rejected invalid email format (400 Bad Request)
  - 5. Rejected unsafe URL like javascript:alert(1) (400 Bad Request)
  - 6. Rejected duplicate application for the same internship + email (409 Conflict)
  - Allows same email to apply to a different internship
  - Rejects application for non-existent internship_id (404 Not Found)

ℹ tests 32
ℹ suites 13
ℹ pass 32
ℹ fail 0
ℹ duration_ms 673ms
```

---

## 💻 Frontend Client & Application Workflow

The frontend is served directly by Express from `public/`:
1. **Live API Fetching**: Loads internships via `fetch('/api/internships')`.
2. **State Panels**: Displays accessible loading spinners, error alerts with a working **Retry** button, and empty filter panels with a **Reset filters** button.
3. **Application Dialog (`<dialog id="apply-modal">`)**:
   - Opens when clicking "Apply" on any card or from the "View Details" modal.
   - Pre-fills the role title and ID.
   - Associated `<label for="...">` elements on all input fields.
   - Client-side validation for Full Name, Email, and Portfolio URL.
   - Loading state on Submit button to prevent duplicate submissions.
   - Inline server error feedback and clean success confirmation.
   - Full keyboard navigation: Focus trapped inside `<dialog>`, `Escape` closes, and focus returns to trigger element.
   - Zero horizontal overflow at **360px** mobile viewport width.

---

## 📡 API Reference

### Internships Endpoints

#### `GET /api/internships`
Returns a paginated list of internships.
- **Query Parameters**:
  - `page`: Page number (default `1`)
  - `limit`: Items per page (default `10`, max `100`)
  - `search`: Keyword search across title, domain, location, and skills
  - `domain`: Filter by domain (`Full Stack Development`, `UI/UX`, `Data Analytics`, `Cyber Security`)
  - `mode`: Filter by mode (`Remote`, `Hybrid`, `On-site`)
  - `sort`: Sort field (`id`, `title`, `domain`, `mode`, `openings`, `created_at`)
  - `order`: Sort direction (`asc`, `desc`)
- **Response**: `200 OK`
```json
{
  "status": "success",
  "data": [
    {
      "id": "INT-101",
      "title": "Frontend Intern",
      "domain": "Full Stack Development",
      "mode": "Remote",
      "location": "India",
      "skills": ["HTML", "CSS", "JavaScript"],
      "openings": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

#### `GET /api/internships/:id`
Returns a single internship by its string ID (e.g. `INT-101`). Returns `404` if not found.

#### `POST /api/internships`
Creates a new internship. Accepts `id` (optional), `title`, `domain`, `mode`, `location`, `skills` (array of strings), and `openings`.

#### `PUT /api/internships/:id` & `PATCH /api/internships/:id`
Full (`PUT`) or partial (`PATCH`) update of an internship record.

#### `DELETE /api/internships/:id`
Deletes an internship record.

---

### Applications Endpoints

#### `POST /api/applications`
Submits an application for an internship.
- **Rate Limit**: Max 15 submissions per 15 minutes per IP.
- **Request Body**:
```json
{
  "internship_id": "INT-101",
  "applicant_name": "Jane Doe",
  "applicant_email": "jane.doe@example.com",
  "portfolio_url": "https://github.com/janedoe",
  "cover_note": "Experienced in semantic HTML, CSS Grid, and vanilla JavaScript."
}
```
- **Response**: `201 Created`
```json
{
  "status": "success",
  "data": {
    "id": "APP-1-ML7B1K",
    "internship_id": "INT-101",
    "applicant_name": "Jane Doe",
    "applicant_email": "jane.doe@example.com",
    "portfolio_url": "https://github.com/janedoe",
    "cover_note": "Experienced in semantic HTML, CSS Grid, and vanilla JavaScript.",
    "created_at": "2026-11-20 00:38:00"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (missing name, invalid email, or unsafe URL scheme).
  - `404 Not Found`: `internship_id` does not exist in database.
  - `409 Conflict`: Applicant with this email has already applied to this internship.

#### `GET /api/applications`
Returns a list of submitted applications (supports `?internship_id=INT-101` query filter).

---

### Health Check

#### `GET /api/health`
- **Response**: `200 OK`
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "uptime": 45,
    "timestamp": "2026-11-20T00:38:00.000Z"
  }
}
```

---

## 📜 License

MIT License. Free to use and adapt.
