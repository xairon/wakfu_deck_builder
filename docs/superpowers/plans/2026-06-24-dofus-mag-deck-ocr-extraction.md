# Dofus Mag — Extraction OCR des decks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraire proprement tous les decks « idées de deck » WAKFU TCG des 73 photos de Dofus Mag et les intégrer à la page `/decks/official` avec tout leur contenu (cartes, lore, manière de jouer, méta).

**Architecture:** Données déclaratives dans `src/data/dofusMagDecks.ts` (type `OfficialDeck` étendu), fusionnées dans `OfficialDecksView`. Extraction par vision (Claude) avec un **invariant de checksum absolu** (somme des quantités = 48, + héros + havre-sac = 50) appliqué à l'extraction ET en test CI. Pilote manuel de 3 decks puis run complet via workflow multi-agents. Rapport de matching des noms via script reproductible.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Vitest, tsx (scripts), Pinia (résolveur `deckStore.findCardByName`).

**Spec:** [docs/superpowers/specs/2026-06-24-dofus-mag-deck-ocr-extraction-design.md](../specs/2026-06-24-dofus-mag-deck-ocr-extraction-design.md)

---

## File Structure

| Fichier                                             | Rôle                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/data/officialDecks.ts` (modifier)              | Étendre `OfficialDeck` + `OfficialDeckCard` avec champs optionnels                   |
| `src/data/dofusMagDecks.ts` (créer)                 | `DOFUS_MAG_DECKS: OfficialDeck[]` — données extraites                                |
| `src/components/deck/DeckMagMeta.vue` (créer)       | Composant présentationnel : rend lore/conseil/méta d'un deck                         |
| `src/views/OfficialDecksView.vue` (modifier)        | Fusionner les decks Dofus Mag + nom/ordre d'extension + `<DeckMagMeta>` dans Détails |
| `scripts/lib/dofusMagMatch.ts` (créer)              | Cœur pur : `norm`, `buildNameIndex`, `classifyDeck` (testable)                       |
| `scripts/dofusMagMatchingReport.ts` (créer)         | Shell I/O : lit `public/data/*.json`, écrit le rapport                               |
| `tests/data/dofusMagDecks.spec.ts` (créer)          | Intégrité + **invariant 48** (gate CI)                                               |
| `tests/components/deck/DeckMagMeta.spec.ts` (créer) | Rendu conditionnel des métadonnées                                                   |
| `tests/scripts/dofusMagMatch.spec.ts` (créer)       | Test du cœur de matching                                                             |
| `docs/dofus-mag-index.md` (créer, extraction)       | Manifeste deck → photos + 2 photos de règles                                         |
| `docs/dofus-mag-matching-report.md` (généré)        | Rapport de résolution des noms                                                       |

---

## Task 1: Modèle de données + invariant 48 (gate)

**Files:**

- Modify: `src/data/officialDecks.ts` (interfaces `OfficialDeck` ~ligne 12, `OfficialDeckCard` ~ligne 6)
- Create: `src/data/dofusMagDecks.ts`
- Test: `tests/data/dofusMagDecks.spec.ts`

- [ ] **Step 1: Écrire le test d'intégrité + invariant (échoue à la compilation)**

Créer `tests/data/dofusMagDecks.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { DOFUS_MAG_DECKS } from "@/data/dofusMagDecks";

describe("DOFUS_MAG_DECKS — intégrité & invariant 48", () => {
  it("a des ids uniques", () => {
    const ids = DOFUS_MAG_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque deck a héros, havre-sac, ≥1 carte et extension dofus-mag", () => {
    for (const d of DOFUS_MAG_DECKS) {
      expect(d.hero, `${d.id}: hero`).toBeTruthy();
      expect(d.havreSac, `${d.id}: havreSac`).toBeTruthy();
      expect(d.cards.length, `${d.id}: cards`).toBeGreaterThan(0);
      expect(d.extension, `${d.id}: extension`).toBe("dofus-mag");
    }
  });

  it("chaque carte a une quantité >= 1", () => {
    for (const d of DOFUS_MAG_DECKS) {
      for (const c of d.cards) {
        expect(c.quantity, `${d.id}/${c.name}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("INVARIANT: somme des quantités === 48 (50 avec héros + havre-sac)", () => {
    for (const d of DOFUS_MAG_DECKS) {
      const total = d.cards.reduce((s, c) => s + c.quantity, 0);
      expect(total, `${d.id}: attendu 48, obtenu ${total}`).toBe(48);
    }
  });
});
```

- [ ] **Step 2: Lancer le test → échec (module introuvable)**

Run: `npx vitest run tests/data/dofusMagDecks.spec.ts`
Expected: FAIL — `Cannot find module '@/data/dofusMagDecks'`.

- [ ] **Step 3: Étendre les interfaces dans `src/data/officialDecks.ts`**

Dans `OfficialDeckCard`, ajouter après `type` :

```ts
  /** Libellé de catégorie imprimé dans le magazine (ex. « Alliés »). */
  section?: string;
