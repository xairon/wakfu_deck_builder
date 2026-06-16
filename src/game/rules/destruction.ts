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
import { discard, move } from "../engine/verbs";
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

/**
 * 410.7 — Havre-Sac à 0 Point de Résistance : il est banni (Exil), ses Salles
 * sont détruites et le Héros (qui réside dans la zone havreSac) est expulsé au
 * Monde en conservant ses compteurs (échange Monde↔Havre-Sac, 501.5).
 */
export function havreSacBanishEvents(ctx: RulesCtx): StateBasedDestruction {
  const events: DraftEvent[] = [];
  const log: string[] = [];
  const destroyed: InstanceId[] = [];
  for (const seat of ["A", "B"] as const) {
    const sacId = ctx.state.seats[seat].havreSacInstanceId;
    const sac = sacId ? ctx.state.instances[sacId] : null;
    if (!sac || sac.location.zone === "exil") continue;
    const res = sac.counters.resistance;
    if (res === undefined || res > 0) continue;
    // Intérieur du Havre-Sac (zone havreSac) : Héros expulsé, Salles détruites.
    for (const inst of Object.values(ctx.state.instances)) {
      if (inst.controller !== seat || inst.location.zone !== "havreSac")
        continue;
      const card = ctx.getCard(inst.cardId);
      if (card?.mainType === "Héros") {
        events.push(
          move(seat, {
            instanceId: inst.instanceId,
            from: inst.location,
            to: { zone: "monde" },
            position: { at: "any" },
            visibility: { faceDown: false, visibleTo: "all" },
            preservesIdentity: true, // 501.5 : conserve PV/XP/Niveau
            orientationOnArrival: inst.orientation ?? "upright",
          }),
        );
        log.push(`${card.name} est expulsé au Monde (Havre-Sac banni, 410.7).`);
      } else {
        events.push(discard(inst.owner, inst.instanceId, inst.location));
        destroyed.push(inst.instanceId);
        log.push(
          `${card?.name ?? "Une Salle"} est détruite (Havre-Sac banni, 410.7).`,
        );
      }
    }
    // Le Havre-Sac lui-même → Exil (banni).
    events.push(
      move(seat, {
        instanceId: sac.instanceId,
        from: sac.location,
        to: { zone: "exil", owner: seat },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
      }),
    );
    destroyed.push(sac.instanceId);
    log.push(`Le Havre-Sac de ${seat} est banni (0 Résistance, 410.7).`);
  }
  return { events, log, destroyed };
}
