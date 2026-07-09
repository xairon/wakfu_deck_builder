/**
 * Moteur de règles R1 — Ressources & coûts (4261/4316/4356/4381/4398).
 * Une carte en jeu redressée (Monde ou Havre-Sac, sauf Protecteur) produit en
 * s'inclinant 1 Ressource de son Élément. Coût de lancement = Niveau ; un
 * Allié exige au moins une Ressource de son Élément.
 */
import type { Card } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import type { PlanCost, ResourceProducer, RulesCtx } from "./types";
import {
  canProduceResource,
  elementLabel,
  levelCost,
  normWord,
  requiredElement,
  resourceElement,
} from "./cardAttrs.ts";
import { staticAbilitiesOf } from "./modifiers.ts";
import { isUniqueCard } from "@/utils/cardRules";

/**
 * 2342 — le bonus « Havre-Sac ×2 Ressources » du 2ᵉ joueur à son 1er tour est-il
 * ENCORE disponible ? Vrai SSI : c'est le 1er tour du joueur qui n'a pas commencé
 * (tour 2), son Havre-Sac est en jeu, DRESSÉ, et le jeton d'usage unique
 * `sacBonusUsed` n'a pas été posé (il l'est dès que le Havre-Sac sert à payer —
 * playFromHand / resolveIntent). Sert au comptage des producteurs ET à
 * l'affichage du badge « +1 » (qui doit disparaître une fois le bonus consommé).
 */
export function havreSacBonusAvailable(ctx: RulesCtx, seat: Seat): boolean {
  if (seat === ctx.state.turn.firstPlayer || ctx.state.turn.number !== 2)
    return false;
  const sacId = ctx.state.seats[seat].havreSacInstanceId;
  const sac = sacId ? ctx.state.instances[sacId] : null;
  return (
    !!sac &&
    (sac.location.zone === "monde" || sac.location.zone === "havreSac") &&
    sac.orientation === "upright" &&
    !sac.counters.tokens?.sacBonusUsed
  );
}

/** Cartes inclinables pour produire une Ressource (contrôlées, redressées). */
export function resourceProducers(
  ctx: RulesCtx,
  seat: Seat,
): ResourceProducer[] {
  const out: ResourceProducer[] = [];
  // 2342 : au premier tour du joueur qui n'a PAS commencé, son Havre-Sac se
  // redresse après sa première inclinaison → il vaut DEUX Ressources pour le
  // même coût (une seule inclinaison réelle au paiement). Dispo centralisée.
  const sacBonus = havreSacBonusAvailable(ctx, seat);
  const sacId = ctx.state.seats[seat].havreSacInstanceId;
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== seat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    if (inst.orientation !== "upright") continue;
    const card = ctx.getCard(inst.cardId);
    if (!card || !canProduceResource(card)) continue;
    const producer = {
      instanceId: inst.instanceId,
      // Élément de RESSOURCE (override coloré des Pious pris en compte), distinct
      // de l'Élément de combat (producedElement).
      element: resourceElement(card),
    };
    out.push(producer);
    // Bonus à USAGE UNIQUE : le doublon n'est émis que tant que le bonus est
    // disponible (havreSacBonusAvailable garde déjà « dressé » + jeton d'usage).
    if (sacBonus && inst.instanceId === sacId) out.push({ ...producer });
  }
  return out;
}

/** Classe du Héros de `seat` (heroCard.class), normalisée, ou null. */
function heroClassOf(ctx: RulesCtx, seat: Seat): string | null {
  const id = ctx.state.seats[seat].heroInstanceId;
  const inst = id ? ctx.state.instances[id] : null;
  const card = inst ? ctx.getCard(inst.cardId) : null;
  const klass =
    card && card.mainType === "Héros"
      ? (card as { class?: string }).class
      : null;
  return klass ? normWord(klass) : null;
}