```

Dans `OfficialDeck`, ajouter après `cards: OfficialDeckCard[];` :

```ts
  /** Paragraphe d'intro narratif (Dofus Mag). */
  lore?: string;
  /** « Le conseil d'Adamaï » — comment jouer le deck. */
  howToPlay?: string;
  /** Alignement affiché (ex. « Neutre »). */
  alignment?: string;
  /** « Cartes maîtresses » mises en avant. */
  keyCards?: string[];
  /** Carte Protecteur du deck, le cas échéant. */
  protector?: string;
  /** Crédit d'illustration / deck. */
  illustrator?: string;
  /** Numéro du magazine (ex. « Dofus Mag 124 »). */
  magIssue?: string;
  /** Provenance du deck. */
  source?: "dofus-mag";
```

- [ ] **Step 4: Créer `src/data/dofusMagDecks.ts` (tableau vide typé)**

```ts
/**
 * Decks « idées de deck » WAKFU TCG extraits du magazine Dofus Mag.
 * Source de vérité : photos dans `dofus_mag_decks/` (hors git).
 * INVARIANT : chaque deck = exactement 48 cartes (hors héros + havre-sac).
 * Voir le rapport de matching : `docs/dofus-mag-matching-report.md`.
 */
import type { OfficialDeck } from "./officialDecks";

export const DOFUS_MAG_DECKS: OfficialDeck[] = [];
```

- [ ] **Step 5: Lancer le test → succès (vide, vacuité)**

Run: `npx vitest run tests/data/dofusMagDecks.spec.ts`
Expected: PASS (4 tests, le tableau vide passe trivialement — l'invariant deviendra mordant dès l'ajout de decks).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/data/officialDecks.ts src/data/dofusMagDecks.ts tests/data/dofusMagDecks.spec.ts
git commit -m "feat(dofus-mag): modèle de données + invariant 48 (gate CI)"
```

---

## Task 2: Composant présentationnel `DeckMagMeta.vue`

**Files:**

- Create: `src/components/deck/DeckMagMeta.vue`
- Test: `tests/components/deck/DeckMagMeta.spec.ts`

- [ ] **Step 1: Écrire le test de rendu (échoue — composant absent)**

Créer `tests/components/deck/DeckMagMeta.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import type { OfficialDeck } from "@/data/officialDecks";

const base: OfficialDeck = {
  id: "x",
  name: "X",
  description: "",
  extension: "dofus-mag",
  hero: "H",
  havreSac: "HS",
  cards: [],
};

describe("DeckMagMeta", () => {
  it("affiche lore, conseil et cartes maîtresses quand présents", () => {
    const w = mount(DeckMagMeta, {
      props: {
        deck: {
          ...base,
          lore: "Il était une fois les Gelées",
          howToPlay: "Tape fort et vite",
          keyCards: ["Roi Gelax", "Gelaxième Dimension"],
          magIssue: "Dofus Mag 124",
        },
      },
    });
    expect(w.text()).toContain("Il était une fois les Gelées");
    expect(w.text()).toContain("Tape fort et vite");
    expect(w.text()).toContain("Roi Gelax");
    expect(w.text()).toContain("Dofus Mag 124");
  });

  it("ne rend rien pour un deck sans métadonnées (starter)", () => {
    const w = mount(DeckMagMeta, { props: { deck: base } });
    expect(w.text().trim()).toBe("");
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run tests/components/deck/DeckMagMeta.spec.ts`
Expected: FAIL — `Failed to resolve import "@/components/deck/DeckMagMeta.vue"`.

