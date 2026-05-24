import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const bcrypt = require("./node_modules/bcryptjs/index.js");

// pg lives in lib/db's node_modules
const { Pool } = require(
  path.join(__dirname, "../../lib/db/node_modules/pg/lib/index.js")
);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'inputter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const users = [
  { username: "admin",     password: "admin123",    role: "admin" },
  { username: "approver1", password: "approver123", role: "approver" },
  { username: "inputter1", password: "inputter123", role: "inputter" },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING`,
    [u.username, hash, u.role]
  );
  console.log(`Seeded: ${u.username} (${u.role})`);
}

const { rows } = await pool.query("SELECT id, username, role FROM users ORDER BY id");
console.log("\nAll users:");
console.table(rows);
await pool.end();
console.log("\nDone! You can now log in at http://localhost:3000");
