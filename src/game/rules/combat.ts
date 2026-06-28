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
import { otherSeat } from "../types/zones.ts";
import type {
  CombatPlan,
  CombatResult,
  CombatStance,
  DamageMod,
  RuleEvent,
  RulesCtx,
} from "./types";
import { discard, incCounter } from "../engine/verbs.ts";
import { producedElement, xpValue } from "./cardAttrs.ts";
import { effectiveForce } from "./stats.ts";
import { grantXpEvents } from "./progress.ts";
import { effectiveKeywords } from "./effects/keywords.ts";
import { reduceDamage } from "./effects/damageMods.ts";

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

  // 707/6135 — dégâts portés à la CIBLE (attaquants libres + débordement Géant)
  // et liste des attaquants l'ayant frappée (candidats à la riposte 707.1).
  const targetStrikers: InstanceId[] = [];
  let targetDamageTotal = 0;
  function hitTarget(source: InstanceId, base: number): void {
    const eff = reduceDamage(
      ctx,
      {
        targetId: plan.target.instanceId,
        amount: base,
        element: damageElementOf(ctx, source),
        combat: true,
        sourceId: source,
      },
      mods,
      stance,
    );
    prevented += base - eff;
    if (eff <= 0) return;
    targetStrikers.push(source);
    targetDamageTotal += eff;
    ruleEvents.push({
      kind: "damageDealt",
      source,
      target: plan.target.instanceId,
      amount: eff,
      element: damageElementOf(ctx, source),
      combat: true,
    });
    // Cible Allié : les Dommages passent par la map dmg (létalité unifiée).
    if (plan.target.kind === "ally") addDmg(plan.target.instanceId, eff);
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
    if (effectiveKeywords(ctx, attacker).geant) {
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
      if (pool > 0) {
        if (unkilled.length) inflict(attacker, unkilled[0], pool);
        else hitTarget(attacker, pool); // 6135 : débordement sur la Cible
      }
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

  // 707 — attaquants libres → Dommages sur la cible, individuellement (6179)
  const freeAttackers = plan.attackers.filter(
    (id) => !blockersOf.get(id)?.length,
  );
  for (const id of freeAttackers) hitTarget(id, forceOf(ctx, id, stance));

  // 707.1 — la Cible (Allié/Héros) qui n'a pas frappé en duel riposte sa Force
  // à UN attaquant l'ayant frappée (choix du défenseur via plan.ripostes,
  // sinon le premier). Simultané : la riposte va dans dmg, létalité après.
  if (plan.target.kind !== "havreSac" && targetStrikers.length) {
    const tId = plan.target.instanceId;
    const chosen = plan.ripostes?.[tId];
    const struck =
      chosen && targetStrikers.includes(chosen) ? chosen : targetStrikers[0];
    inflict(tId, struck, forceOf(ctx, tId, stance));
    log.push(`Riposte : ${nameOf(ctx, tId)} frappe ${nameOf(ctx, struck)}.`);
  }

  // Application du total à la Cible Héros (PV) / Havre-Sac (Résistance) ;
  // la Cible Allié est déjà dans dmg (via hitTarget).
  if (targetDamageTotal > 0) {
    if (plan.target.kind === "hero") {
      events.push(
        incCounter(atk, plan.target.instanceId, "hp", -targetDamageTotal),
      );
      log.push(`${targetDamageTotal} Dommage(s) au Héros adverse.`);
    } else if (plan.target.kind === "havreSac") {
      // 306.3 : la Résistance du Havre-Sac est son compteur
      events.push(
        incCounter(
          atk,
          plan.target.instanceId,
          "resistance",
          -targetDamageTotal,
        ),
      );
      log.push(`${targetDamageTotal} Dommage(s) au Havre-Sac adverse.`);
    } else {
      log.push(
        `${targetDamageTotal} Dommage(s) sur ${nameOf(ctx, plan.target.instanceId)}.`,
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
  if (plan.target.kind === "hero" && targetDamageTotal > 0) {
    const hero = ctx.state.instances[plan.target.instanceId];
    if (hero) {
      const base =
        heroHpAfter.get(plan.target.instanceId) ?? hero.counters.hp ?? 0;
      heroHpAfter.set(plan.target.instanceId, base - targetDamageTotal);
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

  // Tacle (pouvoir continu, glossaire) : « jusqu'à la fin du combat, les Alliés
  // ou Héros qui bloquent ou qui sont bloqués par un Allié ou Héros possédant
  // Tacle ne peuvent pas s'incliner ». Verrou RELATIONNEL : un bloqueur est
  // verrouillé s'il bloque un attaquant possédant Tacle (il « bloque » un
  // possesseur de Tacle). Réciproquement, un attaquant bloqué par un bloqueur
  // possédant Tacle est « bloqué par » un possesseur de Tacle — mais les
  // attaquants ne sont PAS inclinés en fin de combat (ils l'ont été à la
  // déclaration, A6) et le combat se termine ici : leur verrou « ne peut pas
  // s'incliner jusqu'à la fin du combat » n'a donc aucune inclinaison à
  // empêcher. La SEULE inclinaison effective en fin de combat est celle des
  // bloqueurs survivants (708.3) : on la supprime pour ceux verrouillés par
  // Tacle. C'est le point d'application FIDÈLE et porteur du mot-clé.
  const tacleLocked = (blocker: InstanceId): boolean => {
    const attacker = plan.blocks[blocker];
    // « bloque un possesseur de Tacle » (l'attaquant bloqué a Tacle)
    if (attacker && effectiveKeywords(ctx, attacker).tacle) return true;
    return false;
  };

  // 708.3 — Fin de Combat : les bloqueurs SURVIVANTS sont inclinés (les
  // attaquants l'ont été à la déclaration, A6). Les détruits sont en défausse.
  for (const blocker of Object.keys(plan.blocks)) {
    if (destroyed.includes(blocker)) continue;
    const inst = ctx.state.instances[blocker];
    if (!inst || inst.orientation === "tapped") continue;
    // Tacle : un bloqueur verrouillé « ne peut pas s'incliner » → on n'émet pas
    // son inclinaison de fin de combat (708.3 cédant au pouvoir continu Tacle).
    if (tacleLocked(blocker)) {
      log.push(
        `${nameOf(ctx, blocker)} ne s'incline pas (Tacle de ${nameOf(ctx, plan.blocks[blocker])}).`,
      );
      continue;
    }
    events.push({
      actor: atk,
      type: "SET_ORIENTATION",
      payload: { instanceId: blocker, orientation: "tapped" },
    });
  }

  return { events, log, destroyed, winner, ruleEvents };
}
