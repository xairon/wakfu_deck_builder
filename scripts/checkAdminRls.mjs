/**
 * Prouve, contre la VRAIE base, que les droits d'administration tiennent.
 *
 * Les tests unitaires moquent Supabase : ils ne prouvent RIEN sur la RLS. Ce
 * script est le seul contrôle qui vaille.
 *
 * Il n'écrit jamais rien de durable : chaque tentative d'écriture DOIT échouer,
 * et les rares écritures censées réussir ne sont pas testées ici (elles le sont
 * par l'usage réel de l'UI).
 *
 * Usage :
 *   node scripts/checkAdminRls.mjs
 *   # optionnel, pour couvrir les points 3/4/5 (compte SANS rôle admin) :
 *   TEST_EMAIL=… TEST_PASSWORD=… node scripts/checkAdminRls.mjs
 */
import { readFileSync } from "node:fs";

function envFromDotenv(key) {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line
    ? line
        .slice(key.length + 1)
        .replace(/^"|"$/g, "")
        .trim()
    : "";
}

const URL = process.env.VITE_SUPABASE_URL || envFromDotenv("VITE_SUPABASE_URL");
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY || envFromDotenv("VITE_SUPABASE_ANON_KEY");
if (!URL || !ANON) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables.");
  process.exit(1);
}

let failures = 0;
function check(label, ok, detail = "") {
  console.log(
    `${ok ? "  ✅" : "  ❌"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}

/**
 * Une écriture est « bloquée » SI ET SEULEMENT SI la base a répondu et a refusé.
 * `status === 0` signifie qu'on n'a pas pu la joindre : ce n'est PAS une preuve
 * que l'écriture est interdite, et le traiter comme un succès transformerait une
 * panne réseau en faux feu vert de sécurité.
 */
function isBlocked(res) {
  return res.status >= 400;
}

/**
 * Un échec RÉSEAU n'est pas un verdict de sécurité : si l'URL est fausse ou
 * l'hôte injoignable, il faut le dire clairement et sortir en erreur, JAMAIS
 * laisser croire qu'un contrôle est passé. On distingue donc `status: 0`
 * (contact impossible) d'un vrai code HTTP.
 */
let networkFailures = 0;

async function rest(path, { method = "GET", token = ANON, body } = {}) {
  try {
    const res = await fetch(`${URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    networkFailures++;
    return { status: 0, text: `réseau injoignable : ${err?.message ?? err}` };
  }
}

async function signIn(email, password) {
  try {
    const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { token: j.access_token, userId: j.user?.id };
  } catch (err) {
    networkFailures++;
    console.error(`  Connexion impossible (réseau) : ${err?.message ?? err}`);
    return null;
  }
}

console.log("\n── Lecture publique (anon) ──────────────────");
{
  const r1 = await rest("rules_effective?select=number&limit=1");
  check("anon LIT rules_effective", r1.status === 200, `HTTP ${r1.status}`);
  const r2 = await rest("card_errata?select=card_id&limit=1");
  check("anon LIT card_errata", r2.status === 200, `HTTP ${r2.status}`);
  const r3 = await rest("admin_audit?select=id&limit=1");
  // La RLS filtre : 200 avec 0 ligne est acceptable, du contenu ne l'est pas.
  check(
    "anon NE LIT PAS le journal",
    r3.status !== 200 || r3.text.trim() === "[]",
    `HTTP ${r3.status} ${r3.text.slice(0, 60)}`,
  );
}

console.log("\n── Écriture anonyme : tout doit échouer ─────");
{
  const w1 = await rest("rules_overrides", {
    method: "POST",
    body: { number: "__rls_probe__", body: "x" },
  });
  check("anon N'ÉCRIT PAS rules_overrides", isBlocked(w1), `HTTP ${w1.status}`);
  const w2 = await rest("card_errata", {
    method: "POST",
    body: { card_id: "__rls_probe__", summary: "x" },
  });
  check("anon N'ÉCRIT PAS card_errata", isBlocked(w2), `HTTP ${w2.status}`);
  const w3 = await rest("admin_audit", {
    method: "POST",
    body: { action: "create", entity: "errata", entity_key: "x" },
  });
  check("anon N'ÉCRIT PAS le journal", isBlocked(w3), `HTTP ${w3.status}`);
}

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
if (!email || !password) {
  console.log(
    "\n⚠️  TEST_EMAIL / TEST_PASSWORD absents : les points 3 à 5 (compte connecté\n" +
      "   NON admin) n'ont PAS été vérifiés. Fournis un compte de test sans rôle\n" +
      "   pour une preuve complète.",
  );
} else {
  const session = await signIn(email, password);
  if (!session) {
    console.error("\n❌ Connexion du compte de test impossible.");
    failures++;
  } else {
    const t = session.token;
    console.log("\n── Connecté NON admin : écriture interdite ──");
    const w1 = await rest("rules_overrides", {
      method: "POST",
      token: t,
      body: { number: "__rls_probe__", body: "x" },
    });
    check(
      "non-admin N'ÉCRIT PAS rules_overrides",
      isBlocked(w1),
      `HTTP ${w1.status}`,
    );
    const w2 = await rest("card_errata", {
      method: "POST",
      token: t,
      body: { card_id: "__rls_probe__", summary: "x" },
    });
    check(
      "non-admin N'ÉCRIT PAS card_errata",
      isBlocked(w2),
      `HTTP ${w2.status}`,
    );

    console.log("\n── Auto-promotion : les DEUX voies ──────────");
    const p1 = await rest(`profiles?user_id=eq.${session.userId}`, {
      method: "PATCH",
      token: t,
      body: { role: "admin" },
    });
    check(
      "ne peut PAS se promouvoir par UPDATE",
      isBlocked(p1),
      `HTTP ${p1.status}`,
    );
    const p2 = await rest("profiles", {
      method: "POST",
      token: t,
      body: { user_id: session.userId, username: "probe", role: "admin" },
    });
    check(
      "ne peut PAS se promouvoir par INSERT",
      isBlocked(p2),
      `HTTP ${p2.status}`,
    );

    console.log("\n── RPC de rôle : réservée à l'owner ─────────");
    // Passe par `rest()` comme tout le reste : un fetch brut ici échapperait au
    // try/catch et ferait planter le script sur une simple coupure réseau.
    const rpc = await rest("rpc/set_user_role", {
      method: "POST",
      token: t,
      body: { p_user_id: session.userId, p_role: "admin" },
    });
    check(
      "non-owner NE PEUT PAS appeler set_user_role",
      isBlocked(rpc),
      `HTTP ${rpc.status}`,
    );

    // Contrôle final : le rôle n'a pas bougé.
    const after = await rest(
      `profiles?user_id=eq.${session.userId}&select=role`,
      { token: t },
    );
    check(
      "le rôle du compte de test est resté 'user'",
      after.text.includes('"user"') || after.text.trim() === "[]",
      after.text.slice(0, 60),
    );
  }
}

if (networkFailures > 0) {
  console.error(
    `\n⚠️  ${networkFailures} appel(s) n'ont pas pu joindre la base (URL ou réseau).\n` +
      "   AUCUNE conclusion de sécurité ne peut être tirée de ce run.",
  );
}

console.log(
  failures === 0 && networkFailures === 0
    ? "\n✅ Toutes les garanties de sécurité tiennent.\n"
    : `\n❌ ${failures} garantie(s) EN DÉFAUT — ne pas déployer.\n`,
);
process.exit(failures === 0 && networkFailures === 0 ? 0 : 1);