- [ ] **Step 3: Créer `src/components/deck/DeckMagMeta.vue`**

```vue
<template>
  <div v-if="hasMeta" class="space-y-3" data-testid="deck-mag-meta">
    <div v-if="deck.alignment">
      <p class="eyebrow mb-1">Alignement</p>
      <p class="text-sm text-base-content/80">{{ deck.alignment }}</p>
    </div>
    <div v-if="deck.lore">
      <p class="eyebrow mb-1">Présentation</p>
      <p class="text-sm leading-relaxed text-base-content/80">
        {{ deck.lore }}
      </p>
    </div>
    <div v-if="deck.howToPlay">
      <p class="eyebrow mb-1">Comment le jouer</p>
      <p class="text-sm leading-relaxed text-base-content/80">
        {{ deck.howToPlay }}
      </p>
    </div>
    <div v-if="deck.keyCards && deck.keyCards.length">
      <p class="eyebrow mb-1">Cartes maîtresses</p>
      <p class="text-sm text-base-content/80">{{ deck.keyCards.join(", ") }}</p>
    </div>
    <div v-if="deck.protector">
      <p class="eyebrow mb-1">Protecteur</p>
      <p class="text-sm text-base-content/80">{{ deck.protector }}</p>
    </div>
    <p
      v-if="deck.illustrator || deck.magIssue"
      class="font-mono text-[11px] uppercase tracking-wider text-base-content/55"
    >
      <span v-if="deck.magIssue">{{ deck.magIssue }}</span>
      <span v-if="deck.illustrator && deck.magIssue"> · </span>
      <span v-if="deck.illustrator">Illus. {{ deck.illustrator }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { OfficialDeck } from "@/data/officialDecks";

const props = defineProps<{ deck: OfficialDeck }>();

const hasMeta = computed(() =>
  Boolean(
    props.deck.lore ||
      props.deck.howToPlay ||
      props.deck.alignment ||
      (props.deck.keyCards && props.deck.keyCards.length) ||
      props.deck.protector ||
      props.deck.illustrator ||
      props.deck.magIssue,
  ),
);
</script>
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run tests/components/deck/DeckMagMeta.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/deck/DeckMagMeta.vue tests/components/deck/DeckMagMeta.spec.ts
git commit -m "feat(dofus-mag): composant DeckMagMeta (lore + conseil + méta)"
```

---

## Task 3: Câbler le groupe « Dofus Mag » dans `OfficialDecksView`

**Files:**

- Modify: `src/views/OfficialDecksView.vue` (import + computed `officialDecks` ~ligne 337, `extensionOrder` ~ligne 376, `formatExtensionName` ~ligne 490, panneau Détails ~ligne 278-296, bloc `<script setup>` imports ~ligne 318)

> Pas de test unitaire de montage de la vue (dépend de `cardStore`/`deckStore`/router). La vérification se fait en **preview** (Task 5, après ajout de données par le pilote) + e2e existant. Cette tâche est purement du câblage déclaratif.

- [ ] **Step 1: Importer les decks Dofus Mag + le composant**

Dans `src/views/OfficialDecksView.vue`, après l'import de `OFFICIAL_DECKS` (~ligne 318) :

```ts
import { OFFICIAL_DECKS, type OfficialDeck } from "@/data/officialDecks";
import { DOFUS_MAG_DECKS } from "@/data/dofusMagDecks";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
```

- [ ] **Step 2: Fusionner les decks**

Remplacer `const officialDecks = computed(() => OFFICIAL_DECKS);` par :

```ts
const officialDecks = computed(() => [...OFFICIAL_DECKS, ...DOFUS_MAG_DECKS]);
```

- [ ] **Step 3: Ajouter l'extension à l'ordre d'affichage**

Dans `extensionGroups` (~ligne 376), remplacer :

```ts
const extensionOrder = ["incarnam", "bonta-brakmar"];
```

par :

```ts
const extensionOrder = ["incarnam", "bonta-brakmar", "dofus-mag"];
```

- [ ] **Step 4: Ajouter le nom d'affichage de l'extension**

Dans `formatExtensionName` (~ligne 491), ajouter au map `names` :

```ts
    "dofus-mag": "Dofus Mag",
```

