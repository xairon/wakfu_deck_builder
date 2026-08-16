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

/**
 * 6135 — Dommages nécessaires pour rendre LÉTAL un bloqueur du point de vue
 * d'un Géant : Force restante (Force effective − Dommages déjà marqués) +
 * Résistance du bloqueur dans l'élément des Dommages de l'attaquant.
 */
function geantNeed(
  ctx: RulesCtx,
  blockerId: InstanceId,
  stance: CombatStance,
  element: string,
): number {
  const remaining = Math.max(
    0,
    forceOf(ctx, blockerId, stance) -
      (ctx.state.instances[blockerId]?.counters.damage ?? 0),
  );
  return (
    remaining + (effectiveKeywords(ctx, blockerId).resistances[element] ?? 0)
  );
}

/**
 * 6135 — la répartition de Force d'un Géant proposée par le joueur est-elle
 * légale ? `null` si oui, sinon une raison en français (affichable). Légal :
 * chaque part vise un de SES bloqueurs (ou la Cible de l'attaque), les parts
 * sont des entiers ≥ 0, leur somme vaut la Force du Géant, et la Cible ne
 * reçoit des Dommages QUE si tous les bloqueurs reçoivent des Dommages létaux
 * (glossaire Géant : « Si tous les Alliés ou Héros qui bloquent … se voient
 * infliger des Dommages létaux, les Dommages restants peuvent être infligés
 * à la Cible de l'attaque »).
 */
export function whyBadGeantAssign(
  ctx: RulesCtx,
  stance: CombatStance,
  attackerId: InstanceId,
  blockers: InstanceId[],
  targetId: InstanceId,
  assign: Record<InstanceId, number>,
): string | null {
  const force = forceOf(ctx, attackerId, stance);
  const el = damageElementOf(ctx, attackerId);
  let sum = 0;
  for (const [id, n] of Object.entries(assign)) {
    if (!Number.isInteger(n) || n < 0)
      return "Chaque part de Dommages doit être un entier positif.";
    if (id !== targetId && !blockers.includes(id))
      return "Un Géant ne répartit sa Force qu'entre SES bloqueurs (et la Cible).";
    sum += n;
  }
  if (sum !== force)
    return `La répartition doit totaliser la Force du Géant (${force}).`;
  if ((assign[targetId] ?? 0) > 0 && !blockers.includes(targetId)) {
    for (const b of blockers) {
      if ((assign[b] ?? 0) < geantNeed(ctx, b, stance, el))
        return "La Cible ne peut recevoir le reliquat que si tous les bloqueurs reçoivent des Dommages létaux.";
    }
  }
  return null;
}

/**
 * 6135 — politique AUTOMATIQUE de répartition d'un Géant (fallback moteur +
 * préremplissage de l'UI) : assigner d'abord les parts létales les moins
 * chères ; le reliquat va sur la Cible si tous les bloqueurs sont létaux,
 * sinon sur le premier bloqueur non tué.
 */
