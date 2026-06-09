/**
 * Moteur de règles R1 — résolution de combat (702–708).
 *
 * Calcule duels et dommages en pur, puis émet la rafale de `DraftEvent`
 * correspondante (le store la dispatch telle quelle). Simplifications R1
 * documentées dans la spec : l'attaquant bloqué frappe son premier bloqueur,
 * pas de Réactions, pas de mots-clés.
 */
import type { DraftEvent, InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import type { CombatPlan, CombatResult, RulesCtx } from "./types";
import { discard, incCounter, tap } from "../engine/verbs";
import { forceValue, xpValue } from "./cardAttrs";
import { grantXpEvents } from "./progress";

function forceOf(ctx: RulesCtx, id: InstanceId): number {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!card) return 0;
  return forceValue(card, inst!.face === "verso" ? "verso" : "recto");
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

  // 706 — duels : l'attaquant frappe UN bloqueur (R1 : le premier),
  // tous les bloqueurs frappent l'attaquant simultanément.
  for (const attacker of plan.attackers) {
    const blockers = blockersOf.get(attacker);
    if (!blockers?.length) continue;
    addDmg(blockers[0], forceOf(ctx, attacker));
    for (const b of blockers) addDmg(attacker, forceOf(ctx, b));
    log.push(
      `Duel : ${nameOf(ctx, attacker)} contre ${blockers
        .map((b) => nameOf(ctx, b))
        .join(" + ")}.`,
    );
  }

  // 707 — attaquants libres → dommages sur la cible
  const freeDamage = plan.attackers
    .filter((id) => !blockersOf.get(id)?.length)
    .reduce((n, id) => n + forceOf(ctx, id), 0);
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
    const force = forceOf(ctx, id);
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
