const ALLOWED_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Basic XSS sanitizer that strips dangerous tags and characters.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '');
}

/**
 * Validates request body for creating or updating an internship.
 */
function validateInternship(isPartial = false) {
  return (req, res, next) => {
    const { id, title, domain, mode, location, skills, openings } = req.body;
    const errors = [];

    if (isPartial && Object.keys(req.body).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields provided for update. Provide at least one field to update.',
        errors: [{ field: 'body', message: 'Request body cannot be empty' }]
      });
    }

    if (id !== undefined) {
      if (typeof id !== 'string' || id.trim().length === 0) {
        errors.push({ field: 'id', message: 'ID must be a non-empty string' });
      } else if (id.length > 50) {
        errors.push({ field: 'id', message: 'ID cannot exceed 50 characters' });
      }
    }

    if (!isPartial || title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        errors.push({ field: 'title', message: 'Title is required and must be a non-empty string' });
      } else if (title.trim().length < 2 || title.trim().length > 120) {
        errors.push({ field: 'title', message: 'Title must be between 2 and 120 characters' });
      } else {
        req.body.title = sanitizeString(title);
      }
    }

    if (!isPartial || domain !== undefined) {
      if (typeof domain !== 'string' || domain.trim().length === 0) {
        errors.push({ field: 'domain', message: 'Domain is required and must be a non-empty string' });
      } else if (domain.trim().length < 2 || domain.trim().length > 80) {
        errors.push({ field: 'domain', message: 'Domain must be between 2 and 80 characters' });
      } else {
        req.body.domain = sanitizeString(domain);
      }
    }

    if (!isPartial || mode !== undefined) {
      if (!mode || typeof mode !== 'string') {
        errors.push({ field: 'mode', message: `Mode is required and must be one of: ${ALLOWED_MODES.join(', ')}` });
      } else {
        const normalizedMode = ALLOWED_MODES.find(m => m.toLowerCase() === mode.trim().toLowerCase());
        if (!normalizedMode) {
          errors.push({
            field: 'mode',
            message: `Mode must be one of: ${ALLOWED_MODES.join(', ')} (received '${mode}')`
          });
        } else {
          req.body.mode = normalizedMode;
        }
      }
    }

    if (!isPartial || location !== undefined) {
      if (typeof location !== 'string' || location.trim().length === 0) {
        errors.push({ field: 'location', message: 'Location is required and must be a non-empty string' });
      } else if (location.trim().length < 2 || location.trim().length > 80) {
        errors.push({ field: 'location', message: 'Location must be between 2 and 80 characters' });
      } else {
        req.body.location = sanitizeString(location);
      }
    }

    if (!isPartial || skills !== undefined) {
      if (!Array.isArray(skills)) {
        errors.push({ field: 'skills', message: 'Skills must be an array of strings' });
      } else if (skills.length === 0) {
        errors.push({ field: 'skills', message: 'Skills array must contain at least one skill' });
      } else {
        const invalidSkills = skills.filter(s => typeof s !== 'string' || s.trim().length === 0);
        if (invalidSkills.length > 0) {
          errors.push({ field: 'skills', message: 'All items in skills array must be non-empty strings' });
        } else {
          req.body.skills = skills.map(s => sanitizeString(s));
        }
      }
    }

    if (!isPartial || openings !== undefined) {
      const parsedOpenings = Number(openings);
      if (openings === undefined && !isPartial) {
        req.body.openings = 1;
      } else if (!Number.isInteger(parsedOpenings) || parsedOpenings < 0) {
        errors.push({ field: 'openings', message: 'Openings must be a non-negative integer (>= 0)' });
      } else {
        req.body.openings = parsedOpenings;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
}

/**
 * Validates request body for creating an application.
 * Enforces strict URL scheme checking, email syntax, name, and sanitized inputs.
 */
function validateApplication(req, res, next) {
  const { internship_id, applicant_name, applicant_email, portfolio_url, cover_note } = req.body;
  const errors = [];

  // internship_id validation
  if (!internship_id || typeof internship_id !== 'string' || internship_id.trim() === '') {
    errors.push({ field: 'internship_id', message: 'internship_id is required' });
  } else {
    req.body.internship_id = internship_id.trim();
  }

  // applicant_name validation
  if (!applicant_name || typeof applicant_name !== 'string' || applicant_name.trim() === '') {
    errors.push({ field: 'applicant_name', message: 'Full name is required' });
  } else if (applicant_name.trim().length < 2 || applicant_name.trim().length > 100) {
    errors.push({ field: 'applicant_name', message: 'Full name must be between 2 and 100 characters' });
  } else {
    req.body.applicant_name = sanitizeString(applicant_name);
  }

  // applicant_email validation
  if (!applicant_email || typeof applicant_email !== 'string' || applicant_email.trim() === '') {
    errors.push({ field: 'applicant_email', message: 'Email address is required' });
  } else {
    const trimmedEmail = applicant_email.trim().toLowerCase();
    if (trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      errors.push({ field: 'applicant_email', message: 'Please provide a valid email address (e.g. user@example.com)' });
    } else {
      req.body.applicant_email = trimmedEmail;
    }
  }

  // portfolio_url validation (strict URL allowlist: http or https only)
  if (!portfolio_url || typeof portfolio_url !== 'string' || portfolio_url.trim() === '') {
    errors.push({ field: 'portfolio_url', message: 'Portfolio or GitHub URL is required' });
  } else {
    const rawUrl = portfolio_url.trim();

    // Explicitly reject dangerous schemes upfront
    const lowerUrl = rawUrl.toLowerCase();
    if (
      lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('file:') ||
      lowerUrl.startsWith('vbscript:')
    ) {
      errors.push({ field: 'portfolio_url', message: 'Invalid URL: Only http:// or https:// URLs are allowed' });
    } else {
      try {
        const parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          errors.push({ field: 'portfolio_url', message: 'URL must use either http:// or https:// protocol' });
        } else if (!parsedUrl.hostname || parsedUrl.hostname.includes(' ') || !parsedUrl.hostname.includes('.')) {
          errors.push({ field: 'portfolio_url', message: 'URL must have a valid domain name' });
        } else {
          req.body.portfolio_url = parsedUrl.href;
        }
      } catch (err) {
        errors.push({ field: 'portfolio_url', message: 'Invalid URL format. Example: https://github.com/username' });
      }
    }
  }

  // cover_note validation (optional)
  if (cover_note !== undefined && cover_note !== null) {
    if (typeof cover_note !== 'string') {
      errors.push({ field: 'cover_note', message: 'Cover note must be text' });
    } else if (cover_note.length > 2000) {
      errors.push({ field: 'cover_note', message: 'Cover note cannot exceed 2000 characters' });
    } else {
      req.body.cover_note = sanitizeString(cover_note);
    }
  } else {
    req.body.cover_note = '';
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors
    });
  }

  next();
}

module.exports = {
  validateInternship,
  validateApplication,
  sanitizeString,
  ALLOWED_MODES
};
