import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: bun run scripts/seed-db.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  // Schema has multiple statements — use unsafe
  const schema = readFileSync("src/db/schema.sql", "utf8");
  console.log("Running schema...");
  await sql.unsafe(schema);
  console.log("Schema applied.");

  // Seed has multiple statements too
  const seed = readFileSync("src/db/seed.sql", "utf8");
  console.log("Running seed...");
  await sql.unsafe(seed);
  console.log("Seed applied.");

  const result = await sql`
    SELECT 'leads' as tbl, count(*)::text as cnt FROM leads
    UNION ALL SELECT 'contacts', count(*)::text FROM contacts
    UNION ALL SELECT 'activities', count(*)::text FROM activities
    UNION ALL SELECT 'calls', count(*)::text FROM calls
    UNION ALL SELECT 'messages', count(*)::text FROM messages
    UNION ALL SELECT 'receptionist_settings', count(*)::text FROM receptionist_settings
  `;
  console.log("\nTable counts:");
  for (const row of result) console.log(`  ${row.tbl}: ${row.cnt}`);
  console.log("\nDone. CRM and Receptionist are ready.");
}

main().catch(console.error);
