import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: bun run scripts/seed-db.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

/**
 * Split a multi-statement SQL string into individual statements.
 *
 * Handles:
 *   - E'...' escape strings (including escaped quotes via \' and '')
 *   - Regular '...' string literals (including escaped quotes via '')
 *   - Line comments (--)
 *   - Block comments (/* ... * /)
 *   - Semicolons inside string literals (not treated as statement boundaries)
 */
function splitSQL(raw: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // --- E'...' PostgreSQL escape string ---
    if ((ch === "E" || ch === "e") && i + 1 < raw.length && raw[i + 1] === "'") {
      current += ch + "'";
      i += 2;
      while (i < raw.length) {
        if (raw[i] === "\\" && i + 1 < raw.length) {
          // backslash-escaped character (e.g. \n, \', \\)
          current += raw[i] + raw[i + 1];
          i += 2;
        } else if (raw[i] === "'" && i + 1 < raw.length && raw[i + 1] === "'") {
          // doubled single quote = escaped quote ('')
          current += "''";
          i += 2;
        } else if (raw[i] === "'") {
          // closing quote
          current += "'";
          i++;
          break;
        } else {
          current += raw[i];
          i++;
        }
      }
      continue;
    }

    // --- Regular '...' string literal ---
    if (ch === "'") {
      current += "'";
      i++;
      while (i < raw.length) {
        if (raw[i] === "'" && i + 1 < raw.length && raw[i + 1] === "'") {
          // doubled single quote = escaped quote
          current += "''";
          i += 2;
        } else if (raw[i] === "'") {
          // closing quote
          current += "'";
          i++;
          break;
        } else {
          current += raw[i];
          i++;
        }
      }
      continue;
    }

    // --- Line comment: -- ... \n ---
    if (ch === "-" && i + 1 < raw.length && raw[i + 1] === "-") {
      // skip until end of line
      while (i < raw.length && raw[i] !== "\n") i++;
      continue;
    }

    // --- Block comment: /* ... */ ---
    if (ch === "/" && i + 1 < raw.length && raw[i + 1] === "*") {
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && i + 1 < raw.length && raw[i + 1] === "/")) {
        i++;
      }
      if (i < raw.length) i += 2; // skip past */
      continue;
    }

    // --- Statement separator ---
    if (ch === ";") {
      const stmt = current.trim();
      if (stmt.length > 0) statements.push(stmt);
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Trailing content without a final semicolon
  const stmt = current.trim();
  if (stmt.length > 0) statements.push(stmt);

  return statements;
}

async function main() {
  // ── Schema ──────────────────────────────────────────────────────────
  const schema = readFileSync("src/db/schema.sql", "utf8");
  const schemaStatements = splitSQL(schema);
  console.log(`Splitting schema.sql into ${schemaStatements.length} statements...`);

  console.log("Applying schema (transaction)...");
  await sql.transaction(
    (txn) => schemaStatements.map((stmt) => txn.query(stmt)),
  );
  console.log("Schema applied.");

  // ── Seed ────────────────────────────────────────────────────────────
  const seed = readFileSync("src/db/seed.sql", "utf8");
  const seedStatements = splitSQL(seed);
  console.log(`\nSplitting seed.sql into ${seedStatements.length} statements...`);

  console.log("Applying seed data (transaction)...");
  await sql.transaction(
    (txn) => seedStatements.map((stmt) => txn.query(stmt)),
  );
  console.log("Seed applied.");

  // ── Verify ──────────────────────────────────────────────────────────
  const result = await sql`
    SELECT 'leads' as tbl, count(*)::text as cnt FROM leads
    UNION ALL SELECT 'contacts', count(*)::text FROM contacts
    UNION ALL SELECT 'activities', count(*)::text FROM activities
    UNION ALL SELECT 'calls', count(*)::text FROM calls
    UNION ALL SELECT 'messages', count(*)::text FROM messages
    UNION ALL SELECT 'receptionist_settings', count(*)::text FROM receptionist_settings
    UNION ALL SELECT 'campaigns', count(*)::text FROM campaigns
    UNION ALL SELECT 'campaign_recipients', count(*)::text FROM campaign_recipients
    UNION ALL SELECT 'scraped_leads', count(*)::text FROM scraped_leads
  `;
  console.log("\nTable counts:");
  for (const row of result) console.log(`  ${row.tbl}: ${row.cnt}`);
  console.log("\nDone. CRM, Receptionist, and Marketing tables are ready.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
