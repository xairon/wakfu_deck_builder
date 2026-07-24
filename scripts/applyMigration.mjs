/**
 * Applique un fichier de migration SQL via la Management API (superuser →
 * contourne la RLS). Évite d'avoir à coller le SQL à la main dans le SQL Editor.
 *
 * Les migrations du projet sont IDEMPOTENTES (create ... if not exists,
 * drop policy if exists) : rejouer est sans danger.
 *
 * Le token n'est JAMAIS écrit dans la sortie.
 *
 * Usage :
 *   SUPABASE_MGMT_TOKEN=sbp_… node scripts/applyMigration.mjs supabase/migrations/0012_rules_errata.sql
 */
import { readFileSync } from "node:fs";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const file = process.argv[2];

if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}
if (!file) {
  console.error("Erreur : chemin du fichier .sql manquant.");
  console.error(
    "Usage : node scripts/applyMigration.mjs supabase/migrations/0012_rules_errata.sql",
  );
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

if (!res.ok) {
  // On imprime le corps de l'erreur (jamais le token).
  console.error(`Échec (HTTP ${res.status}) :`, await res.text());
  process.exit(1);
}

console.log(`Migration appliquée : ${file}`);
