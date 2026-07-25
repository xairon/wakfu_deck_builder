/**
 * ORCHESTRATEUR one-shot — met en service la fonctionnalité « errata + règles
 * officielles » de bout en bout, dans le bon ordre, avec vérification.
 *
 *   1. applique la migration 0012 (tables rules + card_errata, RLS)
 *   2. seed des 66 errata depuis public/data/errata.json
 *   3. seed des 532 lignes de règles depuis le HTML brut versionné
 *   4. VÉRIFIE les comptes en base et échoue bruyamment si ça ne colle pas
 *
 * Chaque étape s'arrête au premier échec : on ne seed jamais par-dessus une
 * migration qui n'est pas passée. Tout est idempotent (rejouable sans danger).
 *
 * ⚠️ Depuis la Phase 2, les errata sont édités par les admins : le seed refuse de
 * tourner si `card_errata` n'est pas vide (--force pour passer outre).
 *
 * Le token n'est JAMAIS écrit dans la sortie.
 *
 * Usage :
 *   SUPABASE_MGMT_TOKEN=sbp_… node scripts/setupErrataRules.mjs
 */
import { execFileSync } from "node:child_process";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  console.error(
    "Récupérable sur https://supabase.com/dashboard/account/tokens (« Personal access token »).",
  );
  process.exit(1);
}

const shell = process.platform === "win32";
const forceArgs = process.argv.includes("--force") ? ["--force"] : [];

function step(label, args) {
  console.log(`\n── ${label} ─────────────────────────────────`);
  execFileSync("node", args, { stdio: "inherit", shell });
}

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
    console.error(
      `Vérification impossible (HTTP ${res.status})`,
      await res.text(),
    );
    process.exit(1);
  }
  return res.json();
}

step("1/4 · Migration 0012 (tables + RLS)", [
  "scripts/applyMigration.mjs",
  "supabase/migrations/0012_rules_errata.sql",
]);
step("2/4 · Seed des errata", ["scripts/seedErrata.mjs", ...forceArgs]);
step("3/4 · Seed des règles", ["scripts/seedRules.mjs"]);

console.log("\n── 4/4 · Vérification en base ───────────────");
const [errata] = await runSql(
  "select count(*)::int as n from public.card_errata;",
);
const [rules] = await runSql(
  "select count(*)::int as n from public.rules where kind = 'rule';",
);
const [chapters] = await runSql(
  "select count(*)::int as n from public.rules where kind = 'chapter';",
);
const [sections] = await runSql(
  "select count(*)::int as n from public.rules where kind = 'section';",
);
const [probe] = await runSql(
  "select number from public.rules where number = '418.5b';",
);

console.log(`  card_errata            : ${errata.n} (attendu 66)`);
console.log(`  rules · chapitres      : ${chapters.n} (attendu 8)`);
console.log(`  rules · sections       : ${sections.n} (attendu 79)`);
console.log(`  rules · règles         : ${rules.n} (attendu 445)`);
console.log(
  `  ancre de deep-link     : ${probe ? "418.5b présent" : "418.5b ABSENT"}`,
);

const ok =
  errata.n === 66 &&
  chapters.n === 8 &&
  sections.n === 79 &&
  rules.n === 445 &&
  !!probe;

if (!ok) {
  console.error(
    "\n❌ Les comptes ne correspondent pas — NE PAS supprimer public/data/errata.json.",
  );
  process.exit(1);
}

console.log("\n✅ Tout est en place. Les pages /errata et /regles/officielles");
console.log(
  "   doivent désormais afficher du contenu (recharge avec Ctrl+F5).",
);
console.log(
  "   public/data/errata.json peut maintenant être supprimé dans un commit séparé.",
);