/**
 * Réduction continue de coût (805 / 805.2) applicable au LANCEMENT de `card`
 * par `seat`, fidèle (« le coût de X est réduit de N »). Somme deux couches :
 *
 *  1. selfCostMod : statiques de la carte elle-même conditionnés par la Classe
 *     du Héros (« Si votre Héros est <Classe>, le coût du <self> est réduit de
 *     N. » — les Dopeuls). N'est compté que si le Héros du contrôleur est de la
 *     Classe nommée.
 *  2. costAura : statiques `costAura` portées par les cartes du MÊME contrôleur
 *     présentes en jeu (Monde / Havre-Sac), dont le `scope` correspond à `card`
 *     (Famille via subTypes, mainType, ou trait Unique). « Tant que <self> est
 *     dans le Monde, le coût de vos <scope> est réduit de N. »
 *
 * Le résultat est borné au coût (le coût effectif est ensuite planché à 0 par
 * `planCost`). Pas d'augmentation de coût ici (les formes « le coût des Actions
 * adverses … » / Porteur restent manuelles).
 */
export function costModifier(ctx: RulesCtx, seat: Seat, card: Card): number {
  let reduction = 0;
  // 1. Réduction de SOI gated par la Classe du Héros (Dopeuls).
  for (const s of staticAbilitiesOf(card)) {
    if (s.kind !== "selfCostMod") continue;
    const heroClass = heroClassOf(ctx, seat);
    if (heroClass && heroClass === normWord(s.ifHeroClass)) reduction += s.n;
  }
  // 2. Auras de réduction des sources EN JEU du contrôleur.
  const subTypes = card.subTypes ?? [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== seat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    const srcCard = ctx.getCard(inst.cardId);
    if (!srcCard) continue;
    const side = inst.face === "verso" ? "verso" : "recto";
    for (const s of staticAbilitiesOf(srcCard, side)) {
      if (s.kind !== "costAura") continue;
      const scope = s.scope;
      const matches =
        scope.kind === "unique"
          ? isUniqueCard(card)
          : scope.kind === "type"
            ? card.mainType === scope.mainType
            : // family : « vos Alliés <Famille> » — Allié portant la Famille.
              card.mainType === "Allié" &&
              subTypes.some((st) => normWord(st) === scope.sub);
      if (matches) reduction += s.n;
    }
  }
  return reduction;
}

/**
 * Sélection automatique des producteurs pour payer le coût de lancement de
 * `card`. Satisfait d'abord l'exigence élémentaire (Allié), puis complète en
 * préférant les éléments non requis (préserve les ressources contraintes).
 *
 * Le coût de base (Niveau) est d'abord réduit par les pouvoirs continus de
 * réduction de coût (`costModifier`, 805) et planché à 0.
 *
 * 418.5b — un ALLIÉ dépense TOUJOURS au moins UNE Ressource de son Élément : cette
 * exigence élémentaire ne se réduit pas. Si une réduction de coût ramène son Niveau
 * sous 1, le coût reste planchéré à 1 (payé avec sa Ressource élémentaire). Les
 * autres types (coût Neutre) tombent bien à 0 (gratuits).
 */
export function planCost(ctx: RulesCtx, seat: Seat, card: Card): PlanCost {
  const req = requiredElement(card);
  const reduced = Math.max(0, levelCost(card) - costModifier(ctx, seat, card));
  const cost = req ? Math.max(1, reduced) : reduced;
  if (cost <= 0) return { ok: true, producers: [] };

  const pool = resourceProducers(ctx, seat);
  if (pool.length < cost) {
    return {
      ok: false,
      reason: `Pas assez de Ressources : il faut ${cost} carte(s) redressée(s) à incliner (${pool.length} disponible(s)).`,
    };
  }

  const chosen: InstanceId[] = [];
  const remaining = [...pool];
  if (req) {
    const i = remaining.findIndex((p) => p.element === req);
    if (i === -1) {
      return {
        ok: false,
        reason: `Il faut au moins une Ressource ${elementLabel(req)} pour jouer cet Allié.`,
      };
    }
    chosen.push(remaining[i].instanceId);
    remaining.splice(i, 1);
  }
  // complète avec les éléments non requis d'abord (Neutre puis autres ≠ req)
  remaining.sort((a, b) => {
    const rank = (p: ResourceProducer) =>
      p.element === "neutre" ? 0 : p.element === req ? 2 : 1;
    return rank(a) - rank(b);
  });
  while (chosen.length < cost) {
    const next = remaining.shift();
    if (!next) break;
    chosen.push(next.instanceId);
  }
  return { ok: true, producers: chosen };
}
