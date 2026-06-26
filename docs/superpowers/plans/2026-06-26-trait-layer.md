# Couche traits — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Reconnaître les 60 tokens-traits (« Héros : X » + métier) dans `effects[]`, extraire le métier en champ typé, et reclasser ces effets `coverage:"trait"`.

**Architecture:** Schémas Zod = source de vérité (étendus). `scripts/compileEffects.ts` gagne une passe `promoteTraits` (parallèle à `promoteKeywords`). Données seules.

**Tech Stack:** TypeScript ~5.3, Zod v4, Vitest 3, tsx.

Spec : `docs/superpowers/specs/2026-06-26-trait-layer-design.md`.

---

## Task 1 : Schémas

**Files:** Modify `src/schema/cards.ts`, `src/schema/effects.ts`

- [ ] **Step 1** — Dans `src/schema/cards.ts`, ajouter `metier` à `baseCardSchema` (à côté des autres champs optionnels comme `experience`/`notes`) :

```ts
  metier: z.enum(["Bricoleur", "Forgeron", "Bijoutier", "Armurier"]).optional(),
```

- [ ] **Step 2** — Dans `src/schema/effects.ts`, étendre `effectCoverageSchema` :

```ts
export const effectCoverageSchema = z.enum([
  "auto",
  "manual",
  "uncovered",
  "ruling",
  "keyword",
  "trait",
]);
```

- [ ] **Step 3** — `npm run type-check` → PASS.

- [ ] **Step 4** — Commit :

```bash
git add src/schema/cards.ts src/schema/effects.ts
git commit -m "feat(schema): champ metier + coverage trait

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Passe `promoteTraits` dans le pipeline

**Files:** Modify `scripts/compileEffects.ts`

- [ ] **Step 1** — Ajouter `metier?` à l'interface `RawCard` (repérer l'interface `RawCard`, y ajouter le champ) :

```ts
  metier?: string;
```

- [ ] **Step 2** — Ajouter la fonction `promoteTraits` juste APRÈS la fonction `promoteKeywords` :

```ts
/** Métiers (trait Artisan, glossaire « Métier »). Clé = description normalisée. */
const METIER_TOKENS: Record<string, string> = {
  bricoleur: "Bricoleur",
  forgeron: "Forgeron",
  bijoutier: "Bijoutier",
  armurier: "Armurier",
};

/**
 * Promeut les tokens TRAITS déversés dans `effects[]` (qui ne sont PAS des
 * effets) : le métier (Bricoleur/Forgeron/Bijoutier/Armurier) → champ typé
 * `card.metier` ; la restriction « Héros : X » → reclassée sans champ (X déjà
 * dans subTypes). Dans les deux cas l'effet source est marqué
 * `coverage:"trait"`. L'entrée d'effet reste (indices stables → CARD_SCRIPTS).
 * Doit tourner APRÈS classifyKinds et avant assignCoverageAndMechanics (qui
 * préserve "trait"). Dédup du métier (set-if-absent) → idempotent.
 */
