/**
 * Moteur de règles — pouvoirs CONTINUS (805 / 812.2), couche dérivée :
 * recalculée à chaque lecture, jamais d'événement. Les formes compilées
 * (`StaticAbility`) viennent des données (`effects[].compiled.static`,
 * grammaire `compileStaticEffectText`) ; les faces recto/verso des Héros
 * sont lues selon la face courante de l'instance.
 */
import type { Card, CardEffect, StaticAbility } from "@/types/cards";
import { isHeroCard } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import type { RulesCtx } from "./types";
import { compileStaticEffectText } from "./effects/dsl";

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
        ? compileStaticEffectText(text, card.name)
        : null);
    if (compiled?.trigger === "static" && compiled.static)
      out.push(compiled.static);
  }
  return out;
}

function sideOf(ctx: RulesCtx, id: InstanceId): "recto" | "verso" {
  return ctx.state.instances[id]?.face === "verso" ? "verso" : "recto";
}

/** « [X] ne peut pas bloquer. » (Jicé Aouaire) — lu par `eligibleBlockers`. */
export function cannotBlock(ctx: RulesCtx, id: InstanceId): boolean {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  return staticAbilitiesOf(card, sideOf(ctx, id)).some(
    (s) => s.kind === "cannotBlock",
  );
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
