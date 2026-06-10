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

/**
 * Une phrase → une op sûre, ou null (l'effet entier est alors abandonné).
 * Accepte l'impératif (« piochez ») et, après « vous pouvez », l'infinitif
 * (« piocher »).
 */
function parseSentence(sentence: string): EffectOp | null {
  let m = sentence.match(/^gagne[zr] (\d+) xp$/);
  if (m) return { op: "gainXp", n: toNumber(m[1]) };
  m = sentence.match(/^pioche[zr] (une|deux|trois|\d+) cartes?$/);
  if (m) return { op: "draw", n: toNumber(m[1]) };
  m = sentence.match(
    /^(?:gagne[zr]|votre heros gagne) (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  m = sentence.match(/^inflige[zr] (\d+) dommages? au heros adverse$/);
  if (m) return { op: "damageOppHero", n: toNumber(m[1]) };
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
  const ops: EffectOp[] = [];
  for (const s of sentences) {
    const op = parseSentence(s);
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
export function arrivalEffects(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ?? (text ? compileEffectText(text, card.name) : null);
    if (compiled && compiled.trigger === "onArrive")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}