- [ ] **Step 5: Rendre `<DeckMagMeta>` dans le panneau Détails**

Dans le bloc `v-if="expandedDeckId === deck.id"` (~ligne 278), juste avant `<p class="eyebrow mb-2">Liste des cartes</p>`, insérer :

```html
<DeckMagMeta :deck="deck" class="mb-4" />
```

- [ ] **Step 6: Type-check + suite de tests**

Run: `npm run type-check && npx vitest run tests/data tests/components`
Expected: aucune erreur de type ; tests verts.

- [ ] **Step 7: Commit**

```bash
git add src/views/OfficialDecksView.vue
git commit -m "feat(dofus-mag): groupe Dofus Mag sur /decks/official + Détails enrichis"
```

---

## Task 4: Rapport de matching des noms (script reproductible)

**Files:**

- Create: `scripts/lib/dofusMagMatch.ts` (cœur pur testable)
- Create: `scripts/dofusMagMatchingReport.ts` (shell I/O)
- Modify: `package.json` (ajouter le script npm)
- Test: `tests/scripts/dofusMagMatch.spec.ts`

- [ ] **Step 1: Écrire le test du cœur de matching (échoue)**

Créer `tests/scripts/dofusMagMatch.spec.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  norm,
  buildNameIndex,
  classifyDeck,
} from "../../scripts/lib/dofusMagMatch";
import type { OfficialDeck } from "@/data/officialDecks";

describe("dofusMagMatch", () => {
  it("norm enlève accents/casse/espaces", () => {
    expect(norm("  Brisé ! ")).toBe("brise !");
    expect(norm("Klore  Ofil")).toBe("klore ofil");
  });

  it("buildNameIndex indexe par nom normalisé", () => {
    const idx = buildNameIndex([
      { name: "Klore Ofil", extension: { name: "Incarnam" } },
      { name: "Smare", extension: { name: "Incarnam" } },
    ]);
    expect(idx.has("klore ofil")).toBe(true);
    expect(idx.get("smare")?.[0].extension.name).toBe("Incarnam");
  });

  it("classifyDeck sépare résolus et non résolus", () => {
    const idx = buildNameIndex([
      { name: "Smare", extension: { name: "Incarnam" } },
    ]);
    const deck = {
      id: "d",
      name: "D",
      description: "",
      extension: "dofus-mag",
      hero: "Smare",
      havreSac: "Inconnu HS",
      cards: [
        { name: "Smare", quantity: 2, type: "card" },
        { name: "Carte Fantôme", quantity: 1, type: "card" },
      ],
    } as OfficialDeck;
    const r = classifyDeck(deck, idx);
    expect(r.resolved).toContain("Smare");
    expect(r.unresolved).toContain("Carte Fantôme");
    expect(r.unresolved).toContain("Inconnu HS");
  });
});
```

- [ ] **Step 2: Lancer → échec (module absent)**

Run: `npx vitest run tests/scripts/dofusMagMatch.spec.ts`
Expected: FAIL — module `../../scripts/lib/dofusMagMatch` introuvable.

- [ ] **Step 3: Implémenter `scripts/lib/dofusMagMatch.ts`**

```ts
import type { OfficialDeck } from "@/data/officialDecks";

export interface IndexedCard {
  name: string;
  extension: { name: string };
}

/** Réplique `normalizeText` du deckStore (accents/casse/espaces). */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameIndex(
  cards: IndexedCard[],
): Map<string, IndexedCard[]> {
  const idx = new Map<string, IndexedCard[]>();
  for (const c of cards) {
    const k = norm(c.name);
    (idx.get(k) ?? idx.set(k, []).get(k)!).push(c);
  }
  return idx;
}

export interface DeckClassification {
  resolved: string[];
  unresolved: string[];
  /** Noms résolus mais présents dans plusieurs extensions (reprints). */
  ambiguous: string[];
}

export function classifyDeck(
  deck: OfficialDeck,
  idx: Map<string, IndexedCard[]>,
): DeckClassification {
  const names = [deck.hero, deck.havreSac, ...deck.cards.map((c) => c.name)];
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const ambiguous: string[] = [];
  for (const name of names) {
    const hits = idx.get(norm(name));
    if (!hits || hits.length === 0) unresolved.push(name);
    else {
      resolved.push(name);
      const exts = new Set(hits.map((h) => h.extension.name));
      if (exts.size > 1) ambiguous.push(name);
    }
  }
  return { resolved, unresolved, ambiguous };
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run tests/scripts/dofusMagMatch.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implémenter le shell I/O `scripts/dofusMagMatchingReport.ts`**

```ts
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { DOFUS_MAG_DECKS } from "../src/data/dofusMagDecks";
import {
  buildNameIndex,
  classifyDeck,
  type IndexedCard,
} from "./lib/dofusMagMatch";