export function autoGeantAssign(
  ctx: RulesCtx,
  stance: CombatStance,
  attackerId: InstanceId,
  blockers: InstanceId[],
  targetId: InstanceId,
): Record<InstanceId, number> {
  const el = damageElementOf(ctx, attackerId);
  const assign: Record<InstanceId, number> = {};
  let pool = forceOf(ctx, attackerId, stance);
  const sorted = [...blockers].sort(
    (x, y) => geantNeed(ctx, x, stance, el) - geantNeed(ctx, y, stance, el),
  );
  const unkilled: InstanceId[] = [];
  for (const b of sorted) {
    const need = geantNeed(ctx, b, stance, el);
    if (need > 0 && need <= pool) {
      assign[b] = need;
      pool -= need;
    } else {
      unkilled.push(b);
    }
  }
  if (pool > 0) {
    if (unkilled.length)
      assign[unkilled[0]] = (assign[unkilled[0]] ?? 0) + pool;
    else assign[targetId] = (assign[targetId] ?? 0) + pool; // 6135 : débordement
  }
  return assign;
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

  // Vivacité : un combattant DÉTRUIT / expulsé du Monde avant la résolution
  // (réaction, effet, Exclusion) ne participe plus. Le journal est immuable
  // (l'instance survit en Défausse) donc on FILTRE ici sur la zone, sinon un
  // cadavre frapperait depuis la Défausse (dégâts + XP fantômes). Miroir de
  // removeFromCombat (ruling W52) : attaquant mort → ses blocages restent
  // orphelins (le bloqueur n'échange aucun coup mais s'incline en 708.3) ;
  // bloqueur mort → son blocage est levé (l'attaquant redevient libre).
  const inPlay = (id: InstanceId): boolean =>
    ctx.state.instances[id]?.location.zone === "monde";
  const liveAttackers = plan.attackers.filter(inPlay);

  // bloqueurs par attaquant
  const blockersOf = new Map<InstanceId, InstanceId[]>();
  for (const [blocker, attacker] of Object.entries(plan.blocks)) {
    if (!liveAttackers.includes(attacker)) continue; // attaquant mort → blocage orphelin
    if (!inPlay(blocker)) continue; // bloqueur mort → blocage levé
    const list = blockersOf.get(attacker) ?? [];
    list.push(blocker);
    blockersOf.set(attacker, list);
  }

  // 706 — duels : l'attaquant frappe UN bloqueur (Géant : répartit sa Force
  // entre tous, 6135) ; tous les bloqueurs le frappent simultanément.
  for (const attacker of liveAttackers) {
    const blockers = blockersOf.get(attacker);
    if (!blockers?.length) continue;
    const aForce = forceOf(ctx, attacker, stance);



    if (effectiveKeywords(ctx, attacker).geant) {
      // 6135 — répartition CHOISIE par l'attaquant (plan.geantAssign) si elle
      // est légale (whyBadGeantAssign) ; sinon politique automatique (fallback
      // moteur : bot, plan absent, ou proposition invalide — jamais bloquant).
      const proposed = plan.geantAssign?.[attacker];
      const assign =
        proposed &&
        whyBadGeantAssign(
          ctx,
          stance,
          attacker,
          blockers,
          plan.target.instanceId,
          proposed,
        ) === null
          ? proposed
          : autoGeantAssign(
              ctx,
              stance,
              attacker,
              blockers,
              plan.target.instanceId,
            );
      for (const [id, n] of Object.entries(assign)) {
        if (n <= 0) continue;
        if (id === plan.target.instanceId && !blockers.includes(id))
          hitTarget(attacker, n); // débordement sur la Cible (tous létaux)
        else inflict(attacker, id, n);
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
  const freeAttackers = liveAttackers.filter(
    (id) => !blockersOf.get(id)?.length,
  );
  for (const id of freeAttackers) hitTarget(id, forceOf(ctx, id, stance));

  // 707.1 — la Cible (Allié/Héros) qui n'a pas frappé en duel riposte sa Force
  // à UN attaquant l'ayant frappée (choix du défenseur via plan.ripostes,
  // sinon le premier). Simultané : la riposte va dans dmg, létalité après.
  if (plan.target.kind !== "havreSac" && targetStrikers.length) {
    const tId = plan.target.instanceId;
    const chosen = plan.ripostes?.[tId];
    const wasChosen = !!chosen && targetStrikers.includes(chosen);
    const struck = wasChosen ? chosen! : targetStrikers[0];
    inflict(tId, struck, forceOf(ctx, tId, stance));
    // 707.1 : la riposte ne peut viser qu'un attaquant AYANT infligé des Dommages
    // à la Cible. Si le choix pointait un attaquant bloqué / absorbé (aucun
    // Dommage passé), on redirige vers un frappeur valide — AVEC un message
    // (sinon la riposte frappait « ailleurs » sans explication).
    if (chosen && !wasChosen)
      log.push(
        `Riposte redirigée : ${nameOf(ctx, chosen)} n'a pas infligé de Dommages (bloqué/absorbé) → ${nameOf(ctx, tId)} frappe ${nameOf(ctx, struck)}.`,
      );
    else
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
      // 804.7 — déclenchés de mort (« Quand détruit », hand-watchers Tofu
      // Céleste). Émis ici pour que la mort EN COMBAT les déclenche comme la
      // destruction par effet/balayage ; collectés par doResolveCombat sur le
      // contexte de destruction (l'instance reste lisible en Défausse).
      ruleEvents.push({
        kind: "destroyed",
        instanceId: id,
        controller: inst.controller,
      });
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
    // Un bloqueur détruit AVANT la résolution (réaction) est déjà en Défausse :
    // 708.3 ne l'incline pas (on n'émet pas de SET_ORIENTATION sur un mort).
    if (
      !inst ||
      inst.location.zone !== "monde" ||
      inst.orientation === "tapped"
    )
      continue;
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
