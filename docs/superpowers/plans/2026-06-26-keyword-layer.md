# Couche mots-clés — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Reconnaître les ~270 tokens mots-clés déversés dans `effects[]`, les promouvoir en `keywords[]` structurés (valeur + définition glossaire) et les reclasser `coverage:"keyword"`.

**Architecture:** Schémas Zod = source de vérité (étendus). `scripts/compileEffects.ts` gagne une passe `promoteKeywords` (généralise `promoteTextKeywords`) lisant `src/data/glossary.ts`. Données seules, pas de wiring moteur.

**Tech Stack:** TypeScript ~5.3, Zod v4, Vitest 3, tsx.

Spec : `docs/superpowers/specs/2026-06-26-keyword-layer-design.md`.

---

## Task 1 : Étendre les schémas (source de vérité)

**Files:** Modify `src/schema/primitives.ts`, `src/schema/effects.ts`

- [ ] **Step 1** — Dans `src/schema/primitives.ts`, remplacer `cardKeywordSchema` :

```ts
export const cardKeywordSchema = z.enum([
  "Inclinaison",
  "Riposte",
  "Portée",
  "Critique",
  "Parade",
  "Résistance",
  "Recette",
  "Géant",
  "Unique",
  "Agilité",
  "Agressivité",
  "Tacle",
  "Renfort",
  "Défense",
  "Fantôme",
  "Capture",
  "Éthérée",
]);
```

- [ ] **Step 2** — Dans `src/schema/effects.ts`, ajouter `value` à `cardKeywordInfoSchema` :

```ts
export const cardKeywordInfoSchema = z.object({
  name: cardKeywordSchema,
  description: z.string(),
  value: z.number().optional(),
  elements: z.array(cardElementSchema).optional(),
});
```

- [ ] **Step 3** — Dans `src/schema/effects.ts`, étendre `effectCoverageSchema` :

```ts
export const effectCoverageSchema = z.enum([
  "auto",
  "manual",
  "uncovered",
  "ruling",
  "keyword",
]);
```

- [ ] **Step 4** — `npm run type-check` → PASS.

- [ ] **Step 5** — Commit :

```bash
git add src/schema/primitives.ts src/schema/effects.ts
git commit -m "feat(schema): vocabulaire mots-clés étendu + coverage keyword + value

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Passe `promoteKeywords` dans le pipeline

**Files:** Modify `scripts/compileEffects.ts`

- [ ] **Step 1** — Ajouter `value?` à l'interface `RawKeyword` (vers la ligne 82) :

Repérer :

```ts
interface RawKeyword {
  name?: string;
  description?: string;
  elements?: unknown[];
}
```

Remplacer par :

```ts
interface RawKeyword {
  name?: string;
  description?: string;
  value?: number;
  elements?: unknown[];
}
```

- [ ] **Step 2** — Importer le glossaire. Sous l'import `OP_TO_MECHANIC` (vers la ligne 28) :

```ts
import { GLOSSARY } from "../src/data/glossary";
```

- [ ] **Step 3** — Remplacer ENTIÈREMENT la fonction `promoteTextKeywords` (≈ lignes 234-250) par :

```ts
/** Définition officielle d'un terme du glossaire (clé normalisée). */
const GLOSSARY_BY_TERM = new Map(
  GLOSSARY.map((g) => [normText(g.term), g.definition]),
);

/**
 * Tokens mots-clés déversés dans `effects[]` par le scrape. Clé = description
 * normalisée (normText). `valued` : le token porte un nombre (« Capture : N »,
 * « Éthérée N »). `glossaryTerm` : terme à chercher dans GLOSSARY (normalisé) ;
 * absent → pas de définition connue (ex. Éthérée).
 */
const KEYWORD_TOKENS: Record<
  string,
  { name: string; glossaryTerm?: string; valued?: boolean }
> = {
  geant: { name: "Géant", glossaryTerm: "geant" },
  agilite: { name: "Agilité", glossaryTerm: "agilite" },
  agressivite: { name: "Agressivité", glossaryTerm: "agressivite" },
  tacle: { name: "Tacle", glossaryTerm: "tacle" },
  renfort: { name: "Renfort", glossaryTerm: "renfort" },
  defense: { name: "Défense", glossaryTerm: "defense" },
  fantome: { name: "Fantôme", glossaryTerm: "fantome" },
  capture: { name: "Capture", glossaryTerm: "capture", valued: true },
  // Éthérée : absent du glossaire snapshot → pas de définition (à récupérer).
  etheree: { name: "Éthérée", valued: true },
};