const DATA_DIR = resolve(__dirname, "../public/data");

function loadAllCards(): IndexedCard[] {
  const out: IndexedCard[] = [];
  for (const f of readdirSync(DATA_DIR)) {
    if (!f.endsWith(".json")) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(json)) continue;
    for (const c of json as any[]) {
      if (c && typeof c.name === "string" && c.extension?.name) {
        out.push({ name: c.name, extension: { name: c.extension.name } });
      }
    }
  }
  return out;
}

function main() {
  const idx = buildNameIndex(loadAllCards());
  const lines: string[] = [
    "# Rapport de matching — Decks Dofus Mag",
    "",
    `Généré pour ${DOFUS_MAG_DECKS.length} deck(s).`,
    "",
  ];
  let totalUnresolved = 0;
  for (const d of DOFUS_MAG_DECKS) {
    const r = classifyDeck(d, idx);
    totalUnresolved += r.unresolved.length;
    lines.push(`## ${d.name} (\`${d.id}\`)`);
    lines.push(`- Résolus : ${r.resolved.length}`);
    if (r.unresolved.length)
      lines.push(
        `- **Non résolus (${r.unresolved.length})** : ${r.unresolved.join(", ")}`,
      );
    if (r.ambiguous.length)
      lines.push(`- Ambigus (reprints) : ${r.ambiguous.join(", ")}`);
    lines.push("");
  }
  lines.unshift(`> Total noms non résolus : **${totalUnresolved}**`, "");
  const outPath = resolve(__dirname, "../docs/dofus-mag-matching-report.md");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Rapport écrit : ${outPath} (${totalUnresolved} non résolus)`);
}

main();
```

- [ ] **Step 6: Ajouter le script npm dans `package.json`**

Dans `"scripts"`, après `"validate-data"` :

```json
    "dofus-mag-report": "tsx scripts/dofusMagMatchingReport.ts",
```

- [ ] **Step 7: Lancer le script (tableau vide → rapport quasi vide, mais doit s'exécuter sans erreur)**

Run: `npm run dofus-mag-report`
Expected: `Rapport écrit : …/docs/dofus-mag-matching-report.md (0 non résolus)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/dofusMagMatch.ts scripts/dofusMagMatchingReport.ts tests/scripts/dofusMagMatch.spec.ts package.json docs/dofus-mag-matching-report.md
git commit -m "feat(dofus-mag): rapport de matching des noms (script + cœur testé)"
```

---

## Task 5: PILOTE — index + extraction de 3 decks + checkpoint utilisateur

> Tâche procédurale (vision Claude). Aucun code applicatif ; on **remplit** `DOFUS_MAG_DECKS` et on valide le format avec l'utilisateur avant le run complet.

**Files:**

- Create: `docs/dofus-mag-index.md`
- Modify: `src/data/dofusMagDecks.ts` (ajouter 3 decks)

- [ ] **Step 1: Passe d'indexation**

Lire (Read) chacune des 73 photos de `dofus_mag_decks/`. Produire `docs/dofus-mag-index.md` :

- une table `photo → deck(s) visibles` (un cliché peut couvrir 2 decks partiels) ;
- la liste des decks distincts avec **toutes** les photos qui les couvrent ;
- **les 2 photos de RÈGLES MULTI** explicitement marquées `EXCLU (règles)`.

- [ ] **Step 2: Choisir 3 decks à couverture complète**

Sélectionner 3 decks dont les photos couvrent l'intégralité de la fiche (nom, héros, havre-sac, toutes catégories avec totaux, lore, conseil). Privilégier des structures variées (ex. un avec Protecteur/Cartes maîtresses, un avec Conseil d'Adamaï).

- [ ] **Step 3: Extraire + réconcilier les checksums (bloquant)**

Pour chaque deck, lire ensemble toutes ses photos et remplir un objet `OfficialDeck` :

- `id`: `dofus-mag-<slug>` ; `extension: "dofus-mag"` ; `source: "dofus-mag"` ;
- `description`: une phrase courte (archétype) ; `lore`, `howToPlay`, `alignment`, `keyCards`, `protector`, `illustrator`, `magIssue` si présents ;
- `cards[]`: chaque entrée `{ name, quantity, type, section }` (`type` = `"card"` ; `section` = libellé imprimé : « Alliés », « Sorts », « Actions », « Équipements », « Zones », « Protecteur »…).

**Checksum obligatoire avant d'écrire :**

1. par catégorie : somme des quantités d'une catégorie === total imprimé (« Alliés : 25 ») ;
2. global : `somme(toutes quantités) === 48`.
   Si l'un échoue → **relire les photos** pour la carte/quantité manquante. Ne jamais écrire un deck non réconcilié (le marquer `incomplete` dans l'index et passer au suivant si vraiment illisible).

