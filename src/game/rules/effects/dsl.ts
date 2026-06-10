/**
 * Moteur de règles — étape C : DSL d'effets texte, parsing STRICT.
 *
 * Un effet n'est automatisé que si la TOTALITÉ de son texte est comprise :
 * un déclencheur reconnu dont le sujet est la carte elle-même, puis des
 * phrases qui correspondent toutes à une opération sûre. Tout le reste
 * retombe sur le mode manuel (la table n'est jamais bloquée).
 *
 * Couverture mesurée sur les données réelles : 152 effets « Quand X
 * apparaît » ; 12 entièrement parsés par cette grammaire (les Dofus
 * « gagnez N XP » surtout — l'XP alimente niveaux et victoire déjà
 * automatisés). Étendre = ajouter une regex d'op + un test.
 */
import type { Card } from "@/types/cards";

export type EffectOp =
  | { op: "gainXp"; n: number }
  | { op: "draw"; n: number }
  | { op: "heroGainPv"; n: number }
  | { op: "damageOppHero"; n: number };

export interface EffectAtom {
  trigger: "onArrive";
  ops: EffectOp[];
  /** Texte d'origine (journal). */
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

/** Une phrase → une op sûre, ou null (l'effet entier est alors abandonné). */
function parseSentence(sentence: string): EffectOp | null {
  let m = sentence.match(/^gagnez (\d+) xp$/);
  if (m) return { op: "gainXp", n: toNumber(m[1]) };
  m = sentence.match(/^piochez (une|deux|trois|\d+) cartes?$/);
  if (m) return { op: "draw", n: toNumber(m[1]) };
  m = sentence.match(
    /^(?:gagnez|votre heros gagne) (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  m = sentence.match(/^infligez (\d+) dommages? au heros adverse$/);
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
 * Effets d'apparition entièrement automatisables de cette carte.
 * Strict : déclencheur « Quand/Lorsque [cette carte] apparaît, … » + toutes
 * les phrases reconnues, sinon rien.
 */
export function arrivalEffects(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    const text = String(e?.description ?? "").trim();
    if (!text) continue;
    const m = norm(text).match(
      /^(?:quand|lorsque) (.{1,60}?) apparait\s*,\s*(.+)$/,
    );
    if (!m || !subjectIsSelf(m[1], card.name)) continue;
    const sentences = m[2]
      .replace(/\.$/, "")
      .split(/\.\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sentences.length) continue;
    const ops: EffectOp[] = [];
    let allParsed = true;
    for (const s of sentences) {
      const op = parseSentence(s);
      if (!op) {
        allParsed = false;
        break;
      }
      ops.push(op);
    }
    if (allParsed) atoms.push({ trigger: "onArrive", ops, text });
  }
  return atoms;
}
