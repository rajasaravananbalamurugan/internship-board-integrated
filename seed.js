const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./src/db');

const defaultSeedData = [
  {
    id: "INT-101",
    title: "Frontend Intern",
    domain: "Full Stack Development",
    mode: "Remote",
    location: "India",
    skills: ["HTML", "CSS", "JavaScript"],
    openings: 3
  },
  {
    id: "INT-102",
    title: "API Engineering Intern",
    domain: "Full Stack Development",
    mode: "Hybrid",
    location: "Pune",
    skills: ["Node.js", "SQL", "Testing"],
    openings: 2
  },
  {
    id: "INT-103",
    title: "UI/UX Intern",
    domain: "UI/UX",
    mode: "Remote",
    location: "India",
    skills: ["Figma", "Research", "Accessibility"],
    openings: 1
  },
  {
    id: "INT-104",
    title: "Data Analyst Intern",
    domain: "Data Analytics",
    mode: "On-site",
    location: "Bengaluru",
    skills: ["Excel", "SQL", "Data visualisation"],
    openings: 2
  },
  {
    id: "INT-105",
    title: "Security Operations Intern",
    domain: "Cyber Security",
    mode: "Remote",
    location: "India",
    skills: ["Linux", "Logs", "Networking"],
    openings: 1
  }
];

function seedDatabase(dbPath) {
  const db = getDatabase(dbPath);

  // Load from internships.json if present, otherwise fallback to defaultSeedData
  let seedItems = defaultSeedData;
  const jsonPath = path.join(__dirname, 'internships.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(parsed.internships) && parsed.internships.length > 0) {
        seedItems = parsed.internships;
      }
    } catch (e) {
      console.warn('Could not read internships.json, falling back to default seed records:', e.message);
    }
  }

  const upsertStmt = db.prepare(`
    INSERT INTO internships (id, title, domain, mode, location, skills, openings, updated_at)
    VALUES (@id, @title, @domain, @mode, @location, @skills, @openings, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      domain = excluded.domain,
      mode = excluded.mode,
      location = excluded.location,
      skills = excluded.skills,
      openings = excluded.openings,
      updated_at = CURRENT_TIMESTAMP
  `);

  const seedTransaction = db.transaction((items) => {
    for (const item of items) {
      upsertStmt.run({
        id: item.id,
        title: item.title,
        domain: item.domain,
        mode: item.mode,
        location: item.location,
        skills: typeof item.skills === 'string' ? item.skills : JSON.stringify(item.skills),
        openings: Number(item.openings) || 1
      });
    }
  });

  seedTransaction(seedItems);

  const count = db.prepare('SELECT COUNT(*) AS total FROM internships').get().total;
  console.log(`✅ Seed complete! Seeded ${seedItems.length} records. Total internships in database: ${count}.`);
  return { seeded: seedItems.length, total: count };
}

if (require.main === module) {
  try {
    seedDatabase();
  } catch (err) {
    console.error('❌ Failed to seed database:', err);
    process.exit(1);
  }
}

module.exports = { seedDatabase, defaultSeedData };
