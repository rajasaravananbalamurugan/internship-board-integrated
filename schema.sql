-- schema.sql
-- Database schema for Internship Board and Application Submission Workflow

-- Table: internships
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

-- Table: applications
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

-- Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_internships_domain ON internships(domain);
CREATE INDEX IF NOT EXISTS idx_internships_mode ON internships(mode);
CREATE INDEX IF NOT EXISTS idx_internships_location ON internships(location);
CREATE INDEX IF NOT EXISTS idx_internships_created_at ON internships(created_at);

CREATE INDEX IF NOT EXISTS idx_applications_internship_id ON applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(applicant_email);