function promoteTraits(card: RawCard): void {
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.kind) continue; // ruling/errata
      const t = normText(e?.description);
      if (!t) continue;
      const metier = METIER_TOKENS[t];
      if (metier) {
        if (!card.metier) card.metier = metier;
        e.coverage = "trait";
        continue;
      }
      if (/^heros\s*:\s*.+$/.test(t)) {
        e.coverage = "trait"; // restriction classe/alignement (déjà en subTypes)
      }
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}
```

- [ ] **Step 3** — Appeler la passe. Après `promoteKeywords(card);` (≈ ligne 352) ajouter :

```ts
promoteTraits(card);
```

- [ ] **Step 4** — Préserver `trait` dans la passe finale. Repérer (≈ ligne 315) :

```ts
      if (e.coverage !== "manual" && e.coverage !== "keyword") {
```

Remplacer par :

```ts
      if (
        e.coverage !== "manual" &&
        e.coverage !== "keyword" &&
        e.coverage !== "trait"
      ) {
```

- [ ] **Step 5** — Régénérer : `npm run compile-effects`. Attendu : exit 0, 11 fichiers ✓.

- [ ] **Step 6** — Vérifier (one-liner) :

```bash
node -e "const fs=require('fs');let trait=0,metier=0;for(const f of fs.readdirSync('public/data')){if(!f.endsWith('.json'))continue;let d;try{d=JSON.parse(fs.readFileSync('public/data/'+f))}catch{continue};if(!Array.isArray(d))continue;for(const c of d){if(c.metier)metier++;for(const e of [...(c.effects||[]),...((c.recto||{}).effects||[]),...((c.verso||{}).effects||[])])if(e.coverage==='trait')trait++;}}console.log('trait effects:',trait,'| cards with metier:',metier)"
```

Attendu : ~60 trait effects, ~25 cartes avec metier.

- [ ] **Step 7** — `npm run type-check` → PASS.

- [ ] **Step 8** — Idempotence : commit (étape 9), puis relancer `npm run compile-effects` et confirmer `git diff --stat public/data` vide.

- [ ] **Step 9** — Commit (script + données régénérées) :

```bash
git add scripts/compileEffects.ts public/data/*.json
git commit -m "feat(data): promotion des tokens traits (metier + restriction) coverage trait

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Tests & rapport

**Files:** Create `tests/data/traits.spec.ts` ; Modify `tests/data/coverage.spec.ts`, `scripts/reportCoverage.ts`

- [ ] **Step 1** — Créer `tests/data/traits.spec.ts` :

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
interface RawCard {
  id?: string;
  metier?: string;
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

const METIERS = new Set(["Bricoleur", "Forgeron", "Bijoutier", "Armurier"]);
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

function effects(c: RawCard): RawEffect[] {
  return [
    ...(c.effects ?? []),
    ...(c.recto?.effects ?? []),
    ...(c.verso?.effects ?? []),
  ];
}

describe("couche traits", () => {
  it("devrait extraire le métier et reclasser son token en coverage=trait", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        const t = norm(e.description ?? "");
        const m = {
          bricoleur: "Bricoleur",
          forgeron: "Forgeron",
          bijoutier: "Bijoutier",
          armurier: "Armurier",
        }[t];
        if (!m) continue;
        if (c.metier !== m)
          bad.push(`${c.id}: metier=${c.metier} attendu ${m}`);
        if (e.coverage !== "trait")
          bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait reclasser « Héros : X » en coverage=trait", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        if (/^heros\s*:\s*.+$/.test(norm(e.description ?? ""))) {
          if (e.coverage !== "trait")
            bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("ne devrait promouvoir que des valeurs de métier valides", () => {
    for (const c of cards) {
      if (c.metier !== undefined) expect(METIERS.has(c.metier)).toBe(true);
    }
  });

  it("ne devrait PAS reclasser un trait noyé dans une phrase", () => {
    for (const c of cards) {
      for (const e of effects(c)) {
        if (e.coverage !== "trait") continue;
        const t = norm(e.description ?? "");
        const isToken =
          ["bricoleur", "forgeron", "bijoutier", "armurier"].includes(t) ||
          /^heros\s*:\s*.+$/.test(t);
        if (!isToken)
          throw new Error(`fausse promotion trait: '${e.description}'`);
      }
    }
  });
});
```

- [ ] **Step 2** — `npx vitest run tests/data/traits.spec.ts` → PASS.

- [ ] **Step 3** — `tests/data/coverage.spec.ts` : ajouter `"trait"` au set `COVERAGE`. Repérer :

```ts
const COVERAGE = new Set(["auto", "manual", "uncovered", "ruling", "keyword"]);
```

Remplacer par :

```ts
const COVERAGE = new Set([
  "auto",
  "manual",
  "uncovered",
  "ruling",
  "keyword",
  "trait",
]);
```

- [ ] **Step 4** — `scripts/reportCoverage.ts` : ajouter `trait: 0,` à l'objet `tally`, et après la ligne `keyword` de l'affichage :

```ts
console.log(`  trait:     ${tally.trait}`);
```

- [ ] **Step 5** — `npx vitest run` (suite complète) → tout vert. `npm run report-coverage` → affiche le bucket `trait`.

- [ ] **Step 6** — Commit :

```bash
git add tests/data/traits.spec.ts tests/data/coverage.spec.ts scripts/reportCoverage.ts
git commit -m "test(data): couche traits (metier + restriction Héros:X) + report

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Vérification finale

- `npm run type-check` PASS · `npx vitest run` tout vert · `npm run compile-effects` idempotent.
- `npm run report-coverage` : `uncovered` ~1658, nouveau bucket `trait` ~60, plus aucun token non-effet résiduel.
