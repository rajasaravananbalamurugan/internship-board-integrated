const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Configure test environment variables
process.env.NODE_ENV = 'test';
const TEST_DB_PATH = path.join(__dirname, 'integration-test.db');
process.env.DB_PATH = TEST_DB_PATH;

const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/db');
const { seedDatabase } = require('../seed');

let server;
let baseUrl;

describe('Internship Board & Applications Integration Tests', () => {
  before(async () => {
    // Clean up any stale test database
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
    }

    // Seed test database
    seedDatabase(TEST_DB_PATH);

    // Boot app on random available port
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
    }
  });

  /* ── 1. Security Headers ────────────────────────────────── */
  describe('Security Protections & Headers', () => {
    test('verifies presence of Helmet security headers (CSP, X-Frame-Options, X-Content-Type-Options)', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);

      // Verify security headers
      assert.ok(res.headers.get('content-security-policy'), 'CSP header should be present');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    });
  });

  /* ── 2. Successful listing & filtering of internships ───── */
  describe('GET /api/internships (Listing & Filtering)', () => {
    test('1. Successful listing of internships with standard envelope and pagination', async () => {
      const res = await fetch(`${baseUrl}/api/internships`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.status, 'success');
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 5);
      assert.deepEqual(body.pagination, {
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1
      });

      // Verify structure of first record
      const first = body.data[0];
      assert.ok(first.id);
      assert.ok(first.title);
      assert.ok(first.domain);
      assert.ok(Array.isArray(first.skills));
    });

    test('filters internships by domain', async () => {
      const res = await fetch(`${baseUrl}/api/internships?domain=Full%20Stack%20Development`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.length, 2);
      assert.ok(body.data.every(item => item.domain === 'Full Stack Development'));
    });

    test('filters internships by mode', async () => {
      const res = await fetch(`${baseUrl}/api/internships?mode=Remote`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.length, 3);
      assert.ok(body.data.every(item => item.mode === 'Remote'));
    });

    test('searches internships across title, location, or skills', async () => {
      const res = await fetch(`${baseUrl}/api/internships?search=Figma`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].id, 'INT-103');
    });
  });

  /* ── 3. Application Workflow & Validation Tests ─────────── */
  describe('POST /api/applications (Submission & Validation Workflow)', () => {
    test('2. Successful application submission (201 Created)', async () => {
      const payload = {
        internship_id: 'INT-101',
        applicant_name: 'Alex Johnson',
        applicant_email: 'alex.johnson@example.com',
        portfolio_url: 'https://github.com/alexjohnson',
        cover_note: 'Excited about frontend performance and responsive web design.'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 201);
      assert.equal(body.status, 'success');
      assert.ok(body.data.id.startsWith('APP-'));
      assert.equal(body.data.internship_id, 'INT-101');
      assert.equal(body.data.applicant_name, 'Alex Johnson');
      assert.equal(body.data.applicant_email, 'alex.johnson@example.com');
      assert.equal(body.data.portfolio_url, 'https://github.com/alexjohnson');
      assert.equal(body.data.cover_note, 'Excited about frontend performance and responsive web design.');
      assert.ok(body.data.created_at);
    });

    test('3. Rejected missing or blank name (400 Bad Request)', async () => {
      const payload = {
        internship_id: 'INT-101',
        applicant_name: '   ', // blank name
        applicant_email: 'valid.name@example.com',
        portfolio_url: 'https://github.com/validname'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.status, 'error');
      assert.equal(body.message, 'Validation failed');
      assert.ok(Array.isArray(body.errors));
      assert.ok(body.errors.some(e => e.field === 'applicant_name'));
    });

    test('4. Rejected invalid email format (400 Bad Request)', async () => {
      const payload = {
        internship_id: 'INT-101',
        applicant_name: 'Sarah Connor',
        applicant_email: 'not-an-email-address',
        portfolio_url: 'https://github.com/sconnor'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.status, 'error');
      assert.equal(body.message, 'Validation failed');
      assert.ok(body.errors.some(e => e.field === 'applicant_email'));
    });

    test('5. Rejected unsafe URL like javascript:alert(1) (400 Bad Request)', async () => {
      const unsafePayloads = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://files.example.com/cv.pdf'
      ];

      for (const unsafeUrl of unsafePayloads) {
        const payload = {
          internship_id: 'INT-102',
          applicant_name: 'Hacker Joe',
          applicant_email: `hacker_${Date.now()}@example.com`,
          portfolio_url: unsafeUrl
        };

        const res = await fetch(`${baseUrl}/api/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await res.json();

        assert.equal(res.status, 400, `Expected 400 for unsafe URL: ${unsafeUrl}`);
        assert.equal(body.status, 'error');
        assert.ok(body.errors.some(e => e.field === 'portfolio_url'));
      }
    });

    test('6. Rejected duplicate application for the same internship + email (409 Conflict)', async () => {
      const payload = {
        internship_id: 'INT-101',
        applicant_name: 'Alex Johnson',
        applicant_email: 'alex.johnson@example.com', // Already applied to INT-101 in Test 2
        portfolio_url: 'https://github.com/alexjohnson'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 409);
      assert.equal(body.status, 'error');
      assert.ok(body.message.includes('already submitted an application'));
    });

    test('Allows same email to apply to a different internship', async () => {
      const payload = {
        internship_id: 'INT-102', // Different internship
        applicant_name: 'Alex Johnson',
        applicant_email: 'alex.johnson@example.com',
        portfolio_url: 'https://github.com/alexjohnson'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 201);
      assert.equal(body.status, 'success');
      assert.equal(body.data.internship_id, 'INT-102');
    });

    test('Rejects application for non-existent internship_id (404 Not Found)', async () => {
      const payload = {
        internship_id: 'INT-999',
        applicant_name: 'John Doe',
        applicant_email: 'johndoe@example.com',
        portfolio_url: 'https://github.com/johndoe'
      };

      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.equal(body.status, 'error');
      assert.ok(body.message.includes('does not exist'));
    });
  });
});
