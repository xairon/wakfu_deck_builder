/**
 * Seed de la table `rules` depuis le HTML brut versionné.
 * Passe par la Management API (superuser → contourne la RLS).
 * Idempotent : purge puis ré-insère.
 * Usage : SUPABASE_MGMT_TOKEN=sbp_… PROJECT_REF=… node scripts/seedRules.mjs
 */
import { execFileSync } from "node:child_process";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}

// Réutilise le parser (source unique) via tsx.
const json = execFileSync("npx", ["tsx", "scripts/scrapeRules.ts"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  shell: process.platform === "win32", // npx.cmd resolution on Windows
});
const rows = JSON.parse(json);

const chapters = rows.filter((r) => r.kind === "chapter").length;
const sections = rows.filter((r) => r.kind === "section").length;
// Le compte de RÈGLES est vérifié séparément : l'extraction des chapitres/sections
// (sur le texte des titres) est structurellement INDÉPENDANTE de celle des règles
// (sur les div.regle-target[id]). Sans ce 3e garde-fou, un renommage de la classe
// côté site donnerait rules=0 tout en passant chapitres=8 / sections=79.
const ruleCount = rows.filter((r) => r.kind === "rule").length;
if (chapters !== 8 || sections < 70 || ruleCount < 400) {
  console.error(
    `Parsing suspect (chapitres=${chapters}, sections=${sections}, regles=${ruleCount}) — seed annulé.`,
  );
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const qOrNull = (s) => (s === undefined || s === null ? "NULL" : q(s));

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) {
    console.error("SQL error", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

const values = rows
  .map(
    (r) =>
      `(${q(r.number)}, ${q(r.kind)}, ${r.chapter}, ${qOrNull(r.title)}, ` +
      `${qOrNull(r.body)}, ${r.sort_order})`,
  )
  .join(",\n");

await runSql("delete from public.rules;");
await runSql(
  "insert into public.rules (number, kind, chapter, title, body, sort_order) values " +
    values +
    ";",
);
const check = await runSql("select count(*)::int as n from public.rules;");
console.log(
  `Seed terminé : ${rows.length} lignes envoyées, ${JSON.stringify(check)} en base.`,
);
