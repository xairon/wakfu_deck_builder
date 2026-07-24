/**
 * Migration one-shot : public/data/errata.json → table `card_errata`.
 *
 * Passe par la Management API (superuser → contourne la RLS, l'écriture étant
 * réservée au service_role), comme scripts/seedCardsViaManagement.mjs.
 *
 * Idempotent : purge la table puis ré-insère (66 lignes, coût négligeable).
 * Usage : SUPABASE_MGMT_TOKEN=sbp_… PROJECT_REF=… node scripts/seedErrata.mjs
 */
import { readFileSync } from "node:fs";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const qOrNull = (s) =>
  s === undefined || s === null || s === "" ? "NULL" : q(s);

/** "13/10/2009" → "2009-10-13" (date SQL). Retourne NULL si non parsable. */
function toSqlDate(fr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(fr ?? ""));
  return m ? `'${m[3]}-${m[2]}-${m[1]}'` : "NULL";
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
    console.error("SQL error", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

const file = JSON.parse(readFileSync("public/data/errata.json", "utf8"));
const rows = [];
for (const [cardId, list] of Object.entries(file.errata ?? {})) {
  list.forEach((e, i) => {
    if (!e?.summary) {
      console.error(`Errata sans summary pour ${cardId} — abandon.`);
      process.exit(1);
    }
    rows.push(
      `(${q(cardId)}, ${toSqlDate(e.date)}, ${qOrNull(e.source)}, ` +
        `${q(e.summary)}, ${qOrNull(e.before)}, ${qOrNull(e.after)}, ${i})`,
    );
  });
}

if (rows.length === 0) {
  console.error("Aucun errata trouvé — abandon.");
  process.exit(1);
}

await runSql("delete from public.card_errata;");
await runSql(
  "insert into public.card_errata " +
    "(card_id, errata_date, source, summary, before_text, after_text, sort_order) values " +
    rows.join(",\n") +
    ";",
);

const check = await runSql(
  "select count(*)::int as n from public.card_errata;",
);
console.log(
  `Seed terminé : ${rows.length} lignes envoyées, ${JSON.stringify(check)} en base.`,
);
