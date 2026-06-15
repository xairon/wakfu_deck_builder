/**
 * Moteur de règles — étape C : mots-clés de combat extraits des DONNÉES.
 *
 * Couverture réelle mesurée sur public/data/*.json (1613 cartes) :
 * - « Résistance [Élément] N » : 185 cartes, structuré dans `keywords[]`
 *   (name: 'Résistance', description: '<N>', elements: ['terre']) — règle
 *   7469 : prévention de N Dommages de cet Élément, par infliction.
 * - « Géant » : 93 cartes, texte d'effet strictement égal à « Géant » —
 *   règle 7258/6135 : l'attaquant répartit sa Force entre ses bloqueurs.
 * Les autres mots-clés du type `CardKeyword` (Riposte, Portée, Critique,
 * Parade) n'existent pas dans les données scrapées — rien à automatiser.
 */
import type { Card } from "@/types/cards";
import { isHeroCard } from "@/types/cards";
import type { InstanceId } from "../../types/events";
import type { RulesCtx } from "../types";
import { normElement } from "../cardAttrs";

export interface CombatKeywords {
  /** Prévention par élément normalisé (minuscules). */
  resistances: Record<string, number>;
  geant: boolean;
}

const NONE: CombatKeywords = { resistances: {}, geant: false };

export function combatKeywords(
  card: Card | null,
  side: "recto" | "verso" = "recto",
): CombatKeywords {
  if (!card) return NONE;
  // Un Équipement ne combat pas lui-même : ses `keywords[]` scrapés sont des
  // morceaux de bonus de panoplie attribués à tort à la carte seule (ex.
  // « Résistance 1 Air » du Scaranneau Blanc). Les bonus au Porteur arrivent
  // avec le modèle Équipement (lot F).
  if (card.mainType === "Équipement") return NONE;
  const face = isHeroCard(card)
    ? side === "verso"
      ? (card.verso ?? card.recto)
      : card.recto
    : null;
  const keywords = face ? face.keywords : card.keywords;
  const effects = face ? face.effects : card.effects;

  const resistances: Record<string, number> = {};
  for (const k of keywords ?? []) {
    if (!k?.name?.toLowerCase().startsWith("résistance")) continue;
    const n = Number.parseInt(String(k.description ?? "").trim(), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    for (const el of k.elements ?? []) {
      const key = normElement(el);
      resistances[key] = (resistances[key] ?? 0) + n;
    }
  }
  // Géant : mot-clé structuré (promu à la compilation) ou texte d'effet strict
  let geant = (keywords ?? []).some((k) => k?.name === "Géant");
  for (const e of effects ?? []) {
    if (String(e?.description ?? "").trim() === "Géant") geant = true;
  }
  return { resistances, geant };
}

/**
 * Mots-clés EFFECTIFS d'une instance en jeu : imprimés (face courante de
 * l'instance) + jetons (`geantMod`/`geantCombatMod` → Géant, `resMod_<el>` →
 * Résistance, posés par les effets — lots C/D). Les bonus conférés par
 * l'équipement arrivent au lot F. C'est la SEULE lecture correcte en
 * contexte de partie — `combatKeywords(card)` seul ignore face et jetons.
 */
export function effectiveKeywords(
  ctx: RulesCtx,
  id: InstanceId,
): CombatKeywords {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  const base = combatKeywords(card, inst?.face === "verso" ? "verso" : "recto");
  const tokens = inst?.counters.tokens ?? {};
  const resistances = { ...base.resistances };
  for (const [name, value] of Object.entries(tokens)) {
    if (!value) continue;
    const m = name.match(/^resMod_(.+)$/);
    if (!m) continue;
    const el = normElement(m[1]);
    resistances[el] = (resistances[el] ?? 0) + value;
  }
  const geant = base.geant || !!tokens.geantMod || !!tokens.geantCombatMod;
  return { resistances, geant };
}

/** Dommages effectifs après Résistance de la cible (par infliction, 7469). */
export function preventDamage(
  target: CombatKeywords,
  amount: number,
  element: string,
): number {
  return Math.max(0, amount - (target.resistances[element] ?? 0));
}
