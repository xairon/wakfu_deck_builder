/**
 * Prouve, contre la VRAIE base, que les droits d'administration tiennent.
 *
 * Les tests unitaires moquent Supabase : ils ne prouvent RIEN sur la RLS. Ce
 * script est le seul contrôle qui vaille.
 *
 * Le script lui-même n'écrit jamais rien de durable EXPRÈS : chaque tentative
 * d'écriture DOIT échouer, et les rares écritures censées réussir ne sont pas
 * testées ici (elles le sont par l'usage réel de l'UI). Si une sonde d'auto-
 * promotion réussit malgré tout (la faille qu'elle cherche est réelle), le
 * compte de test, LUI, reste promu en base — le script prévient bruyamment
 * avec le SQL de nettoyage exact, mais ne corrige RIEN automatiquement.
 *
 * Usage :
 *   node scripts/checkAdminRls.mjs
 *   # optionnel, pour couvrir les points 3/4/5 (compte SANS rôle admin) :
 *   TEST_EMAIL=… TEST_PASSWORD=… node scripts/checkAdminRls.mjs
 *
 * Note sur les deux sondes d'auto-promotion (§ « Auto-promotion : les DEUX
 * voies ») : elles ont des conditions CONTRAIRES pour être concluantes. La
 * sonde INSERT a besoin d'un compte SANS ligne `profiles` (sinon 409, conflit
 * de clé primaire) ; la sonde UPDATE a besoin d'un compte AVEC une ligne
 * `profiles` déjà existante (sinon 0 ligne affectée). Un même run peut donc
 * rendre une sonde concluante et l'autre non — chaque ⚠️ INCONCLUANT indique
 * quel type de compte relancer avec.
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
 * `≥ 400` ne suffit PAS pour les deux sondes d'auto-promotion sur
 * `profiles.role` : un statut d'échec peut avoir une cause qui ne prouve
 * RIEN sur le privilège de colonne testé.
 *
 * - "blocked"      : refus du privilège lui-même — 401 (session invalide) ou
 *                     403 (`42501`, permission denied for column). C'est la
 *                     SEULE preuve valable que la colonne n'est pas accordée.
 * - "inconclusive" : échec pour une tout autre raison. Typiquement 409 côté
 *                     INSERT : le compte de test a DÉJÀ une ligne `profiles`
 *                     (cas normal, `setUsername()` en crée une) → Postgres
 *                     rejette sur la contrainte `profiles_pkey` AVANT même
 *                     d'examiner le privilège de colonne `role`. `isBlocked`
 *                     seul classerait ça comme un ✅ sans jamais avoir
 *                     réellement exercé la colonne — la porte pourrait être
 *                     grande ouverte.
 * - "allowed"      : la base a accepté l'écriture (2xx) — la faille est réelle.
 */
function classifyWrite(res) {
  if (res.status === 401 || res.status === 403) return "blocked";
  if (res.status === 409) return "inconclusive";
  if (res.status === 0) return "inconclusive"; // panne réseau, déjà comptée à part
  if (res.status >= 400) return "blocked";
  return "allowed";
}

/**
 * Sonde de self-promotion par UPDATE : elle matche TOUJOURS par clé primaire
 * (`user_id=eq.<self>`), donc pas de conflit d'unicité façon INSERT — mais
 * une ambiguïté SYMÉTRIQUE existe. Si le compte de test n'a PAS encore de
 * ligne `profiles` (n'a jamais appelé `setUsername()`), l'UPDATE ne matche
 * aucune ligne et PostgREST répond 2xx quand même : un « succès » qui ne
 * prouve RIEN sur le privilège, exactement comme le 409 côté INSERT. On
 * demande donc `Prefer: return=representation` pour distinguer « 0 ligne
 * affectée » d'une vraie promotion réussie.
 */
function classifySelfUpdate(res) {
  if (res.status === 401 || res.status === 403) return "blocked";
  if (res.status === 0) return "inconclusive";
  if (res.status >= 400) return "blocked";
  try {
    const rows = JSON.parse(res.text || "[]");
    if (Array.isArray(rows) && rows.length === 0) return "inconclusive";
  } catch {
    // Statut 2xx mais corps non-JSON : impossible de confirmer « 0 ligne » —
    // traiter comme "allowed" (hypothèse la plus prudente en sécurité).
  }
  return "allowed";
}

let inconclusive = 0;

/**
 * Comme `check()`, mais pour une preuve à trois issues : un "inconclusive"
 * n'est ni un ✅ (rien n'est prouvé) ni un ❌ (rien ne prouve une faille non
 * plus) — il est compté à part et fait échouer le run (comme un
 * `networkFailures`), pour forcer l'opérateur à relancer dans des conditions
 * qui prouvent réellement quelque chose.
 */
