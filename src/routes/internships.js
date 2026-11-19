const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db');
const { validateInternship } = require('../middleware/validate');

/**
 * Format SQLite row into standardized internship JSON object.
 */
function formatInternship(row) {
  if (!row) return null;
  let skills = [];
  try {
    skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
  } catch (e) {
    skills = [];
  }

  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    mode: row.mode,
    location: row.location,
    skills: skills,
    openings: Number(row.openings),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Generates the next sequential ID in the format INT-xxx.
 */
function generateNextId(db) {
  const rows = db.prepare("SELECT id FROM internships WHERE id LIKE 'INT-%'").all();
  let maxNum = 100;
  for (const row of rows) {
    const match = row.id.match(/^INT-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `INT-${maxNum + 1}`;
}

/**
 * GET /api/internships
 * Retrieves paginated, filterable, searchable list of internships.
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      search,
      domain,
      mode,
      location,
      skill,
      page = 1,
      limit = 10,
      sort = 'id',
      order = 'asc'
    } = req.query;

    // Validate and sanitize pagination
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    // Build parameterized WHERE clauses
    const whereClauses = [];
    const params = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      whereClauses.push(
        '(title LIKE ? OR domain LIKE ? OR location LIKE ? OR skills LIKE ?)'
      );
      params.push(term, term, term, term);
    }

    if (domain && typeof domain === 'string' && domain.trim() !== '') {
      whereClauses.push('LOWER(domain) = LOWER(?)');
      params.push(domain.trim());
    }

    if (mode && typeof mode === 'string' && mode.trim() !== '') {
      whereClauses.push('LOWER(mode) = LOWER(?)');
      params.push(mode.trim());
    }

    if (location && typeof location === 'string' && location.trim() !== '') {
      whereClauses.push('LOWER(location) LIKE LOWER(?)');
      params.push(`%${location.trim()}%`);
    }

    if (skill && typeof skill === 'string' && skill.trim() !== '') {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM json_each(internships.skills) WHERE LOWER(value) = LOWER(?))'
      );
      params.push(skill.trim());
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total matching records
    const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM internships ${whereSql}`);
    const { total } = countStmt.get(...params);

    // Validate sort column to avoid SQL injection
    const allowedSortFields = {
      id: 'id',
      title: 'title',
      domain: 'domain',
      mode: 'mode',
      location: 'location',
      openings: 'openings',
      created_at: 'created_at',
      createdAt: 'created_at'
    };
    const sortCol = allowedSortFields[sort] || 'id';
    const sortDir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Fetch paginated records
    const selectSql = `
      SELECT * FROM internships
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `;
    const dataStmt = db.prepare(selectSql);
    const rows = dataStmt.all(...params, parsedLimit, offset);

    res.json({
      status: 'success',
      data: rows.map(formatInternship),
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/internships/meta/filters
 * Returns unique domains, modes, and locations for client filter dropdowns.
 */
router.get('/meta/filters', (req, res, next) => {
  try {
    const db = getDatabase();
    const domains = db.prepare('SELECT DISTINCT domain FROM internships ORDER BY domain ASC').all().map(r => r.domain);
    const modes = db.prepare('SELECT DISTINCT mode FROM internships ORDER BY mode ASC').all().map(r => r.mode);
    const locations = db.prepare('SELECT DISTINCT location FROM internships ORDER BY location ASC').all().map(r => r.location);
    const total = db.prepare('SELECT COUNT(*) AS count FROM internships').get().count;

    res.json({
      status: 'success',
      data: {
        domains,
        modes,
        locations,
        total
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/internships/:id
 * Retrieves a single internship by ID.
 */
router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: `Internship with ID '${id}' not found`
      });
    }

    res.json({
      status: 'success',
      data: formatInternship(row)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/internships
 * Creates a new internship.
 */
router.post('/', validateInternship(false), (req, res, next) => {
  try {
    const db = getDatabase();
    let { id, title, domain, mode, location, skills, openings } = req.body;

    if (id) {
      id = id.trim();
      const existing = db.prepare('SELECT id FROM internships WHERE id = ?').get(id);
      if (existing) {
        return res.status(409).json({
          status: 'error',
          message: `Internship with ID '${id}' already exists`,
          errors: [{ field: 'id', message: `ID '${id}' is already in use` }]
        });
      }
    } else {
      id = generateNextId(db);
    }

    const skillsJson = JSON.stringify(skills.map(s => s.trim()));
    const numOpenings = openings !== undefined ? Number(openings) : 1;

    const insertStmt = db.prepare(`
      INSERT INTO internships (id, title, domain, mode, location, skills, openings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(id, title.trim(), domain.trim(), mode.trim(), location.trim(), skillsJson, numOpenings);

    const created = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);

    res.status(201).json({
      status: 'success',
      data: formatInternship(created)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/internships/:id
 * Full update / replacement of an existing internship.
 */
router.put('/:id', validateInternship(false), (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, domain, mode, location, skills, openings } = req.body;

    const existing = db.prepare('SELECT id FROM internships WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Internship with ID '${id}' not found`
      });
    }

    const skillsJson = JSON.stringify(skills.map(s => s.trim()));
    const numOpenings = openings !== undefined ? Number(openings) : 1;

    const updateStmt = db.prepare(`
      UPDATE internships
      SET title = ?,
          domain = ?,
          mode = ?,
          location = ?,
          skills = ?,
          openings = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(title.trim(), domain.trim(), mode.trim(), location.trim(), skillsJson, numOpenings, id);

    const updated = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);

    res.json({
      status: 'success',
      data: formatInternship(updated)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/internships/:id
 * Partial update of an existing internship.
 */
router.patch('/:id', validateInternship(true), (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, domain, mode, location, skills, openings } = req.body;

    const existing = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Internship with ID '${id}' not found`
      });
    }

    const setClauses = [];
    const params = [];

    if (title !== undefined) {
      setClauses.push('title = ?');
      params.push(title.trim());
    }
    if (domain !== undefined) {
      setClauses.push('domain = ?');
      params.push(domain.trim());
    }
    if (mode !== undefined) {
      setClauses.push('mode = ?');
      params.push(mode.trim());
    }
    if (location !== undefined) {
      setClauses.push('location = ?');
      params.push(location.trim());
    }
    if (skills !== undefined) {
      setClauses.push('skills = ?');
      params.push(JSON.stringify(skills.map(s => s.trim())));
    }
    if (openings !== undefined) {
      setClauses.push('openings = ?');
      params.push(Number(openings));
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const updateSql = `UPDATE internships SET ${setClauses.join(', ')} WHERE id = ?`;
    db.prepare(updateSql).run(...params);

    const updated = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);

    res.json({
      status: 'success',
      data: formatInternship(updated)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/internships/:id
 * Deletes an internship by ID.
 */
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM internships WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Internship with ID '${id}' not found`
      });
    }

    db.prepare('DELETE FROM internships WHERE id = ?').run(id);

    res.json({
      status: 'success',
      data: {
        id,
        deleted: true,
        title: existing.title
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
