/**
 * Moteur de règles R1+C — résolution de combat (702–708) avec mots-clés.
 *
 * Calcule duels et dommages en pur, puis émet la rafale de `DraftEvent`
 * correspondante (le store la dispatch telle quelle). Mots-clés automatisés :
 * Résistance (prévention par élément, 7469) et Géant (répartition de la Force
 * entre les bloqueurs, 6135 — politique auto : tuer le plus de bloqueurs).
 * Simplifications restantes : sans Géant l'attaquant frappe son premier
 * bloqueur, pas de Réactions.
 */
import type { DraftEvent, InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import type { CombatPlan, CombatResult, RulesCtx } from "./types";
import { discard, incCounter, tap } from "../engine/verbs";
import { producedElement, xpValue } from "./cardAttrs";
import type { ForceStance } from "./stats";
import { effectiveForce } from "./stats";
import { grantXpEvents } from "./progress";
import { combatKeywords, preventDamage } from "./effects/keywords";
import type { CombatKeywords } from "./effects/keywords";

function cardOf(ctx: RulesCtx, id: InstanceId) {
  const inst = ctx.state.instances[id];
  return inst ? ctx.getCard(inst.cardId) : null;
}

function sideOf(ctx: RulesCtx, id: InstanceId): "recto" | "verso" {
  return ctx.state.instances[id]?.face === "verso" ? "verso" : "recto";
}

function forceOf(ctx: RulesCtx, id: InstanceId, stance?: ForceStance): number {
  return effectiveForce(ctx, id, stance);
}

function keywordsOf(ctx: RulesCtx, id: InstanceId): CombatKeywords {
  return combatKeywords(cardOf(ctx, id), sideOf(ctx, id));
}

/** Élément des Dommages infligés par une carte = son Élément (410.1). */
function damageElementOf(ctx: RulesCtx, id: InstanceId): string {
  const card = cardOf(ctx, id);
  return card ? producedElement(card) : "neutre";
}

function isHero(ctx: RulesCtx, id: InstanceId): boolean {
  const inst = ctx.state.instances[id];
  return !!inst && ctx.state.seats[inst.controller].heroInstanceId === id;
}

function nameOf(ctx: RulesCtx, id: InstanceId): string {
  const inst = ctx.state.instances[id];
  return ctx.getCard(inst?.cardId ?? null)?.name ?? "Carte";
}

export function resolveCombat(ctx: RulesCtx, plan: CombatPlan): CombatResult {
  const atk = plan.attackerSeat;
  const def = otherSeat(atk);
  const events: DraftEvent[] = [];
  const log: string[] = [];
  const destroyed: InstanceId[] = [];

  // dommages accumulés pendant CE combat (en plus des compteurs existants)
  const dmg = new Map<InstanceId, number>();
  const addDmg = (id: InstanceId, n: number) =>
    dmg.set(id, (dmg.get(id) ?? 0) + n);
  // total prévenu par Résistance (pour le journal)
  let prevented = 0;
  /** Inflige `base` Dommages de `source` à `target`, Résistance déduite. */
  function inflict(source: InstanceId, target: InstanceId, base: number): void {
    const eff = preventDamage(
      keywordsOf(ctx, target),
      base,
      damageElementOf(ctx, source),
    );
    prevented += base - eff;
    if (eff > 0) addDmg(target, eff);
  }

  // 703 — les attaquants s'engagent : inclinés à la déclaration
  for (const id of plan.attackers) events.push(tap(atk, id));

  // bloqueurs par attaquant
  const blockersOf = new Map<InstanceId, InstanceId[]>();
  for (const [blocker, attacker] of Object.entries(plan.blocks)) {
    if (!plan.attackers.includes(attacker)) continue;
    const list = blockersOf.get(attacker) ?? [];
    list.push(blocker);
    blockersOf.set(attacker, list);
  }
  // 805.1 — posture du combat : les pouvoirs « Tant qu'il bloque » (Maître
  // Bolet) valent pour les duels ET le seuil de létalité (204.4).
  const stance: ForceStance = {
    blockers: [...blockersOf.values()].flat(),
  };

  // 706 — duels : l'attaquant frappe UN bloqueur (Géant : répartit sa Force
  // entre tous, 6135) ; tous les bloqueurs le frappent simultanément.
  for (const attacker of plan.attackers) {
    const blockers = blockersOf.get(attacker);
    if (!blockers?.length) continue;
    const aForce = forceOf(ctx, attacker, stance);
    const el = damageElementOf(ctx, attacker);
    if (keywordsOf(ctx, attacker).geant && blockers.length > 1) {
      // politique auto : assigner d'abord les parts létales les moins chères
      const needRaw = (b: InstanceId) => {
        const remaining = Math.max(
          0,
          forceOf(ctx, b, stance) -
            (ctx.state.instances[b]?.counters.damage ?? 0),
        );
        return remaining + (keywordsOf(ctx, b).resistances[el] ?? 0);
      };
      let pool = aForce;
      const sorted = [...blockers].sort((x, y) => needRaw(x) - needRaw(y));
      const unkilled: InstanceId[] = [];
      for (const b of sorted) {
        const need = needRaw(b);
        if (need > 0 && need <= pool) {
          inflict(attacker, b, need);
          pool -= need;
        } else {
          unkilled.push(b);
        }
      }
      if (pool > 0 && unkilled.length) inflict(attacker, unkilled[0], pool);
      log.push(`Duel (Géant) : ${nameOf(ctx, attacker)} répartit sa Force.`);
    } else {
      // 6105 : l'attaquant choisit le bloqueur frappé (sinon le premier)
      const chosen = plan.strikes?.[attacker];
      const struck = chosen && blockers.includes(chosen) ? chosen : blockers[0];
      inflict(attacker, struck, aForce);
    }
    for (const b of blockers) inflict(b, attacker, forceOf(ctx, b, stance));
    log.push(
      `Duel : ${nameOf(ctx, attacker)} contre ${blockers
        .map((b) => nameOf(ctx, b))
        .join(" + ")}.`,
    );
  }

  // 707 — attaquants libres → dommages sur la cible, individuellement (6179)
  const freeAttackers = plan.attackers.filter(
    (id) => !blockersOf.get(id)?.length,
  );
  let freeDamage = 0;
  for (const id of freeAttackers) {
    const base = forceOf(ctx, id, stance);
    if (plan.target.kind === "havreSac") {
      freeDamage += base; // la Résistance du Havre-Sac est son compteur (306.3)
    } else {
      const eff = preventDamage(
        keywordsOf(ctx, plan.target.instanceId),
        base,
        damageElementOf(ctx, id),
      );
      prevented += base - eff;
      freeDamage += eff;
    }
  }
  if (freeDamage > 0) {
    if (plan.target.kind === "hero") {
      events.push(incCounter(atk, plan.target.instanceId, "hp", -freeDamage));
      log.push(`${freeDamage} Dommage(s) au Héros adverse.`);
    } else if (plan.target.kind === "havreSac") {
      events.push(
        incCounter(atk, plan.target.instanceId, "resistance", -freeDamage),
      );
      log.push(`${freeDamage} Dommage(s) au Havre-Sac adverse.`);
    } else {
      addDmg(plan.target.instanceId, freeDamage);
      log.push(
        `${freeDamage} Dommage(s) sur ${nameOf(ctx, plan.target.instanceId)}.`,
      );
    }
  }
  if (prevented > 0)
    log.push(`Résistance : ${prevented} Dommage(s) prévenu(s).`);

  // 204.6 / 410.x — application des dommages : Héros → PV, Allié → damage + létalité
  let xpForAtk = 0;
  let xpForDef = 0;
  // PV restants des Héros touchés pendant ce combat (duels + cible)
  const heroHpAfter = new Map<InstanceId, number>();
  for (const [id, n] of dmg) {
    if (n <= 0) continue;
    const inst = ctx.state.instances[id];
    if (!inst) continue;
    if (isHero(ctx, id)) {
      events.push(incCounter(atk, id, "hp", -n));
      heroHpAfter.set(id, (inst.counters.hp ?? 0) - n);
      log.push(`${nameOf(ctx, id)} perd ${n} PV.`);
      continue;
    }
    events.push(incCounter(atk, id, "damage", n));
    const total = (inst.counters.damage ?? 0) + n;
    const force = forceOf(ctx, id, stance);
    if (force > 0 && total >= force) {
      destroyed.push(id);
      events.push(discard(inst.owner, id, inst.location));
      const card = ctx.getCard(inst.cardId);
      const xp = card ? xpValue(card) : 0;
      if (inst.controller === def) xpForAtk += xp;
      else xpForDef += xp;
      log.push(`${nameOf(ctx, id)} est détruit.`);
    }
  }
  if (plan.target.kind === "hero" && freeDamage > 0) {
    const hero = ctx.state.instances[plan.target.instanceId];
    if (hero) {
      const base =
        heroHpAfter.get(plan.target.instanceId) ?? hero.counters.hp ?? 0;
      heroHpAfter.set(plan.target.instanceId, base - freeDamage);
    }
  }

  // 415.1 — XP des Alliés détruits au Héros adverse de leur contrôleur
  let winner: Seat | null = null;
  for (const [seat, amount] of [
    [atk, xpForAtk],
    [def, xpForDef],
  ] as const) {
    const grant = grantXpEvents(ctx, seat, amount);
    events.push(...grant.events);
    log.push(...grant.log.map((l) => `Le Héros de ${seat} ${l}`));
    if (grant.won) winner = seat;
  }

  // 103.2a — tout Héros à 0 PV ou moins fait perdre son contrôleur
  for (const [id, hp] of heroHpAfter) {
    if (hp > 0) continue;
    const loser = ctx.state.instances[id]?.controller;
    if (loser) winner = winner ?? otherSeat(loser);
  }

  return { events, log, destroyed, winner };
}