/**
 * Promeut les tokens mots-clés (description = un mot-clé seul, ou « Mot : N » /
 * « Mot N » pour les valués) en mots-clés STRUCTURÉS dans `keywords[]`, avec
 * leur valeur éventuelle et leur définition glossaire, et marque l'effet source
 * `coverage:"keyword"`. L'entrée d'effet reste (indices stables → CARD_SCRIPTS).
 * Dédup par nom → idempotent. Doit tourner APRÈS classifyKinds (qui efface
 * coverage) et avant assignCoverageAndMechanics (qui préserve "keyword").
 */
function promoteKeywords(card: RawCard): void {
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.kind) continue; // ruling/errata : pas un token mot-clé
      const t = normText(e?.description);
      if (!t) continue;
      // Match : mot seul, ou « mot : N » / « mot N » pour les valués.
      let token = KEYWORD_TOKENS[t];
      let value: number | undefined;
      if (!token) {
        const m = t.match(/^([a-zéèêàùûôîç]+)\s*:?\s*(\d+)$/);
        if (m && KEYWORD_TOKENS[m[1]]?.valued) {
          token = KEYWORD_TOKENS[m[1]];
          value = Number.parseInt(m[2], 10);
        }
      }
      if (!token) continue;
      card.keywords = card.keywords ?? [];
      if (!card.keywords.some((k) => k?.name === token!.name)) {
        const description = token.glossaryTerm
          ? (GLOSSARY_BY_TERM.get(token.glossaryTerm) ?? "")
          : "";
        const kw: RawKeyword = { name: token.name, description };
        if (value !== undefined) kw.value = value;
        card.keywords.push(kw);
      }
      e.coverage = "keyword";
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}
```

Note : `normText` (déjà défini plus haut dans le fichier) strip accents/casse, donc les clés de `KEYWORD_TOKENS` et `GLOSSARY_BY_TERM` sont sans accents. Le regex matche le mot normalisé (sans accents) — `[a-zéèêàùûôîç]` reste tolérant si normText évolue.

- [ ] **Step 4** — Déplacer l'appel. Dans la boucle principale, retirer `promoteTextKeywords(card);` (≈ ligne 298) et ajouter `promoteKeywords(card);` APRÈS `classifyKinds(card);` :

```ts
classifyKinds(card);
promoteKeywords(card);
```

- [ ] **Step 5** — Préserver `keyword` dans la passe finale. Dans `assignCoverageAndMechanics`, élargir le garde :

Repérer `if (e.coverage !== "manual") {` et remplacer par :

```ts
      if (e.coverage !== "manual" && e.coverage !== "keyword") {
```

- [ ] **Step 6** — Régénérer : `npm run compile-effects`. Attendu : exit 0, 11 fichiers ✓.

- [ ] **Step 7** — Vérifier la promotion (one-liner) :

Run:

```bash
node -e "const c=require('./public/data/bonta-brakmar.json'); const k=c.flatMap(x=>x.effects||[]).filter(e=>e.coverage==='keyword'); console.log('keyword effects:',k.length); const cap=c.find(x=>(x.keywords||[]).some(k=>k.name==='Capture')); console.log('a Capture keyword sample:', cap&&JSON.stringify(cap.keywords.find(k=>k.name==='Capture')))"
```

Attendu : un nombre > 0 et un keyword `{name:"Capture", value:N, description:"..."}`.

- [ ] **Step 8** — Idempotence : relancer `npm run compile-effects` puis `git diff --stat public/data` → APRÈS avoir commité l'étape 6, un second run = diff vide.

- [ ] **Step 9** — `npm run type-check` → PASS.

- [ ] **Step 10** — Commit (script + données régénérées) :

```bash
git add scripts/compileEffects.ts public/data/*.json
git commit -m "feat(data): promotion des tokens mots-clés en keywords[] (coverage keyword)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Tests & rapport

**Files:** Create `tests/data/keywords.spec.ts` ; Modify `tests/data/coverage.spec.ts`, `scripts/reportCoverage.ts`

- [ ] **Step 1** — Créer `tests/data/keywords.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

interface RawEffect {
  description?: string;
  coverage?: string;
}
interface RawKeyword {
  name?: string;
  value?: number;
  description?: string;
}
interface RawCard {
  id?: string;
  keywords?: RawKeyword[];
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[]; keywords?: RawKeyword[] };
  verso?: { effects?: RawEffect[]; keywords?: RawKeyword[] };
}

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

const PROMOTED = new Set([
  "Géant",
  "Agilité",
  "Agressivité",
  "Tacle",
  "Renfort",
  "Défense",
  "Fantôme",
  "Capture",
  "Éthérée",
]);
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
const TOKEN_NAMES: Record<string, string> = {
  geant: "Géant",
  agilite: "Agilité",
  agressivite: "Agressivité",
  tacle: "Tacle",
  renfort: "Renfort",
  defense: "Défense",
  fantome: "Fantôme",
  capture: "Capture",
  etheree: "Éthérée",
};

function effects(c: RawCard): RawEffect[] {
  return [
    ...(c.effects ?? []),
    ...(c.recto?.effects ?? []),
    ...(c.verso?.effects ?? []),
  ];
}

describe("couche mots-clés", () => {
  it("devrait reclasser tout token mot-clé en coverage=keyword + keywords[]", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        const t = norm(e.description ?? "");
        const m = t.match(/^([a-zéèêàùûôîç]+)\s*:?\s*(\d+)$/);
        const headValued = m && ["capture", "etheree"].includes(m[1]);
        const name =
          TOKEN_NAMES[t] ?? (headValued ? TOKEN_NAMES[m![1]] : undefined);
        if (!name) continue;
        if (e.coverage !== "keyword")
          bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
        const has = (c.keywords ?? []).some((k) => k.name === name);
        if (!has) bad.push(`${c.id}: '${name}' absent de keywords[]`);
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait porter une value numérique sur Capture/Éthérée promus", () => {
    const valued = cards.flatMap((c) =>
      (c.keywords ?? []).filter(
        (k) => k.name === "Capture" || k.name === "Éthérée",
      ),
    );
    expect(valued.length).toBeGreaterThan(0);
    for (const k of valued) expect(typeof k.value).toBe("number");
  });

  it("ne devrait PAS promouvoir un mot-clé noyé dans une phrase", () => {
    // un effet phrase contenant 'tacle'/'défense' ne doit pas être coverage=keyword
    const sentences = cards
      .flatMap(effects)
      .filter((e) => (e.description ?? "").split(/\s+/).length > 3);
    for (const e of sentences) {
      if (e.coverage === "keyword")
        throw new Error(`fausse promotion: '${e.description}'`);
    }
  });

  it("devrait promouvoir un volume de tokens cohérent (>200)", () => {
    const n = cards
      .flatMap(effects)
      .filter((e) => e.coverage === "keyword").length;
    expect(n).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2** — Lancer : `npx vitest run tests/data/keywords.spec.ts` → PASS.

- [ ] **Step 3** — Mettre à jour `tests/data/coverage.spec.ts` : repérer le set des valeurs de couverture valides et y ajouter `"keyword"`. Repérer :

```ts
const COVERAGE = new Set(["auto", "manual", "uncovered", "ruling"]);
```

Remplacer par :

```ts
const COVERAGE = new Set(["auto", "manual", "uncovered", "ruling", "keyword"]);
```

- [ ] **Step 4** — Mettre à jour `scripts/reportCoverage.ts` : ajouter `keyword` au tally et à l'affichage. Dans l'objet `tally` initial, ajouter `keyword: 0,`. Dans l'affichage, après la ligne `ruling`, ajouter :

```ts
console.log(`  keyword:   ${tally.keyword}`);
```

(Le `% structuré` reste sur auto+manual / (auto+manual+uncovered) — `keyword` et `ruling` exclus comme non-effets.)

- [ ] **Step 5** — `npx vitest run` (suite complète) → tout vert. `npm run report-coverage` → affiche le bucket `keyword`.

- [ ] **Step 6** — Commit :

```bash
git add tests/data/keywords.spec.ts tests/data/coverage.spec.ts scripts/reportCoverage.ts
git commit -m "test(data): couche mots-clés (reconnaissance, value, anti-fausse-promotion) + report

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Vérification finale

- `npm run type-check` PASS · `npx vitest run` tout vert · `npm run compile-effects` idempotent (diff vide).
- `npm run report-coverage` : `uncovered` baisse (~270), nouveau bucket `keyword` (~270).