function checkPrivilege(label, classification, detail, inconclusiveHint) {
  if (classification === "blocked") {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else if (classification === "inconclusive") {
    inconclusive++;
    console.log(
      `  ⚠️  ${label} — INCONCLUANT${detail ? ` (${detail})` : ""} : ${inconclusiveHint}`,
    );
  } else {
    failures++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
  return classification;
}

/**
 * Un échec RÉSEAU n'est pas un verdict de sécurité : si l'URL est fausse ou
 * l'hôte injoignable, il faut le dire clairement et sortir en erreur, JAMAIS
 * laisser croire qu'un contrôle est passé. On distingue donc `status: 0`
 * (contact impossible) d'un vrai code HTTP.
 */
let networkFailures = 0;

async function rest(
  path,
  { method = "GET", token = ANON, body, prefer = "return=minimal" } = {},
) {
  try {
    const res = await fetch(`${URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: prefer,
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
    // `Prefer: return=representation` : nécessaire pour que
    // `classifySelfUpdate` puisse distinguer « 0 ligne affectée » d'une
    // vraie promotion — cf. le commentaire de la fonction.
    const p1 = await rest(`profiles?user_id=eq.${session.userId}`, {
      method: "PATCH",
      token: t,
      prefer: "return=representation",
      body: { role: "admin" },
    });
    const p1Class = checkPrivilege(
      "ne peut PAS se promouvoir par UPDATE",
      classifySelfUpdate(p1),
      `HTTP ${p1.status}`,
      "0 ligne affectée ne prouve rien — relance avec TEST_EMAIL/TEST_PASSWORD " +
        "d'un compte qui a DÉJÀ un profil (connecte-toi une fois dans l'appli " +
        "pour que setUsername() en crée un).",
    );

    const p2 = await rest("profiles", {
      method: "POST",
      token: t,
      body: { user_id: session.userId, username: "probe", role: "admin" },
    });
    const p2Class = checkPrivilege(
      "ne peut PAS se promouvoir par INSERT",
      classifyWrite(p2),
      `HTTP ${p2.status}`,
      "conflit de clé primaire (profil déjà existant), pas une preuve de " +
        "privilège — relance avec TEST_EMAIL/TEST_PASSWORD d'un compte SANS " +
        "ligne `profiles` existante.",
    );

    // ⚠️ Nettoyage — le script n'écrit jamais rien de durable LUI-MÊME, mais
    // si une des deux sondes ci-dessus a réellement réussi (la faille du
    // finding 1 est réelle), le compte de test, LUI, est resté promu
    // 'admin' en base. Le script ne corrige RIEN automatiquement (voir
    // l'en-tête du fichier) : il prévient bruyamment, avec le SQL exact.
    for (const [cls, via] of [
      [p1Class, "UPDATE"],
      [p2Class, "INSERT"],
    ]) {
      if (cls !== "allowed") continue;
      console.error(
        `\n🚨🚨🚨 FAILLE RÉELLE EXPLOITÉE PAR CE SCRIPT (via ${via}) 🚨🚨🚨\n` +
          `   Le compte de test (user_id=${session.userId}${email ? `, ${email}` : ""}) a\n` +
          "   maintenant role='admin' EN BASE. Ce script n'a RIEN nettoyé (il n'écrit\n" +
          "   jamais rien de durable). Repasse-le à 'user' AVANT toute autre chose,\n" +
          "   dans le SQL Editor :\n\n" +
          `     update public.profiles set role = 'user' where user_id = '${session.userId}';\n`,
      );
    }

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

if (inconclusive > 0) {
  console.error(
    `\n⚠️  ${inconclusive} contrôle(s) INCONCLUANT(S) (conflit de clé primaire ou 0\n` +
      "   ligne affectée — pas une preuve de privilège). Relance en suivant le\n" +
      "   conseil affiché à côté de chaque ⚠️ ci-dessus. AUCUNE conclusion de\n" +
      "   sécurité ne peut être tirée de ce run pour ces points précis.",
  );
}

const allGreen = failures === 0 && networkFailures === 0 && inconclusive === 0;
console.log(
  allGreen
    ? "\n✅ Toutes les garanties de sécurité tiennent.\n"
    : `\n❌ ${failures} garantie(s) EN DÉFAUT, ${inconclusive} INCONCLUANTE(S) — ne pas déployer.\n`,
);
process.exit(allGreen ? 0 : 1);
