// One-time maintenance: remove legacy "scored-but-no-proposal" rows.
//
// Background: before the brainstorm redesign, the evaluator stored a score
// (overall/quadrant) with no one-page proposal. Those rows now show up in
// History with a score but, when opened, kick off a fresh brainstorm — the
// "weird" entries. The going-forward flow always saves a proposal, so a row
// with proposal IS NULL is exactly a legacy row.
//
// Usage (needs DATABASE_URL / POSTGRES_URL in the environment, e.g. after
// `vercel env pull .env.local --environment=production`):
//
//   node --env-file=.env.local scripts/delete-legacy.mjs          # dry run (counts only)
//   node --env-file=.env.local scripts/delete-legacy.mjs --apply  # actually delete
//
// Dry run is the default — nothing is deleted unless you pass --apply.

import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  Object.entries(process.env).find(
    ([k, v]) => /(^|_)(DATABASE|POSTGRES)_URL$/.test(k) && /^postgres(ql)?:\/\//.test(v ?? "")
  )?.[1];

if (!url) {
  console.error("No DATABASE_URL / POSTGRES_URL found in the environment.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
// --all wipes every evaluation + version (full clean slate); default targets
// only legacy "scored-but-no-proposal" rows.
const all = process.argv.includes("--all");
const sql = neon(url);

const rows = all
  ? await sql`select id, created_at, overall, quadrant, left(text, 60) as text from evaluations order by created_at desc`
  : await sql`select id, created_at, overall, quadrant, left(text, 60) as text from evaluations where proposal is null order by created_at desc`;

console.log(`Found ${rows.length} row(s) ${all ? "(ALL evaluations)" : "(proposal IS NULL)"}:`);
for (const r of rows) {
  console.log(`  ${r.created_at}  ${Number(r.overall).toFixed(1)}/5  ${r.quadrant ?? "-"}  ${r.text}`);
}

if (!apply) {
  console.log(`\nDry run — nothing deleted. Re-run with --apply${all ? " --all" : ""} to delete.`);
  process.exit(0);
}

if (rows.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

if (all) {
  await sql`delete from proposal_versions`;
  await sql`delete from evaluations`;
  console.log(`\nDeleted ALL ${rows.length} evaluation row(s) and all versions.`);
} else {
  await sql`delete from proposal_versions where evaluation_id = any(${rows.map((r) => r.id)})`;
  await sql`delete from evaluations where proposal is null`;
  console.log(`\nDeleted ${rows.length} legacy evaluation row(s) and any attached versions.`);
}
