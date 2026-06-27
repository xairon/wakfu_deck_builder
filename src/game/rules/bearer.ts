/**
 * Moteur de règles — sous-système ÉQUIPEMENT / PORTEUR (305.x, lot F).
 *
 * Une carte PORTÉE (Équipement ou Monture) confère un POUVOIR DE PORTEUR continu
 * (« Le Porteur de X gagne … ») à la créature à laquelle elle est attachée. Ce
 * module regroupe les prédicats d'ÉLIGIBILITÉ ; la lecture des bonus en jeu
 * (`bearerBonuses`) vit dans `modifiers.ts`, leur application dans `stats.ts`
 * (Force) et `effects/keywords.ts` (Résistance).
 */
import type { Card, StaticAbility } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { RulesCtx } from "./types";
import { normWord } from "./cardAttrs.ts";
import { staticAbilitiesOf } from "./modifiers.ts";

/**
 * Une carte peut-elle être PORTEUR d'un équipement (305.x) ?
 * Seules les créatures en jeu (Allié / Héros) portent de l'équipement. Un
 * MONSTRE ne peut PAS être Porteur (glossaire « Porteur » / « Monstre ») :
 * famille `Monstre` dans les subTypes → inéligible. Les autres types
 * (Équipement, Zone, Salle, Dofus, Havre-Sac) ne sont jamais des Porteurs.
 */
export function canBearEquipment(card: Card | null): boolean {
  if (!card) return false;
  if (card.mainType !== "Allié" && card.mainType !== "Héros") return false;
  if (card.mainType === "Allié") {
    const subs = (card.subTypes ?? []).map(normWord);
    if (subs.includes(normWord("Monstre"))) return false;
  }
  return true;
}

/**
 * Pouvoir de Porteur (`bearerBonus`) déclaré par une carte (Équipement /
 * Monture) — forme compilée des données, sinon repli runtime via le DSL.
 * Présent SSI la carte confère un bonus de Porteur reconnu (Force ou
 * Résistance). Utilisé par la mise-en-jeu pour décider d'ATTACHER (vs. poser en
 * standalone) : un équipement sans bonus reconnu garde le comportement actuel.
 */
export function bearerBonusOf(
  card: Card | null,
): Extract<StaticAbility, { kind: "bearerBonus" }> | null {
  if (!card) return null;
  for (const s of staticAbilitiesOf(card)) {
    if (s.kind === "bearerBonus") return s;
  }
  return null;
}

/** La carte confère-t-elle un bonus de Porteur (→ se joue en l'attachant) ? */
export function grantsBearerBonus(card: Card | null): boolean {
  return bearerBonusOf(card) !== null;
}

/**
 * Cibles éligibles comme Porteur pour un équipement joué par `seat` : les
 * créatures (Allié non-Monstre / Héros) que `seat` CONTRÔLE et qui sont en jeu
 * (Monde / Havre-Sac, hors la carte elle-même). Sert au prompt de ciblage de la
 * mise-en-jeu d'un équipement à bonus de Porteur.
 */
export function eligibleBearers(
  ctx: RulesCtx,
  seat: string,
  equipmentId?: InstanceId,
): InstanceId[] {
  const out: InstanceId[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.instanceId === equipmentId) continue;
    if (inst.controller !== seat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    if (canBearEquipment(ctx.getCard(inst.cardId))) out.push(inst.instanceId);
  }
  return out;
}