- [ ] **Step 4: Écrire les 3 decks dans `src/data/dofusMagDecks.ts`**

Remplacer `export const DOFUS_MAG_DECKS: OfficialDeck[] = [];` par le tableau peuplé des 3 decks (objets `OfficialDeck` complets).

- [ ] **Step 5: Vérifier l'invariant (gate)**

Run: `npx vitest run tests/data/dofusMagDecks.spec.ts`
Expected: PASS — notamment « somme des quantités === 48 » pour les 3 decks. Si FAIL → corriger l'extraction (Step 3), ne pas relâcher l'invariant.

- [ ] **Step 6: Générer le rapport de matching + corriger les typos OCR**

Run: `npm run dofus-mag-report`
Examiner `docs/dofus-mag-matching-report.md`. Pour chaque non-résolu : relire la photo — si c'est une **typo OCR**, corriger le nom dans `dofusMagDecks.ts` et relancer ; si la carte est **réellement absente** de la base, la laisser verbatim (acceptée, déjà gérée par l'import).

- [ ] **Step 7: Type-check + commit**

```bash
npm run type-check
git add src/data/dofusMagDecks.ts docs/dofus-mag-index.md docs/dofus-mag-matching-report.md
git commit -m "feat(dofus-mag): pilote — 3 decks extraits + index + rapport"
```

- [ ] **Step 8: CHECKPOINT preview + validation utilisateur**

Démarrer le preview, naviguer sur `/decks/official`, déplier les Détails d'un deck Dofus Mag, capturer une preuve (screenshot). Présenter à l'utilisateur les 3 decks (données + rendu + rapport) et **demander la validation du format** avant le run complet. Ajuster le schéma/rendu si demandé.

---

## Task 6: RUN COMPLET — workflow multi-agents sur les decks restants

> Opt-in workflow confirmé par l'utilisateur. Un agent par deck extrait + auto-vérifie le checksum 48 ; l'orchestrateur fusionne et le gate vitest tranche.

**Files:**

- Modify: `src/data/dofusMagDecks.ts` (ajouter tous les decks restants)
- Modify: `docs/dofus-mag-matching-report.md` (régénéré)

- [ ] **Step 1: Finaliser le manifeste deck → photos**

À partir de `docs/dofus-mag-index.md`, dresser la liste des decks restants (hors 3 pilotes, hors 2 photos de règles) avec, pour chacun, les chemins exacts des photos qui le couvrent.

- [ ] **Step 2: Lancer le workflow d'extraction**

Invoquer l'outil `Workflow`. Schéma de sortie par agent = un `OfficialDeck` JSON. Le `meta.phases` = `[{title:"Extraction"}]`. Pipeline sur les decks ; chaque `agent()` reçoit :

- le nom présumé du deck + les **chemins de photos** à lire (rappel : images pivotées ~180°) ;
- la consigne de remplir le schéma `OfficialDeck` complet ;
- la **règle absolue** : réconcilier chaque catégorie à son total imprimé ET la somme globale à **48** ; relire les photos jusqu'à concordance ; si irréconciliable, renvoyer `{ incomplete: true, reason }`.

