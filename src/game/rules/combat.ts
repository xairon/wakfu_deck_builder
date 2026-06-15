/**
 * Moteur de règles R1+C — résolution de combat (702–708) avec mots-clés.
 *
 * Calcule duels et dommages en pur, puis émet la rafale de `DraftEvent`
 * correspondante (le store la dispatch telle quelle) ET les `RuleEvent`
 * du bus de déclenchement (`damageDealt`, jamais à ≤ 0 — 811.4).
 * Mots-clés automatisés : Résistance (7469) et Géant (6135), lus via
 * `effectiveKeywords` (face de l'instance + jetons, ex. `geantCombatMod`
 * de Bruss verso). TOUTE infliction passe par la passe unique
 * `reduceDamage` (A2 : Résistance → réductions continues → Trêve).
 *
 * A6 — les `tap()` des attaquants ne sont PLUS émis ici : ils partent à la
 * DÉCLARATION (`combatConfirmAttackers` du store, 703), prérequis de
 * l'ordre Bruss (jetons posés avant les frappes).
 * Simplifications restantes : sans Géant l'attaquant frappe son premier
 * bloqueur (sauf choix 6105), pas de Réactions.
 */
import type { DraftEvent, InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import type {
  CombatPlan,
  CombatResult,
  CombatStance,
  DamageMod,
  RuleEvent,
  RulesCtx,
} from "./types";
import { discard, incCounter } from "../engine/verbs";
import { producedElement, xpValue } from "./cardAttrs";
import { effectiveForce } from "./stats";
import { grantXpEvents } from "./progress";
import { effectiveKeywords } from "./effects/keywords";
import { reduceDamage } from "./effects/damageMods";

function cardOf(ctx: RulesCtx, id: InstanceId) {
  const inst = ctx.state.instances[id];
  return inst ? ctx.getCard(inst.cardId) : null;
}

function forceOf(ctx: RulesCtx, id: InstanceId, stance: CombatStance): number {
  return effectiveForce(ctx, id, stance);
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

/** Posture complète du combat, dérivée du plan (rôles de `reduceDamage`). */
export function stanceOfPlan(plan: CombatPlan): CombatStance {
  return {
    attackers: plan.attackers,
    blocks: plan.blocks,
    targetId: plan.target.kind === "havreSac" ? null : plan.target.instanceId,
  };
}

export function resolveCombat(
  ctx: RulesCtx,
  plan: CombatPlan,
  mods: DamageMod[] = [],
): CombatResult {
  const atk = plan.attackerSeat;
  const def = otherSeat(atk);
  const events: DraftEvent[] = [];
  const log: string[] = [];
  const destroyed: InstanceId[] = [];
  const ruleEvents: RuleEvent[] = [];

  // 805.1 / 702 — posture du combat : sert aux pouvoirs « Tant qu'il
  // bloque » (Maître Bolet) ET aux rôles de la passe de Dommages (Poum).
  const stance = stanceOfPlan(plan);

  // dommages accumulés pendant CE combat (en plus des compteurs existants)
  const dmg = new Map<InstanceId, number>();
  const addDmg = (id: InstanceId, n: number) =>
    dmg.set(id, (dmg.get(id) ?? 0) + n);
  // total prévenu (Résistance, Poum, Trêve…) pour le journal
  let prevented = 0;
  /** Inflige `base` Dommages de `source` à `target` via la passe unique. */
  function inflict(source: InstanceId, target: InstanceId, base: number): void {
    const eff = reduceDamage(
      ctx,
      {
        targetId: target,
        amount: base,
        element: damageElementOf(ctx, source),
        combat: true,
        sourceId: source,
      },
      mods,
      stance,
    );
    prevented += base - eff;
    if (eff <= 0) return; // 811.4 : pas de Dommages → pas d'événement
    addDmg(target, eff);
    ruleEvents.push({
      kind: "damageDealt",
      source,
      target,
      amount: eff,
      element: damageElementOf(ctx, source),
      combat: true,
    });
  }

  // bloqueurs par attaquant
  const blockersOf = new Map<InstanceId, InstanceId[]>();
  for (const [blocker, attacker] of Object.entries(plan.blocks)) {
    if (!plan.attackers.includes(attacker)) continue;
    const list = blockersOf.get(attacker) ?? [];
    list.push(blocker);
    blockersOf.set(attacker, list);
  }

  // 706 — duels : l'attaquant frappe UN bloqueur (Géant : répartit sa Force
  // entre tous, 6135) ; tous les bloqueurs le frappent simultanément.
  for (const attacker of plan.attackers) {
    const blockers = blockersOf.get(attacker);
    if (!blockers?.length) continue;
    const aForce = forceOf(ctx, attacker, stance);
    const el = damageElementOf(ctx, attacker);
    if (effectiveKeywords(ctx, attacker).geant && blockers.length > 1) {
      // politique auto : assigner d'abord les parts létales les moins chères
      const needRaw = (b: InstanceId) => {
        const remaining = Math.max(
          0,
          forceOf(ctx, b, stance) -
            (ctx.state.instances[b]?.counters.damage ?? 0),
        );
        return remaining + (effectiveKeywords(ctx, b).resistances[el] ?? 0);
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
    const eff = reduceDamage(
      ctx,
      {
        targetId: plan.target.instanceId,
        amount: base,
        element: damageElementOf(ctx, id),
        combat: true,
        sourceId: id,
      },
      mods,
      stance,
    );
    prevented += base - eff;
    if (eff <= 0) continue;
    freeDamage += eff;
    ruleEvents.push({
      kind: "damageDealt",
      source: id,
      target: plan.target.instanceId,
      amount: eff,
      element: damageElementOf(ctx, id),
      combat: true,
    });
  }
  if (freeDamage > 0) {
    if (plan.target.kind === "hero") {
      events.push(incCounter(atk, plan.target.instanceId, "hp", -freeDamage));
      log.push(`${freeDamage} Dommage(s) au Héros adverse.`);
    } else if (plan.target.kind === "havreSac") {
      // 306.3 : la Résistance du Havre-Sac est son compteur
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
    log.push(`Prévention : ${prevented} Dommage(s) prévenu(s).`);

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

  return { events, log, destroyed, winner, ruleEvents };
}
