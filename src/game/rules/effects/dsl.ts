/**
 * Moteur de règles — étape C : DSL d'effets texte, parsing STRICT.
 *
 * Un effet n'est automatisé que si la TOTALITÉ de son texte est comprise :
 * un déclencheur reconnu dont le sujet est la carte elle-même, puis des
 * phrases qui correspondent toutes à une opération sûre. Tout le reste
 * retombe sur le mode manuel (la table n'est jamais bloquée).
 *
 * La compilation est faite HORS-LIGNE par `scripts/compileEffects.ts` qui
 * écrit `effects[].compiled` dans public/data/*.json ; au runtime,
 * `arrivalEffects` lit cette forme compilée et ne re-parse le texte qu'en
 * repli (données non migrées, tests). « Vous pouvez … » donne un effet
 * `optional` que la table fait confirmer au joueur avant exécution.
 */
import type { Card, CompiledEffect, CompiledEffectOp } from "@/types/cards";

export type EffectOp = CompiledEffectOp;

export interface EffectAtom extends CompiledEffect {
  /** Texte d'origine (journal / confirmation). */
  text: string;
}

/** minuscules + accents retirés — la casse/les accents varient dans les données. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const WORD_NUMBERS: Record<string, number> = { une: 1, deux: 2, trois: 3 };
function toNumber(raw: string): number {
  return WORD_NUMBERS[raw] ?? Number.parseInt(raw, 10);
}

const TARGET_WHAT: Record<string, "Allié" | "Zone" | "Équipement"> = {
  "l allie": "Allié",
  "l'allie": "Allié",
  "la zone": "Zone",
  "l equipement": "Équipement",
  "l'equipement": "Équipement",
};

/**
 * Une phrase → une op sûre, ou null (l'effet entier est alors abandonné).
 * Accepte l'impératif (« piochez ») et, après « vous pouvez », l'infinitif
 * (« piocher »). `sourceElement` = Élément de la carte source (410.1), figé
 * dans les ops de dommages pour la Résistance de la cible.
 */
function parseSentence(
  sentence: string,
  sourceElement: string,
): EffectOp | null {
  let m = sentence.match(/^gagne[zr] (\d+) xp$/);
  if (m) return { op: "gainXp", n: toNumber(m[1]) };
  m = sentence.match(/^pioche[zr] (une|deux|trois|\d+) cartes?$/);
  if (m) return { op: "draw", n: toNumber(m[1]) };
  m = sentence.match(
    /^(?:gagne[zr]|votre heros gagne) (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  m = sentence.match(/^votre heros perd (\d+) (?:pv|points? de vie)$/);
  if (m) return { op: "heroLosePv", n: toNumber(m[1]) };
  m = sentence.match(
    /^(?:inflige[zr] (\d+) dommages? au heros adverse|le heros adverse perd (\d+) (?:pv|points? de vie))$/,
  );
  if (m) return { op: "damageOppHero", n: toNumber(m[1] ?? m[2]) };
  m = sentence.match(/^gagne[zr] (\d+) (?:points? de )?resistance$/);
  if (m) return { op: "havreSacGainResistance", n: toNumber(m[1]) };
  m = sentence.match(
    /^detrui(?:sez|re) (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const what = TARGET_WHAT[m[1].replace(/['’]/g, "'").replace(/\s+/g, " ")];
    if (!what) return null;
    const zones: ("monde" | "havreSac")[] = m[3]
      ? ["monde", "havreSac"]
      : ["monde"];
    return { op: "destroyTarget", what, zones };
  }
  m = sentence.match(
    /^inflige[zr] (\d+) dommages? a l['’ ]?\s?allie de votre choix(?: dans le monde)?$/,
  );
  if (m)
    return {
      op: "damageAllyTarget",
      n: toNumber(m[1]),
      element: sourceElement,
    };
  return null;
}

/** Le sujet du déclencheur désigne-t-il la carte elle-même ? */
function subjectIsSelf(subject: string, cardName: string): boolean {
  const s = subject.replace(/^(le |la |les |l['’]\s?|un |une )/, "").trim();
  const n = norm(cardName);
  return n.includes(s) || s.includes(n);
}

/**
 * Compile un texte d'effet en forme machine, ou null si une seule partie
 * n'est pas comprise. Pur — utilisé par le script de compilation hors-ligne
 * et comme repli runtime.
 */
export function compileEffectText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  const m = norm(text).match(
    /^(?:quand|lorsque) (.{1,60}?) apparait\s*,\s*(.+)$/,
  );
  if (!m || !subjectIsSelf(m[1], cardName)) return null;
  let rest = m[2].replace(/\.$/, "").trim();
  let optional = false;
  const opt = rest.match(/^vous pouvez (.+)$/);
  if (opt) {
    optional = true;
    rest = opt[1];
  }
  const sentences = rest
    .split(/\.\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return null;
  // « vous pouvez » ne porte que sur sa phrase : un optionnel multi-phrases
  // est ambigu (le reste serait-il obligatoire ?) → on ne compile pas.
  if (optional && sentences.length > 1) return null;
  const ops: EffectOp[] = [];
  for (const s of sentences) {
    const op = parseSentence(s, sourceElement);
    if (!op) return null;
    ops.push(op);
  }
  return optional
    ? { trigger: "onArrive", optional, ops }
    : { trigger: "onArrive", ops };
}

/**
 * Effets d'apparition automatisables de cette carte : forme compilée des
 * données si présente, sinon re-parsing strict du texte.
 */
/** Élément d'une carte pour les Dommages de ses effets (410.1). */
export function effectSourceElement(card: Card): string {
  return card.stats?.force?.element ?? card.stats?.niveau?.element ?? "Neutre";
}

export function arrivalEffects(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text
        ? compileEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onArrive")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}