Schéma `agent({schema})` (JSON Schema) imposant : `id, name, description, extension:"dofus-mag", hero, havreSac, cards[]{name,quantity,type,section}`, optionnels `lore,howToPlay,alignment,keyCards,protector,illustrator,magIssue`, et un `checksum` numérique = somme calculée par l'agent.

- [ ] **Step 3: Fusionner les résultats**

Filtrer les `incomplete` (les lister dans l'index pour traitement manuel ultérieur). Pour les complets, vérifier côté orchestrateur que `sum(cards.quantity) === 48` (double garde) avant insertion. Ajouter tous les decks valides à `DOFUS_MAG_DECKS` dans `src/data/dofusMagDecks.ts` (formatage Prettier).

- [ ] **Step 4: Gate invariant sur l'ensemble**

Run: `npx vitest run tests/data/dofusMagDecks.spec.ts`
Expected: PASS pour **tous** les decks. Tout deck en échec → ré-extraire (relire ses photos) jusqu'à 48. Ne pas désactiver le test.

- [ ] **Step 5: Rapport final + corrections OCR**

Run: `npm run dofus-mag-report`
Parcourir les non-résolus ; corriger les typos OCR (relecture photo) ; laisser verbatim les cartes réellement absentes.

- [ ] **Step 6: Type-check + commit**

```bash
npm run type-check
git add src/data/dofusMagDecks.ts docs/dofus-mag-index.md docs/dofus-mag-matching-report.md
git commit -m "feat(dofus-mag): run complet — tous les decks extraits (invariant 48 vert)"
```

---

## Task 7: Vérification finale + nettoyage + clôture

**Files:**

- Create: `.gitignore` (ajout) — exclure `dofus_mag_decks/`

- [ ] **Step 1: Ignorer les photos sources (volumineuses, hors-asset)**

Ajouter à `.gitignore` :

```
# Photos sources Dofus Mag (matériel d'extraction, ~240 Mo)
dofus_mag_decks/
```

- [ ] **Step 2: Suite complète + type-check + build**

Run: `npm run type-check && npx vitest run && npm run build`
Expected: type-check OK ; tous les tests verts (dont l'invariant 48 sur tous les decks) ; build OK.

- [ ] **Step 3: Preuve visuelle finale (preview)**

Démarrer le preview, aller sur `/decks/official` : vérifier le groupe « Dofus Mag · N decks », le compteur, et qu'un Détails affiche lore + conseil + cartes maîtresses (via `DeckMagMeta`). Capturer un screenshot pour l'utilisateur. Tester un « Importer » sur un deck Dofus Mag (cartes manquantes signalées par toast = attendu).

- [ ] **Step 4: Commit final**

```bash
git add .gitignore
git commit -m "chore(dofus-mag): ignorer les photos sources + vérification finale"
```

- [ ] **Step 5: Clôture de branche**

Invoquer superpowers:finishing-a-development-branch pour décider de l'intégration (merge / PR). Mentionner le nombre de decks extraits et les éventuels decks `incomplete` restants.

---

## Self-Review

- **Couverture du spec :** modèle étendu (T1) ✓ ; capture « tout le visible » via champs optionnels + `DeckMagMeta` (T1/T2) ✓ ; groupe `/decks/official` (T3) ✓ ; invariant 48 / double checksum (T1 test + T5/T6 extraction) ✓ ; exclusion des 2 photos de règles (T5) ✓ ; rapport de matching (T4) ✓ ; pilote puis workflow multi-agents (T5/T6) ✓ ; decks tels quels / historiques mais réconciliés à 48 (T5/T6) ✓ ; photos hors git (T7) ✓ ; tests d'intégrité/rendu/matching (T1/T2/T4) ✓.
- **Placeholders :** aucun TODO/TBD ; tout le code des tâches code est complet.
- **Cohérence des types :** `OfficialDeck`/`OfficialDeckCard` étendus en T1 et réutilisés à l'identique en T2/T4/T5/T6 ; `norm`/`buildNameIndex`/`classifyDeck` définis en T4 et appelés avec les mêmes signatures dans le test et le shell.
- **Note :** la résolution de cartes pour l'import réutilise `deckStore.findCardByName` non pinné (aucune entrée `EXTENSION_NAME_BY_SLUG` pour `dofus-mag`) — comportement voulu, aucun changement requis dans `OfficialDecksView` côté import.
