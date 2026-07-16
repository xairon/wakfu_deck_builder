/**
 * Déploiement des Edge Functions Supabase.
 *
 * Pourquoi ce script existe : les fonctions importent le graphe `src/` (moteur de
 * jeu partagé), qui utilise l'alias `@/` et des imports sans extension / vers des
 * `index.ts`. Le bundler Deno de la CLI Supabase ne sait résoudre NI l'alias NI la
 * résolution d'index → `supabase functions deploy` échoue au bundling
 * (« Relative import path "@/schema" not prefixed with / or ./ or ../ »).
 *
 * Solution : on pré-bundle chaque fonction avec esbuild (qui résout `@/` → src/ et
 * les index) en un fichier autonome ne gardant que `jsr:`/`npm:`/`node:` externes
 * (que Deno résout au runtime). On dépose ce bundle à la place de `index.ts` le
 * temps du déploiement, puis on restaure la source d'origine (try/finally).
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deployEdgeFunctions.mjs [--ref <projectRef>] [slug ...]
 *   (par défaut : ref ehqalhzvmgkepgbaxbzu, slugs create_game join_game submit_event)
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
let projectRef = "ehqalhzvmgkepgbaxbzu";
const slugs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--ref") projectRef = argv[++i];
  else slugs.push(argv[i]);
}
if (slugs.length === 0) slugs.push("create_game", "join_game", "submit_event");

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "ERREUR : SUPABASE_ACCESS_TOKEN manquant dans l'environnement.",
  );
  process.exit(1);
}

const bundleFn = (slug) =>
  build({
    entryPoints: [`${root}/supabase/functions/${slug}/index.ts`],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "deno1",
    alias: { "@": `${root}/src` },
    external: ["jsr:*", "npm:*", "node:*", "https://*"],
    write: false,
    logLevel: "warning",
  }).then((r) => r.outputFiles[0].text);

for (const slug of slugs) {
  const indexPath = `${root}/supabase/functions/${slug}/index.ts`;
  const original = readFileSync(indexPath, "utf8");
  let deployed = false;
  try {
    const bundled = await bundleFn(slug);
    if (/(^|\n)\s*import\b[^\n]*["']([./@]|https:)/.test(bundled)) {
      throw new Error(
        `${slug} : le bundle contient encore un import non externe`,
      );
    }
    writeFileSync(indexPath, bundled, "utf8");
    console.log(
      `\n=== Déploiement ${slug} (${(bundled.length / 1024).toFixed(1)} KB) ===`,
    );
    const res = spawnSync(
      "npx",
      [
        "--yes",
        "supabase@latest",
        "functions",
        "deploy",
        slug,
        "--project-ref",
        projectRef,
      ],
      { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
    );
    if (res.status !== 0)
      throw new Error(`${slug} : échec du déploiement (code ${res.status})`);
    deployed = true;
  } finally {
    writeFileSync(indexPath, original, "utf8"); // restaure toujours la source
  }
  console.log(
    deployed
      ? `✔ ${slug} déployé, source restaurée`
      : `✖ ${slug} non déployé, source restaurée`,
  );
}

console.log("\nTerminé.");
