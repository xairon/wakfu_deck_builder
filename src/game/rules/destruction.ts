/**
 * Moteur de règles — destructions D'ÉTAT (1414 / 3019), une passe pure :
 * tout Allié en jeu dont la Force effective est 0 (1414) ou dont les
 * Dommages posés atteignent sa Force effective (3019 — la perte d'une aura
 * rend létal un dommage déjà posé) est détruit. Le store reboucle en point
 * fixe (≤ 32 passes) : une destruction peut en déclencher une autre
 * (cascade d'auras).
 *
 * Même logique que `resolveDestroyTarget` (415.1) : défausse du
 * propriétaire, XP de l'Allié à l'adversaire de son contrôleur — mais les
 * gains d'XP sont GROUPÉS par siège : deux morts simultanées ne doivent pas
 * émettre deux passages de niveau calculés sur le même état.
 */
import type { DraftEvent, InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import type { RulesCtx } from "./types";
import { discard } from "../engine/verbs";
import { xpValue } from "./cardAttrs";
import type { ForceStance } from "./stats";
import { effectiveForce } from "./stats";
import { staticAbilitiesOf } from "./modifiers";
import { grantXpEvents } from "./progress";

export interface StateBasedDestruction {
  events: DraftEvent[];
  log: string[];
  destroyed: InstanceId[];
}

export function stateBasedDestroyEvents(
  ctx: RulesCtx,
  stance?: ForceStance,
): StateBasedDestruction {
  const events: DraftEvent[] = [];
  const log: string[] = [];
  const destroyed: InstanceId[] = [];
  const xpBySeat: Record<Seat, number> = { A: 0, B: 0 };
  for (const inst of Object.values(ctx.state.instances)) {
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    const card = ctx.getCard(inst.cardId);
    if (!card || card.mainType !== "Allié") continue;
    // Donnée scrapée SANS Force (ni imprimée, ni définie par un pouvoir
    // continu) : Force inconnue ≠ Force 0 — jamais détruit d'office.
    const side = inst.face === "verso" ? "verso" : "recto";
    const known =
      card.stats?.force?.value !== undefined ||
      staticAbilitiesOf(card, side).some(
        (s) => s.kind === "forceEqualsHandSize",
      );
    if (!known) continue;
    const force = effectiveForce(ctx, inst.instanceId, stance);
    const damage = inst.counters.damage ?? 0;
    if (force > 0 && damage < force) continue;
    events.push(discard(inst.owner, inst.instanceId, inst.location));
    destroyed.push(inst.instanceId);
    log.push(
      force <= 0
        ? `${card.name} est détruit (Force effective 0, 1414).`
        : `${card.name} est détruit (Dommages ${damage} ≥ Force ${force}, 3019).`,
    );
    xpBySeat[otherSeat(inst.controller)] += xpValue(card);
  }
  for (const seat of ["A", "B"] as const) {
    const grant = grantXpEvents(ctx, seat, xpBySeat[seat]);
    events.push(...grant.events);
    log.push(...grant.log.map((l) => `Le Héros de ${seat} ${l}`));
  }
  return { events, log, destroyed };
}
