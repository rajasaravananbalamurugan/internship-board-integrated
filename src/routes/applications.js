const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db');
const { validateApplication } = require('../middleware/validate');
const { applicationLimiter } = require('../middleware/security');

/**
 * Format an application database row for API response.
 */
function formatApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    internship_id: row.internship_id,
    applicant_name: row.applicant_name,
    applicant_email: row.applicant_email,
    portfolio_url: row.portfolio_url,
    cover_note: row.cover_note || '',
    created_at: row.created_at
  };
}

/**
 * Helper to generate unique application ID.
 */
function generateApplicationId(db) {
  const count = db.prepare('SELECT COUNT(*) AS total FROM applications').get().total;
  const timestamp = Date.now().toString(36).toUpperCase();
  return `APP-${count + 1}-${timestamp}`;
}

/**
 * POST /api/applications
 * Submits an application for an internship.
 * Protected with applicationLimiter, strict validation, and conflict checks.
 */
router.post('/', applicationLimiter, validateApplication, (req, res, next) => {
  try {
    const db = getDatabase();
    const { internship_id, applicant_name, applicant_email, portfolio_url, cover_note } = req.body;

    // 1. Verify that the requested internship exists
    const internship = db.prepare('SELECT id, title FROM internships WHERE id = ?').get(internship_id);
    if (!internship) {
      return res.status(404).json({
        status: 'error',
        message: `Internship with ID '${internship_id}' does not exist.`
      });
    }

    // 2. Check for duplicate application at application layer
    const existing = db.prepare(
      'SELECT id FROM applications WHERE internship_id = ? AND applicant_email = ?'
    ).get(internship_id, applicant_email);

    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: `You have already submitted an application for ${internship.title} (${internship_id}) using email '${applicant_email}'.`
      });
    }

    // 3. Generate ID and insert using parameterized query
    const id = generateApplicationId(db);

    const insertStmt = db.prepare(`
      INSERT INTO applications (id, internship_id, applicant_name, applicant_email, portfolio_url, cover_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(id, internship_id, applicant_name, applicant_email, portfolio_url, cover_note || null);

    const created = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);

    return res.status(201).json({
      status: 'success',
      data: formatApplication(created)
    });
  } catch (err) {
    // Handle database constraint race-condition
    if (
      err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      err.message?.includes('UNIQUE constraint failed') ||
      err.message?.includes('uq_internship_applicant')
    ) {
      return res.status(409).json({
        status: 'error',
        message: `You have already submitted an application for this internship with email '${req.body.applicant_email}'.`
      });
    }
    next(err);
  }
});

/**
 * GET /api/applications
 * List applications (optional filter by internship_id).
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const { internship_id } = req.query;

    let rows;
    if (internship_id) {
      rows = db.prepare('SELECT * FROM applications WHERE internship_id = ? ORDER BY created_at DESC').all(internship_id);
    } else {
      rows = db.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();
    }

    res.json({
      status: 'success',
      data: rows.map(formatApplication)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/applications/:id
 * Retrieve a specific application by ID.
 */
router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: `Application with ID '${id}' not found.`
      });
    }

    res.json({
      status: 'success',
      data: formatApplication(row)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
