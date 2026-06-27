/**
 * Moteur de règles — pouvoirs CONTINUS (805 / 812.2), couche dérivée :
 * recalculée à chaque lecture, jamais d'événement. Les formes compilées
 * (`StaticAbility`) viennent des données (`effects[].compiled.static`,
 * grammaire `compileStaticEffectText`) ; les faces recto/verso des Héros
 * sont lues selon la face courante de l'instance.
 */
import type { Card, CardEffect, StaticAbility } from "@/types/cards";
import { isHeroCard } from "../../types/cards.ts";
import type { InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import type { RulesCtx } from "./types";
import {
  compileBearerBonusText,
  compileStaticEffectText,
  selfAttackEffects,
} from "./effects/dsl.ts";

/**
 * Pouvoirs continus d'une carte (face courante pour un Héros) : forme
 * compilée des données si présente, sinon re-parsing strict du texte (repli
 * runtime, comme les autres lecteurs du DSL).
 */
export function staticAbilitiesOf(
  card: Card | null,
  side: "recto" | "verso" = "recto",
): StaticAbility[] {
  if (!card) return [];
  const face = isHeroCard(card)
    ? side === "verso"
      ? (card.verso ?? card.recto)
      : card.recto
    : null;
  const effects: CardEffect[] = (face ? face.effects : card.effects) ?? [];
  const out: StaticAbility[] = [];
  for (const e of effects) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? // Repli runtime : pouvoir continu « Tant que … » OU bonus de Porteur
          // « Le Porteur de X gagne … » (305.x) — les deux produisent un
          // `trigger:"static"` lu identiquement ci-dessous.
          (compileStaticEffectText(text, card.name) ??
          compileBearerBonusText(text, card.name))
        : null);
    if (compiled?.trigger === "static" && compiled.static)
      out.push(compiled.static);
  }
  return out;
}

function sideOf(ctx: RulesCtx, id: InstanceId): "recto" | "verso" {
  return ctx.state.instances[id]?.face === "verso" ? "verso" : "recto";
}

/**
 * Pouvoirs de PORTEUR (305.x) effectifs sur un Porteur en jeu : les
 * `StaticAbility` de kind `bearerBonus` portées par les cartes ATTACHÉES
 * (`bearer.attachments` — Équipements / Montures), tant qu'elles sont en jeu.
 * Le bonus appartient au PORTEUR (la carte portée ne combat pas) : c'est la
 * lecture correcte depuis l'arrivée du modèle d'attachement (lot F). Seules les
 * cartes co-localisées en Monde/Havre-Sac comptent (un équipement renvoyé en
 * main n'est plus porté). Lu par `effectiveForce` (Force) et `combatKeywords`
 * (Résistance).
 */
export function bearerBonuses(
  ctx: RulesCtx,
  bearerId: InstanceId,
): Extract<StaticAbility, { kind: "bearerBonus" }>[] {
  const bearer = ctx.state.instances[bearerId];
  if (!bearer?.attachments?.length) return [];
  const out: Extract<StaticAbility, { kind: "bearerBonus" }>[] = [];
  for (const equipId of bearer.attachments) {
    const equip = ctx.state.instances[equipId];
    if (!equip) continue;
    const zone = equip.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    const card = ctx.getCard(equip.cardId);
    for (const s of staticAbilitiesOf(card, sideOf(ctx, equipId))) {
      if (s.kind === "bearerBonus") out.push(s);
    }
  }
  return out;
}

/** « [X] ne peut pas bloquer. » (Jicé Aouaire) — lu par `eligibleBlockers`.
 *  `cannotAttackOrBlock` (Épouvantail, Allies Élémentaires) couvre aussi le
 *  blocage : il est inclus ici pour que la lecture « peut-il bloquer ? » reste
 *  exhaustive. */
export function cannotBlock(ctx: RulesCtx, id: InstanceId): boolean {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  return staticAbilitiesOf(card, sideOf(ctx, id)).some(
    (s) => s.kind === "cannotBlock" || s.kind === "cannotAttackOrBlock",
  );
}

/** « [X] ne peut ni attaquer, ni bloquer. » (Épouvantail, Aero/Akwa/Pyro/Terra)
 *  — lu par `eligibleAttackers` (le volet blocage est couvert par `cannotBlock`
 *  ci-dessus, qui inclut ce kind). */
export function cannotAttackOrBlock(ctx: RulesCtx, id: InstanceId): boolean {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  return staticAbilitiesOf(card, sideOf(ctx, id)).some(
    (s) => s.kind === "cannotAttackOrBlock",
  );
}

/** « [X] ne peut pas porter d'Équipement. » (Allies Élémentaires) — lu par
 *  l'intention ATTACH (refus comme Porteur). */
export function cannotCarryEquipment(ctx: RulesCtx, id: InstanceId): boolean {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  return staticAbilitiesOf(card, sideOf(ctx, id)).some(
    (s) => s.kind === "cannotCarryEquipment",
  );
}

/**
 * Bonus de PM à VENIR d'une déclaration d'attaquants (ruling Bruss Ouilis) :
 * « le bonus de +1 PM s'applique … avant la vérification de la légalité de
 * la Déclaration des Attaquants ». Somme des `combatModSelf.pm` que les
 * triggers `onSelfAttacks` des candidats poseront s'ils attaquent — lu par
 * le plafond d'attaquants (703) AVANT que les jetons existent.
 */
export function attackPmBonus(
  ctx: RulesCtx,
  attackerIds: InstanceId[],
): number {
  let bonus = 0;
  for (const id of attackerIds) {
    const inst = ctx.state.instances[id];
    const card = inst ? ctx.getCard(inst.cardId) : null;
    if (!card) continue;
    for (const atom of selfAttackEffects(card, sideOf(ctx, id))) {
      for (const op of atom.ops) {
        if (op.op === "combatModSelf") bonus += op.pm ?? 0;
      }
    }
  }
  return bonus;
}

/**
 * Niveau courant du Héros de `seat` (307.4/307.5) : compteur `level` posé
 * par la montée de niveau, sinon la face (verso = Niveau 2), sinon 1.
 */
export function heroLevel(ctx: RulesCtx, seat: Seat): 1 | 2 | 3 {
  const id = ctx.state.seats[seat].heroInstanceId;
  const inst = id ? ctx.state.instances[id] : null;
  if (!inst) return 1;
  if ((inst.counters.level ?? 0) >= 3) return 3;
  if (inst.face === "verso" || inst.counters.level === 2) return 2;
  return 1;
}
